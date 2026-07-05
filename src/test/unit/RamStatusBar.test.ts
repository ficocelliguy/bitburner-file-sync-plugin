import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { RamStatusBar } from '../../ui/RamStatusBar';

const { _reset, _state, StatusBarAlignment } = vscodeMock;

suite('RamStatusBar', () => {
    setup(() => {
        _reset();
    });

    test('creates a left-aligned item, initially hidden', () => {
        const bar = new RamStatusBar();
        const item = _state.statusBarItems[0];
        assert.equal(item.alignment, StatusBarAlignment.Left);
        assert.equal(item.shown, false);
        bar.dispose();
    });

    test('shows the formatted total when a number arrives', () => {
        const bar = new RamStatusBar();
        bar.update(1.85);
        const item = _state.statusBarItems[0];
        assert.equal(item.shown, true);
        assert.match(item.text, /RAM: 1.85 GB/);
        bar.dispose();
    });

    test('hides when total is undefined', () => {
        const bar = new RamStatusBar();
        bar.update(2.5);
        bar.update(undefined);
        const item = _state.statusBarItems[0];
        assert.equal(item.shown, false);
        bar.dispose();
    });
});
