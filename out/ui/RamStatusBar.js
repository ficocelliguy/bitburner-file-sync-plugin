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
// Command wired to the status bar item's click. Constant so extension.ts and
// this file can't drift out of sync on the name.
exports.SHOW_BREAKDOWN_COMMAND = 'bitburnerSync.showRamCostBreakdown';
// Priority controls left-to-right order inside the Left-aligned status
// group: higher priority renders further left. The primary connect/stop
// item lives at 100, so we sit at 99 to appear immediately to its right.
const STATUS_BAR_PRIORITY = 99;
class RamStatusBar {
    item;
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_BAR_PRIORITY);
        this.item.command = exports.SHOW_BREAKDOWN_COMMAND;
        this.item.hide();
    }
    // Show `total` GB, or hide the item when total is undefined (not a
    // script, no connection, or the server can't compute the cost).
    update(total) {
        if (total === undefined) {
            this.item.hide();
            return;
        }
        this.item.text = `$(chip) RAM: ${(0, RamCost_1.formatRam)(total)}`;
        this.item.tooltip = 'RAM cost reported by Bitburner for the file on the server. Click for the estimated per-method breakdown.';
        this.item.show();
    }
    dispose() {
        this.item.dispose();
    }
}
exports.RamStatusBar = RamStatusBar;
// Command handler for SHOW_BREAKDOWN_COMMAND. Runs the local scraping-based
// scan of the active editor against the registry's cost table and displays
// the result as a QuickPick — a QuickPick renders as a scrollable overlay,
// filters on typing, and dismisses on Escape, which fits the read-only
// "show me what's contributing" affordance better than a modal dialog.
async function showRamCostBreakdown(registry) {
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
        await vscode.window.showInformationMessage('RAM cost table is empty. Connect to Bitburner (or run "Bitburner: Download Type Definitions") so the breakdown can be built.');
        return;
    }
    const { total, entries } = (0, RamCost_1.computeScriptRamCost)(editor.document.getText(), costs);
    if (entries.length === 0) {
        await vscode.window.showInformationMessage('No Netscript methods detected in the current file.');
        return;
    }
    const noun = entries.length === 1 ? 'method' : 'methods';
    await vscode.window.showQuickPick(entries.map(e => ({ label: e.name, description: (0, RamCost_1.formatRam)(e.cost) })), {
        title: `Estimated RAM cost: ${(0, RamCost_1.formatRam)(total)} across ${entries.length} unique ${noun}`,
        placeHolder: 'Highest cost first. Press Escape to close.',
        canPickMany: false,
        matchOnDescription: true,
    });
}
//# sourceMappingURL=RamStatusBar.js.map