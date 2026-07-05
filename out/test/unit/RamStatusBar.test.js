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
    test('creates a left-aligned item, initially hidden', () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.alignment, StatusBarAlignment.Left);
        assert_1.strict.equal(item.shown, false);
        bar.dispose();
    });
    test('shows the formatted total when a number arrives', () => {
        const bar = new RamStatusBar_1.RamStatusBar();
        bar.update(1.85);
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.shown, true);
        assert_1.strict.match(item.text, /RAM: 1.85 GB/);
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
//# sourceMappingURL=RamStatusBar.test.js.map