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
const BitburnerApi_1 = require("../../api/BitburnerApi");
const Configuration_1 = require("../../config/Configuration");
const SyncEngine_1 = require("../../sync/SyncEngine");
const RamCostTracker_1 = require("../../ram/RamCostTracker");
const helpers_1 = require("./helpers");
const { Uri, _reset, _setWorkspaceFolders, _state, _writeFile } = vscodeMock;
// Set the active editor without triggering the onDidChangeActiveTextEditor
// listeners. Tests use this to seed state *before* building the tracker so
// its constructor-time subscriptions don't fire a stray recompute that
// consumes a queued RPC response.
function seedActiveEditor(uri) {
    _state.activeTextEditor = { document: { uri } };
}
function build(opts = {}) {
    const rpc = new helpers_1.FakeRpcClient();
    const api = new BitburnerApi_1.BitburnerApi(rpc);
    const server = new helpers_1.FakeServer();
    if (opts.connected) {
        server.setConnected(true);
    }
    const config = new Configuration_1.Configuration();
    const output = vscodeMock.window.createOutputChannel('test');
    const engine = new SyncEngine_1.SyncEngine(api, config, output);
    const updates = [];
    const tracker = new RamCostTracker_1.RamCostTracker(output, (total) => updates.push(total), api, config, server, engine);
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
        assert_1.strict.deepEqual(updates, [undefined]);
        tracker.dispose();
    });
    test('recompute reports undefined when disconnected', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc } = build({ connected: false });
        await tracker.initialize();
        assert_1.strict.deepEqual(updates, [undefined]);
        assert_1.strict.equal(rpc.calls.length, 0, 'must not call calculateRam while disconnected');
        tracker.dispose();
    });
    test('recompute reports undefined for a non-script file', async () => {
        seedActiveEditor(Uri.file('/workspace/notes.md'));
        const { tracker, updates, rpc } = build({ connected: true });
        await tracker.initialize();
        assert_1.strict.deepEqual(updates, [undefined]);
        assert_1.strict.equal(rpc.calls.length, 0);
        tracker.dispose();
    });
    test('calls calculateRam for the active script and forwards the total', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc } = build({ connected: true });
        rpc.queueResponse('calculateRam', 4.25);
        await tracker.initialize();
        assert_1.strict.deepEqual(rpc.calls, [{
                method: 'calculateRam',
                params: { filename: '/a.js', server: 'home' },
            }]);
        assert_1.strict.deepEqual(updates, [4.25]);
        tracker.dispose();
    });
    test('reports undefined when calculateRam rejects (e.g. file not on server)', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc } = build({ connected: true });
        rpc.queueError('calculateRam', new Error('file not found'));
        await tracker.initialize();
        assert_1.strict.deepEqual(updates, [undefined]);
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
        await (0, helpers_1.waitMs)(0);
        const calcCalls = rpc.calls.filter(c => c.method === 'calculateRam');
        assert_1.strict.equal(calcCalls.length, 2);
        assert_1.strict.deepEqual(updates, [1, 2.4]);
        tracker.dispose();
    });
    test('does not recompute after a push of a file that is not the active one', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        _writeFile('/workspace/other.js', 'x');
        const { tracker, updates, rpc, engine } = build({ connected: true });
        rpc.queueResponse('calculateRam', 1);
        await tracker.initialize();
        await engine.pushFile(Uri.file('/workspace/other.js'));
        await (0, helpers_1.waitMs)(0);
        // Only the initial-load calculateRam should have run.
        assert_1.strict.equal(rpc.calls.filter(c => c.method === 'calculateRam').length, 1);
        assert_1.strict.deepEqual(updates, [1]);
        tracker.dispose();
    });
    test('server disconnect hides the indicator', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc, server } = build({ connected: true });
        rpc.queueResponse('calculateRam', 3);
        await tracker.initialize();
        assert_1.strict.deepEqual(updates, [3]);
        server.setConnected(false);
        server.emit('disconnected');
        assert_1.strict.deepEqual(updates, [3, undefined]);
        tracker.dispose();
    });
    test('server connect triggers a recompute for the active editor', async () => {
        seedActiveEditor(Uri.file('/workspace/a.js'));
        const { tracker, updates, rpc, server } = build({ connected: false });
        await tracker.initialize();
        // Initial: disconnected -> undefined
        assert_1.strict.deepEqual(updates, [undefined]);
        rpc.queueResponse('calculateRam', 2);
        server.setConnected(true);
        server.emit('connected');
        // Let the async recompute settle.
        await (0, helpers_1.waitMs)(0);
        assert_1.strict.deepEqual(updates, [undefined, 2]);
        tracker.dispose();
    });
});
//# sourceMappingURL=RamCostTracker.test.js.map