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
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const WebSocketServer_1 = require("./server/WebSocketServer");
const JsonRpcClient_1 = require("./server/JsonRpcClient");
const BitburnerApi_1 = require("./api/BitburnerApi");
const Configuration_1 = require("./config/Configuration");
const SyncEngine_1 = require("./sync/SyncEngine");
const FileWatcher_1 = require("./sync/FileWatcher");
const StatusBar_1 = require("./ui/StatusBar");
const RamStatusBar_1 = require("./ui/RamStatusBar");
const RamCostTracker_1 = require("./ram/RamCostTracker");
let wsServer;
let rpcClient;
let api;
let config;
let syncEngine;
let fileWatcher;
let statusBar;
let ramStatusBar;
let ramCostTracker;
let outputChannel;
// Persistence keys. Names live here so the two callers (the read in
// activate() and the write after running once) can't drift apart.
const FIRST_INSTALL_KEY = 'bitburnerSync.hasOpenedConfigOnFirstInstall';
const FIRST_CONNECT_KEY = 'bitburnerSync.hasConnectedBefore';
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
        vscode.window.showInformationMessage(`In-game under Options->Remote API, enter port ${config.port} and hit Connect.`);
        vscode.window.showInformationMessage(`Bitburner sync server started on port ${config.port}.`);
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
    // dist/types/ is populated by esbuild's copyBundledTypes step. Pass
    // the absolute path so user tsconfigs can resolve `react` / `react-dom`
    // imports against the bundled @types copies instead of forcing each
    // user to install them.
    const bundledTypesDir = path.join(context.extensionPath, 'dist', 'types');
    syncEngine = new SyncEngine_1.SyncEngine(api, config, outputChannel, bundledTypesDir, context.workspaceState);
    fileWatcher = new FileWatcher_1.FileWatcher(syncEngine, config);
    statusBar = new StatusBar_1.StatusBar();
    ramStatusBar = new RamStatusBar_1.RamStatusBar();
    ramCostTracker = new RamCostTracker_1.RamCostTracker(outputChannel, (entries) => ramStatusBar.update(entries));
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
        // First-connect-per-workspace prompt: if the game has scripts the
        // user doesn't have locally, offer to pull them down — or, if the
        // workspace has scripts the game doesn't, offer to push them up.
        // workspaceState (not globalState) so each project gets its own offer.
        await maybePromptFirstConnectSync(context);
    });
    wsServer.on('disconnected', () => {
        outputChannel.appendLine('Bitburner disconnected.');
    });
    wsServer.on('rejected', () => {
        // A second Bitburner tab tried to connect while the current one was
        // still passing liveness checks. Log so users have a breadcrumb if
        // the new tab appears to silently fail to connect.
        outputChannel.appendLine('Refused a new Bitburner connection: the existing one is still live.');
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
    }), vscode.commands.registerCommand('bitburnerSync.downloadSelectedFiles', async () => {
        await ensureServerStarted();
        if (!wsServer.isConnected) {
            vscode.window.showWarningMessage('Not connected to Bitburner.');
            return;
        }
        try {
            await syncEngine.downloadSelectedFiles();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to download files: ${err}`);
        }
    }), vscode.commands.registerCommand(RamStatusBar_1.SHOW_BREAKDOWN_COMMAND, () => (0, RamStatusBar_1.showRamCostBreakdown)(ramStatusBar)), outputChannel, statusBar, ramStatusBar, { dispose: () => ramCostTracker.dispose() }, { dispose: () => syncEngine.dispose() }, { dispose: () => fileWatcher.dispose() }, { dispose: () => rpcClient.dispose() }, 
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
    // First-install: open the settings UI so the user can see what's
    // available. globalState (not workspaceState) so we only do this once
    // per VS Code install, not on every new workspace.
    void maybeOpenSettingsOnFirstInstall(context);
    // Existing-user migration: if a previous version of the extension left
    // a NetscriptDefinitions.d.ts in the workspace, regenerate the globals
    // shim and patch tsconfig so `NS` becomes a global and `@ns` resolves —
    // without waiting for the user to reconnect to the game. Fire-and-forget;
    // failures are logged inside the call.
    void syncEngine.ensureTypeDefinitionsSetup();
    // First read of the RAM cost table. If NetscriptDefinitions.d.ts is
    // already in the workspace (existing user, or the migration path just
    // wrote it), the status bar becomes useful immediately; otherwise the
    // file-watcher inside the tracker will populate it after the first
    // download.
    void ramCostTracker.initialize();
}
async function maybeOpenSettingsOnFirstInstall(context) {
    if (context.globalState.get(FIRST_INSTALL_KEY, false)) {
        return;
    }
    // Mark first so a failed openSettings (e.g. command palette unavailable
    // mid-startup) doesn't re-pop on every reload. The user can always open
    // settings manually if they missed the auto-open.
    await context.globalState.update(FIRST_INSTALL_KEY, true);
    try {
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:bitburner-file-sync-plugin');
    }
    catch (err) {
        outputChannel.appendLine(`Could not open settings UI: ${err}`);
    }
}
async function maybePromptFirstConnectSync(context) {
    if (context.workspaceState.get(FIRST_CONNECT_KEY, false)) {
        return;
    }
    // Set the flag before we await any RPCs — if the user disconnects/reconnects
    // mid-listing, we don't want to fire the prompt twice for the same
    // first-connect intent.
    await context.workspaceState.update(FIRST_CONNECT_KEY, true);
    try {
        const newRemoteCount = await syncEngine.countNewRemoteFiles();
        if (newRemoteCount > 0) {
            const noun = newRemoteCount === 1 ? 'script' : 'scripts';
            const choice = await vscode.window.showInformationMessage(`Bitburner has ${newRemoteCount} ${noun} not in this workspace. Download them now?`, 'Download', 'Not now');
            if (choice === 'Download') {
                await syncEngine.downloadAll();
            }
            return;
        }
        // Nothing to download. Check the other direction: local files the
        // server doesn't have. Only offer upload when the download branch
        // is empty so we never ask the user to pick a direction.
        const newLocalCount = await syncEngine.countNewLocalFiles();
        if (newLocalCount <= 0) {
            return;
        }
        const noun = newLocalCount === 1 ? 'script' : 'scripts';
        const choice = await vscode.window.showInformationMessage(`This workspace has ${newLocalCount} ${noun} not in Bitburner. Sync them now?`, 'Sync', 'Not now');
        if (choice === 'Sync') {
            await syncEngine.syncAll();
        }
    }
    catch (err) {
        outputChannel.appendLine(`First-connect sync prompt failed: ${err}`);
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