"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncEngine = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const minimatch_1 = require("minimatch");
const PathMapper_1 = require("./PathMapper");
const BundledReactTypes_1 = require("./BundledReactTypes");
// Paths that are never appropriate to push to Bitburner, regardless of user
// config. Kept here (not in the user-overridable `bitburnerSync.exclude`)
// because VS Code's settings UI replaces the whole array on edit — surfacing
// these as defaults would let a single typo accidentally start syncing
// .vscode/settings.json or node_modules contents.
const ALWAYS_EXCLUDE = [
    '**/NetscriptDefinitions.d.ts',
    '**/NetscriptGlobals.d.ts',
    '.git/**',
    '.gitignore',
    '.vscode/**',
    'node_modules/**',
    'tsconfig.json',
    'package.json',
    'package-lock.json',
];
// Files the extension writes into the workspace root to wire up editor
// type hints. NetscriptDefinitions.d.ts is downloaded verbatim from the
// game; NetscriptGlobals.d.ts is generated from it (see writeGlobalsShim)
// and re-exports the top-level Netscript types into the global scope so
// scripts can use `NS` without importing.
const DEFINITIONS_FILE = 'NetscriptDefinitions.d.ts';
const GLOBALS_FILE = 'NetscriptGlobals.d.ts';
// Path alias used by the bitburner-official typescript template
// (`import { NS } from '@ns'`). We mirror that mapping in tsconfig so
// existing scripts that follow the convention keep resolving.
const NS_PATH_ALIAS = '@ns';
// Hard cap on the size of any single file synced to Bitburner.
const MAX_FILE_SIZE_BYTES = 1024 * 1024;
// More generous cap for NetscriptDefinitions.d.ts
const MAX_DEFINITIONS_SIZE_BYTES = 8 * 1024 * 1024;
// Hard ceiling on how many filenames a single downloadAll() will accept from
// the server.
const MAX_DOWNLOAD_FILE_COUNT = 5000;
// In-game folder where deleted files are stashed instead of hard-deleted.
const TRASHBIN_PREFIX = '/trashbin';
class SyncEngine {
    api;
    config;
    memento;
    pathMapper;
    debounceTimers = new Map();
    outputChannel;
    // Listeners fired after a successful pushFile. The tracker uses this to
    // know when to ask Bitburner for the file's RAM cost — asking on save
    // alone would race the debounced push and return the pre-save number.
    pushListeners = [];
    constructor(api, config, outputChannel, memento) {
        this.api = api;
        this.config = config;
        this.memento = memento;
        this.pathMapper = new PathMapper_1.PathMapper(config);
        this.outputChannel = outputChannel;
    }
    async pushFile(uri) {
        // Honor the documented "sync nothing" opt-out — fileExtensions: []
        // means the user explicitly disabled syncing. FileWatcher.start and
        // syncAll already respect this; the explicit `Bitburner: Sync Current
        // File` command must too.
        if (this.config.fileExtensions.length === 0) {
            vscode.window.showWarningMessage('bitburnerSync.fileExtensions is set to []. Nothing will be synced. Remove the setting to fall back to the defaults.');
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
        }
        catch {
            // ignore — readFile will surface the underlying problem
        }
        if (size > MAX_FILE_SIZE_BYTES) {
            throw new Error(`File exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} sync limit: ${uri.fsPath} (${formatBytes(size)})`);
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
            throw new Error(`File exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} sync limit: ${uri.fsPath} (${formatBytes(bytes.byteLength)})`);
        }
        const content = Buffer.from(bytes).toString('utf8');
        await this.api.pushFile(remotePath, content, this.config.targetServer);
        this.log(`Pushed: ${remotePath}`);
        if (this.config.showNotifications) {
            vscode.window.showInformationMessage(`Synced: ${remotePath}`);
        }
        this.emitPushed(remotePath);
    }
    // Register a listener called with the remote path after each successful
    // pushFile (manual command, auto-sync save, rename-push, etc.). Returns
    // a Disposable so callers can unsubscribe on dispose.
    onDidPush(listener) {
        this.pushListeners.push(listener);
        return {
            dispose: () => {
                const i = this.pushListeners.indexOf(listener);
                if (i >= 0) {
                    this.pushListeners.splice(i, 1);
                }
            }
        };
    }
    emitPushed(remote) {
        for (const listener of this.pushListeners) {
            try {
                listener(remote);
            }
            catch (err) {
                this.log(`onDidPush listener threw: ${err instanceof Error ? err.message : err}`);
            }
        }
    }
    async syncAll() {
        if (this.config.fileExtensions.length === 0) {
            vscode.window.showWarningMessage('bitburnerSync.fileExtensions is set to []. Nothing will be synced. Remove the setting to fall back to the defaults.');
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
            }
            catch (err) {
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
    handleFileChange(uri) {
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
            }
            catch (err) {
                this.log(`Auto-sync failed for ${uri.fsPath}: ${err}`);
            }
        }, 300);
        this.debounceTimers.set(key, timer);
    }
    // Push-style counterpart to deleteFile: removes the file from the remote.
    // Used by handleFileRename (the "old" side of a user-initiated VS Code
    // rename/move) — renames are relocations, not destructive actions, so
    // the moved file lives at the new path and the old path goes away. Plain
    // VS Code deletes go through moveToTrashbin() instead, which is non-
    // destructive and reversible. Mirrors pushFile's guard rails —
    // fileExtensions opt-out, exclude rules, syncDirectory mapping — so a
    // file we'd never push can never trigger a remote delete either. The
    // matching extension check is intentional: a `.gitignore` deletion at the
    // root must not turn into a `deleteFile("/.gitignore")` call.
    async deleteRemoteFile(uri) {
        if (this.config.fileExtensions.length === 0) {
            return;
        }
        if (this.isExcluded(uri)) {
            this.log(`Excluded from delete-sync: ${uri.fsPath}`);
            return;
        }
        if (!this.matchesAllowedExtension(uri)) {
            return;
        }
        const remotePath = this.pathMapper.mapToRemote(uri);
        await this.api.deleteFile(remotePath, this.config.targetServer);
        this.log(`Deleted: ${remotePath}`);
        if (this.config.showNotifications) {
            vscode.window.showInformationMessage(`Deleted: ${remotePath}`);
        }
    }
    // Non-destructive counterpart to deleteRemoteFile: instead of dropping
    // the in-game file, copy its content to `/trashbin/<original-path>` and
    // then remove the original. The trashbin is a safety net — accidental
    // VS Code deletes (an errant rm in a script, an unfortunate undo, etc.)
    // are recoverable from inside Bitburner by inspecting `/trashbin/`.
    //
    // Three RPCs (getFile → pushFile → deleteFile) per move; renames don't
    // use this path because they're already a "the file moved" operation,
    // not a "the file is gone" one.
    async moveToTrashbin(uri) {
        if (this.config.fileExtensions.length === 0) {
            return;
        }
        if (this.isExcluded(uri)) {
            this.log(`Excluded from trashbin-move: ${uri.fsPath}`);
            return;
        }
        if (!this.matchesAllowedExtension(uri)) {
            return;
        }
        const remotePath = this.pathMapper.mapToRemote(uri);
        const server = this.config.targetServer;
        // Files that already live under /trashbin/ shouldn't nest deeper —
        // a user emptying the trashbin from VS Code expects those files to
        // actually go away. Hard-delete instead.
        if (isInTrashbin(remotePath)) {
            await this.api.deleteFile(remotePath, server);
            this.log(`Deleted from trashbin: ${remotePath}`);
            if (this.config.showNotifications) {
                vscode.window.showInformationMessage(`Deleted from trashbin: ${remotePath}`);
            }
            return;
        }
        const trashbinPath = TRASHBIN_PREFIX + remotePath;
        let content;
        try {
            content = await this.api.getFile(remotePath, server);
        }
        catch {
            // File never made it to the game (never synced, deleted in-game
            // already, etc.). Nothing to trash; nothing to clean up. Logged,
            // not surfaced — this is a routine no-op for files outside the
            // synced set or for deletes done before the first connect.
            this.log(`Trashbin move skipped: ${remotePath} not found on ${server}`);
            return;
        }
        // Push to trashbin first; only delete the original on success so a
        // transient transport failure can't leave the user with no copy at
        // either path.
        await this.api.pushFile(trashbinPath, content, server);
        await this.api.deleteFile(remotePath, server);
        this.log(`Moved to trashbin: ${remotePath} -> ${trashbinPath}`);
        if (this.config.showNotifications) {
            vscode.window.showInformationMessage(`Moved to trashbin: ${remotePath}`);
        }
    }
    // Forwarded from FileWatcher when VS Code reports a user-initiated delete.
    // We deliberately use workspace.onDidDeleteFiles (not the lower-level
    // FileSystemWatcher.onDidDelete) — the former only fires for explicit
    // user actions inside VS Code, so git branch switches, terminal `rm`s
    // and external editor deletes do *not* propagate to the game. Auto-sync
    // gating mirrors handleFileChange so disabling autoSync disables both
    // directions.
    //
    // The propagation is a *trashbin move*, not a hard delete: see
    // moveToTrashbin() for the rationale.
    handleFileDelete(uri) {
        if (!this.config.autoSync) {
            return;
        }
        // If the delete races with an in-flight debounced push for the same
        // file, cancel the push — we don't want to upload content that the
        // user has just decided is gone. The reverse case (push racing a
        // delete) isn't a concern because the delete event handler runs
        // synchronously here, before the debounce timer fires.
        const key = uri.toString();
        const existing = this.debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
            this.debounceTimers.delete(key);
        }
        this.moveToTrashbin(uri).catch((err) => {
            this.log(`Auto-trashbin failed for ${uri.fsPath}: ${err}`);
        });
    }
    // Forwarded from FileWatcher when VS Code reports a user-initiated
    // rename or move (also user-initiated, same gating as handleFileDelete).
    // A rename is modeled as delete-then-push: the old remote name goes
    // away, the new file's content lands at the new remote path. Either
    // side independently no-ops when it falls outside the syncable set
    // (wrong extension, excluded, outside syncDirectory), so renaming
    // *into* the synced area just pushes, renaming *out of* it just
    // deletes, and a rename entirely outside is a silent no-op.
    handleFileRename(oldUri, newUri) {
        if (!this.config.autoSync) {
            return;
        }
        const oldKey = oldUri.toString();
        const pendingOld = this.debounceTimers.get(oldKey);
        if (pendingOld) {
            clearTimeout(pendingOld);
            this.debounceTimers.delete(oldKey);
        }
        // Run delete-then-push sequentially: the new path may equal the old
        // remote path (e.g. case-only rename on a case-insensitive filesystem
        // — admittedly contrived, but cheap to be correct about), and we'd
        // rather not race a delete against the push of the same target.
        void (async () => {
            try {
                await this.deleteRemoteFile(oldUri);
            }
            catch (err) {
                this.log(`Auto-delete (rename) failed for ${oldUri.fsPath}: ${err}`);
            }
            // pushFile itself doesn't filter by extension — that's the
            // FileWatcher's job for save events, and the manual `syncFile`
            // command bypasses it deliberately. FileWatcher only filters
            // rename events at "old OR new is relevant", so we have to
            // re-check the new side here before pushing: a rename like
            // `a.js -> notes.md` must delete `/a.js` but NOT push notes.md.
            if (!this.matchesAllowedExtension(newUri)) {
                return;
            }
            try {
                if (await this.fileExists(newUri)) {
                    await this.pushFile(newUri);
                }
            }
            catch (err) {
                this.log(`Auto-sync (rename) failed for ${newUri.fsPath}: ${err}`);
            }
        })();
    }
    matchesAllowedExtension(uri) {
        const lastDot = uri.fsPath.lastIndexOf('.');
        if (lastDot < 0) {
            return false;
        }
        const ext = uri.fsPath.slice(lastDot).toLowerCase();
        return this.config.fileExtensions.includes(ext);
    }
    async downloadAll() {
        return this.downloadFiles();
    }
    async downloadSelectedFiles() {
        const value = this.memento?.get("bitburnerSync.downloadSelectedFilesSelection") ?? "**/*.js";
        const input = await vscode.window.showInputBox({
            title: "Specify files to download",
            prompt: "for example, 'scripts/**' for all files under the scripts folder, or '**/*.json' for all json files",
            value,
        });
        if (!input) {
            return;
        }
        await this.memento?.update("bitburnerSync.downloadSelectedFilesSelection", input);
        return this.downloadFiles(input);
    }
    async downloadFiles(inclusionPattern) {
        // Honor the documented "sync nothing" opt-out symmetrically: with no
        // allowed extensions, the whole listing → filter → fetch loop is dead
        // weight. Bail before the getFileNames RPC so the user gets the same
        // explicit warning push paths produce.
        if (this.config.fileExtensions.length === 0) {
            vscode.window.showWarningMessage('bitburnerSync.fileExtensions is set to []. Nothing will be downloaded. Remove the setting to fall back to the defaults.');
            return;
        }
        const planResult = await this.buildDownloadPlan({ inclusionPattern });
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
                    throw new Error(`File exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} sync limit (${formatBytes(byteLen)})`);
                }
                await vscode.workspace.fs.writeFile(destUri, Buffer.from(content));
                downloaded++;
                this.log(`Downloaded: ${remote}`);
            }
            catch (err) {
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
    async countNewRemoteFiles() {
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
    async countNewLocalFiles() {
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
            let remotePath;
            try {
                remotePath = this.pathMapper.mapToRemote(file);
            }
            catch {
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
    async buildDownloadPlan(opts = {}) {
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
        const entries = [];
        let skipped = 0;
        for (const filename of fileNames) {
            try {
                (0, PathMapper_1.validateRemotePath)(filename);
            }
            catch (err) {
                skipped++;
                if (!silent) {
                    this.log(`Skipped (invalid name from server): ${JSON.stringify(filename)} — ${err instanceof Error ? err.message : err}`);
                }
                continue;
            }
            if (!matchesAllowedExtension(filename, allowedExts) || !matchesIncludePattern(filename, opts.inclusionPattern)) {
                skipped++;
                if (!silent) {
                    this.log(`Skipped (extension not in bitburnerSync.fileExtensions): ${filename}`);
                }
                continue;
            }
            // Never pull the in-game trashbin back into the workspace. The
            // trashbin is the extension's own non-destructive delete bucket
            // (see moveToTrashbin) — downloading it would resurrect the very
            // files the user just deleted in VS Code, the next syncAll would
            // push them back to /trashbin/<path> again, and the user ends up
            // chasing the same files around. Counted as skipped so the
            // download summary reflects what happened.
            if (isInTrashbin(canonicalizeRemotePath(filename))) {
                skipped++;
                if (!silent) {
                    this.log(`Skipped (in /trashbin/): ${filename}`);
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
    async fileExists(uri) {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        }
        catch {
            return false;
        }
    }
    allExcludePatterns() {
        return [...ALWAYS_EXCLUDE, ...this.config.exclude];
    }
    isExcluded(uri) {
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
        return this.allExcludePatterns().some(p => (0, minimatch_1.minimatch)(rel, p, { dot: true }));
    }
    findFilesExcludeGlob() {
        const patterns = this.allExcludePatterns();
        if (patterns.length === 0) {
            return null;
        }
        if (patterns.length === 1) {
            return patterns[0];
        }
        return `{${patterns.join(',')}}`;
    }
    async confirmOverwrite(filenames) {
        const MAX_LIST = 20;
        const shown = filenames.slice(0, MAX_LIST);
        const remainder = filenames.length - shown.length;
        const list = shown.join('\n');
        const more = remainder > 0 ? `\n…and ${remainder} more` : '';
        const count = filenames.length;
        const noun = count === 1 ? 'file' : 'files';
        const choice = await vscode.window.showWarningMessage(`Overwrite ${count} local ${noun}?`, {
            modal: true,
            detail: `Downloading from Bitburner will replace the following ${noun}:\n\n${list}${more}\n\nNew files (not yet present locally) will be downloaded either way.`,
        }, 'Overwrite');
        return choice === 'Overwrite';
    }
    async downloadDefinitions() {
        const rawContent = await this.api.getDefinitionFile();
        // The real NetscriptDefinitions.d.ts is well under 1 MB today, but
        // give it headroom for future growth — the cap exists to bound a
        // hostile/buggy server, not to second-guess the game.
        const byteLen = Buffer.byteLength(rawContent, 'utf8');
        if (byteLen > MAX_DEFINITIONS_SIZE_BYTES) {
            throw new Error(`${DEFINITIONS_FILE} exceeds the ${formatBytes(MAX_DEFINITIONS_SIZE_BYTES)} sanity limit (${formatBytes(byteLen)})`);
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder open');
        }
        // Upstream's NetscriptDefinitions.d.ts marks types as `@public` in
        // JSDoc but doesn't always actually `export` them (e.g.
        // AutocompleteData, ReactNode, ReactElement). In a TS module those
        // unexported types become module-private, which breaks both
        // `import { AutocompleteData } from '@ns'` and the globals shim. We
        // patch the downloaded file to add `export` to every top-level
        // interface/type/enum/class declaration that's missing it. The
        // patch is idempotent — re-running it on already-exported lines is
        // a no-op — so re-downloads don't drift.
        const content = ensureAllTopLevelDeclarationsExported(rawContent);
        const rootUri = workspaceFolders[0].uri;
        const destUri = vscode.Uri.joinPath(rootUri, DEFINITIONS_FILE);
        await vscode.workspace.fs.writeFile(destUri, Buffer.from(content));
        this.log(`Downloaded ${DEFINITIONS_FILE}`);
        vscode.window.showInformationMessage(`Downloaded ${DEFINITIONS_FILE} to workspace root.`);
        await this.writeGlobalsShim(rootUri, content);
        await this.ensureTsConfig(rootUri);
    }
    /**
     * One-shot migration hook called from `activate()`. If the workspace
     * already contains a `NetscriptDefinitions.d.ts` from a previous
     * (pre-globals) version of the extension, regenerate
     * `NetscriptGlobals.d.ts` from it and patch `tsconfig.json` so the
     * global-`NS` and `@ns` path-alias setup is in place without requiring
     * the user to reconnect to the game and re-download. Returns silently
     * (no errors, no notifications) when there's nothing to migrate.
     */
    async ensureTypeDefinitionsSetup() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }
        const rootUri = workspaceFolders[0].uri;
        const defsUri = vscode.Uri.joinPath(rootUri, DEFINITIONS_FILE);
        let raw;
        try {
            const bytes = await vscode.workspace.fs.readFile(defsUri);
            raw = Buffer.from(bytes).toString('utf8');
        }
        catch {
            // No existing definitions file — nothing to migrate. The normal
            // download path will set everything up when the user connects.
            return;
        }
        try {
            // Apply the same export-everything patch to a previously-downloaded
            // d.ts so existing users get the AutocompleteData / ReactNode /
            // ReactElement fix without needing to reconnect.
            const patched = ensureAllTopLevelDeclarationsExported(raw);
            if (patched !== raw) {
                await vscode.workspace.fs.writeFile(defsUri, Buffer.from(patched));
                this.log(`Patched ${DEFINITIONS_FILE} to export all top-level types`);
            }
            await this.writeGlobalsShim(rootUri, patched);
            await this.ensureTsConfig(rootUri);
        }
        catch (err) {
            // Migration is best-effort: it must never block extension
            // activation. Surface the failure in the output channel so the
            // user can diagnose if they notice type hints aren't working.
            this.log(`Type-definitions setup failed: ${err instanceof Error ? err.message : err}`);
        }
    }
    async writeGlobalsShim(rootUri, defsContent) {
        const names = extractTopLevelExportNames(defsContent);
        if (names.length === 0) {
            // The d.ts is empty, truncated, or malformed. Don't write an
            // empty shim that would mask the underlying problem — let
            // ensureTsConfig still wire up the @ns alias as a fallback.
            this.log(`Skipped ${GLOBALS_FILE}: no top-level exports parsed from ${DEFINITIONS_FILE}`);
            return;
        }
        const body = renderGlobalsShim(names);
        const uri = vscode.Uri.joinPath(rootUri, GLOBALS_FILE);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(body));
        this.log(`Wrote ${GLOBALS_FILE} (${names.length} Netscript types globalized, React/ReactDOM inlined)`);
    }
    async ensureTsConfig(rootUri) {
        const tsconfigUri = vscode.Uri.joinPath(rootUri, 'tsconfig.json');
        let raw;
        try {
            const bytes = await vscode.workspace.fs.readFile(tsconfigUri);
            raw = Buffer.from(bytes).toString('utf8');
        }
        catch {
            // not yet — fall through to fresh-template path below.
        }
        // Try strict JSON first — only then is it safe to re-serialize.
        let strictParsed;
        if (raw !== undefined) {
            try {
                strictParsed = JSON.parse(raw);
            }
            catch {
                // not strict JSON; may still be valid JSONC
            }
        }
        // JSONC fallback for *detection only* — we won't rewrite it, since
        // re-serializing would drop the user's comments and formatting.
        let jsoncParsed = strictParsed;
        if (jsoncParsed === undefined && raw !== undefined) {
            try {
                jsoncParsed = JSON.parse(stripJsonComments(raw));
            }
            catch {
                // unparseable
            }
        }
        const wanted = this.buildWantedTsconfig(jsoncParsed);
        if (raw === undefined) {
            // File doesn't exist — safe to create a fresh template.
            await this.writeFreshTsConfig(tsconfigUri, wanted);
            return;
        }
        if (strictParsed) {
            const changed = mergeWantedIntoTsconfig(strictParsed, wanted);
            if (changed) {
                await vscode.workspace.fs.writeFile(tsconfigUri, Buffer.from(JSON.stringify(strictParsed, null, 2) + '\n'));
                this.log(`Updated tsconfig.json with ${wanted.files.join(', ')}, "${NS_PATH_ALIAS}" path alias, and jsx mode`);
            }
            return;
        }
        if (jsoncParsed && tsconfigHasAllWanted(jsoncParsed, wanted)) {
            return;
        }
        // Either JSONC-missing-an-entry or unparseable. Don't risk corrupting
        // the file; tell the user what to add.
        await this.warnManualTsConfigSetup(tsconfigUri, wanted, jsoncParsed === undefined);
    }
    // Compute the set of fields the extension wants present in the user's
    // tsconfig. The result is sensitive to whether `existing` already has
    // `compilerOptions.baseUrl` set: with baseUrl, `paths` entries resolve
    // relative to baseUrl (old style) so `@ns` needs to climb back out to
    // the workspace root; without baseUrl, entries resolve relative to the
    // tsconfig directory (new style, the only style left in TS 7.0 where
    // `baseUrl` is removed).
    buildWantedTsconfig(existing) {
        const co = existing?.['compilerOptions'];
        const hasBaseUrl = !!co
            && typeof co === 'object'
            && !Array.isArray(co)
            && typeof co['baseUrl'] === 'string';
        const syncDir = this.config.syncDirectory;
        // `@ns` and `@/*` are add-if-missing so users who deliberately
        // point them at different files aren't overwritten.
        let defaultPaths;
        if (hasBaseUrl) {
            // Old layout: paths resolve relative to baseUrl (which older
            // extension versions and the bitburner-official template set
            // to syncDirectory). Climb back out for the d.ts.
            const depth = syncDir ? syncDir.split('/').filter(Boolean).length : 0;
            const toRoot = '../'.repeat(depth);
            defaultPaths = {
                [NS_PATH_ALIAS]: [toRoot + DEFINITIONS_FILE],
                ['@/*']: ['./*'],
            };
        }
        else {
            // New layout: paths resolve relative to the tsconfig directory
            // (workspace root). The d.ts lives there, so reference it
            // directly; `@/*` points at the sync root explicitly.
            const syncRoot = syncDir ? `./${syncDir}/*` : './*';
            defaultPaths = {
                [NS_PATH_ALIAS]: [DEFINITIONS_FILE],
                ['@/*']: [syncRoot],
            };
        }
        // `react` / `react-dom` used to be add-always entries pointing at
        // absolute paths inside the installed extension directory. That
        // directory is versioned (`.vscode/extensions/…-0.1.2/…`), so every
        // extension upgrade turned every user's paths into dangling
        // pointers. Types now ship inline in NetscriptGlobals.d.ts, so we
        // no longer add these entries — and legacy ones get scrubbed
        // below via `pathsToRemove`.
        const pathsToRemove = ['react', 'react-dom'];
        return {
            files: [DEFINITIONS_FILE, GLOBALS_FILE],
            paths: defaultPaths,
            pathsToRemove,
            // Compiler options the extension *adds if missing*. We never
            // overwrite a user-set value, so a custom `jsx` mode survives.
            // `jsx: "react"` matches the Bitburner runtime, which uses the
            // classic React.createElement factory (React is a runtime global,
            // see NetscriptGlobals.d.ts).
            compilerOptions: { jsx: 'react' },
        };
    }
    async writeFreshTsConfig(tsconfigUri, wanted) {
        const syncDir = this.config.syncDirectory;
        const syncRoot = syncDir ? `./${syncDir}/*` : './*';
        const tsconfig = {
            compilerOptions: {
                noImplicitAny: false,
                target: 'ESNext',
                module: 'ESNext',
                moduleResolution: 'bundler',
                allowImportingTsExtensions: true,
                allowJs: true,
                checkJs: true,
                noEmit: true,
                skipLibCheck: true,
                esModuleInterop: true,
                isolatedModules: true,
                jsx: 'react',
                paths: {
                    ...wanted.paths,
                    '*': [syncRoot],
                    '/*': [syncRoot],
                },
            },
            include: ['**/*'],
            files: wanted.files,
        };
        await vscode.workspace.fs.writeFile(tsconfigUri, Buffer.from(JSON.stringify(tsconfig, null, 2) + '\n'));
        this.log('Created tsconfig.json');
    }
    async warnManualTsConfigSetup(tsconfigUri, wanted, unparseable) {
        const reason = unparseable
            ? 'tsconfig.json could not be parsed'
            : 'tsconfig.json appears to contain comments or trailing commas (JSONC), which the extension will not rewrite';
        const message = `${reason}. Add the entries below manually to enable Netscript type hints.`;
        this.log(`WARN: ${message}`);
        this.log('Suggested tsconfig.json entries:');
        this.log(`    "files": ${JSON.stringify(wanted.files)}`);
        this.log(`    "compilerOptions": { "paths": ${JSON.stringify(wanted.paths)}, ${Object.entries(wanted.compilerOptions).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`).join(', ')} }`);
        if (wanted.pathsToRemove.length > 0) {
            this.log(`    Also remove any stale entries from "compilerOptions.paths": ${JSON.stringify(wanted.pathsToRemove)} (they used to point into the extension install directory and break on upgrade — React/ReactDOM types now live in ${GLOBALS_FILE}).`);
        }
        this.log('See the Troubleshooting section of the README for a full example.');
        const open = 'Open tsconfig.json';
        const show = 'Show Instructions';
        const choice = await vscode.window.showWarningMessage(message, open, show);
        if (choice === open) {
            await vscode.commands.executeCommand('vscode.open', tsconfigUri);
        }
        else if (choice === show) {
            this.outputChannel.show();
        }
    }
    dispose() {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
exports.SyncEngine = SyncEngine;
// Renders a byte count for humans. Negative inputs (used as a "size
// unknown" sentinel) render as "unknown size" so the error message is still
// readable.
function formatBytes(bytes) {
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
function canonicalizeRemotePath(p) {
    return p.startsWith('/') ? p : '/' + p;
}
// True when the remote path already lives inside `/trashbin/`. Used by
// moveToTrashbin to short-circuit "delete a file in the trashbin" into a
// real delete instead of nesting `/trashbin/trashbin/...`.
function isInTrashbin(remotePath) {
    return remotePath === TRASHBIN_PREFIX || remotePath.startsWith(TRASHBIN_PREFIX + '/');
}
// Returns true if `filename`'s extension (case-insensitive) is in the
// `allowed` list. The list is expected to be normalized by Configuration:
// lowercase, each with a single leading dot.
function matchesAllowedExtension(filename, allowed) {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot < 0) {
        return false;
    }
    return allowed.includes(filename.slice(lastDot).toLowerCase());
}
function matchesIncludePattern(filename, inclusionPattern) {
    if (!inclusionPattern) {
        return true;
    }
    return (0, minimatch_1.minimatch)(filename, inclusionPattern, { dot: true });
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
function stripJsonComments(text) {
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
        }
        else if (c === '"' || c === '\'') {
            inString = true;
            stringChar = c;
            out += c;
            i++;
        }
        else if (c === '/' && next === '/') {
            while (i < text.length && text[i] !== '\n') {
                i++;
            }
        }
        else if (c === '/' && next === '*') {
            i += 2;
            while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                i++;
            }
            i += 2;
        }
        else if (c === ',') {
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
            }
            else {
                out += c;
                i++;
            }
        }
        else {
            out += c;
            i++;
        }
    }
    return out;
}
// Idempotent post-process pass over the downloaded NetscriptDefinitions.d.ts:
// prepend `export ` to any top-level `interface|type|enum|class` declaration
// that's missing it.
//
// Upstream tags many declarations with `@public` in JSDoc but leaves the
// `export` keyword off (e.g. `interface AutocompleteData`, `type ReactNode`,
// `interface ReactElement`). In a module that makes them module-private and
// breaks both `import { AutocompleteData } from '@ns'` and the globals shim.
// We restore the author's documented intent by exporting them.
//
// The regex anchors at start-of-line in multiline mode, so it skips
// already-exported declarations (those start with `e` from `export`) and
// nested declarations inside namespaces / `declare global` blocks (those
// have leading whitespace). Block-string false positives are essentially
// impossible in a generated d.ts.
function ensureAllTopLevelDeclarationsExported(source) {
    return source.replace(/^(?:interface|type|enum|class|abstract\s+class)\s+\w+/gm, 'export $&');
}
// Extract the names of all top-level `export interface|type|enum|class` declarations
// from a TypeScript declaration source. Used to build the global re-export shim.
//
// A regex rather than the TS compiler API is intentional: the bitburner d.ts
// format is stable and well-behaved, and we don't want to pay the ~60 MB
// runtime cost of pulling in typescript just to walk one file. The failure
// mode of mis-parsing is benign — at worst a type goes un-shimmed and the
// user falls back to `import { X } from '@ns'`, which the tsconfig paths
// alias also wires up.
function extractTopLevelExportNames(source) {
    const seen = new Set();
    const names = [];
    const re = /^export\s+(?:declare\s+)?(?:interface|type|enum|class|abstract\s+class)\s+(\w+)/gm;
    let m;
    while ((m = re.exec(source)) !== null) {
        const name = m[1];
        if (!seen.has(name)) {
            seen.add(name);
            names.push(name);
        }
    }
    return names;
}
// Render the NetscriptGlobals.d.ts shim that re-exports the d.ts's top-level
// types into the global scope, plus the React / ReactDOM runtime globals that
// Bitburner exposes implicitly. Generated content — never hand-edited.
//
// The React / ReactDOM / JSX namespaces are inlined via `declare global {
// namespace React { … } … }` (see BundledReactTypes.ts). A global namespace
// produces both a type and a runtime value, so scripts can reach for
// `React.useState(...)` or `React.Component` directly without an import.
// Wrapping in `declare global` is load-bearing here: NetscriptGlobals.d.ts
// is a module (it has an `import` and `export {}`), so a bare `declare
// namespace React` would create a module-local React instead of the global
// the Bitburner runtime exposes. Ambient module re-exports for "react" /
// "react-dom" live at the top-level of the file — TypeScript disallows
// `declare module "…"` inside `declare global`.
function renderGlobalsShim(names) {
    const defsModuleSpecifier = './' + DEFINITIONS_FILE.replace(/\.d\.ts$/, '');
    const lines = [
        '// AUTO-GENERATED by the Bitburner File Sync extension. DO NOT EDIT.',
        '//',
        '// Re-exports the Netscript API\'s top-level types into the global scope so',
        '// you can write `function main(ns: NS)` without importing anything. The list',
        `// below is regenerated each time \`${DEFINITIONS_FILE}\` is downloaded, so it`,
        '// stays in sync as Bitburner adds APIs.',
        '//',
        '// React and ReactDOM are also declared globally here because the Bitburner',
        '// runtime exposes them implicitly. Their types are inlined below — a curated',
        '// subset covering hooks, components, refs, memo/forwardRef/lazy, the event',
        '// object hierarchy, HTMLAttributes, and the JSX intrinsic-element map. Users',
        '// who need stricter typing can install @types/react into their workspace and',
        '// let module augmentation replace these declarations.',
        '',
        `import type * as _NS from "${defsModuleSpecifier}";`,
        '',
        'declare global {',
        ...names.map(n => `    type ${n} = _NS.${n};`),
        '',
        BundledReactTypes_1.BUNDLED_REACT_NAMESPACES,
        '}',
        '',
        BundledReactTypes_1.BUNDLED_REACT_MODULE_ALIASES,
        '',
        'export {};',
        '',
    ];
    return lines.join('\n');
}
// Add the wanted `files` entries, `compilerOptions.paths` aliases, and any
// missing `compilerOptions` keys to an already-parsed tsconfig object.
// Mutates `cfg` in place. Returns true iff any change was made. Existing
// values are never overwritten — we only add what's missing — so user
// customizations (their own `paths` aliases, a different `jsx` mode, etc.)
// survive intact.
function mergeWantedIntoTsconfig(cfg, wanted) {
    let changed = false;
    let files = cfg['files'];
    if (!Array.isArray(files)) {
        files = [];
        cfg['files'] = files;
        changed = true;
    }
    const filesArr = files;
    for (const entry of wanted.files) {
        if (!filesArr.includes(entry)) {
            filesArr.push(entry);
            changed = true;
        }
    }
    let co = cfg['compilerOptions'];
    if (!co || typeof co !== 'object' || Array.isArray(co)) {
        co = {};
        cfg['compilerOptions'] = co;
        changed = true;
    }
    const coObj = co;
    for (const [key, value] of Object.entries(wanted.compilerOptions)) {
        if (coObj[key] === undefined) {
            coObj[key] = value;
            changed = true;
        }
    }
    let paths = coObj['paths'];
    if (!paths || typeof paths !== 'object' || Array.isArray(paths)) {
        paths = {};
        coObj['paths'] = paths;
        changed = true;
    }
    const pathsObj = paths;
    for (const [alias, target] of Object.entries(wanted.paths)) {
        if (!Array.isArray(pathsObj[alias])) {
            pathsObj[alias] = target;
            changed = true;
        }
    }
    // Actively scrub aliases we no longer manage. The extension previously
    // wrote absolute paths for `react` / `react-dom` pointing at the
    // versioned extension install directory; those entries become dangling
    // pointers on every upgrade. Removing them here means an upgrading
    // user doesn't have to hand-edit their tsconfig — and the React /
    // ReactDOM types now come from NetscriptGlobals.d.ts anyway.
    for (const alias of wanted.pathsToRemove) {
        if (alias in pathsObj) {
            delete pathsObj[alias];
            changed = true;
        }
    }
    return changed;
}
// Mirror of mergeWantedIntoTsconfig for the JSONC detection path: returns
// true iff every wanted field is already present in `cfg`. Used to decide
// whether to silently accept the user's JSONC tsconfig or warn them to
// patch it manually.
function tsconfigHasAllWanted(cfg, wanted) {
    const files = cfg['files'];
    if (!Array.isArray(files)) {
        return false;
    }
    for (const entry of wanted.files) {
        if (!files.includes(entry)) {
            return false;
        }
    }
    const co = cfg['compilerOptions'];
    if (!co || typeof co !== 'object') {
        return false;
    }
    const coObj = co;
    for (const key of Object.keys(wanted.compilerOptions)) {
        if (coObj[key] === undefined) {
            return false;
        }
    }
    const paths = coObj['paths'];
    if (!paths || typeof paths !== 'object') {
        return false;
    }
    const pathsObj = paths;
    for (const alias of Object.keys(wanted.paths)) {
        if (!Array.isArray(pathsObj[alias])) {
            return false;
        }
    }
    // Any alias slated for removal that still exists means the JSONC file
    // is out of date — we can't rewrite it safely, so the caller warns
    // the user to hand-edit it out.
    for (const alias of wanted.pathsToRemove) {
        if (alias in pathsObj) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=SyncEngine.js.map