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
const assert_1 = require("assert");
const vscodeMock = __importStar(require("./mocks/vscode"));
const RamStatusBar_1 = require("../../ui/RamStatusBar");
const { _reset, _state, StatusBarAlignment, Uri } = vscodeMock;
// Minimal stand-in for NetscriptCostRegistry. Only needs `getCosts()` for
// the breakdown helper — no watchers, no disk I/O.
function fakeRegistry(costs) {
    return { getCosts: () => costs };
}
suite('RamStatusBar', () => {
    setup(() => {
        _reset();
    });
    test('creates a left-aligned item wired to the breakdown command, initially hidden', () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.alignment, StatusBarAlignment.Left);
        assert_1.strict.equal(item.command, RamStatusBar_1.SHOW_BREAKDOWN_COMMAND);
        assert_1.strict.equal(item.shown, false);
        bar.dispose();
    });
    test('shows the padded total when a number arrives', () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        bar.update(1.85);
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.shown, true);
        assert_1.strict.match(item.text, /RAM: 1\.85 GB/);
        bar.dispose();
    });
    test('pads integer totals with trailing zeros (matches game display)', () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        bar.update(2);
        const item = _state.statusBarItems[0];
        assert_1.strict.match(item.text, /RAM: 2\.00 GB/);
        bar.dispose();
    });
    test('hides when total is undefined', () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        bar.update(2.5);
        bar.update(undefined);
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.shown, false);
        bar.dispose();
    });
});
suite('showRamCostBreakdown', () => {
    setup(() => {
        _reset();
    });
    test('opens a QuickPick populated from the active editor + registry with base cost last', async () => {
        _state.activeTextEditor = {
            document: {
                uri: Uri.file('/workspace/main.js'),
                getText: () => 'ns.hack("n00dles"); ns.grow("home");',
            },
        };
        const registry = fakeRegistry(new Map([['hack', 0.1], ['grow', 0.15]]));
        await (0, RamStatusBar_1.showRamCostBreakdown)(registry);
        assert_1.strict.equal(_state.quickPickCalls.length, 1);
        const call = _state.quickPickCalls[0];
        // grow (0.15) sorts before hack (0.1); Base cost pinned last.
        assert_1.strict.deepEqual(call.items.map(i => i.label), ['grow', 'hack', 'Base cost']);
        const opts = call.options;
        // 0.15 + 0.1 + 1.6 = 1.85
        assert_1.strict.match(opts.title ?? '', /RAM cost: 1\.85 GB/);
    });
    test('shows a friendly message when the cost table is empty (no d.ts yet)', async () => {
        _state.activeTextEditor = {
            document: {
                uri: Uri.file('/workspace/main.js'),
                getText: () => 'ns.hack("n00dles");',
            },
        };
        await (0, RamStatusBar_1.showRamCostBreakdown)(fakeRegistry(new Map()));
        assert_1.strict.equal(_state.quickPickCalls.length, 0);
        assert_1.strict.equal(_state.notifications.length, 1);
        assert_1.strict.match(_state.notifications[0].message, /RAM cost table is empty/);
    });
    test('shows a friendly message when the file has no ns methods', async () => {
        _state.activeTextEditor = {
            document: {
                uri: Uri.file('/workspace/main.js'),
                getText: () => 'const x = 1;',
            },
        };
        await (0, RamStatusBar_1.showRamCostBreakdown)(fakeRegistry(new Map([['hack', 0.1]])));
        assert_1.strict.equal(_state.quickPickCalls.length, 0);
        assert_1.strict.equal(_state.notifications.length, 1);
        assert_1.strict.match(_state.notifications[0].message, /No Netscript methods/);
    });
    test('shows a friendly message when there is no active editor', async () => {
        await (0, RamStatusBar_1.showRamCostBreakdown)(fakeRegistry(new Map([['hack', 0.1]])));
        assert_1.strict.equal(_state.quickPickCalls.length, 0);
        assert_1.strict.equal(_state.notifications.length, 1);
        assert_1.strict.match(_state.notifications[0].message, /Open a script/);
    });
});
//# sourceMappingURL=RamStatusBar.test.js.map