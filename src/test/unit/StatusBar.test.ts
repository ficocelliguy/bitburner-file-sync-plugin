import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { StatusBar } from '../../ui/StatusBar';

const { _reset, _state, ThemeColor, StatusBarAlignment } = vscodeMock;

suite('StatusBar', () => {
    setup(() => {
        _reset();
    });

    test('creates a left-aligned status bar item bound to the toggle command', () => {
        const bar = new StatusBar();
        const item = _state.statusBarItems[0];
        assert.equal(item.alignment, StatusBarAlignment.Left);
        assert.equal(item.command, 'bitburnerSync.toggleServer');
        assert.equal(item.shown, true);
        bar.dispose();
    });

    test('initialises in the stopped display', () => {
        new StatusBar();
        const item = _state.statusBarItems[0];
        assert.match(item.text, /Bitburner: Off/);
        assert.match(item.tooltip, /Click to start/);
        assert.equal(item.backgroundColor, undefined);
    });

    test('update("waiting") shows the waiting label', () => {
        const bar = new StatusBar();
        bar.update('waiting');
        const item = _state.statusBarItems[0];
        assert.match(item.text, /Bitburner: Waiting/);
        assert.match(item.tooltip, /waiting for Bitburner/);
        assert.equal(item.backgroundColor, undefined);
    });

    test('update("connected") shows the connected label', () => {
        const bar = new StatusBar();
        bar.update('connected');
        const item = _state.statusBarItems[0];
        assert.match(item.text, /Bitburner: Connected/);
        assert.equal(item.backgroundColor, undefined);
    });

    test('update("error") sets the error background color', () => {
        const bar = new StatusBar();
        bar.update('error');
        const item = _state.statusBarItems[0];
        assert.match(item.text, /Bitburner: Error/);
        assert.ok(item.backgroundColor instanceof ThemeColor);
        assert.equal((item.backgroundColor as InstanceType<typeof ThemeColor>).id, 'statusBarItem.errorBackground');
    });

    test('update transitions clear the error background when going back to a normal state', () => {
        const bar = new StatusBar();
        bar.update('error');
        bar.update('connected');
        const item = _state.statusBarItems[0];
        assert.equal(item.backgroundColor, undefined);
    });

    test('dispose() disposes the underlying status bar item', () => {
        const bar = new StatusBar();
        const item = _state.statusBarItems[0];
        bar.dispose();
        assert.equal(item.disposed, true);
    });
});
