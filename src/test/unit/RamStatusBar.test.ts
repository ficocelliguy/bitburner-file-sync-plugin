import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { RamStatusBar, showRamCostBreakdown, SHOW_BREAKDOWN_COMMAND } from '../../ui/RamStatusBar';
import type { NetscriptCostRegistry } from '../../ram/NetscriptCostRegistry';

const { _reset, _state, StatusBarAlignment, Uri } = vscodeMock;

// Minimal stand-in for NetscriptCostRegistry. Only needs `getCosts()` for
// the breakdown helper — no watchers, no disk I/O.
function fakeRegistry(costs: Map<string, number>): NetscriptCostRegistry {
    return { getCosts: () => costs } as unknown as NetscriptCostRegistry;
}

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

    test('shows the padded total when a number arrives', () => {
        const bar = new RamStatusBar();
        bar.update(1.85);
        const item = _state.statusBarItems[0];
        assert.equal(item.shown, true);
        assert.match(item.text, /RAM: 1\.85 GB/);
        bar.dispose();
    });

    test('pads integer totals with trailing zeros (matches game display)', () => {
        const bar = new RamStatusBar();
        bar.update(2);
        const item = _state.statusBarItems[0];
        assert.match(item.text, /RAM: 2\.00 GB/);
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
        await showRamCostBreakdown(registry);
        assert.equal(_state.quickPickCalls.length, 1);
        const call = _state.quickPickCalls[0];
        // grow (0.15) sorts before hack (0.1); Base cost pinned last.
        assert.deepEqual(
            (call.items as { label: string; description: string }[]).map(i => i.label),
            ['grow', 'hack', 'Base cost'],
        );
        const opts = call.options as { title?: string };
        // 0.15 + 0.1 + 1.6 = 1.85
        assert.match(opts.title ?? '', /RAM cost: 1\.85 GB/);
    });

    test('shows a friendly message when the cost table is empty (no d.ts yet)', async () => {
        _state.activeTextEditor = {
            document: {
                uri: Uri.file('/workspace/main.js'),
                getText: () => 'ns.hack("n00dles");',
            },
        };
        await showRamCostBreakdown(fakeRegistry(new Map()));
        assert.equal(_state.quickPickCalls.length, 0);
        assert.equal(_state.notifications.length, 1);
        assert.match(_state.notifications[0].message, /RAM cost table is empty/);
    });

    test('shows a friendly message when the file has no ns methods', async () => {
        _state.activeTextEditor = {
            document: {
                uri: Uri.file('/workspace/main.js'),
                getText: () => 'const x = 1;',
            },
        };
        await showRamCostBreakdown(fakeRegistry(new Map([['hack', 0.1]])));
        assert.equal(_state.quickPickCalls.length, 0);
        assert.equal(_state.notifications.length, 1);
        assert.match(_state.notifications[0].message, /No Netscript methods/);
    });

    test('shows a friendly message when there is no active editor', async () => {
        await showRamCostBreakdown(fakeRegistry(new Map([['hack', 0.1]])));
        assert.equal(_state.quickPickCalls.length, 0);
        assert.equal(_state.notifications.length, 1);
        assert.match(_state.notifications[0].message, /Open a script/);
    });
});
