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
const StatusBar_1 = require("../../ui/StatusBar");
const { _reset, _state, ThemeColor, StatusBarAlignment } = vscodeMock;
suite('StatusBar', () => {
    setup(() => {
        _reset();
    });
    test('creates a left-aligned status bar item bound to the toggle command', () => {
        const bar = new StatusBar_1.StatusBar();
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.alignment, StatusBarAlignment.Left);
        assert_1.strict.equal(item.command, 'bitburnerSync.toggleServer');
        assert_1.strict.equal(item.shown, true);
        bar.dispose();
    });
    test('initialises in the stopped display', () => {
        new StatusBar_1.StatusBar();
        const item = _state.statusBarItems[0];
        assert_1.strict.match(item.text, /Bitburner: Off/);
        assert_1.strict.match(item.tooltip, /Click to start/);
        assert_1.strict.equal(item.backgroundColor, undefined);
    });
    test('update("waiting") shows the waiting label', () => {
        const bar = new StatusBar_1.StatusBar();
        bar.update('waiting');
        const item = _state.statusBarItems[0];
        assert_1.strict.match(item.text, /Bitburner: Waiting/);
        assert_1.strict.match(item.tooltip, /waiting for Bitburner/);
        assert_1.strict.equal(item.backgroundColor, undefined);
    });
    test('update("connected") shows the connected label', () => {
        const bar = new StatusBar_1.StatusBar();
        bar.update('connected');
        const item = _state.statusBarItems[0];
        assert_1.strict.match(item.text, /Bitburner: Connected/);
        assert_1.strict.equal(item.backgroundColor, undefined);
    });
    test('update("error") sets the error background color', () => {
        const bar = new StatusBar_1.StatusBar();
        bar.update('error');
        const item = _state.statusBarItems[0];
        assert_1.strict.match(item.text, /Bitburner: Error/);
        assert_1.strict.ok(item.backgroundColor instanceof ThemeColor);
        assert_1.strict.equal(item.backgroundColor.id, 'statusBarItem.errorBackground');
    });
    test('update transitions clear the error background when going back to a normal state', () => {
        const bar = new StatusBar_1.StatusBar();
        bar.update('error');
        bar.update('connected');
        const item = _state.statusBarItems[0];
        assert_1.strict.equal(item.backgroundColor, undefined);
    });
    test('dispose() disposes the underlying status bar item', () => {
        const bar = new StatusBar_1.StatusBar();
        const item = _state.statusBarItems[0];
        bar.dispose();
        assert_1.strict.equal(item.disposed, true);
    });
});
//# sourceMappingURL=StatusBar.test.js.map