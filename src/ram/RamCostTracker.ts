import * as vscode from 'vscode';
import type { BitburnerApi } from '../api/BitburnerApi';
import type { Configuration } from '../config/Configuration';
import { FILE_EXTENSION_DEFAULTS } from '../config/Configuration';
import { PathMapper } from '../sync/PathMapper';
import type { SyncEngine } from '../sync/SyncEngine';
import type { WebSocketServer } from '../server/WebSocketServer';
import type { NetscriptCostRegistry } from './NetscriptCostRegistry';
import { computeScriptRamCost } from './RamCost';

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
//
// While disconnected we fall back to a local, definition-scraping scan of
// the active file (see NetscriptCostRegistry / computeScriptRamCost). That
// keeps a rough estimate visible in the status bar even before the user has
// started the sync server — the number won't match Bitburner exactly (false
// positives from bare-word identifier matching are accepted), but it's a
// useful preview. When connected, the server-computed value is always
// preferred because it uses full AST analysis.
//
// The indicator stays hidden for non-script files, and — in the fallback
// path — for scripts that don't reference any recognized ns method.
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
        private readonly registry: NetscriptCostRegistry,
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

        // Save events keep the disconnected-fallback estimate fresh: with
        // no push RPC to hook, the local scan wouldn't otherwise re-run
        // after the user edits the file. When connected, the push event
        // above already covers the same case, so this handler no-ops
        // (recompute takes the server path instead).
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((doc) => {
                if (this.wsServer.isConnected) {
                    return;
                }
                const active = vscode.window.activeTextEditor;
                if (active && active.document.uri.toString() === doc.uri.toString()) {
                    void this.recompute();
                }
            }),
        );

        // Registry reloads (a fresh d.ts arriving on disk) can change what
        // the fallback scan produces, so pick that up too. When connected
        // the recompute takes the server path and the registry's change
        // has no effect on the displayed number — safe to call blindly.
        this.disposables.push(
            registry.onDidReload(() => { void this.recompute(); }),
        );

        this.onConnected = (): void => { void this.recompute(); };
        // On disconnect, hand off to the local fallback (which may hide
        // the indicator, or may show the scraped total — recompute() picks
        // the right branch based on wsServer.isConnected at call time).
        this.onDisconnected = (): void => { void this.recompute(); };
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
            // Fallback path: no server round-trip available, so approximate
            // from the workspace's scraped cost table. Hides the indicator
            // when the scan finds no ns methods so the status bar doesn't
            // light up for a plain .js file that happens to be open.
            this.onUpdate(this.localScan(editor.document));
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

    // Scrape-based total for the disconnected fallback. Returns `undefined`
    // when the scan finds no recognized ns methods so the caller can hide
    // the status bar item rather than show a lone "1.60 GB" base charge
    // for a script that isn't actually using the API.
    private localScan(doc: vscode.TextDocument): number | undefined {
        const costs = this.registry.getCosts();
        if (costs.size === 0) {
            return undefined;
        }
        const { total, entries } = computeScriptRamCost(doc.getText(), costs);
        if (entries.length === 0) {
            return undefined;
        }
        return total;
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
