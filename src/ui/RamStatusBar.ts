import * as vscode from 'vscode';
import { computeScriptRamCost, formatRam } from '../ram/RamCost';
import type { NetscriptCostRegistry } from '../ram/NetscriptCostRegistry';

// Command wired to the status bar item's click. Constant so extension.ts and
// this file can't drift out of sync on the name.
export const SHOW_BREAKDOWN_COMMAND = 'bitburnerSync.showRamCostBreakdown';

// Priority controls left-to-right order inside the Left-aligned status
// group: higher priority renders further left. The primary connect/stop
// item lives at 100, so we sit at 99 to appear immediately to its right.
const STATUS_BAR_PRIORITY = 99;

export class RamStatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            STATUS_BAR_PRIORITY,
        );
        this.item.command = SHOW_BREAKDOWN_COMMAND;
        this.item.hide();
    }

    // Show `total` GB, or hide the item when total is undefined (not a
    // script, no connection, or the server can't compute the cost).
    update(total: number | undefined): void {
        if (total === undefined) {
            this.item.hide();
            return;
        }
        this.item.text = `$(chip) RAM: ${formatRam(total)}`;
        this.item.tooltip = 'RAM cost reported by Bitburner for the file on the server. Click for the estimated per-method breakdown.';
        this.item.show();
    }

    dispose(): void {
        this.item.dispose();
    }
}

// Command handler for SHOW_BREAKDOWN_COMMAND. Runs the local scraping-based
// scan of the active editor against the registry's cost table and displays
// the result as a QuickPick — a QuickPick renders as a scrollable overlay,
// filters on typing, and dismisses on Escape, which fits the read-only
// "show me what's contributing" affordance better than a modal dialog.
export async function showRamCostBreakdown(registry: NetscriptCostRegistry): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        await vscode.window.showInformationMessage('Open a script to see its RAM cost breakdown.');
        return;
    }
    const costs = registry.getCosts();
    if (costs.size === 0) {
        // Empty when NetscriptDefinitions.d.ts hasn't been downloaded yet.
        // The user's most likely next step is either "connect" or "run Get
        // Type Definitions", so point them there rather than showing an
        // empty picker.
        await vscode.window.showInformationMessage(
            'RAM cost table is empty. Connect to Bitburner (or run "Bitburner: Download Type Definitions") so the breakdown can be built.'
        );
        return;
    }
    const { total, entries } = computeScriptRamCost(editor.document.getText(), costs);
    if (entries.length === 0) {
        await vscode.window.showInformationMessage('No Netscript methods detected in the current file.');
        return;
    }
    const noun = entries.length === 1 ? 'method' : 'methods';
    await vscode.window.showQuickPick(
        entries.map(e => ({ label: e.name, description: formatRam(e.cost) })),
        {
            title: `Estimated RAM cost: ${formatRam(total)} across ${entries.length} unique ${noun}`,
            placeHolder: 'Highest cost first. Press Escape to close.',
            canPickMany: false,
            matchOnDescription: true,
        },
    );
}
