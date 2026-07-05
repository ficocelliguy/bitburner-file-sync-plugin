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
exports.RamStatusBar = void 0;
const vscode = __importStar(require("vscode"));
const RamCost_1 = require("../ram/RamCost");
// Priority controls left-to-right order inside the Left-aligned status
// group: higher priority renders further left. The primary connect/stop
// item lives at 100, so we sit at 99 to appear immediately to its right.
const STATUS_BAR_PRIORITY = 99;
class RamStatusBar {
    item;
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_BAR_PRIORITY);
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
        this.item.tooltip = 'RAM cost reported by Bitburner for the file on the server.';
        this.item.show();
    }
    dispose() {
        this.item.dispose();
    }
}
exports.RamStatusBar = RamStatusBar;
//# sourceMappingURL=RamStatusBar.js.map