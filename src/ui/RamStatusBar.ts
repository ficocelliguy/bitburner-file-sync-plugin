import * as vscode from 'vscode';
import { formatRam } from '../ram/RamCost';

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
        this.item.tooltip = 'RAM cost reported by Bitburner for the file on the server.';
        this.item.show();
    }

    dispose(): void {
        this.item.dispose();
    }
}
