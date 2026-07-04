import * as vscode from 'vscode';

const SECTION = 'bitburnerSync';

export class Configuration {
    private get config(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(SECTION);
    }

    get port(): number {
        return this.config.get<number>('port', 12525);
    }

    get autoSync(): boolean {
        return this.config.get<boolean>('autoSync', true);
    }

    get targetServer(): string {
        return this.config.get<string>('targetServer', 'home');
    }

    get fileExtensions(): string[] {
        // An explicit `[]` in user config means "sync nothing" — that's a
        // legitimate intent and we must NOT silently fall back to defaults.
        // Only when the key is unset across every config scope do we use the
        // baked-in list. `inspect()` is the only API that distinguishes
        // "configured to empty" from "not configured at all" — `get()` with
        // a default conflates them.
        //
        // Includes the four per-language scopes so `[javascript]` and friends
        // are honored (they're the only way users can scope settings to a
        // single language, and they show up under inspect's *LanguageValue
        // keys, not globalValue/workspaceValue).
        const inspected = this.config.inspect<string[]>('fileExtensions');
        const userSet =
            inspected?.globalValue !== undefined ||
            inspected?.workspaceValue !== undefined ||
            inspected?.workspaceFolderValue !== undefined ||
            inspected?.globalLanguageValue !== undefined ||
            inspected?.workspaceLanguageValue !== undefined ||
            inspected?.workspaceFolderLanguageValue !== undefined ||
            inspected?.defaultLanguageValue !== undefined;
        const raw = userSet
            ? (this.config.get<string[]>('fileExtensions', []) ?? [])
            : FILE_EXTENSION_DEFAULTS.slice();
        // Accept both "js" and ".js" (and ".JS" / "  .JS  ") in user config —
        // normalize to a single leading dot, lowercased, with empties dropped.
        return raw
            .map(e => e.trim().toLowerCase())
            .map(e => e.replace(/^\.+/, ''))
            .filter(e => e.length > 0)
            .map(e => `.${e}`);
    }

    get showNotifications(): boolean {
        return this.config.get<boolean>('showNotifications', true);
    }

    get autoStart(): boolean {
        return this.config.get<boolean>('autoStart', false);
    }

    get autoDownloadDefinitions(): boolean {
        return this.config.get<boolean>('autoDownloadDefinitions', true);
    }

    get syncDirectory(): string {
        const normalized = this.normalizedSyncDirectory();
        // Fail closed: an unsafe value (path traversal, drive letter) silently
        // falls back to the workspace root. The matching warning is surfaced
        // separately via syncDirectoryError() so callers that read this getter
        // many times per save don't spam notifications.
        if (isUnsafeSyncDirectory(normalized)) {
            return '';
        }
        return normalized;
    }

    syncDirectoryError(): string | null {
        const raw = this.config.get<string>('syncDirectory', '');
        if (!raw) {
            return null;
        }
        const normalized = this.normalizedSyncDirectory();
        if (isUnsafeSyncDirectory(normalized)) {
            return `bitburnerSync.syncDirectory has been ignored because it would escape the workspace: ${JSON.stringify(raw)}. Falling back to the workspace root.`;
        }
        return null;
    }

    private normalizedSyncDirectory(): string {
        const raw = this.config.get<string>('syncDirectory', '');
        return raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    }

    get fileGlob(): string {
        const exts = this.fileExtensions.map(e => e.replace('.', ''));
        if (exts.length === 0) {
            // No extensions to match — return a sentinel that VS Code's glob
            // matcher can parse but no real file will ever match. Callers
            // should prefer to check fileExtensions.length first and skip
            // entirely; this is the defensive backstop.
            return '__bitburnerSync_no_extensions_configured__';
        }
        const prefix = this.syncDirectory ? `${this.syncDirectory}/` : '';
        return `${prefix}**/*.{${exts.join(',')}}`;
    }

    get exclude(): string[] {
        const raw = this.config.get<string[]>('exclude', []);
        // Normalize Windows-style backslashes to forward slashes so a user
        // who types `node_modules\foo` (muscle memory) still matches against
        // the forward-slash relative path the matcher compares against.
        return raw.map(p => p.trim().replace(/\\/g, '/')).filter(p => p.length > 0);
    }
}

// Keep in sync with the `default` array on `bitburnerSync.fileExtensions`
// in package.json. Used as the in-process fallback when the user has not
// set the value in any scope.
export const FILE_EXTENSION_DEFAULTS = [
    '.js', '.ts', '.jsx', '.tsx', '.txt', '.json', '.css', '.py',
] as const;

function isUnsafeSyncDirectory(normalized: string): boolean {
    if (!normalized) {
        return false;
    }
    // Reject `..` as a complete path segment — anchors a workspace-relative
    // path back outside the workspace.
    if (normalized.split('/').some(seg => seg === '..')) {
        return true;
    }
    // Reject Windows drive letters — would re-anchor to an absolute path.
    if (/^[A-Za-z]:/.test(normalized)) {
        return true;
    }
    return false;
}
