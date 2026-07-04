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
exports.RamCostTracker = void 0;
const vscode = __importStar(require("vscode"));
const RamCost_1 = require("./RamCost");
const DEFINITIONS_FILE = 'NetscriptDefinitions.d.ts';
// File extensions that plausibly contain Netscript code. The Bitburner
// runtime executes .js/.ts/.jsx/.tsx; anything else (README, tsconfig, css)
// isn't a script and shouldn't produce a RAM figure even if it happens to
// mention identifiers like `hack` or `write` in prose.
const SCRIPT_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx']);
// Watches for changes that could affect the active-editor RAM cost and
// pushes new results to the caller-provided sink. Two independent inputs
// drive updates:
//   1. NetscriptDefinitions.d.ts — the source of truth for the cost table.
//      Rebuilt on create/change; cleared on delete.
//   2. The active editor's script text — recomputed when the user switches
//      editors or saves the current file.
//
// Save (not every keystroke) is intentional: the user asked for a light,
// fast indicator, and keystroke-driven recompute would run the regex scan
// on every character. Save + editor-swap covers the "I just made a change,
// what's the number now?" case without paying that cost.
class RamCostTracker {
    outputChannel;
    onUpdate;
    costs = new Map();
    disposables = [];
    constructor(outputChannel, onUpdate) {
        this.outputChannel = outputChannel;
        this.onUpdate = onUpdate;
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (primary) {
            const pattern = new vscode.RelativePattern(primary, DEFINITIONS_FILE);
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            const reload = () => { void this.reload(); };
            watcher.onDidCreate(reload, null, this.disposables);
            watcher.onDidChange(reload, null, this.disposables);
            watcher.onDidDelete(() => {
                this.costs = new Map();
                this.recompute();
            }, null, this.disposables);
            this.disposables.push(watcher);
        }
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.recompute()), vscode.workspace.onDidSaveTextDocument((doc) => {
            const active = vscode.window.activeTextEditor;
            // Only recompute if the saved doc *is* the active doc.
            // Background saves (autosave of a hidden buffer, formatter
            // save-on-focus-change) shouldn't override the number for
            // whatever file the user is currently looking at.
            if (active && active.document.uri.toString() === doc.uri.toString()) {
                this.recompute();
            }
        }));
    }
    // One-shot load at activation. Kept separate from the constructor so
    // callers can await the initial cost-table read and know the first
    // recompute isn't going to hit an empty map when a d.ts is already on
    // disk.
    async initialize() {
        await this.reload();
    }
    async reload() {
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            this.costs = new Map();
            this.recompute();
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
            // No d.ts yet — the user hasn't connected to Bitburner or the
            // download hasn't completed. Silently clear so the status bar
            // stays hidden until the file appears.
            this.costs = new Map();
        }
        this.recompute();
    }
    recompute() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isScriptDocument(editor.document)) {
            this.onUpdate([]);
            return;
        }
        const { entries } = (0, RamCost_1.computeScriptRamCost)(editor.document.getText(), this.costs);
        this.onUpdate(entries);
    }
    dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
    }
}
exports.RamCostTracker = RamCostTracker;
function isScriptDocument(doc) {
    const p = doc.uri.fsPath.toLowerCase();
    const dot = p.lastIndexOf('.');
    if (dot < 0) {
        return false;
    }
    return SCRIPT_EXTENSIONS.has(p.slice(dot));
}
//# sourceMappingURL=RamCostTracker.js.map