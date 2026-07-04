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
exports.RamStatusBar = exports.SHOW_BREAKDOWN_COMMAND = void 0;
exports.showRamCostBreakdown = showRamCostBreakdown;
const vscode = __importStar(require("vscode"));
const RamCost_1 = require("../ram/RamCost");
// Command wired to the status bar item's click. Kept as a constant so the
// same name is used at registration time (extension.ts) and here without
// risk of drift.
exports.SHOW_BREAKDOWN_COMMAND = 'bitburnerSync.showRamCostBreakdown';
// Priority controls left-to-right order inside the Left-aligned status
// group: higher priority renders further left. The primary connect/stop
// item lives at 100, so we sit at 99 to appear immediately to its right.
const STATUS_BAR_PRIORITY = 99;
class RamStatusBar {
    item;
    lastEntries = [];
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_BAR_PRIORITY);
        this.item.command = exports.SHOW_BREAKDOWN_COMMAND;
        this.item.hide();
    }
    // Replace the currently-shown estimate. Passing an empty array hides
    // the item entirely — the user asked that the indicator disappear when
    // the active file has no identifiable Netscript methods.
    update(entries) {
        this.lastEntries = entries.slice();
        if (entries.length === 0) {
            this.item.hide();
            return;
        }
        const total = entries.reduce((sum, e) => sum + e.cost, 0);
        this.item.text = `$(chip) RAM: ${(0, RamCost_1.formatRam)(total)}`;
        this.item.tooltip = 'Estimated static RAM cost. Click for the per-method breakdown.';
        this.item.show();
    }
    getEntries() {
        return this.lastEntries;
    }
    dispose() {
        this.item.dispose();
    }
}
exports.RamStatusBar = RamStatusBar;
// Render the per-method breakdown as a QuickPick. QuickPick displays as a
// modal-style overlay in VS Code, handles scrolling for long lists, and
// gives the user free-text filtering. `canPickMany: false` and ignoring the
// selection means the picker is read-only — dismissing it (Escape / click
// outside) closes the view, matching the "click to see, click away to
// dismiss" flow the user described.
async function showRamCostBreakdown(bar) {
    const entries = bar.getEntries();
    if (entries.length === 0) {
        await vscode.window.showInformationMessage('No Netscript methods detected in the current file.');
        return;
    }
    const total = entries.reduce((sum, e) => sum + e.cost, 0);
    const noun = entries.length === 1 ? 'method' : 'methods';
    await vscode.window.showQuickPick(entries.map(e => ({ label: e.name, description: (0, RamCost_1.formatRam)(e.cost) })), {
        title: `Estimated RAM cost: ${(0, RamCost_1.formatRam)(total)} across ${entries.length} unique ${noun}`,
        placeHolder: 'Filter ns methods...',
        canPickMany: false,
        matchOnDescription: true,
    });
}
//# sourceMappingURL=RamStatusBar.js.map