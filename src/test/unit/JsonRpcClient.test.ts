import { strict as assert } from 'assert';
import { JsonRpcClient } from '../../server/JsonRpcClient';
import type { WebSocketServer } from '../../server/WebSocketServer';
import { FakeServer, waitMs } from './helpers';

function makeClient(timeout = 10000): { server: FakeServer; client: JsonRpcClient } {
    const server = new FakeServer();
    const client = new JsonRpcClient(server as unknown as WebSocketServer, timeout);
    return { server, client };
}

suite('JsonRpcClient', () => {
    test('sends a well-formed JSON-RPC request when connected', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);

        const promise = client.request('pushFile', { filename: '/x', content: 'y', server: 'home' });

        assert.equal(server.sent.length, 1);
        const sent = JSON.parse(server.sent[0]);
        assert.equal(sent.jsonrpc, '2.0');
        assert.equal(sent.method, 'pushFile');
        assert.deepEqual(sent.params, { filename: '/x', content: 'y', server: 'home' });
        assert.equal(typeof sent.id, 'number');

        // Resolve to flush pending state
        server.emit('message', { jsonrpc: '2.0', id: sent.id, result: 'OK' });
        assert.equal(await promise, 'OK');
    });

    test('rejects immediately when not connected', async () => {
        const { client } = makeClient();
        await assert.rejects(client.request('any'), /Not connected to Bitburner/);
    });

    test('correlates responses by id even when out of order', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);

        const p1 = client.request<string>('a');
        const p2 = client.request<string>('b');
        const id1 = JSON.parse(server.sent[0]).id as number;
        const id2 = JSON.parse(server.sent[1]).id as number;

        // Respond to second first
        server.emit('message', { jsonrpc: '2.0', id: id2, result: 'second' });
        server.emit('message', { jsonrpc: '2.0', id: id1, result: 'first' });

        assert.equal(await p1, 'first');
        assert.equal(await p2, 'second');
    });

    test('rejects with the error.message field when the server returns an error', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        const promise = client.request('bad');
        const id = JSON.parse(server.sent[0]).id as number;
        server.emit('message', {
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: 'something broke' },
        });
        await assert.rejects(promise, /something broke/);
    });

    test('times out and clears pending entry when no response arrives', async () => {
        const { server, client } = makeClient(50);
        server.setConnected(true);
        const promise = client.request('slow');
        await assert.rejects(promise, /timed out after 50ms/);
    });

    test('ignores response messages whose id is unknown', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        // Should be a no-op (no exception)
        server.emit('message', { jsonrpc: '2.0', id: 9999, result: 'nope' });
    });

    test('ignores messages with no id (notifications)', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        server.emit('message', { jsonrpc: '2.0', method: 'notify' });
    });

    test('ignores messages whose id is not a number (string / null / object)', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        const p = client.request<string>('a');
        const realId = JSON.parse(server.sent[0]).id as number;

        // Each of these has a non-number id and must NOT resolve `p`. We
        // verify by emitting a properly-shaped response afterwards.
        server.emit('message', { jsonrpc: '2.0', id: 'a-string', result: 'wrong' });
        server.emit('message', { jsonrpc: '2.0', id: null, result: 'also-wrong' });
        server.emit('message', { jsonrpc: '2.0', id: { id: realId }, result: 'still-wrong' });
        server.emit('message', { jsonrpc: '2.0', id: realId, result: 'right' });

        assert.equal(await p, 'right');
    });

    test('survives a message that is not even an object (defensive double-check)', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        // WebSocketServer would normally filter these out, but JsonRpcClient
        // is the listener and must not throw if something slips through.
        for (const bad of [null, undefined, 42, 'hello', [1, 2, 3]] as unknown[]) {
            server.emit('message', bad);
        }
        // Sanity: a real response still works after the bad messages.
        const p = client.request<string>('x');
        const id = JSON.parse(server.sent[0]).id as number;
        server.emit('message', { jsonrpc: '2.0', id, result: 'ok' });
        assert.equal(await p, 'ok');
    });

    test('rejects with a descriptive error when error field is malformed', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        const cases: { error: unknown; expected: RegExp }[] = [
            { error: 'plain string error', expected: /malformed shape/ },
            { error: 42, expected: /malformed shape/ },
            { error: { code: -32000 /* no message field */ }, expected: /malformed shape/ },
            { error: { message: 123 /* message not a string */ }, expected: /malformed shape/ },
            { error: [], expected: /malformed shape/ },
        ];
        for (const { error, expected } of cases) {
            const p = client.request('a');
            const id = JSON.parse(server.sent[server.sent.length - 1]).id as number;
            server.emit('message', { jsonrpc: '2.0', id, error });
            await assert.rejects(p, expected, `case ${JSON.stringify(error)} should have been rejected`);
        }
    });

    test('dispose rejects all pending requests', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        const p1 = client.request('a');
        const p2 = client.request('b');
        client.dispose();
        await assert.rejects(p1, /Client disposed/);
        await assert.rejects(p2, /Client disposed/);
    });

    test('rejects pending requests immediately on disconnect (no waiting for timeout)', async () => {
        const { server, client } = makeClient(10000);
        server.setConnected(true);
        const p1 = client.request('a');
        const p2 = client.request('b');
        const start = Date.now();
        server.emit('disconnected');
        await assert.rejects(p1, /Bitburner disconnected/);
        await assert.rejects(p2, /Bitburner disconnected/);
        // Must NOT have waited for the 10s timeout
        assert.ok(Date.now() - start < 500, 'pending should reject promptly on disconnect');
    });

    test('cleans up timer and pending entry immediately when send() throws synchronously', async () => {
        const { server, client } = makeClient(10000); // long timeout — failure must NOT wait for it
        server.setConnected(true);
        server.sendShouldThrow = new Error('socket gone');

        const start = Date.now();
        await assert.rejects(client.request('a'), /socket gone/);
        assert.ok(Date.now() - start < 200, `expected immediate rejection, took ${Date.now() - start}ms`);

        // Internal pending map must be empty — no dead entry leaked.
        interface Internal { pending: Map<number, unknown> }
        const internal = client as unknown as Internal;
        assert.equal(internal.pending.size, 0, 'pending entry should be cleaned up after send() throw');
    });

    test('a fresh request after reconnect is unaffected by prior disconnect', async () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        const p1 = client.request('a');
        server.emit('disconnected');
        await assert.rejects(p1, /Bitburner disconnected/);

        // Reconnect and issue another request
        server.setConnected(true);
        const p2 = client.request<string>('b');
        const id = JSON.parse(server.sent[1]).id as number;
        server.emit('message', { jsonrpc: '2.0', id, result: 'ok' });
        assert.equal(await p2, 'ok');
    });

    test('assigns incrementing ids', () => {
        const { server, client } = makeClient();
        server.setConnected(true);
        client.request('a').catch(() => {});
        client.request('b').catch(() => {});
        client.request('c').catch(() => {});
        const ids = server.sent.map(s => JSON.parse(s).id as number);
        assert.equal(ids[1], ids[0] + 1);
        assert.equal(ids[2], ids[1] + 1);
    });

    test('clears the timeout once a response arrives so no stray timer fires', async () => {
        const { server, client } = makeClient(30);
        server.setConnected(true);
        const promise = client.request('quick');
        const id = JSON.parse(server.sent[0]).id as number;
        server.emit('message', { jsonrpc: '2.0', id, result: 'done' });
        assert.equal(await promise, 'done');
        // Wait beyond the timeout to ensure no late rejection.
        await waitMs(60);
    });
});
