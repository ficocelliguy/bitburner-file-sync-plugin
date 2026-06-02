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
exports.FileWatcher = void 0;
const vscode = __importStar(require("vscode"));
class FileWatcher {
    syncEngine;
    config;
    fileWatcher = null;
    disposables = [];
    constructor(syncEngine, config) {
        this.syncEngine = syncEngine;
        this.config = config;
    }
    start() {
        this.stop();
        // If the user has explicitly set fileExtensions to [], they want
        // nothing synced. Don't create the file watcher or the save listener
        // — both would be no-ops at best, confusing at worst.
        if (this.config.fileExtensions.length === 0) {
            return;
        }
        // Scope to the primary workspace folder. A bare-string glob would
        // watch every folder in a multi-root workspace, but downloads only
        // ever land in folder[0] and the activation warning promises the
        // sync stays inside it.
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            return;
        }
        const pattern = new vscode.RelativePattern(primary, this.config.fileGlob);
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.fileWatcher.onDidChange((uri) => {
            this.syncEngine.handleFileChange(uri);
        }, null, this.disposables);
        this.fileWatcher.onDidCreate((uri) => {
            this.syncEngine.handleFileChange(uri);
        }, null, this.disposables);
        // Note: we intentionally do NOT subscribe to onDidDelete. Bitburner
        // sync is one-way (local → remote) for pushes; deleting a file
        // locally — whether intentional, a rename (which fires delete+create),
        // a branch switch, or an external process — must not propagate to
        // the game. Users who want a file gone on both sides delete it on
        // both sides themselves.
        // Also hook into save events for reliable detection
        const saveWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
            if (this.matchesExtensions(doc.uri) && this.isInSyncDirectory(doc.uri)) {
                this.syncEngine.handleFileChange(doc.uri);
            }
        });
        this.disposables.push(saveWatcher);
    }
    isInSyncDirectory(uri) {
        // Save events fire for documents from any workspace folder. Filter
        // here to the primary folder (and the configured syncDirectory inside
        // it) so we don't try to push a file that's already out of scope.
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            return false;
        }
        const filePath = uri.fsPath.replace(/\\/g, '/');
        const folderPath = primary.uri.fsPath.replace(/\\/g, '/');
        const syncDir = this.config.syncDirectory;
        const expectedPrefix = syncDir ? `${folderPath}/${syncDir}/` : `${folderPath}/`;
        return filePath.startsWith(expectedPrefix);
    }
    stop() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
        this.disposables.forEach(d => d.dispose());
        this.disposables.length = 0;
    }
    matchesExtensions(uri) {
        const lastDot = uri.fsPath.lastIndexOf('.');
        // No dot in the filename → no extension. Reject explicitly: the prior
        // implementation matched the whole path via substring(-1).
        if (lastDot < 0) {
            return false;
        }
        const ext = uri.fsPath.slice(lastDot).toLowerCase();
        return this.config.fileExtensions.includes(ext);
    }
    dispose() {
        this.stop();
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=FileWatcher.js.map