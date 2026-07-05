import * as vscode from 'vscode';
import type { BitburnerApi } from '../api/BitburnerApi';
import type { Configuration } from '../config/Configuration';
import { FILE_EXTENSION_DEFAULTS } from '../config/Configuration';
import { PathMapper } from '../sync/PathMapper';
import type { SyncEngine } from '../sync/SyncEngine';
import type { WebSocketServer } from '../server/WebSocketServer';

// File extensions that plausibly contain Netscript code. The Bitburner
// runtime executes .js/.ts/.jsx/.tsx; anything else (README, tsconfig, css)
// isn't a script and shouldn't produce a RAM figure.
const SCRIPT_EXTENSIONS = FILE_EXTENSION_DEFAULTS;

// Asks Bitburner for the RAM cost of the active file and forwards the
// result to the caller-provided sink. Two things drive an update:
//   1. The user switches editors — we recompute for the newly-active file.
//   2. A pushFile finishes (auto-sync on save, manual `Sync Current File`,
//      rename-push). We wait for the push to complete rather than firing
//      on the save event so calculateRam sees the just-pushed content.
// The status bar is hidden while disconnected, on files outside the
// syncable set, or when the server can't compute a cost (file not on
// server yet, parse error, etc.).
export class RamCostTracker implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly pathMapper: PathMapper;
    // Monotonic token so an older in-flight calculateRam can't overwrite a
    // newer result. Every recompute() bumps this; when the RPC resolves,
    // we compare against the current value and drop the write if we've
    // been superseded.
    private recomputeToken = 0;
    private readonly onConnected: () => void;
    private readonly onDisconnected: () => void;

    constructor(
        private readonly outputChannel: vscode.OutputChannel,
        private readonly onUpdate: (total: number | undefined) => void,
        private readonly api: BitburnerApi,
        private readonly config: Configuration,
        private readonly wsServer: WebSocketServer,
        syncEngine: SyncEngine,
    ) {
        this.pathMapper = new PathMapper(config);

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                void this.recompute();
            }),
        );

        // Recompute after each push so the number reflects what's actually
        // on the server. Filter to the active editor's file — background
        // syncAll runs don't tell us anything about the file the user is
        // looking at.
        this.disposables.push(
            syncEngine.onDidPush((remote) => {
                const activeRemote = this.activeRemotePath();
                if (activeRemote !== undefined && activeRemote === remote) {
                    void this.recompute();
                }
            }),
        );

        this.onConnected = (): void => { void this.recompute(); };
        this.onDisconnected = (): void => {
            this.recomputeToken++;
            this.onUpdate(undefined);
        };
        this.wsServer.on('connected', this.onConnected);
        this.wsServer.on('disconnected', this.onDisconnected);
    }

    // Public trigger for the initial read at activation time.
    async initialize(): Promise<void> {
        await this.recompute();
    }

    private async recompute(): Promise<void> {
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
        let remotePath: string;
        try {
            remotePath = this.pathMapper.mapToRemote(editor.document.uri);
        } catch {
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
        } catch (err) {
            if (token !== this.recomputeToken) {
                return;
            }
            // Common cases: file not on server yet, parse error in the
            // script, disconnected mid-request. All benign — hide the
            // indicator and log for diagnostics.
            this.outputChannel.appendLine(
                `calculateRam(${remotePath}) failed: ${err instanceof Error ? err.message : err}`
            );
            this.onUpdate(undefined);
        }
    }

    private activeRemotePath(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isScriptDocument(editor.document)) {
            return undefined;
        }
        try {
            return this.pathMapper.mapToRemote(editor.document.uri);
        } catch {
            return undefined;
        }
    }

    dispose(): void {
        this.wsServer.off('connected', this.onConnected);
        this.wsServer.off('disconnected', this.onDisconnected);
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
    }
}

function isScriptDocument(doc: vscode.TextDocument): boolean {
    const p = doc.uri.fsPath.toLowerCase();
    const dot = p.lastIndexOf('.');
    if (dot < 0) {
        return false;
    }
    const ext = p.slice(dot);
    return (SCRIPT_EXTENSIONS as readonly string[]).includes(ext);
}
