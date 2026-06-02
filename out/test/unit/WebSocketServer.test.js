"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const ws_1 = require("ws");
const WebSocketServer_1 = require("../../server/WebSocketServer");
const helpers_1 = require("./helpers");
// Bind to ephemeral port (0) and ask the underlying server for the assigned port.
function actualPort(server) {
    const internal = server;
    const addr = internal.server?.address();
    if (addr && typeof addr === 'object') {
        return addr.port;
    }
    throw new Error('server has no bound port');
}
async function startServer(server) {
    await server.start(0);
    return actualPort(server);
}
function waitForState(server, target, timeoutMs = 1000) {
    return new Promise((resolve, reject) => {
        if (server.state === target) {
            resolve();
            return;
        }
        const handler = (state) => {
            if (state === target) {
                server.off('stateChanged', handler);
                clearTimeout(timer);
                resolve();
            }
        };
        const timer = setTimeout(() => {
            server.off('stateChanged', handler);
            reject(new Error(`Timed out waiting for state ${target}; last state: ${server.state}`));
        }, timeoutMs);
        server.on('stateChanged', handler);
    });
}
function waitForOpen(ws) {
    return new Promise((resolve, reject) => {
        ws.once('open', () => resolve());
        ws.once('error', err => reject(err));
    });
}
suite('WebSocketServer', () => {
    let server;
    setup(() => {
        server = new WebSocketServer_1.WebSocketServer();
    });
    teardown(async () => {
        await server.stop();
    });
    test('starts in the stopped state', () => {
        assert_1.strict.equal(server.state, 'stopped');
        assert_1.strict.equal(server.isConnected, false);
    });
    test('transitions to waiting after start()', async () => {
        await startServer(server);
        assert_1.strict.equal(server.state, 'waiting');
    });
    test('emits stateChanged with the new state', async () => {
        const seen = [];
        server.on('stateChanged', s => seen.push(s));
        await startServer(server);
        await server.stop();
        assert_1.strict.deepEqual(seen, ['waiting', 'stopped']);
    });
    test('rejects start() when the port is already in use', async () => {
        const port = await startServer(server);
        const other = new WebSocketServer_1.WebSocketServer();
        await assert_1.strict.rejects(other.start(port), /already in use/);
        assert_1.strict.equal(other.state, 'error');
        await other.stop();
    });
    test('transitions to connected when a client connects', async () => {
        const port = await startServer(server);
        const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(client);
        await waitForState(server, 'connected');
        assert_1.strict.equal(server.isConnected, true);
        client.close();
        await waitForState(server, 'waiting');
        assert_1.strict.equal(server.isConnected, false);
    });
    test('emits a `connected` event when a client attaches', async () => {
        const port = await startServer(server);
        const connectedEvent = new Promise(resolve => server.once('connected', () => resolve()));
        const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(client);
        await connectedEvent;
        client.close();
        await waitForState(server, 'waiting');
    });
    test('parses incoming JSON messages and emits them via `message`', async () => {
        const port = await startServer(server);
        const got = [];
        server.on('message', m => got.push(m));
        const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(client);
        await waitForState(server, 'connected');
        client.send(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'OK' }));
        // small wait for message dispatch
        await (0, helpers_1.waitMs)(30);
        assert_1.strict.equal(got.length, 1);
        assert_1.strict.deepEqual(got[0], { jsonrpc: '2.0', id: 1, result: 'OK' });
        client.close();
        await waitForState(server, 'waiting');
    });
    test('emits an `error` event for malformed JSON instead of crashing', async () => {
        const port = await startServer(server);
        const errPromise = new Promise(resolve => server.once('error', resolve));
        const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(client);
        await waitForState(server, 'connected');
        client.send('not json {');
        const err = await errPromise;
        assert_1.strict.match(err.message, /Failed to parse message/);
        client.close();
        await waitForState(server, 'waiting');
    });
    test('closes the prior connection when a second client connects', async () => {
        const port = await startServer(server);
        const c1 = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(c1);
        await waitForState(server, 'connected');
        const c1Closed = new Promise(resolve => c1.once('close', () => resolve()));
        const c2 = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(c2);
        await c1Closed;
        assert_1.strict.equal(server.isConnected, true);
        c2.close();
        await waitForState(server, 'waiting');
    });
    test('emits a single `disconnected` between connect-handoffs (no double disconnect, no missed one)', async () => {
        const port = await startServer(server);
        const events = [];
        server.on('connected', () => events.push('connected'));
        server.on('disconnected', () => events.push('disconnected'));
        const c1 = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(c1);
        await waitForState(server, 'connected');
        // Hand off to a second client. The handover must fire exactly one
        // `disconnected` for c1 before the `connected` for c2. The old ws's
        // own 'close' handler must NOT fire a second disconnected after the
        // swap.
        const c2 = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(c2);
        // Let c1's close event flush so any spurious second 'disconnected'
        // would show up below.
        await new Promise(resolve => c1.once('close', () => resolve()));
        // Small extra tick in case the ws close handler is queued.
        await new Promise(r => setTimeout(r, 20));
        assert_1.strict.deepEqual(events, ['connected', 'disconnected', 'connected'], `expected one disconnect between two connects, got: ${JSON.stringify(events)}`);
        assert_1.strict.equal(server.isConnected, true);
        c2.close();
        await waitForState(server, 'waiting');
    });
    test('emits `disconnected` when the active client closes', async () => {
        const port = await startServer(server);
        const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(client);
        await waitForState(server, 'connected');
        const disconnect = new Promise(resolve => server.once('disconnected', () => resolve()));
        client.close();
        await disconnect;
        assert_1.strict.equal(server.isConnected, false);
    });
    test('send() throws when there is no connected client', () => {
        assert_1.strict.throws(() => server.send('hello'), /No active Bitburner connection/);
    });
    test('send() delivers a payload to the connected client', async () => {
        const port = await startServer(server);
        const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(client);
        await waitForState(server, 'connected');
        const received = new Promise(resolve => client.once('message', d => resolve(d.toString())));
        server.send('ping');
        assert_1.strict.equal(await received, 'ping');
        client.close();
        await waitForState(server, 'waiting');
    });
    test('stop() is idempotent and resolves even with no server running', async () => {
        await server.stop();
        await server.stop();
        assert_1.strict.equal(server.state, 'stopped');
    });
    test('stop() also closes the active client connection', async () => {
        const port = await startServer(server);
        const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(client);
        await waitForState(server, 'connected');
        const closed = new Promise(resolve => client.once('close', () => resolve()));
        await server.stop();
        await closed;
        assert_1.strict.equal(server.state, 'stopped');
    });
    test('emits an `error` event for JSON that parses but is not a plain object', async () => {
        // Each of these is valid JSON but not a JSON-RPC message shape.
        const cases = ['[1, 2, 3]', '"a string"', '42', 'null', 'true'];
        for (const payload of cases) {
            const fresh = new WebSocketServer_1.WebSocketServer();
            const port = await startServer(fresh);
            const errPromise = new Promise(resolve => fresh.once('error', resolve));
            const messagePromise = new Promise(resolve => {
                fresh.once('message', m => resolve(m));
                setTimeout(() => resolve(undefined), 200);
            });
            const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
            await waitForOpen(client);
            await waitForState(fresh, 'connected');
            client.send(payload);
            const err = await errPromise;
            assert_1.strict.match(err.message, /expected JSON object/, `payload ${payload} should have produced an "expected JSON object" error`);
            const wasMessageEmitted = (await messagePromise) !== undefined;
            assert_1.strict.equal(wasMessageEmitted, false, `payload ${payload} should NOT have been emitted as a message`);
            client.close();
            await fresh.stop();
        }
    });
    test('start() while already running restarts on the new port (old binding released)', async () => {
        const firstPort = await startServer(server);
        // Sanity: the first port is bound, so a second WebSocketServer asking
        // for the same port fails with EADDRINUSE.
        const probe = new WebSocketServer_1.WebSocketServer();
        await assert_1.strict.rejects(probe.start(firstPort), /already in use/);
        await probe.stop();
        // Second start() on port 0 should restart, releasing firstPort and
        // binding a new ephemeral port.
        await server.start(0);
        const secondPort = actualPort(server);
        assert_1.strict.notEqual(secondPort, firstPort, 'expected a fresh port after restart');
        assert_1.strict.equal(server.state, 'waiting');
        // The old port should now be free — confirm by binding to it from
        // a fresh server instance.
        const successor = new WebSocketServer_1.WebSocketServer();
        await successor.start(firstPort);
        assert_1.strict.equal(successor.state, 'waiting');
        await successor.stop();
    });
    test('start() while already running emits stop+restart state transitions', async () => {
        await startServer(server);
        const seen = [];
        server.on('stateChanged', s => seen.push(s));
        await server.start(0);
        // The restart goes 'stopped' (from stop()) → 'waiting' (from new bind).
        assert_1.strict.deepEqual(seen, ['stopped', 'waiting']);
    });
    test('start() retries on EADDRINUSE and succeeds when the port frees up in time', async () => {
        // Hold a port, then release it shortly after the new server starts —
        // the retry loop should succeed without surfacing an error.
        const holder = new WebSocketServer_1.WebSocketServer();
        const heldPort = await startServer(holder);
        const successor = new WebSocketServer_1.WebSocketServer();
        const startPromise = successor.start(heldPort);
        // Release the port after the first attempt has already failed but
        // before the retry budget is exhausted.
        setTimeout(() => { holder.stop(); }, 250);
        await startPromise;
        assert_1.strict.equal(successor.state, 'waiting');
        await successor.stop();
    });
    test('start() recovers from a previous bind failure (this.server cleared)', async () => {
        // First, fail a bind to drive the server into the error state with
        // no live this.server.
        const holder = new WebSocketServer_1.WebSocketServer();
        const heldPort = await startServer(holder);
        await assert_1.strict.rejects(server.start(heldPort), /already in use/);
        assert_1.strict.equal(server.state, 'error');
        // Holder releases the port.
        await holder.stop();
        // Subsequent start() on the now-free port must succeed — and must
        // NOT hang on an internal stop() of an unbound, dead server.
        await server.start(heldPort);
        assert_1.strict.equal(server.state, 'waiting');
    });
    test('a socket error after connect is treated as a disconnect (state, emit)', async () => {
        const port = await startServer(server);
        const client = new ws_1.WebSocket(`ws://127.0.0.1:${port}`);
        await waitForOpen(client);
        await waitForState(server, 'connected');
        const disconnectedPromise = new Promise(resolve => server.once('disconnected', () => resolve()));
        const errorPromise = new Promise(resolve => server.once('error', resolve));
        const internal = server;
        internal.client?.emit('error', new Error('socket boom'));
        const err = await errorPromise;
        await disconnectedPromise;
        assert_1.strict.match(err.message, /socket boom/);
        assert_1.strict.equal(server.isConnected, false, 'isConnected must flip on socket error, not stay stale');
        assert_1.strict.equal(server.state, 'waiting', 'state must reflect that the connection is gone');
        client.close();
    });
    test('a late server-level error after listening updates state and emits, without crashing', async () => {
        await startServer(server);
        const errorPromise = new Promise(resolve => server.once('error', resolve));
        const internal = server;
        const fakeErr = Object.assign(new Error('late boom'), { code: 'EMFILE' });
        internal.server?.emit('error', fakeErr);
        const err = await errorPromise;
        assert_1.strict.match(err.message, /late boom/);
        assert_1.strict.equal(server.state, 'error', 'state must flip to error on late server fault');
    });
});
//# sourceMappingURL=WebSocketServer.test.js.map