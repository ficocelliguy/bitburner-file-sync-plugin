import * as path from 'path';
import * as vscode from 'vscode';
import { minimatch } from 'minimatch';
import type { BitburnerApi } from '../api/BitburnerApi';
import type { Configuration } from '../config/Configuration';
import { PathMapper, validateRemotePath } from './PathMapper';

// Paths that are never appropriate to push to Bitburner, regardless of user
// config. Kept here (not in the user-overridable `bitburnerSync.exclude`)
// because VS Code's settings UI replaces the whole array on edit — surfacing
// these as defaults would let a single typo accidentally start syncing
// .vscode/settings.json or node_modules contents.
const ALWAYS_EXCLUDE = [
    '**/NetscriptDefinitions.d.ts',
    '.git/**',
    '.gitignore',
    '.vscode/**',
    'node_modules/**',
];

// Hard cap on the size of any single file synced to Bitburner. The Remote
// API will technically accept larger payloads, but a 1 MB script almost
// certainly indicates a build artifact, accidentally-committed binary, or
// runaway log being saved into the sync directory — none of which the user
// wants to round-trip through the game. Applied symmetrically to downloads
// so a hostile/buggy server can't OOM the extension host.
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

// Separate, more generous cap for NetscriptDefinitions.d.ts — it's a single,
// known artifact from the game itself rather than user content, and TypeScript
// declaration files for large APIs can legitimately run into the multi-MB range.
const MAX_DEFINITIONS_SIZE_BYTES = 8 * 1024 * 1024;

// Hard ceiling on how many filenames a single downloadAll() will accept from
// the server. Real Bitburner saves are dozens to low-hundreds of scripts; a
// listing in the thousands almost certainly means a corrupt save, a buggy
// server, or a hostile peer trying to weaponize the unbounded sequential
// getFile loop. Refuse the whole operation rather than start chewing through
// it — the user can re-issue with a narrower fileExtensions filter, or look
// at the output channel to see why the listing is unreasonable.
const MAX_DOWNLOAD_FILE_COUNT = 5000;

interface DownloadPlanEntry {
    remote: string;
    destUri: vscode.Uri;
    existing: boolean;
}

export class SyncEngine {
    private readonly pathMapper: PathMapper;
    private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly outputChannel: vscode.OutputChannel;

    constructor(
        private readonly api: BitburnerApi,
        private readonly config: Configuration,
        outputChannel: vscode.OutputChannel
    ) {
        this.pathMapper = new PathMapper(config);
        this.outputChannel = outputChannel;
    }

    async pushFile(uri: vscode.Uri): Promise<void> {
        // Honor the documented "sync nothing" opt-out — fileExtensions: []
        // means the user explicitly disabled syncing. FileWatcher.start and
        // syncAll already respect this; the explicit `Bitburner: Sync Current
        // File` command must too.
        if (this.config.fileExtensions.length === 0) {
            vscode.window.showWarningMessage(
                'bitburnerSync.fileExtensions is set to []. Nothing will be synced. Remove the setting to fall back to the defaults.'
            );
            return;
        }
        if (this.isExcluded(uri)) {
            this.log(`Excluded from sync: ${uri.fsPath}`);
            return;
        }
        // Size check before reading: a stat is cheap; pulling a 100 MB file
        // into a string just to refuse it is not. If stat fails we fall
        // through and let the readFile below produce the real error.
        let size = -1;
        try {
            size = (await vscode.workspace.fs.stat(uri)).size;
        } catch {
            // ignore — readFile will surface the underlying problem
        }
        if (size > MAX_FILE_SIZE_BYTES) {
            throw new Error(
                `File exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} sync limit: ${uri.fsPath} (${formatBytes(size)})`
            );
        }
        const remotePath = this.pathMapper.mapToRemote(uri);
        const bytes = await vscode.workspace.fs.readFile(uri);
        // Re-check post-read. The stat() above can race with a writer growing
        // the file: stat reports 100 bytes, the file balloons to 50 MB before
        // readFile latches, and the original cap check would have let it
        // through. The buffer is already allocated, so this can't prevent the
        // read — but it stops the oversize content from being pushed and
        // gives a clear per-file error.
        if (bytes.byteLength > MAX_FILE_SIZE_BYTES) {
            throw new Error(
                `File exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} sync limit: ${uri.fsPath} (${formatBytes(bytes.byteLength)})`
            );
        }
        const content = Buffer.from(bytes).toString('utf8');
        await this.api.pushFile(remotePath, content, this.config.targetServer);
        this.log(`Pushed: ${remotePath}`);
        if (this.config.showNotifications) {
            vscode.window.showInformationMessage(`Synced: ${remotePath}`);
        }
    }

    async syncAll(): Promise<void> {
        if (this.config.fileExtensions.length === 0) {
            vscode.window.showWarningMessage(
                'bitburnerSync.fileExtensions is set to []. Nothing will be synced. Remove the setting to fall back to the defaults.'
            );
            return;
        }
        // Scope to the primary workspace folder via RelativePattern. A plain
        // string glob would search every folder in a multi-root workspace,
        // contradicting the primary-folder-only model the activation warning
        // promises and pushing files we can't round-trip on download.
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            vscode.window.showWarningMessage('No workspace folder open.');
            return;
        }
        const includePattern = new vscode.RelativePattern(primary, this.config.fileGlob);
        const excludeGlob = this.findFilesExcludeGlob();
        const excludePattern = excludeGlob ? new vscode.RelativePattern(primary, excludeGlob) : null;
        const files = await vscode.workspace.findFiles(includePattern, excludePattern);

        if (files.length === 0) {
            vscode.window.showWarningMessage('No matching files found to sync.');
            return;
        }

        let pushed = 0;
        let failed = 0;
        let excluded = 0;

        for (const file of files) {
            // Defense-in-depth: findFiles already excluded these, but the
            // matcher VS Code uses may not be byte-equivalent to ours.
            if (this.isExcluded(file)) {
                excluded++;
                this.log(`Excluded from sync: ${file.fsPath}`);
                continue;
            }
            try {
                await this.pushFile(file);
                pushed++;
            } catch (err) {
                failed++;
                this.log(`Failed to push ${file.fsPath}: ${err}`);
            }
        }

        const excludedSummary = excluded > 0 ? `, ${excluded} excluded` : '';
        const msg = `Sync complete: ${pushed} pushed, ${failed} failed${excludedSummary}`;
        this.log(msg);
        if (this.config.showNotifications) {
            vscode.window.showInformationMessage(msg);
        }
    }

    handleFileChange(uri: vscode.Uri): void {
        if (!this.config.autoSync) {
            return;
        }
        // Silently drop excluded files — logging on every save of an
        // ignored file would flood the output channel.
        if (this.isExcluded(uri)) {
            return;
        }

        const key = uri.toString();
        const existing = this.debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(async () => {
            this.debounceTimers.delete(key);
            // Defensive: the file may have been deleted by an external
            // process (terminal, another editor) during the 300 ms debounce
            // window. The delete event from the file-system watcher would
            // normally cancel this timer, but external deletes don't always
            // round-trip back to us. Skip with a clear log line instead of
            // logging a generic auto-sync failure.
            if (!(await this.fileExists(uri))) {
                this.log(`Auto-sync skipped (file no longer exists): ${uri.fsPath}`);
                return;
            }
            try {
                await this.pushFile(uri);
            } catch (err) {
                this.log(`Auto-sync failed for ${uri.fsPath}: ${err}`);
            }
        }, 300);

        this.debounceTimers.set(key, timer);
    }

    async downloadAll(): Promise<void> {
        // Honor the documented "sync nothing" opt-out symmetrically: with no
        // allowed extensions, the whole listing → filter → fetch loop is dead
        // weight. Bail before the getFileNames RPC so the user gets the same
        // explicit warning push paths produce.
        if (this.config.fileExtensions.length === 0) {
            vscode.window.showWarningMessage(
                'bitburnerSync.fileExtensions is set to []. Nothing will be downloaded. Remove the setting to fall back to the defaults.'
            );
            return;
        }
        const planResult = await this.buildDownloadPlan();
        if (planResult === null) {
            return;
        }
        const { entries, skipped } = planResult;

        // Always pull new unique files; only the would-overwrite set gets a
        // confirmation prompt. If the user declines, the new files are still
        // downloaded — the prompt is about clobbering local work, not about
        // bailing on the whole operation. The download iterates `entries`
        // in the order the server returned them, so a partial download
        // (existing-skipped) doesn't reshuffle the user's project.
        let includeExisting = true;
        const existingRemotes = entries.filter(e => e.existing).map(e => e.remote);
        if (existingRemotes.length > 0) {
            includeExisting = await this.confirmOverwrite(existingRemotes);
            if (!includeExisting) {
                this.log(`Overwrite declined: ${existingRemotes.length} existing local file${existingRemotes.length === 1 ? '' : 's'} kept; new files will still be downloaded`);
            }
        }
        const toDownload = entries.filter(e => includeExisting || !e.existing);

        if (toDownload.length === 0 && skipped === 0) {
            vscode.window.showWarningMessage('Nothing to download.');
            return;
        }

        let downloaded = 0;
        let failed = 0;

        for (const { remote, destUri } of toDownload) {
            try {
                const content = await this.api.getFile(remote, this.config.targetServer);
                // Mirror the upload-side MAX_FILE_SIZE_BYTES cap. The string
                // is already in memory by the time we get here, so this can't
                // prevent the allocation — but it stops a hostile/buggy
                // server from clobbering the user's disk with a massive
                // file, and surfaces a clear per-file error in the summary.
                const byteLen = Buffer.byteLength(content, 'utf8');
                if (byteLen > MAX_FILE_SIZE_BYTES) {
                    throw new Error(
                        `File exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} sync limit (${formatBytes(byteLen)})`
                    );
                }
                await vscode.workspace.fs.writeFile(destUri, Buffer.from(content));
                downloaded++;
                this.log(`Downloaded: ${remote}`);
            } catch (err) {
                failed++;
                this.log(`Failed to download ${remote}: ${err}`);
            }
        }

        const summarySkipped = skipped > 0 ? `, ${skipped} skipped` : '';
        const msg = `Download complete: ${downloaded} downloaded, ${failed} failed${summarySkipped}`;
        this.log(msg);
        if (this.config.showNotifications) {
            vscode.window.showInformationMessage(msg);
        }
    }

    // Returns the count of remote files that don't yet exist locally, after
    // the same path/extension filtering downloadAll() applies. Used by the
    // first-connect prompt in extension.ts to decide whether to ask the user
    // about pulling files down.
    async countNewRemoteFiles(): Promise<number> {
        if (this.config.fileExtensions.length === 0) {
            return 0;
        }
        const planResult = await this.buildDownloadPlan({ silent: true });
        if (planResult === null) {
            return 0;
        }
        return planResult.entries.filter(e => !e.existing).length;
    }

    // Returns the count of local syncable files whose remote-equivalent path
    // is not present on the server. Mirrors syncAll() filtering (extensions,
    // syncDirectory, excludes) so the count reflects what a syncAll would
    // actually push. Used by the first-connect prompt in extension.ts to
    // decide whether to offer an upload when nothing needs downloading.
    async countNewLocalFiles(): Promise<number> {
        if (this.config.fileExtensions.length === 0) {
            return 0;
        }
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            return 0;
        }

        const remoteNames = await this.api.getFileNames(this.config.targetServer);
        // Same hostile/buggy-listing guard as downloadAll. If the server is
        // returning nonsense we can't trust the set-difference, so report 0
        // and let the user discover the issue via an explicit downloadAll.
        if (remoteNames.length > MAX_DOWNLOAD_FILE_COUNT) {
            return 0;
        }
        const remoteSet = new Set(remoteNames.map(canonicalizeRemotePath));

        const includePattern = new vscode.RelativePattern(primary, this.config.fileGlob);
        const excludeGlob = this.findFilesExcludeGlob();
        const excludePattern = excludeGlob ? new vscode.RelativePattern(primary, excludeGlob) : null;
        const files = await vscode.workspace.findFiles(includePattern, excludePattern);

        let count = 0;
        for (const file of files) {
            if (this.isExcluded(file)) {
                continue;
            }
            let remotePath: string;
            try {
                remotePath = this.pathMapper.mapToRemote(file);
            } catch {
                // Outside syncDirectory or otherwise not mappable — wouldn't
                // be pushed by syncAll either, so don't count it.
                continue;
            }
            if (!remoteSet.has(canonicalizeRemotePath(remotePath))) {
                count++;
            }
        }
        return count;
    }

    // Listing + per-name validation + new/existing partition. Shared by
    // downloadAll() and countNewRemoteFiles() so the two stay in sync on
    // what counts as a downloadable file. Returns null when the caller
    // should abort entirely (no workspace, empty listing, server returned
    // an unreasonable count). When `silent` is true the caller is asking
    // a question, not running the download — suppress user-facing warnings
    // and per-skip log spam.
    private async buildDownloadPlan(
        opts: { silent?: boolean } = {}
    ): Promise<{
        entries: DownloadPlanEntry[];
        skipped: number;
    } | null> {
        const silent = !!opts.silent;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            if (silent) {
                return null;
            }
            throw new Error('No workspace folder open');
        }

        const rootUri = workspaceFolders[0].uri;
        const syncDir = this.config.syncDirectory;
        const destBaseUri = syncDir ? vscode.Uri.joinPath(rootUri, syncDir) : rootUri;
        const fileNames = await this.api.getFileNames(this.config.targetServer);

        if (fileNames.length === 0) {
            if (!silent) {
                vscode.window.showWarningMessage('No files found on Bitburner server.');
            }
            return null;
        }
        if (fileNames.length > MAX_DOWNLOAD_FILE_COUNT) {
            if (!silent) {
                const msg = `Refusing to download: server returned ${fileNames.length} filenames (limit is ${MAX_DOWNLOAD_FILE_COUNT}). This usually indicates a corrupt save or a buggy server. Narrow bitburnerSync.fileExtensions or contact the server admin.`;
                this.log(msg);
                vscode.window.showErrorMessage(msg);
            }
            return null;
        }

        const allowedExts = this.config.fileExtensions;
        const entries: DownloadPlanEntry[] = [];
        let skipped = 0;
        for (const filename of fileNames) {
            try {
                validateRemotePath(filename);
            } catch (err) {
                skipped++;
                if (!silent) {
                    this.log(`Skipped (invalid name from server): ${JSON.stringify(filename)} — ${err instanceof Error ? err.message : err}`);
                }
                continue;
            }
            if (!matchesAllowedExtension(filename, allowedExts)) {
                skipped++;
                if (!silent) {
                    this.log(`Skipped (extension not in bitburnerSync.fileExtensions): ${filename}`);
                }
                continue;
            }
            const relativePath = filename.startsWith('/') ? filename.slice(1) : filename;
            const destUri = vscode.Uri.joinPath(destBaseUri, relativePath);
            entries.push({
                remote: filename,
                destUri,
                existing: await this.fileExists(destUri),
            });
        }
        return { entries, skipped };
    }

    private async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    private allExcludePatterns(): string[] {
        return [...ALWAYS_EXCLUDE, ...this.config.exclude];
    }

    private isExcluded(uri: vscode.Uri): boolean {
        // Anchor on the primary workspace folder so a file in folder #2 of a
        // multi-root workspace doesn't sneak past the exclude check just
        // because its own folder matches. PathMapper will throw on it next,
        // surfacing a clear "not in primary workspace folder" error.
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            return false;
        }
        const rel = path.relative(primary.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
            return false;
        }
        // Use minimatch so this matcher and VS Code's findFiles share
        // compatible glob semantics (brace expansion, dotfile matching with
        // `dot: true`, character classes). Previously a home-grown regex
        // here silently diverged from VS Code's matcher used by syncAll.
        return this.allExcludePatterns().some(p => minimatch(rel, p, { dot: true }));
    }

    private findFilesExcludeGlob(): string | null {
        const patterns = this.allExcludePatterns();
        if (patterns.length === 0) {
            return null;
        }
        if (patterns.length === 1) {
            return patterns[0];
        }
        return `{${patterns.join(',')}}`;
    }

    private async confirmOverwrite(filenames: string[]): Promise<boolean> {
        const MAX_LIST = 20;
        const shown = filenames.slice(0, MAX_LIST);
        const remainder = filenames.length - shown.length;
        const list = shown.join('\n');
        const more = remainder > 0 ? `\n…and ${remainder} more` : '';
        const count = filenames.length;
        const noun = count === 1 ? 'file' : 'files';
        const choice = await vscode.window.showWarningMessage(
            `Overwrite ${count} local ${noun}?`,
            {
                modal: true,
                detail: `Downloading from Bitburner will replace the following ${noun}:\n\n${list}${more}\n\nNew files (not yet present locally) will be downloaded either way.`,
            },
            'Overwrite'
        );
        return choice === 'Overwrite';
    }

    async downloadDefinitions(): Promise<void> {
        const content = await this.api.getDefinitionFile();
        // The real NetscriptDefinitions.d.ts is well under 1 MB today, but
        // give it headroom for future growth — the cap exists to bound a
        // hostile/buggy server, not to second-guess the game.
        const byteLen = Buffer.byteLength(content, 'utf8');
        if (byteLen > MAX_DEFINITIONS_SIZE_BYTES) {
            throw new Error(
                `NetscriptDefinitions.d.ts exceeds the ${formatBytes(MAX_DEFINITIONS_SIZE_BYTES)} sanity limit (${formatBytes(byteLen)})`
            );
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder open');
        }

        const rootUri = workspaceFolders[0].uri;
        const destUri = vscode.Uri.joinPath(rootUri, 'NetscriptDefinitions.d.ts');
        await vscode.workspace.fs.writeFile(destUri, Buffer.from(content));
        this.log('Downloaded NetscriptDefinitions.d.ts');
        vscode.window.showInformationMessage('Downloaded NetscriptDefinitions.d.ts to workspace root.');

        await this.ensureTsConfig(rootUri);
    }

    private async ensureTsConfig(rootUri: vscode.Uri): Promise<void> {
        const tsconfigUri = vscode.Uri.joinPath(rootUri, 'tsconfig.json');
        const defsEntry = 'NetscriptDefinitions.d.ts';

        let raw: string | undefined;
        try {
            const bytes = await vscode.workspace.fs.readFile(tsconfigUri);
            raw = Buffer.from(bytes).toString('utf8');
        } catch {
            // File doesn't exist — safe to create a fresh template.
            const tsconfig = {
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ES2022',
                    moduleResolution: 'node',
                    allowJs: true,
                    checkJs: true,
                    noEmit: true,
                },
                include: ['**/*'],
                files: [defsEntry],
            };
            await vscode.workspace.fs.writeFile(tsconfigUri, Buffer.from(JSON.stringify(tsconfig, null, 2) + '\n'));
            this.log('Created tsconfig.json');
            return;
        }

        // Try strict JSON first — only then is it safe to re-serialize.
        let strictParsed: Record<string, unknown> | undefined;
        try {
            strictParsed = JSON.parse(raw);
        } catch {
            // not strict JSON; may still be valid JSONC
        }

        if (strictParsed) {
            let files = strictParsed['files'] as string[] | undefined;
            if (!Array.isArray(files)) {
                files = [defsEntry];
                strictParsed['files'] = files;
            } else if (!files.includes(defsEntry)) {
                files.push(defsEntry);
            } else {
                return; // already has it
            }
            await vscode.workspace.fs.writeFile(tsconfigUri, Buffer.from(JSON.stringify(strictParsed, null, 2) + '\n'));
            this.log('Updated tsconfig.json with NetscriptDefinitions.d.ts');
            return;
        }

        // Not strict JSON. Try to parse as JSONC (comments / trailing commas) for
        // *detection only* — we won't rewrite it, since re-serializing would drop
        // the user's comments and formatting.
        let jsoncParsed: Record<string, unknown> | undefined;
        try {
            jsoncParsed = JSON.parse(stripJsonComments(raw));
        } catch {
            // unparseable
        }

        if (jsoncParsed) {
            const files = jsoncParsed['files'];
            if (Array.isArray(files) && files.includes(defsEntry)) {
                return; // already wired up
            }
        }

        // Either JSONC-without-the-entry or unparseable. Don't risk corrupting
        // the file; tell the user what to add.
        await this.warnManualTsConfigSetup(tsconfigUri, defsEntry, jsoncParsed === undefined);
    }

    private async warnManualTsConfigSetup(
        tsconfigUri: vscode.Uri,
        defsEntry: string,
        unparseable: boolean
    ): Promise<void> {
        const reason = unparseable
            ? 'tsconfig.json could not be parsed'
            : 'tsconfig.json appears to contain comments or trailing commas (JSONC), which the extension will not rewrite';
        const message = `${reason}. Add "${defsEntry}" to the "files" array manually to enable type hints.`;
        this.log(`WARN: ${message}`);
        this.log('Suggested tsconfig.json entry:');
        this.log(`    "files": ["${defsEntry}"]`);
        this.log('See the Troubleshooting section of the README for a full example.');

        const open = 'Open tsconfig.json';
        const show = 'Show Instructions';
        const choice = await vscode.window.showWarningMessage(message, open, show);
        if (choice === open) {
            await vscode.commands.executeCommand('vscode.open', tsconfigUri);
        } else if (choice === show) {
            this.outputChannel.show();
        }
    }

    dispose(): void {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }

    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}

// Renders a byte count for humans. Negative inputs (used as a "size
// unknown" sentinel) render as "unknown size" so the error message is still
// readable.
function formatBytes(bytes: number): string {
    if (bytes < 0) {
        return 'unknown size';
    }
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Normalize a remote (Bitburner-side) path to a single canonical form so
// set-membership checks across the two ingestion paths agree. PathMapper
// always emits a leading slash; the server's getFileNames listing sometimes
// does and sometimes doesn't.
function canonicalizeRemotePath(p: string): string {
    return p.startsWith('/') ? p : '/' + p;
}

// Returns true if `filename`'s extension (case-insensitive) is in the
// `allowed` list. The list is expected to be normalized by Configuration:
// lowercase, each with a single leading dot.
function matchesAllowedExtension(filename: string, allowed: string[]): boolean {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot < 0) {
        return false;
    }
    return allowed.includes(filename.slice(lastDot).toLowerCase());
}

// Removes // line comments, /* block */ comments, and trailing commas so a
// JSONC document can be fed to JSON.parse. Strings (including escaped quotes)
// are preserved verbatim. Used only to detect existing config — never to
// rewrite a user's file.
//
// Trailing-comma handling is done inside the same string-aware scan rather
// than via a final regex pass — a string containing `,}` content (e.g.
// `"comment": "ends with ,}"`) used to get mangled by an unconditional
// `,(\s*[}\]])` sweep over the post-strip text.
function stripJsonComments(text: string): string {
    let out = '';
    let i = 0;
    let inString = false;
    let stringChar = '';
    while (i < text.length) {
        const c = text[i];
        const next = i + 1 < text.length ? text[i + 1] : '';
        if (inString) {
            if (c === '\\' && i + 1 < text.length) {
                out += c + next;
                i += 2;
                continue;
            }
            if (c === stringChar) {
                inString = false;
            }
            out += c;
            i++;
        } else if (c === '"' || c === '\'') {
            inString = true;
            stringChar = c;
            out += c;
            i++;
        } else if (c === '/' && next === '/') {
            while (i < text.length && text[i] !== '\n') {
                i++;
            }
        } else if (c === '/' && next === '*') {
            i += 2;
            while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                i++;
            }
            i += 2;
        } else if (c === ',') {
            // Look ahead past whitespace for `}` or `]`. If found, drop this
            // comma — it's a trailing comma. We only consume whitespace, not
            // comments: a `,` followed by `// foo` before `}` is unusual
            // enough that we'd rather leave it for JSON.parse to reject than
            // try to chase comments while still inside the comma rule.
            let j = i + 1;
            while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\n' || text[j] === '\r')) {
                j++;
            }
            if (j < text.length && (text[j] === '}' || text[j] === ']')) {
                i++; // skip the comma; whitespace will be emitted on subsequent iterations
            } else {
                out += c;
                i++;
            }
        } else {
            out += c;
            i++;
        }
    }
    return out;
}
