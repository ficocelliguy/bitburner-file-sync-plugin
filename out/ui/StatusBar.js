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
exports.StatusBar = void 0;
const vscode = __importStar(require("vscode"));
const STATE_DISPLAY = {
    stopped: {
        text: '$(debug-stop) Bitburner: Off',
        tooltip: 'Click to start sync server'
    },
    waiting: {
        text: '$(watch) Bitburner: Waiting',
        tooltip: 'Server running, waiting for Bitburner to connect'
    },
    connected: {
        text: '$(check) Bitburner: Connected',
        tooltip: 'Connected to Bitburner'
    },
    stale: {
        text: '$(warning) Bitburner: Stale',
        tooltip: 'Bitburner has not responded to recent liveness checks; the socket is still open and will recover on any reply',
        color: new vscode.ThemeColor('statusBarItem.warningBackground')
    },
    error: {
        text: '$(error) Bitburner: Error',
        tooltip: 'Server error - click to retry',
        color: new vscode.ThemeColor('statusBarItem.errorBackground')
    }
};
class StatusBar {
    item;
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = 'bitburnerSync.toggleServer';
        this.update('stopped');
        this.item.show();
    }
    update(state) {
        const display = STATE_DISPLAY[state];
        this.item.text = display.text;
        this.item.tooltip = display.tooltip;
        this.item.backgroundColor = display.color;
    }
    dispose() {
        this.item.dispose();
    }
}
exports.StatusBar = StatusBar;
//# sourceMappingURL=StatusBar.js.map