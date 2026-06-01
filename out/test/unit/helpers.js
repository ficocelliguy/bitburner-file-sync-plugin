"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeServer = exports.FakeRpcClient = exports.Spy = void 0;
exports.waitMs = waitMs;
const events_1 = require("events");
/**
 * Spy that records every call as a list of argument arrays.
 * Also supports queuing return values / errors.
 */
class Spy {
    calls = [];
    queuedReturns = [];
    queuedErrors = [];
    defaultReturn;
    alwaysThrow;
    fn = (...args) => {
        this.calls.push(args);
        if (this.alwaysThrow) {
            throw this.alwaysThrow;
        }
        if (this.queuedErrors.length > 0) {
            const err = this.queuedErrors.shift();
            if (err) {
                throw err;
            }
        }
        if (this.queuedReturns.length > 0) {
            return this.queuedReturns.shift();
        }
        return this.defaultReturn;
    };
    returns(value) {
        this.defaultReturn = value;
        return this;
    }
    queueReturn(...values) {
        this.queuedReturns.push(...values);
        return this;
    }
    queueError(err) {
        this.queuedErrors.push(err);
        return this;
    }
    throws(err) {
        this.alwaysThrow = err;
        return this;
    }
    reset() {
        this.calls.length = 0;
        this.queuedReturns = [];
        this.queuedErrors = [];
    }
    get callCount() {
        return this.calls.length;
    }
}
exports.Spy = Spy;
/**
 * Minimal in-memory JsonRpcClient mock — exposes the only public method
 * (`request`) that BitburnerApi / SyncEngine consume.
 */
class FakeRpcClient {
    calls = [];
    responses = new Map();
    errors = new Map();
    rejectAll = false;
    queueResponse(method, ...values) {
        const list = this.responses.get(method) ?? [];
        list.push(...values);
        this.responses.set(method, list);
        return this;
    }
    queueError(method, err) {
        const list = this.errors.get(method) ?? [];
        list.push(err);
        this.errors.set(method, list);
        return this;
    }
    failAll() {
        this.rejectAll = true;
        return this;
    }
    async request(method, params) {
        this.calls.push({ method, params });
        if (this.rejectAll) {
            throw new Error(`rejectAll: ${method}`);
        }
        const errs = this.errors.get(method);
        if (errs && errs.length > 0) {
            throw errs.shift();
        }
        const list = this.responses.get(method);
        if (list && list.length > 0) {
            return list.shift();
        }
        return undefined;
    }
    dispose() { }
}
exports.FakeRpcClient = FakeRpcClient;
/**
 * Stand-in for the EventEmitter-based WebSocketServer. Tests can flip
 * connection state and emit messages without binding a socket.
 */
class FakeServer extends events_1.EventEmitter {
    sent = [];
    state = 'stopped';
    isConnected = false;
    sendShouldThrow;
    send(data) {
        if (this.sendShouldThrow) {
            throw this.sendShouldThrow;
        }
        this.sent.push(data);
    }
    setConnected(connected) {
        this.isConnected = connected;
        this.state = connected ? 'connected' : 'waiting';
    }
}
exports.FakeServer = FakeServer;
async function waitMs(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=helpers.js.map