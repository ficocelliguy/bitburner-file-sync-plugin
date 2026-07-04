import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { RamStatusBar, showRamCostBreakdown, SHOW_BREAKDOWN_COMMAND } from '../../ui/RamStatusBar';

const { _reset, _state, StatusBarAlignment } = vscodeMock;

suite('RamStatusBar', () => {
    setup(() => {
        _reset();
    });

    test('creates a left-aligned item wired to the breakdown command, initially hidden', () => {
        const bar = new RamStatusBar();
        const item = _state.statusBarItems[0];
        assert.equal(item.alignment, StatusBarAlignment.Left);
        assert.equal(item.command, SHOW_BREAKDOWN_COMMAND);
        assert.equal(item.shown, false);
        bar.dispose();
    });

    test('shows total + label when entries arrive', () => {
        const bar = new RamStatusBar();
        bar.update([
            { name: 'hack', cost: 0.1 },
            { name: 'grow', cost: 0.15 },
        ]);
        const item = _state.statusBarItems[0];
        assert.equal(item.shown, true);
        assert.match(item.text, /RAM: 0.25 GB/);
        bar.dispose();
    });

    test('hides again when the entry list becomes empty', () => {
        const bar = new RamStatusBar();
        bar.update([{ name: 'hack', cost: 0.1 }]);
        bar.update([]);
        const item = _state.statusBarItems[0];
        assert.equal(item.shown, false);
        bar.dispose();
    });

    test('showRamCostBreakdown opens a QuickPick populated from the last update', async () => {
        const bar = new RamStatusBar();
        bar.update([
            { name: 'weaken', cost: 0.15 },
            { name: 'hack', cost: 0.1 },
        ]);
        await showRamCostBreakdown(bar);
        assert.equal(_state.quickPickCalls.length, 1);
        const call = _state.quickPickCalls[0];
        assert.deepEqual(
            (call.items as { label: string; description: string }[]).map(i => i.label),
            ['weaken', 'hack'],
        );
        const opts = call.options as { title?: string };
        assert.match(opts.title ?? '', /Estimated RAM cost: 0.25 GB/);
        bar.dispose();
    });

    test('showRamCostBreakdown falls back to an information message when nothing is detected', async () => {
        const bar = new RamStatusBar();
        await showRamCostBreakdown(bar);
        assert.equal(_state.quickPickCalls.length, 0);
        assert.equal(_state.notifications.length, 1);
        assert.match(_state.notifications[0].message, /No Netscript methods/);
        bar.dispose();
    });
});
