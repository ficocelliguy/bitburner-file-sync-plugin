import * as vscode from 'vscode';
import { parseRamCosts } from './RamCost';

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
export class NetscriptCostRegistry implements vscode.Disposable {
    private costs: Map<string, number> = new Map();
    private readonly disposables: vscode.Disposable[] = [];
    private readonly reloadListeners: Array<() => void> = [];

    constructor(private readonly outputChannel: vscode.OutputChannel) {
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            return;
        }
        const pattern = new vscode.RelativePattern(primary, DEFINITIONS_FILE);
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const reload = (): void => { void this.reload(); };
        watcher.onDidCreate(reload, null, this.disposables);
        watcher.onDidChange(reload, null, this.disposables);
        watcher.onDidDelete(() => {
            this.costs = new Map();
            this.fireReload();
        }, null, this.disposables);
        this.disposables.push(watcher);
    }

    async initialize(): Promise<void> {
        await this.reload();
    }

    getCosts(): Map<string, number> {
        return this.costs;
    }

    // Fires whenever the cost table is (re)loaded — initial load, d.ts
    // create/change/delete. The `RamCostTracker` subscribes so its
    // disconnected fallback picks up a fresh table without waiting for
    // another editor switch or save.
    onDidReload(listener: () => void): vscode.Disposable {
        this.reloadListeners.push(listener);
        return {
            dispose: (): void => {
                const i = this.reloadListeners.indexOf(listener);
                if (i >= 0) {
                    this.reloadListeners.splice(i, 1);
                }
            },
        };
    }

    private fireReload(): void {
        for (const l of this.reloadListeners) {
            try {
                l();
            } catch (err) {
                this.outputChannel.appendLine(
                    `NetscriptCostRegistry reload listener threw: ${err instanceof Error ? err.message : err}`
                );
            }
        }
    }

    private async reload(): Promise<void> {
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
            this.costs = parseRamCosts(source);
            this.outputChannel.appendLine(`RAM cost table loaded: ${this.costs.size} Netscript methods`);
        } catch {
            // No d.ts yet — the user hasn't connected/downloaded. Leave the
            // table empty; the click handler will show a friendly "connect
            // first" message instead of a bogus breakdown.
            this.costs = new Map();
        }
        this.fireReload();
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
    }
}
