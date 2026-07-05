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
const Configuration_1 = require("../config/Configuration");
const PathMapper_1 = require("../sync/PathMapper");
// File extensions that plausibly contain Netscript code. The Bitburner
// runtime executes .js/.ts/.jsx/.tsx; anything else (README, tsconfig, css)
// isn't a script and shouldn't produce a RAM figure.
const SCRIPT_EXTENSIONS = Configuration_1.FILE_EXTENSION_DEFAULTS;
// Asks Bitburner for the RAM cost of the active file and forwards the
// result to the caller-provided sink. Two things drive an update:
//   1. The user switches editors — we recompute for the newly-active file.
//   2. A pushFile finishes (auto-sync on save, manual `Sync Current File`,
//      rename-push). We wait for the push to complete rather than firing
//      on the save event so calculateRam sees the just-pushed content.
// The status bar is hidden while disconnected, on files outside the
// syncable set, or when the server can't compute a cost (file not on
// server yet, parse error, etc.).
class RamCostTracker {
    outputChannel;
    onUpdate;
    api;
    config;
    wsServer;
    disposables = [];
    pathMapper;
    // Monotonic token so an older in-flight calculateRam can't overwrite a
    // newer result. Every recompute() bumps this; when the RPC resolves,
    // we compare against the current value and drop the write if we've
    // been superseded.
    recomputeToken = 0;
    onConnected;
    onDisconnected;
    constructor(outputChannel, onUpdate, api, config, wsServer, syncEngine) {
        this.outputChannel = outputChannel;
        this.onUpdate = onUpdate;
        this.api = api;
        this.config = config;
        this.wsServer = wsServer;
        this.pathMapper = new PathMapper_1.PathMapper(config);
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => {
            void this.recompute();
        }));
        // Recompute after each push so the number reflects what's actually
        // on the server. Filter to the active editor's file — background
        // syncAll runs don't tell us anything about the file the user is
        // looking at.
        this.disposables.push(syncEngine.onDidPush((remote) => {
            const activeRemote = this.activeRemotePath();
            if (activeRemote !== undefined && activeRemote === remote) {
                void this.recompute();
            }
        }));
        this.onConnected = () => { void this.recompute(); };
        this.onDisconnected = () => {
            this.recomputeToken++;
            this.onUpdate(undefined);
        };
        this.wsServer.on('connected', this.onConnected);
        this.wsServer.on('disconnected', this.onDisconnected);
    }
    // Public trigger for the initial read at activation time.
    async initialize() {
        await this.recompute();
    }
    async recompute() {
        const token = ++this.recomputeToken;
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isScriptDocument(editor.document)) {
            this.onUpdate(undefined);
            return;
        }
        if (!this.wsServer.isConnected) {
            this.onUpdate(undefined);
            return;
        }
        let remotePath;
        try {
            remotePath = this.pathMapper.mapToRemote(editor.document.uri);
        }
        catch {
            // Outside the sync directory / primary workspace — no remote
            // counterpart to ask about.
            this.onUpdate(undefined);
            return;
        }
        try {
            const cost = await this.api.calculateRam(remotePath, this.config.targetServer);
            if (token !== this.recomputeToken) {
                return;
            }
            if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) {
                this.onUpdate(undefined);
                return;
            }
            this.onUpdate(cost);
        }
        catch (err) {
            if (token !== this.recomputeToken) {
                return;
            }
            // Common cases: file not on server yet, parse error in the
            // script, disconnected mid-request. All benign — hide the
            // indicator and log for diagnostics.
            this.outputChannel.appendLine(`calculateRam(${remotePath}) failed: ${err instanceof Error ? err.message : err}`);
            this.onUpdate(undefined);
        }
    }
    activeRemotePath() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isScriptDocument(editor.document)) {
            return undefined;
        }
        try {
            return this.pathMapper.mapToRemote(editor.document.uri);
        }
        catch {
            return undefined;
        }
    }
    dispose() {
        this.wsServer.off('connected', this.onConnected);
        this.wsServer.off('disconnected', this.onDisconnected);
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
    const ext = p.slice(dot);
    return SCRIPT_EXTENSIONS.includes(ext);
}
//# sourceMappingURL=RamCostTracker.js.map