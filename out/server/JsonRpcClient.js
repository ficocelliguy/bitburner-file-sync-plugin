"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonRpcClient = void 0;
class JsonRpcClient {
    server;
    nextId = 1;
    pending = new Map();
    timeout;
    onMessage;
    onDisconnected;
    constructor(server, timeout = 10000) {
        this.server = server;
        this.timeout = timeout;
        // Bind listeners to fields so dispose() can detach them. Without
        // this, listeners survive the client and a future reconstruction
        // would silently duplicate handleMessage on every inbound frame.
        this.onMessage = (msg) => this.handleMessage(msg);
        // If Bitburner drops, fail every in-flight request immediately instead
        // of stalling each one for the full timeout window.
        this.onDisconnected = () => this.rejectAllPending('Bitburner disconnected');
        this.server.on('message', this.onMessage);
        this.server.on('disconnected', this.onDisconnected);
    }
    request(method, params) {
        return new Promise((resolve, reject) => {
            if (!this.server.isConnected) {
                reject(new Error('Not connected to Bitburner'));
                return;
            }
            const id = this.nextId++;
            const request = {
                jsonrpc: '2.0',
                id,
                method,
                params
            };
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Request "${method}" timed out after ${this.timeout}ms`));
            }, this.timeout);
            this.pending.set(id, { resolve: resolve, reject, timer });
            // If send() throws synchronously (transport closed mid-call, etc.)
            // the Promise constructor would catch the throw and reject, but
            // the timer + pending entry would leak until the timeout fires.
            // Clean up explicitly so the rejection is observable immediately
            // and the pending Map doesn't accumulate dead entries.
            try {
                this.server.send(JSON.stringify(request));
            }
            catch (err) {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }
    handleMessage(msg) {
        // WebSocketServer should already have filtered out non-objects, but
        // double-check before any property access — handleMessage runs on
        // every inbound frame and must not throw.
        if (!isPlainObject(msg)) {
            return;
        }
        const id = msg.id;
        // Only correlate when the id is a number we issued. JSON-RPC also
        // allows string and null ids, but we only ever send numbers, so
        // anything else is either a notification or noise.
        if (typeof id !== 'number') {
            return;
        }
        const pending = this.pending.get(id);
        if (!pending) {
            return;
        }
        this.pending.delete(id);
        clearTimeout(pending.timer);
        const errorField = msg.error;
        if (errorField !== undefined && errorField !== null) {
            const message = isPlainObject(errorField) && typeof errorField.message === 'string'
                ? errorField.message
                : `RPC error with malformed shape: ${safeStringify(errorField)}`;
            pending.reject(new Error(message));
            return;
        }
        pending.resolve(msg.result);
    }
    dispose() {
        this.server.off('message', this.onMessage);
        this.server.off('disconnected', this.onDisconnected);
        this.rejectAllPending('Client disposed');
    }
    rejectAllPending(reason) {
        if (this.pending.size === 0) {
            return;
        }
        // Snapshot first so reject callbacks can't mutate the map mid-iteration.
        const entries = Array.from(this.pending.values());
        this.pending.clear();
        for (const entry of entries) {
            clearTimeout(entry.timer);
            entry.reject(new Error(reason));
        }
    }
}
exports.JsonRpcClient = JsonRpcClient;
function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
// Stringify a value for an error message without throwing on cycles or
// non-serializable contents (BigInt, functions, etc.).
function safeStringify(v) {
    try {
        return JSON.stringify(v) ?? String(v);
    }
    catch {
        return String(v);
    }
}
//# sourceMappingURL=JsonRpcClient.js.map