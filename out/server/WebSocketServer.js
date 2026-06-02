"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketServer = void 0;
const ws_1 = require("ws");
const events_1 = require("events");
// EADDRINUSE-retry tuning. When VS Code exits/reloads, the OS sometimes
// hasn't released the previous bind by the time the new session tries to
// start — surface as a permanent error only after a few quick retries.
const EADDRINUSE_RETRY_ATTEMPTS = 5;
const EADDRINUSE_RETRY_DELAY_MS = 200;
class WebSocketServer extends events_1.EventEmitter {
    server = null;
    client = null;
    _state = 'stopped';
    get state() {
        return this._state;
    }
    get isConnected() {
        return this.client !== null && this.client.readyState === ws_1.WebSocket.OPEN;
    }
    async start(port) {
        // If a previous start() left a server bound (possibly on a different
        // port), tear it down first so the new bind actually takes effect.
        // Previously this method early-returned, silently leaving the caller
        // on the old port.
        if (this.server) {
            await this.stop();
        }
        // Brief retry on EADDRINUSE so a fast reload after VS Code closes
        // doesn't permanently strand the user on `error`. Other errors surface
        // on the first attempt — they aren't going to clear on retry.
        let lastErr;
        for (let attempt = 1; attempt <= EADDRINUSE_RETRY_ATTEMPTS; attempt++) {
            try {
                await this.startOnce(port);
                return;
            }
            catch (err) {
                lastErr = err instanceof Error ? err : new Error(String(err));
                const isAddrInUse = /already in use/.test(lastErr.message);
                if (!isAddrInUse || attempt === EADDRINUSE_RETRY_ATTEMPTS) {
                    throw lastErr;
                }
                await delay(EADDRINUSE_RETRY_DELAY_MS);
            }
        }
        // Unreachable — the loop either returns or throws. Kept for the
        // type checker.
        throw lastErr ?? new Error('start() failed');
    }
    startOnce(port) {
        return new Promise((resolve, reject) => {
            // Single-shot "did the start() promise settle?" flag. Used to
            // distinguish a bind-time error (reject the promise) from a
            // late runtime error after `listening` (update state + emit,
            // but don't try to re-reject a settled promise).
            let settled = false;
            // Bind to loopback only — Bitburner runs in the same machine's browser,
            // and exposing the sync port on all interfaces would let anyone on the
            // LAN push/pull script files through this session.
            this.server = new ws_1.WebSocketServer({ port, host: '127.0.0.1' });
            this.server.on('listening', () => {
                settled = true;
                this.setState('waiting');
                resolve();
            });
            this.server.on('error', (err) => {
                if (!settled) {
                    // Pre-listening: bind failure. Null this.server so the
                    // next start()/stop() doesn't try to close an unbound
                    // server (which on some ws versions never invokes its
                    // close callback and hangs the next attempt).
                    this.server = null;
                    settled = true;
                    this.setState('error');
                    if (err.code === 'EADDRINUSE') {
                        reject(new Error(`Port ${port} is already in use`));
                    }
                    else {
                        reject(err);
                    }
                }
                else {
                    // Late runtime error after a successful bind. Caller is
                    // already past the start() await. Reflect the broken
                    // state and surface the error for listeners; don't try
                    // to re-reject a resolved promise.
                    this.setState('error');
                    this.emit('error', err);
                }
            });
            this.server.on('connection', (ws) => {
                if (this.client) {
                    // Surface the old connection ending synchronously *before*
                    // we announce the new one, so listeners that pair
                    // connect/disconnect (notably JsonRpcClient — pending
                    // requests bound to the dead socket need to fail now, not
                    // wait for their per-request timeout) don't see two
                    // `connected`s back-to-back. We null this.client first so
                    // the old ws's own 'close' handler — which guards on
                    // `this.client === ws` — does NOT also emit a second
                    // `disconnected` after we've swapped in `ws`.
                    const old = this.client;
                    this.client = null;
                    this.emit('disconnected');
                    old.close();
                }
                this.client = ws;
                this.setState('connected');
                this.emit('connected');
                ws.on('message', (data) => {
                    let parsed;
                    try {
                        parsed = JSON.parse(data.toString());
                    }
                    catch {
                        this.emit('error', new Error('Failed to parse message: invalid JSON'));
                        return;
                    }
                    // Only emit non-null plain objects — anything else (array,
                    // string, number, null) is not a valid JSON-RPC payload
                    // and would force the listener to defend against shapes
                    // it never expects.
                    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        const got = Array.isArray(parsed) ? 'array' : (parsed === null ? 'null' : typeof parsed);
                        this.emit('error', new Error(`Failed to parse message: expected JSON object, got ${got}`));
                        return;
                    }
                    this.emit('message', parsed);
                });
                ws.on('close', () => {
                    if (this.client === ws) {
                        this.client = null;
                        this.setState(this.server ? 'waiting' : 'stopped');
                        this.emit('disconnected');
                    }
                });
                ws.on('error', (err) => {
                    // Treat a socket error as a disconnect: the socket is
                    // either already broken or about to fire 'close'. Without
                    // this, state stayed 'connected' while isConnected silently
                    // flipped to false on the next send().
                    if (this.client === ws) {
                        this.client = null;
                        this.setState(this.server ? 'waiting' : 'stopped');
                        this.emit('disconnected');
                    }
                    this.emit('error', err);
                });
            });
        });
    }
    stop() {
        return new Promise((resolve) => {
            if (this.client) {
                this.client.close();
                this.client = null;
                // Emit synchronously so listeners (JsonRpcClient) can fail
                // in-flight requests now. The ws 'close' event will fire
                // later but its handler's `this.client === ws` guard is
                // already false, so it won't emit a second time.
                this.emit('disconnected');
            }
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    this.setState('stopped');
                    resolve();
                });
            }
            else {
                this.setState('stopped');
                resolve();
            }
        });
    }
    send(data) {
        if (this.client && this.client.readyState === ws_1.WebSocket.OPEN) {
            this.client.send(data);
        }
        else {
            throw new Error('No active Bitburner connection');
        }
    }
    setState(state) {
        this._state = state;
        this.emit('stateChanged', state);
    }
}
exports.WebSocketServer = WebSocketServer;
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=WebSocketServer.js.map