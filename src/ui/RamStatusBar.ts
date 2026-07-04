import * as vscode from 'vscode';
import { formatRam, type RamCostEntry } from '../ram/RamCost';

// Command wired to the status bar item's click. Kept as a constant so the
// same name is used at registration time (extension.ts) and here without
// risk of drift.
export const SHOW_BREAKDOWN_COMMAND = 'bitburnerSync.showRamCostBreakdown';

// Priority controls left-to-right order inside the Left-aligned status
// group: higher priority renders further left. The primary connect/stop
// item lives at 100, so we sit at 99 to appear immediately to its right.
const STATUS_BAR_PRIORITY = 99;

export class RamStatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private lastEntries: RamCostEntry[] = [];

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            STATUS_BAR_PRIORITY,
        );
        this.item.command = SHOW_BREAKDOWN_COMMAND;
        this.item.hide();
    }

    // Replace the currently-shown estimate. Passing an empty array hides
    // the item entirely — the user asked that the indicator disappear when
    // the active file has no identifiable Netscript methods.
    update(entries: readonly RamCostEntry[]): void {
        this.lastEntries = entries.slice();
        if (entries.length === 0) {
            this.item.hide();
            return;
        }
        const total = entries.reduce((sum, e) => sum + e.cost, 1.6);
        this.item.text = `$(chip) RAM: ${formatRam(total)}`;
        this.item.tooltip = 'Estimated static RAM cost. Click for the per-method breakdown.';
        this.item.show();
    }

    getEntries(): readonly RamCostEntry[] {
        return this.lastEntries;
    }

    dispose(): void {
        this.item.dispose();
    }
}

// Render the per-method breakdown as a QuickPick. QuickPick displays as a
// modal-style overlay in VS Code, handles scrolling for long lists, and
// gives the user free-text filtering. `canPickMany: false` and ignoring the
// selection means the picker is read-only — dismissing it (Escape / click
// outside) closes the view, matching the "click to see, click away to
// dismiss" flow the user described.
export async function showRamCostBreakdown(bar: RamStatusBar): Promise<void> {
    const entries = bar.getEntries();
    if (entries.length === 0) {
        await vscode.window.showInformationMessage('No Netscript methods detected in the current file.');
        return;
    }
    const total = entries.reduce((sum, e) => sum + e.cost, 0);
    const noun = entries.length === 1 ? 'method' : 'methods';
    await vscode.window.showQuickPick(
        entries.map(e => ({ label: e.name, description: formatRam(e.cost) })),
        {
            title: `Estimated RAM cost: ${formatRam(total)} across ${entries.length} unique ${noun}`,
            placeHolder: 'Filter ns methods...',
            canPickMany: false,
            matchOnDescription: true,
        },
    );
}
