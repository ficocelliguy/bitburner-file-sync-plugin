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
exports.NetscriptCostRegistry = void 0;
const vscode = __importStar(require("vscode"));
const RamCost_1 = require("./RamCost");
const DEFINITIONS_FILE = 'NetscriptDefinitions.d.ts';
// Owns the workspace-scraped name→cost table used by the click-through
// breakdown. The status bar total itself comes from the server (see
// RamCostTracker) — this registry only exists so the breakdown modal can
// attribute the total to individual ns methods without waiting for a
// per-file server round-trip.
//
// Refreshes automatically:
//   • at activation (initialize)
//   • when NetscriptDefinitions.d.ts is created or changed on disk (both
//     the extension's own download and manual edits)
//   • cleared when the file is deleted, so a stale table doesn't linger
class NetscriptCostRegistry {
    outputChannel;
    costs = new Map();
    disposables = [];
    reloadListeners = [];
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            return;
        }
        const pattern = new vscode.RelativePattern(primary, DEFINITIONS_FILE);
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const reload = () => { void this.reload(); };
        watcher.onDidCreate(reload, null, this.disposables);
        watcher.onDidChange(reload, null, this.disposables);
        watcher.onDidDelete(() => {
            this.costs = new Map();
            this.fireReload();
        }, null, this.disposables);
        this.disposables.push(watcher);
    }
    async initialize() {
        await this.reload();
    }
    getCosts() {
        return this.costs;
    }
    // Fires whenever the cost table is (re)loaded — initial load, d.ts
    // create/change/delete. The `RamCostTracker` subscribes so its
    // disconnected fallback picks up a fresh table without waiting for
    // another editor switch or save.
    onDidReload(listener) {
        this.reloadListeners.push(listener);
        return {
            dispose: () => {
                const i = this.reloadListeners.indexOf(listener);
                if (i >= 0) {
                    this.reloadListeners.splice(i, 1);
                }
            },
        };
    }
    fireReload() {
        for (const l of this.reloadListeners) {
            try {
                l();
            }
            catch (err) {
                this.outputChannel.appendLine(`NetscriptCostRegistry reload listener threw: ${err instanceof Error ? err.message : err}`);
            }
        }
    }
    async reload() {
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            this.costs = new Map();
            this.fireReload();
            return;
        }
        const uri = vscode.Uri.joinPath(primary.uri, DEFINITIONS_FILE);
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const source = Buffer.from(bytes).toString('utf8');
            this.costs = (0, RamCost_1.parseRamCosts)(source);
            this.outputChannel.appendLine(`RAM cost table loaded: ${this.costs.size} Netscript methods`);
        }
        catch {
            // No d.ts yet — the user hasn't connected/downloaded. Leave the
            // table empty; the click handler will show a friendly "connect
            // first" message instead of a bogus breakdown.
            this.costs = new Map();
        }
        this.fireReload();
    }
    dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
    }
}
exports.NetscriptCostRegistry = NetscriptCostRegistry;
//# sourceMappingURL=NetscriptCostRegistry.js.map