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
exports.Configuration = void 0;
const vscode = __importStar(require("vscode"));
const SECTION = 'bitburnerSync';
class Configuration {
    get config() {
        return vscode.workspace.getConfiguration(SECTION);
    }
    get port() {
        return this.config.get('port', 12525);
    }
    get autoSync() {
        return this.config.get('autoSync', true);
    }
    get targetServer() {
        return this.config.get('targetServer', 'home');
    }
    get fileExtensions() {
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
        const inspected = this.config.inspect('fileExtensions');
        const userSet = inspected?.globalValue !== undefined ||
            inspected?.workspaceValue !== undefined ||
            inspected?.workspaceFolderValue !== undefined ||
            inspected?.globalLanguageValue !== undefined ||
            inspected?.workspaceLanguageValue !== undefined ||
            inspected?.workspaceFolderLanguageValue !== undefined ||
            inspected?.defaultLanguageValue !== undefined;
        const raw = userSet
            ? (this.config.get('fileExtensions', []) ?? [])
            : FILE_EXTENSION_DEFAULTS.slice();
        // Accept both "js" and ".js" (and ".JS" / "  .JS  ") in user config —
        // normalize to a single leading dot, lowercased, with empties dropped.
        return raw
            .map(e => e.trim().toLowerCase())
            .map(e => e.replace(/^\.+/, ''))
            .filter(e => e.length > 0)
            .map(e => `.${e}`);
    }
    get showNotifications() {
        return this.config.get('showNotifications', true);
    }
    get autoStart() {
        return this.config.get('autoStart', false);
    }
    get autoDownloadDefinitions() {
        return this.config.get('autoDownloadDefinitions', true);
    }
    get syncDirectory() {
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
    syncDirectoryError() {
        const raw = this.config.get('syncDirectory', '');
        if (!raw) {
            return null;
        }
        const normalized = this.normalizedSyncDirectory();
        if (isUnsafeSyncDirectory(normalized)) {
            return `bitburnerSync.syncDirectory has been ignored because it would escape the workspace: ${JSON.stringify(raw)}. Falling back to the workspace root.`;
        }
        return null;
    }
    normalizedSyncDirectory() {
        const raw = this.config.get('syncDirectory', '');
        return raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    }
    get fileGlob() {
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
    get exclude() {
        const raw = this.config.get('exclude', []);
        // Normalize Windows-style backslashes to forward slashes so a user
        // who types `node_modules\foo` (muscle memory) still matches against
        // the forward-slash relative path the matcher compares against.
        return raw.map(p => p.trim().replace(/\\/g, '/')).filter(p => p.length > 0);
    }
}
exports.Configuration = Configuration;
// Keep in sync with the `default` array on `bitburnerSync.fileExtensions`
// in package.json. Used as the in-process fallback when the user has not
// set the value in any scope.
const FILE_EXTENSION_DEFAULTS = [
    '.js', '.ts', '.jsx', '.tsx', '.txt', '.json', '.css', '.py',
];
function isUnsafeSyncDirectory(normalized) {
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
//# sourceMappingURL=Configuration.js.map