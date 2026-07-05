import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { BitburnerApi } from '../../api/BitburnerApi';
import { Configuration } from '../../config/Configuration';
import { SyncEngine } from '../../sync/SyncEngine';
import { RamCostTracker } from '../../ram/RamCostTracker';
import { FakeRpcClient, FakeServer, waitMs } from './helpers';

const { Uri, _reset, _setWorkspaceFolders, _state, _writeFile } = vscodeMock;

// Set the active editor without triggering the onDidChangeActiveTextEditor
// listeners. Tests use this to seed state *before* building the tracker so
// its constructor-time subscriptions don't fire a stray recompute that
// consumes a queued RPC response.
function seedActiveEditor(uri: vscodeMock.Uri): void {
    _state.activeTextEditor = { document: { uri } };
}

function build(opts: { connected?: boolean } = {}): {
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
});
