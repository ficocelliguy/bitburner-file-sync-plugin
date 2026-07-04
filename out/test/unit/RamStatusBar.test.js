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
const { _reset, _state, StatusBarAlignment } = vscodeMock;
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
    test('shows total + label when entries arrive', () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        bar.update([
            { name: 'hack', cost: 0.1 },
            { name: 'grow', cost: 0.15 },
        ]);
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.shown, true);
        assert_1.strict.match(item.text, /RAM: 0.25 GB/);
        bar.dispose();
    });
    test('hides again when the entry list becomes empty', () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        bar.update([{ name: 'hack', cost: 0.1 }]);
        bar.update([]);
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.shown, false);
        bar.dispose();
    });
    test('showRamCostBreakdown opens a QuickPick populated from the last update', async () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        bar.update([
            { name: 'weaken', cost: 0.15 },
            { name: 'hack', cost: 0.1 },
        ]);
        await (0, RamStatusBar_1.showRamCostBreakdown)(bar);
        assert_1.strict.equal(_state.quickPickCalls.length, 1);
        const call = _state.quickPickCalls[0];
        assert_1.strict.deepEqual(call.items.map(i => i.label), ['weaken', 'hack']);
        const opts = call.options;
        assert_1.strict.match(opts.title ?? '', /Estimated RAM cost: 0.25 GB/);
        bar.dispose();
    });
    test('showRamCostBreakdown falls back to an information message when nothing is detected', async () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        await (0, RamStatusBar_1.showRamCostBreakdown)(bar);
        assert_1.strict.equal(_state.quickPickCalls.length, 0);
        assert_1.strict.equal(_state.notifications.length, 1);
        assert_1.strict.match(_state.notifications[0].message, /No Netscript methods/);
        bar.dispose();
    });
});
//# sourceMappingURL=RamStatusBar.test.js.map