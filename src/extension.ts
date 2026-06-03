import * as vscode from 'vscode';
import { WebSocketServer } from './server/WebSocketServer';
import { JsonRpcClient } from './server/JsonRpcClient';
import { BitburnerApi } from './api/BitburnerApi';
import { Configuration } from './config/Configuration';
import { SyncEngine } from './sync/SyncEngine';
import { FileWatcher } from './sync/FileWatcher';
import { StatusBar } from './ui/StatusBar';

let wsServer: WebSocketServer;
let rpcClient: JsonRpcClient;
let api: BitburnerApi;
let config: Configuration;
let syncEngine: SyncEngine;
let fileWatcher: FileWatcher;
let statusBar: StatusBar;
let outputChannel: vscode.OutputChannel;

// Persistence keys. Names live here so the two callers (the read in
// activate() and the write after running once) can't drift apart.
const FIRST_INSTALL_KEY = 'bitburnerSync.hasOpenedConfigOnFirstInstall';
const FIRST_CONNECT_KEY = 'bitburnerSync.hasConnectedBefore';

async function startServer(): Promise<void> {
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
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to start server: ${err}`);
    }
}

async function stopServer(): Promise<void> {
    fileWatcher.stop();
    await wsServer.stop();
    vscode.window.showInformationMessage('Bitburner sync server stopped.');
}

async function ensureServerStarted(): Promise<void> {
    if (wsServer.state === 'stopped') {
        await startServer();
    }
}

export function activate(context: vscode.ExtensionContext): void {
    outputChannel = vscode.window.createOutputChannel('Bitburner Sync');
    config = new Configuration();

    warnIfMultiRoot(outputChannel);
    warnIfSyncDirectoryUnsafe(outputChannel, config);

    wsServer = new WebSocketServer();
    rpcClient = new JsonRpcClient(wsServer);
    api = new BitburnerApi(rpcClient, config.targetServer);
    syncEngine = new SyncEngine(api, config, outputChannel);
    fileWatcher = new FileWatcher(syncEngine, config);
    statusBar = new StatusBar();

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
            } catch (err) {
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

    context.subscriptions.push(
        vscode.commands.registerCommand('bitburnerSync.startServer', startServer),
        vscode.commands.registerCommand('bitburnerSync.stopServer', stopServer),
        vscode.commands.registerCommand('bitburnerSync.toggleServer', () => {
            // Treat 'error' as stopped-equivalent: clicking the status bar
            // after a failed bind should retry, not turn the server off.
            const offlike = wsServer.state === 'stopped' || wsServer.state === 'error';
            return offlike ? startServer() : stopServer();
        }),
        vscode.commands.registerCommand('bitburnerSync.syncFile', async () => {
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
            } catch (err) {
                vscode.window.showErrorMessage(`Sync failed: ${err}`);
            }
        }),
        vscode.commands.registerCommand('bitburnerSync.syncAll', async () => {
            await ensureServerStarted();
            if (!wsServer.isConnected) {
                vscode.window.showWarningMessage('Not connected to Bitburner.');
                return;
            }
            try {
                await syncEngine.syncAll();
            } catch (err) {
                vscode.window.showErrorMessage(`Sync all failed: ${err}`);
            }
        }),
        vscode.commands.registerCommand('bitburnerSync.getDefinitions', async () => {
            await ensureServerStarted();
            if (!wsServer.isConnected) {
                vscode.window.showWarningMessage('Not connected to Bitburner.');
                return;
            }
            try {
                await syncEngine.downloadDefinitions();
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to download definitions: ${err}`);
            }
        }),
        vscode.commands.registerCommand('bitburnerSync.downloadAll', async () => {
            await ensureServerStarted();
            if (!wsServer.isConnected) {
                vscode.window.showWarningMessage('Not connected to Bitburner.');
                return;
            }
            try {
                await syncEngine.downloadAll();
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to download files: ${err}`);
            }
        }),
        outputChannel,
        statusBar,
        { dispose: () => syncEngine.dispose() },
        { dispose: () => fileWatcher.dispose() },
        { dispose: () => rpcClient.dispose() },
        // Return the Promise so VS Code awaits port release on
        // reload/upgrade. Without this the next activation can race the
        // close callback and hit EADDRINUSE binding to the same port.
        { dispose: () => wsServer.stop() }
    );

    // Restart on any bitburnerSync.* change so the file watcher picks up new
    // glob settings (syncDirectory / fileExtensions), the new port is bound,
    // etc. Bitburner sees the disconnect and reconnects on its own.
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
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
        })
    );

    // Auto-start if configured
    if (config.autoStart) {
        startServer();
    }

    // First-install: open the settings UI so the user can see what's
    // available. globalState (not workspaceState) so we only do this once
    // per VS Code install, not on every new workspace.
    void maybeOpenSettingsOnFirstInstall(context);
}

async function maybeOpenSettingsOnFirstInstall(context: vscode.ExtensionContext): Promise<void> {
    if (context.globalState.get<boolean>(FIRST_INSTALL_KEY, false)) {
        return;
    }
    // Mark first so a failed openSettings (e.g. command palette unavailable
    // mid-startup) doesn't re-pop on every reload. The user can always open
    // settings manually if they missed the auto-open.
    await context.globalState.update(FIRST_INSTALL_KEY, true);
    try {
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:bitburner-file-sync-plugin');
    } catch (err) {
        outputChannel.appendLine(`Could not open settings UI: ${err}`);
    }
}

async function maybePromptFirstConnectSync(context: vscode.ExtensionContext): Promise<void> {
    if (context.workspaceState.get<boolean>(FIRST_CONNECT_KEY, false)) {
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
            const choice = await vscode.window.showInformationMessage(
                `Bitburner has ${newRemoteCount} ${noun} not in this workspace. Download them now?`,
                'Download', 'Not now'
            );
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
        const choice = await vscode.window.showInformationMessage(
            `This workspace has ${newLocalCount} ${noun} not in Bitburner. Sync them now?`,
            'Sync', 'Not now'
        );
        if (choice === 'Sync') {
            await syncEngine.syncAll();
        }
    } catch (err) {
        outputChannel.appendLine(`First-connect sync prompt failed: ${err}`);
    }
}

export function deactivate(): void {
    // Cleanup handled by subscriptions
}

// Multi-root workspaces aren't fully supported: only the first folder is used
// for upload globbing and as the destination for downloads. Warn once so users
// don't silently wonder why files in other folders aren't syncing.
function warnIfMultiRoot(channel: vscode.OutputChannel): void {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length <= 1) {
        return;
    }
    const first = folders[0];
    const msg = `Bitburner Sync: multi-root workspace detected (${folders.length} folders). Only "${first.name}" (${first.uri.fsPath}) will be synced; files in other folders are ignored.`;
    channel.appendLine(msg);
    vscode.window.showWarningMessage(msg);
}

function warnIfSyncDirectoryUnsafe(channel: vscode.OutputChannel, cfg: Configuration): void {
    const err = cfg.syncDirectoryError();
    if (!err) {
        return;
    }
    channel.appendLine(err);
    vscode.window.showWarningMessage(err);
}
