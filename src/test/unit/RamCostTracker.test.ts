import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { BitburnerApi } from '../../api/BitburnerApi';
import { Configuration } from '../../config/Configuration';
import { SyncEngine } from '../../sync/SyncEngine';
import { RamCostTracker } from '../../ram/RamCostTracker';
import type { NetscriptCostRegistry } from '../../ram/NetscriptCostRegistry';
import { BASE_RAM_COST } from '../../ram/RamCost';
import { FakeRpcClient, FakeServer, waitMs } from './helpers';

const { Uri, _reset, _setWorkspaceFolders, _state, _writeFile } = vscodeMock;

// Set the active editor without triggering the onDidChangeActiveTextEditor
// listeners. Tests use this to seed state *before* building the tracker so
// its constructor-time subscriptions don't fire a stray recompute that
// consumes a queued RPC response.
function seedActiveEditor(uri: vscodeMock.Uri, text = ''): void {
    _state.activeTextEditor = { document: { uri, getText: () => text } };
}

// Minimal stand-in for NetscriptCostRegistry. Only exposes what the tracker
// touches — getCosts() for the fallback scan and onDidReload() for the
// live-update subscription — so tests don't need a real d.ts on disk.
function fakeRegistry(costs: Map<string, number> = new Map()): NetscriptCostRegistry {
    return {
        getCosts: () => costs,
        onDidReload: (_l: () => void) => ({ dispose: (): void => { /* no-op */ } }),
    } as unknown as NetscriptCostRegistry;
}

function build(opts: { connected?: boolean; registry?: NetscriptCostRegistry } = {}): {
    rpc: FakeRpcClient;
    api: BitburnerApi;
    server: FakeServer;
    engine: SyncEngine;
    config: Configuration;
    output: vscodeMock.OutputChannel;
    updates: (number | undefined)[];
    tracker: RamCostTracker;
} {
    const rpc = new FakeRpcClient();
    const api = new BitburnerApi(rpc as unknown as import('../../server/JsonRpcClient').JsonRpcClient);
    const server = new FakeServer();
    if (opts.connected) {
        server.setConnected(true);
    }
    const config = new Configuration();
    const output = vscodeMock.window.createOutputChannel('test');
    const engine = new SyncEngine(api, config, output);
    const updates: (number | undefined)[] = [];
    const tracker = new RamCostTracker(
        output,
        (total) => updates.push(total),
        api,
        config,
        server as unknown as import('../../server/WebSocketServer').WebSocketServer,
        engine,
        opts.registry ?? fakeRegistry(),
    );
    return { rpc, api, server, engine, config, output, updates, tracker };
}

suite('RamCostTracker', () => {
    setup(() => {
        _reset();
        _setWorkspaceFolders(['/workspace']);
    });

    test('recompute reports undefined when no editor is active', async () => {
        const { tracker, updates } = build({ connected: true });
        await tracker.initialize();
        assert.deepEqual(updates, [undefined]);
        tracker.dispose();
    });

    test('recompute reports undefined when disconnected', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc } = build({ connected: false });
        await tracker.initialize();
        assert.deepEqual(updates, [undefined]);
        assert.equal(rpc.calls.length, 0, 'must not call calculateRam while disconnected');
        tracker.dispose();
    });

    test('recompute reports undefined for a non-script file', async () => {
        seedActiveEditor(Uri.file('/workspace/notes.md'));
        const { tracker, updates, rpc } = build({ connected: true });
        await tracker.initialize();
        assert.deepEqual(updates, [undefined]);
        assert.equal(rpc.calls.length, 0);
        tracker.dispose();
    });

    test('calls calculateRam for the active script and forwards the total', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc } = build({ connected: true });
        rpc.queueResponse('calculateRam', 4.25);
        await tracker.initialize();
        assert.deepEqual(rpc.calls, [{
            method: 'calculateRam',
            params: { filename: '/a.js', server: 'home' },
        }]);
        assert.deepEqual(updates, [4.25]);
        tracker.dispose();
    });

    test('reports undefined when calculateRam rejects (e.g. file not on server)', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc } = build({ connected: true });
        rpc.queueError('calculateRam', new Error('file not found'));
        await tracker.initialize();
        assert.deepEqual(updates, [undefined]);
        tracker.dispose();
    });

    test('recomputes after a successful push of the active file', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        _writeFile('/workspace/a.js', 'ns.hack("n00dles")');
        const { tracker, updates, rpc, engine } = build({ connected: true });
        // First: initial recompute at initialize()
        rpc.queueResponse('calculateRam', 1);
        await tracker.initialize();
        // Second: push emits, tracker calls calculateRam again
        rpc.queueResponse('calculateRam', 2.4);
        await engine.pushFile(Uri.file('/workspace/a.js'));
        // Let the post-push recompute (kicked off by the onDidPush listener)
        // finish awaiting calculateRam before we assert.
        await waitMs(0);
        const calcCalls = rpc.calls.filter(c => c.method === 'calculateRam');
        assert.equal(calcCalls.length, 2);
        assert.deepEqual(updates, [1, 2.4]);
        tracker.dispose();
    });

    test('does not recompute after a push of a file that is not the active one', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        _writeFile('/workspace/other.js', 'x');
        const { tracker, updates, rpc, engine } = build({ connected: true });
        rpc.queueResponse('calculateRam', 1);
        await tracker.initialize();
        await engine.pushFile(Uri.file('/workspace/other.js'));
        await waitMs(0);
        // Only the initial-load calculateRam should have run.
        assert.equal(rpc.calls.filter(c => c.method === 'calculateRam').length, 1);
        assert.deepEqual(updates, [1]);
        tracker.dispose();
    });

    test('server disconnect hides the indicator', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc, server } = build({ connected: true });
        rpc.queueResponse('calculateRam', 3);
        await tracker.initialize();
        assert.deepEqual(updates, [3]);
        server.setConnected(false);
        server.emit('disconnected');
        assert.deepEqual(updates, [3, undefined]);
        tracker.dispose();
    });

    test('server connect triggers a recompute for the active editor', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc, server } = build({ connected: false });
        await tracker.initialize();
        // Initial: disconnected -> undefined
        assert.deepEqual(updates, [undefined]);
        rpc.queueResponse('calculateRam', 2);
        server.setConnected(true);
        server.emit('connected');
        // Let the async recompute settle.
        await waitMs(0);
        assert.deepEqual(updates, [undefined, 2]);
        tracker.dispose();
    });

    suite('disconnected fallback via scraped cost table', () => {
        test('reports scraped total for an ns-using script when disconnected', async () => {
            seedActiveEditor(Uri.file('/workspace/a.js'), 'ns.hack("home"); ns.grow("home");');
            const registry = fakeRegistry(new Map([['hack', 0.1], ['grow', 0.15]]));
            const { tracker, updates, rpc } = build({ connected: false, registry });
            await tracker.initialize();
            // 0.1 + 0.15 + 1.6 base = 1.85
            assert.deepEqual(updates, [0.1 + 0.15 + BASE_RAM_COST]);
            assert.equal(rpc.calls.length, 0, 'must not call calculateRam while disconnected');
            tracker.dispose();
        });

        test('reports undefined when disconnected and the script has no ns identifiers', async () => {
            seedActiveEditor(Uri.file('/workspace/a.js'), 'const x = 1; console.log(x);');
            const registry = fakeRegistry(new Map([['hack', 0.1]]));
            const { tracker, updates } = build({ connected: false, registry });
            await tracker.initialize();
            assert.deepEqual(updates, [undefined]);
            tracker.dispose();
        });

        test('reports undefined when disconnected and the registry is empty', async () => {
            // No d.ts yet: even a script full of ns calls can't be scored.
            seedActiveEditor(Uri.file('/workspace/a.js'), 'ns.hack("home");');
            const { tracker, updates } = build({ connected: false });
            await tracker.initialize();
            assert.deepEqual(updates, [undefined]);
            tracker.dispose();
        });

        test('save while disconnected re-runs the local scan for the active editor', async () => {
            const uri = Uri.file('/workspace/a.js');
            seedActiveEditor(uri, 'ns.hack("home");');
            const registry = fakeRegistry(new Map([['hack', 0.1], ['grow', 0.15]]));
            const { tracker, updates } = build({ connected: false, registry });
            await tracker.initialize();
            // First: just hack — 0.1 + base
            assert.deepEqual(updates, [0.1 + BASE_RAM_COST]);
            // Simulate the user editing to add ns.grow, then saving.
            _state.activeTextEditor = { document: { uri, getText: () => 'ns.hack("home"); ns.grow("home");' } };
            vscodeMock._triggerSave(uri);
            await waitMs(0);
            assert.deepEqual(updates, [0.1 + BASE_RAM_COST, 0.1 + 0.15 + BASE_RAM_COST]);
            tracker.dispose();
        });

        test('registry reload re-runs the scan (fresh d.ts arrives after activation)', async () => {
            const uri = Uri.file('/workspace/a.js');
            seedActiveEditor(uri, 'ns.hack("home");');
            // Track a single reload listener so the test can drive it directly.
            let reloadListener: (() => void) | undefined;
            const costs = new Map<string, number>();
            const registry: NetscriptCostRegistry = {
                getCosts: () => costs,
                onDidReload: (l: () => void) => {
                    reloadListener = l;
                    return { dispose: (): void => { reloadListener = undefined; } };
                },
            } as unknown as NetscriptCostRegistry;
            const { tracker, updates } = build({ connected: false, registry });
            await tracker.initialize();
            assert.deepEqual(updates, [undefined]);
            // Table arrives (extension downloaded the d.ts).
            costs.set('hack', 0.1);
            reloadListener?.();
            await waitMs(0);
            assert.deepEqual(updates, [undefined, 0.1 + BASE_RAM_COST]);
            tracker.dispose();
        });
    });
});
