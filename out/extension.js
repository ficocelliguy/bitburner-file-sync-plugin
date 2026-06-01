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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const WebSocketServer_1 = require("./server/WebSocketServer");
const JsonRpcClient_1 = require("./server/JsonRpcClient");
const BitburnerApi_1 = require("./api/BitburnerApi");
const Configuration_1 = require("./config/Configuration");
const SyncEngine_1 = require("./sync/SyncEngine");
const FileWatcher_1 = require("./sync/FileWatcher");
const StatusBar_1 = require("./ui/StatusBar");
let wsServer;
let rpcClient;
let api;
let config;
let syncEngine;
let fileWatcher;
let statusBar;
let outputChannel;
async function startServer() {
    // Allow retry from the error state — that's the whole point of clicking
    // the status bar after a failed bind. wsServer.start() internally stops
    // a stale server if one was left behind.
    if (wsServer.state !== 'stopped' && wsServer.state !== 'error') {
        vscode.window.showInformationMessage('Sync server is already running.');
        return;
    }
    try {
        await wsServer.start(config.port);
        fileWatcher.start();
        vscode.window.showInformationMessage(`Bitburner sync server started on port ${config.port}`);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to start server: ${err}`);
    }
}
async function stopServer() {
    fileWatcher.stop();
    await wsServer.stop();
    vscode.window.showInformationMessage('Bitburner sync server stopped.');
}
async function ensureServerStarted() {
    if (wsServer.state === 'stopped') {
        await startServer();
    }
}
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Bitburner Sync');
    config = new Configuration_1.Configuration();
    warnIfMultiRoot(outputChannel);
    warnIfSyncDirectoryUnsafe(outputChannel, config);
    wsServer = new WebSocketServer_1.WebSocketServer();
    rpcClient = new JsonRpcClient_1.JsonRpcClient(wsServer);
    api = new BitburnerApi_1.BitburnerApi(rpcClient, config.targetServer);
    syncEngine = new SyncEngine_1.SyncEngine(api, config, outputChannel);
    fileWatcher = new FileWatcher_1.FileWatcher(syncEngine, config);
    statusBar = new StatusBar_1.StatusBar();
    wsServer.on('stateChanged', (state) => {
        statusBar.update(state);
    });
    // Node's EventEmitter throws on unhandled 'error' events, which would
    // crash the extension host. Log instead.
    wsServer.on('error', (err) => {
        outputChannel.appendLine(`WebSocket server error: ${err instanceof Error ? err.message : err}`);
    });
    wsServer.on('connected', async () => {
        outputChannel.appendLine('Bitburner connected.');
        if (config.autoDownloadDefinitions) {
            try {
                await syncEngine.downloadDefinitions();
            }
            catch (err) {
                outputChannel.appendLine(`Auto-download definitions failed: ${err}`);
            }
        }
    });
    wsServer.on('disconnected', () => {
        outputChannel.appendLine('Bitburner disconnected.');
    });
    context.subscriptions.push(vscode.commands.registerCommand('bitburnerSync.startServer', startServer), vscode.commands.registerCommand('bitburnerSync.stopServer', stopServer), vscode.commands.registerCommand('bitburnerSync.toggleServer', () => {
        // Treat 'error' as stopped-equivalent: clicking the status bar
        // after a failed bind should retry, not turn the server off.
        const offlike = wsServer.state === 'stopped' || wsServer.state === 'error';
        return offlike ? startServer() : stopServer();
    }), vscode.commands.registerCommand('bitburnerSync.syncFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file to sync.');
            return;
        }
        await ensureServerStarted();
        if (!wsServer.isConnected) {
            vscode.window.showWarningMessage('Not connected to Bitburner.');
            return;
        }
        try {
            await syncEngine.pushFile(editor.document.uri);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Sync failed: ${err}`);
        }
    }), vscode.commands.registerCommand('bitburnerSync.syncAll', async () => {
        await ensureServerStarted();
        if (!wsServer.isConnected) {
            vscode.window.showWarningMessage('Not connected to Bitburner.');
            return;
        }
        try {
            await syncEngine.syncAll();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Sync all failed: ${err}`);
        }
    }), vscode.commands.registerCommand('bitburnerSync.getDefinitions', async () => {
        await ensureServerStarted();
        if (!wsServer.isConnected) {
            vscode.window.showWarningMessage('Not connected to Bitburner.');
            return;
        }
        try {
            await syncEngine.downloadDefinitions();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to download definitions: ${err}`);
        }
    }), vscode.commands.registerCommand('bitburnerSync.downloadAll', async () => {
        await ensureServerStarted();
        if (!wsServer.isConnected) {
            vscode.window.showWarningMessage('Not connected to Bitburner.');
            return;
        }
        try {
            await syncEngine.downloadAll();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to download files: ${err}`);
        }
    }), outputChannel, statusBar, { dispose: () => syncEngine.dispose() }, { dispose: () => fileWatcher.dispose() }, { dispose: () => rpcClient.dispose() }, 
    // Return the Promise so VS Code awaits port release on
    // reload/upgrade. Without this the next activation can race the
    // close callback and hit EADDRINUSE binding to the same port.
    { dispose: () => wsServer.stop() });
    // Restart on any bitburnerSync.* change so the file watcher picks up new
    // glob settings (syncDirectory / fileExtensions), the new port is bound,
    // etc. Bitburner sees the disconnect and reconnects on its own.
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (!e.affectsConfiguration('bitburnerSync')) {
            return;
        }
        // Re-validate syncDirectory on every change so a freshly-bad value
        // is reported, regardless of whether the server is running.
        if (e.affectsConfiguration('bitburnerSync.syncDirectory')) {
            warnIfSyncDirectoryUnsafe(outputChannel, config);
        }
        if (wsServer.state === 'stopped') {
            return;
        }
        outputChannel.appendLine('Configuration changed, restarting sync server...');
        await stopServer();
        await startServer();
    }));
    // Auto-start if configured
    if (config.autoStart) {
        startServer();
    }
}
function deactivate() {
    // Cleanup handled by subscriptions
}
// Multi-root workspaces aren't fully supported: only the first folder is used
// for upload globbing and as the destination for downloads. Warn once so users
// don't silently wonder why files in other folders aren't syncing.
function warnIfMultiRoot(channel) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length <= 1) {
        return;
    }
    const first = folders[0];
    const msg = `Bitburner Sync: multi-root workspace detected (${folders.length} folders). Only "${first.name}" (${first.uri.fsPath}) will be synced; files in other folders are ignored.`;
    channel.appendLine(msg);
    vscode.window.showWarningMessage(msg);
}
function warnIfSyncDirectoryUnsafe(channel, cfg) {
    const err = cfg.syncDirectoryError();
    if (!err) {
        return;
    }
    channel.appendLine(err);
    vscode.window.showWarningMessage(err);
}
//# sourceMappingURL=extension.js.map