import { EventEmitter } from 'events';

/**
 * Spy that records every call as a list of argument arrays.
 * Also supports queuing return values / errors.
 */
export class Spy<TArgs extends unknown[] = unknown[], TReturn = unknown> {
    public readonly calls: TArgs[] = [];
    private queuedReturns: TReturn[] = [];
    private queuedErrors: Error[] = [];
    private defaultReturn: TReturn | undefined;
    private alwaysThrow: Error | undefined;

    readonly fn: (...args: TArgs) => TReturn = (...args: TArgs): TReturn => {
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
            return this.queuedReturns.shift() as TReturn;
        }
        return this.defaultReturn as TReturn;
    };

    returns(value: TReturn): this {
        this.defaultReturn = value;
        return this;
    }

    queueReturn(...values: TReturn[]): this {
        this.queuedReturns.push(...values);
        return this;
    }

    queueError(err: Error): this {
        this.queuedErrors.push(err);
        return this;
    }

    throws(err: Error): this {
        this.alwaysThrow = err;
        return this;
    }

    reset(): void {
        this.calls.length = 0;
        this.queuedReturns = [];
        this.queuedErrors = [];
    }

    get callCount(): number {
        return this.calls.length;
    }
}

/**
 * Minimal in-memory JsonRpcClient mock — exposes the only public method
 * (`request`) that BitburnerApi / SyncEngine consume.
 */
export class FakeRpcClient {
    public readonly calls: { method: string; params: unknown }[] = [];
    private responses: Map<string, unknown[]> = new Map();
    private errors: Map<string, Error[]> = new Map();
    private rejectAll = false;

    queueResponse(method: string, ...values: unknown[]): this {
        const list = this.responses.get(method) ?? [];
        list.push(...values);
        this.responses.set(method, list);
        return this;
    }

    queueError(method: string, err: Error): this {
        const list = this.errors.get(method) ?? [];
        list.push(err);
        this.errors.set(method, list);
        return this;
    }

    failAll(): this {
        this.rejectAll = true;
        return this;
    }

    async request<T = unknown>(method: string, params?: unknown): Promise<T> {
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
            return list.shift() as T;
        }
        return undefined as T;
    }

    dispose(): void {}
}

/**
 * Stand-in for the EventEmitter-based WebSocketServer. Tests can flip
 * connection state and emit messages without binding a socket.
 */
export class FakeServer extends EventEmitter {
    public sent: string[] = [];
    public state: 'stopped' | 'waiting' | 'connected' | 'error' = 'stopped';
    public isConnected = false;
    public sendShouldThrow: Error | undefined;

    send(data: string): void {
        if (this.sendShouldThrow) {
            throw this.sendShouldThrow;
        }
        this.sent.push(data);
    }

    setConnected(connected: boolean): void {
        this.isConnected = connected;
        this.state = connected ? 'connected' : 'waiting';
    }
}

export async function waitMs(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}
