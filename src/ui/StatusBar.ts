import * as vscode from 'vscode';
import type { ConnectionState } from '../types';

const STATE_DISPLAY: Record<ConnectionState, { text: string; tooltip: string; color?: vscode.ThemeColor }> = {
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

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = 'bitburnerSync.toggleServer';
        this.update('stopped');
        this.item.show();
    }

    update(state: ConnectionState): void {
        const display = STATE_DISPLAY[state];
        this.item.text = display.text;
        this.item.tooltip = display.tooltip;
        this.item.backgroundColor = display.color;
    }

    dispose(): void {
        this.item.dispose();
    }
}
