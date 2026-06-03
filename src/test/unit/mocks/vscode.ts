/**
 * Minimal in-memory mock of the `vscode` extension host API.
 *
 * Tests redirect imports of `vscode` to this file (see `../setup.ts`).
 * Each test should call `_reset()` in `beforeEach` to clear state.
 */

type Listener<T> = (arg: T) => void;
type AnyFn = (...args: unknown[]) => unknown;

class Uri {
    public readonly authority = '';
    public readonly query = '';
    public readonly fragment = '';

    private constructor(public readonly fsPath: string, public readonly scheme: string = 'file') {}

    get path(): string {
        return this.fsPath.replace(/\\/g, '/');
    }

    static file(p: string): Uri {
        return new Uri(p);
    }

    static parse(value: string): Uri {
        if (value.startsWith('file://')) {
            return new Uri(value.slice(7));
        }
        return new Uri(value);
    }

    static joinPath(base: Uri, ...segments: string[]): Uri {
        let p = base.fsPath.replace(/\\/g, '/');
        for (const seg of segments) {
            const cleanSeg = seg.replace(/\\/g, '/').replace(/^\/+/, '');
            p = p.replace(/\/+$/, '') + '/' + cleanSeg;
        }
        return new Uri(p);
    }

    toString(): string {
        return `${this.scheme}://${this.fsPath}`;
    }

    toJSON(): unknown {
        return { scheme: this.scheme, fsPath: this.fsPath };
    }

    with(_change: { path?: string; scheme?: string; authority?: string; query?: string; fragment?: string }): Uri {
        return this;
    }
}

class Disposable {
    private fn: () => void;
    constructor(fn: () => void) {
        this.fn = fn;
    }
    dispose(): void {
        this.fn();
    }
    static from(...disposables: { dispose(): unknown }[]): Disposable {
        return new Disposable(() => disposables.forEach(d => d.dispose()));
    }
}

class ThemeColor {
    constructor(public readonly id: string) {}
}

// Minimal stand-in for vscode.RelativePattern. Mirrors the real shape closely
// enough for the production code to construct it; the mock filesystem APIs
// only care about the `.pattern` string.
class RelativePattern {
    public readonly baseUri: Uri;
    public readonly base: string;
    constructor(base: Uri | MockWorkspaceFolder | string, public readonly pattern: string) {
        if (typeof base === 'string') {
            this.baseUri = Uri.file(base);
            this.base = base;
        } else if (base instanceof Uri) {
            this.baseUri = base;
            this.base = base.fsPath;
        } else {
            this.baseUri = base.uri;
            this.base = base.uri.fsPath;
        }
    }
}

const StatusBarAlignment = { Left: 1, Right: 2 } as const;

class MockOutputChannel {
    public readonly lines: string[] = [];
    public disposed = false;
    constructor(public readonly name: string) {}
    append(text: string): void {
        this.lines.push(text);
    }
    appendLine(line: string): void {
        this.lines.push(line);
    }
    replace(text: string): void {
        this.lines.length = 0;
        this.lines.push(text);
    }
    clear(): void {
        this.lines.length = 0;
    }
    show(): void {}
    hide(): void {}
    dispose(): void {
        this.disposed = true;
    }
}

class MockStatusBarItem {
    public text = '';
    public tooltip = '';
    public command: string | undefined;
    public backgroundColor: ThemeColor | undefined;
    public shown = false;
    public disposed = false;
    constructor(public readonly alignment: number, public readonly priority: number) {}
    show(): void {
        this.shown = true;
    }
    hide(): void {
        this.shown = false;
    }
    dispose(): void {
        this.disposed = true;
    }
}

class MockFileSystemWatcher {
    public disposed = false;
    public onChangeListeners: Listener<Uri>[] = [];
    public onCreateListeners: Listener<Uri>[] = [];
    public onDeleteListeners: Listener<Uri>[] = [];
    constructor(public readonly pattern: string | RelativePattern) {}

    private register(
        list: Listener<Uri>[],
        handler: Listener<Uri>,
        disposables?: { dispose(): unknown }[]
    ): Disposable {
        list.push(handler);
        const d = new Disposable(() => {
            const i = list.indexOf(handler);
            if (i >= 0) {
                list.splice(i, 1);
            }
        });
        if (disposables) {
            disposables.push(d);
        }
        return d;
    }

    onDidChange(handler: Listener<Uri>, _ctx?: unknown, disposables?: { dispose(): unknown }[]): Disposable {
        return this.register(this.onChangeListeners, handler, disposables);
    }
    onDidCreate(handler: Listener<Uri>, _ctx?: unknown, disposables?: { dispose(): unknown }[]): Disposable {
        return this.register(this.onCreateListeners, handler, disposables);
    }
    onDidDelete(handler: Listener<Uri>, _ctx?: unknown, disposables?: { dispose(): unknown }[]): Disposable {
        return this.register(this.onDeleteListeners, handler, disposables);
    }
    dispose(): void {
        this.disposed = true;
    }
}

interface MockWorkspaceFolder {
    uri: Uri;
    name: string;
    index: number;
}

interface MockTextDocument {
    uri: Uri;
}

interface MockTextEditor {
    document: MockTextDocument;
}

interface Notification {
    kind: 'info' | 'warning' | 'error';
    message: string;
    items?: string[];
    modal?: boolean;
    detail?: string;
}

interface ConfigChangeEvent {
    affectsConfiguration: (section: string) => boolean;
}

interface FindFilesCall {
    include: string | RelativePattern;
    exclude: string | RelativePattern | null | undefined;
}

interface State {
    configValues: Map<string, unknown>;
    languageConfigValues: Map<string, unknown>;
    workspaceFolders: MockWorkspaceFolder[] | undefined;
    files: Map<string, Buffer>;
    // When set for a given fsPath, stat() returns this size regardless of
    // the file's actual buffer length. Used to simulate stat/read race
    // windows where the file grows between the two calls.
    statSizeOverride: Map<string, number>;
    findFilesQueue: Uri[];
    findFilesCalls: FindFilesCall[];
    notifications: Notification[];
    commands: Map<string, AnyFn>;
    activeTextEditor: MockTextEditor | undefined;
    onSaveListeners: Listener<MockTextDocument>[];
    onConfigChangeListeners: Listener<ConfigChangeEvent>[];
    statusBarItems: MockStatusBarItem[];
    outputChannels: MockOutputChannel[];
    fileWatchers: MockFileSystemWatcher[];
    readFileError: Error | undefined;
    writeFileError: Error | undefined;
    warningResponseQueue: (string | undefined)[];
}

export const _state: State = {
    configValues: new Map(),
    languageConfigValues: new Map(),
    workspaceFolders: undefined,
    files: new Map(),
    statSizeOverride: new Map(),
    findFilesQueue: [],
    findFilesCalls: [],
    notifications: [],
    commands: new Map(),
    activeTextEditor: undefined,
    onSaveListeners: [],
    onConfigChangeListeners: [],
    statusBarItems: [],
    outputChannels: [],
    fileWatchers: [],
    readFileError: undefined,
    writeFileError: undefined,
    warningResponseQueue: [],
};

export function _reset(): void {
    _state.configValues = new Map();
    _state.languageConfigValues = new Map();
    _state.workspaceFolders = undefined;
    _state.files = new Map();
    _state.statSizeOverride = new Map();
    _state.findFilesQueue = [];
    _state.findFilesCalls = [];
    _state.notifications = [];
    _state.commands = new Map();
    _state.activeTextEditor = undefined;
    _state.onSaveListeners = [];
    _state.onConfigChangeListeners = [];
    _state.statusBarItems = [];
    _state.outputChannels = [];
    _state.fileWatchers = [];
    _state.readFileError = undefined;
    _state.writeFileError = undefined;
    _state.warningResponseQueue = [];
}

export function _queueWarningResponse(value: string | undefined): void {
    _state.warningResponseQueue.push(value);
}

export function _setConfig(section: string, key: string, value: unknown): void {
    _state.configValues.set(`${section}.${key}`, value);
}

// Set a per-language config override (the `[javascript]bitburnerSync.X` form
// in user settings). Mirrors what VS Code's WorkspaceConfiguration.inspect()
// returns under the *LanguageValue keys.
export function _setLanguageConfig(section: string, key: string, value: unknown): void {
    _state.languageConfigValues.set(`${section}.${key}`, value);
}

export function _setWorkspaceFolders(paths: string[]): void {
    _state.workspaceFolders = paths.map((p, i) => ({
        uri: Uri.file(p),
        name: `folder-${i}`,
        index: i,
    }));
}

export function _writeFile(fsPath: string, content: string | Buffer): void {
    _state.files.set(fsPath, typeof content === 'string' ? Buffer.from(content) : content);
}

export function _readFile(fsPath: string): string | undefined {
    const buf = _state.files.get(fsPath);
    return buf ? buf.toString() : undefined;
}

export function _triggerSave(uri: Uri): void {
    for (const listener of _state.onSaveListeners) {
        listener({ uri });
    }
}

export function _triggerConfigChange(affectedSection: string): void {
    const evt: ConfigChangeEvent = {
        affectsConfiguration: (s: string) => s === affectedSection || affectedSection.startsWith(s + '.'),
    };
    for (const listener of _state.onConfigChangeListeners) {
        listener(evt);
    }
}

export const workspace = {
    getConfiguration(section?: string): {
        get: <T>(key: string, def: T) => T;
        inspect: <T>(key: string) => {
            key: string;
            globalValue?: T;
            workspaceValue?: T;
            workspaceFolderValue?: T;
            defaultValue?: T;
            globalLanguageValue?: T;
            workspaceLanguageValue?: T;
            workspaceFolderLanguageValue?: T;
            defaultLanguageValue?: T;
        };
    } {
        return {
            get<T>(key: string, def: T): T {
                const fullKey = section ? `${section}.${key}` : key;
                if (_state.languageConfigValues.has(fullKey)) {
                    return _state.languageConfigValues.get(fullKey) as T;
                }
                if (_state.configValues.has(fullKey)) {
                    return _state.configValues.get(fullKey) as T;
                }
                return def;
            },
            inspect<T>(key: string) {
                const fullKey = section ? `${section}.${key}` : key;
                const hasGlobal = _state.configValues.has(fullKey);
                const hasLang = _state.languageConfigValues.has(fullKey);
                return {
                    key: fullKey,
                    globalValue: hasGlobal ? (_state.configValues.get(fullKey) as T) : undefined,
                    globalLanguageValue: hasLang ? (_state.languageConfigValues.get(fullKey) as T) : undefined,
                };
            },
        };
    },
    get workspaceFolders(): MockWorkspaceFolder[] | undefined {
        return _state.workspaceFolders;
    },
    getWorkspaceFolder(uri: Uri): MockWorkspaceFolder | undefined {
        if (!_state.workspaceFolders) {
            return undefined;
        }
        for (const folder of _state.workspaceFolders) {
            const folderPath = folder.uri.fsPath.replace(/\\/g, '/');
            const target = uri.fsPath.replace(/\\/g, '/');
            if (target === folderPath || target.startsWith(folderPath + '/')) {
                return folder;
            }
        }
        return undefined;
    },
    fs: {
        async readFile(uri: Uri): Promise<Uint8Array> {
            if (_state.readFileError) {
                throw _state.readFileError;
            }
            const content = _state.files.get(uri.fsPath);
            if (!content) {
                throw new Error(`ENOENT: ${uri.fsPath}`);
            }
            return content;
        },
        async writeFile(uri: Uri, data: Uint8Array): Promise<void> {
            if (_state.writeFileError) {
                throw _state.writeFileError;
            }
            _state.files.set(uri.fsPath, Buffer.from(data));
        },
        async stat(uri: Uri): Promise<{ type: number; ctime: number; mtime: number; size: number }> {
            const content = _state.files.get(uri.fsPath);
            if (!content) {
                throw new Error(`ENOENT: ${uri.fsPath}`);
            }
            const override = _state.statSizeOverride.get(uri.fsPath);
            const size = override !== undefined ? override : content.length;
            return { type: 1, ctime: 0, mtime: 0, size };
        },
    },
    async findFiles(include: string | RelativePattern, exclude?: string | RelativePattern | null): Promise<Uri[]> {
        _state.findFilesCalls.push({ include, exclude });
        return _state.findFilesQueue.slice();
    },
    createFileSystemWatcher(pattern: string | RelativePattern): MockFileSystemWatcher {
        const w = new MockFileSystemWatcher(pattern);
        _state.fileWatchers.push(w);
        return w;
    },
    onDidSaveTextDocument(handler: Listener<MockTextDocument>): Disposable {
        _state.onSaveListeners.push(handler);
        return new Disposable(() => {
            const i = _state.onSaveListeners.indexOf(handler);
            if (i >= 0) {
                _state.onSaveListeners.splice(i, 1);
            }
        });
    },
    onDidChangeConfiguration(handler: Listener<ConfigChangeEvent>): Disposable {
        _state.onConfigChangeListeners.push(handler);
        return new Disposable(() => {
            const i = _state.onConfigChangeListeners.indexOf(handler);
            if (i >= 0) {
                _state.onConfigChangeListeners.splice(i, 1);
            }
        });
    },
};

export const window = {
    showInformationMessage(message: string): Promise<undefined> {
        _state.notifications.push({ kind: 'info', message });
        return Promise.resolve(undefined);
    },
    showWarningMessage(message: string, ...rest: unknown[]): Promise<string | undefined> {
        let modal = false;
        let detail: string | undefined;
        let items: string[];
        if (rest.length > 0 && typeof rest[0] === 'object' && rest[0] !== null) {
            const opts = rest[0] as { modal?: boolean; detail?: string };
            modal = !!opts.modal;
            detail = opts.detail;
            items = rest.slice(1).filter((x): x is string => typeof x === 'string');
        } else {
            items = rest.filter((x): x is string => typeof x === 'string');
        }
        _state.notifications.push({ kind: 'warning', message, items, modal, detail });
        return Promise.resolve(_state.warningResponseQueue.shift());
    },
    showErrorMessage(message: string): Promise<undefined> {
        _state.notifications.push({ kind: 'error', message });
        return Promise.resolve(undefined);
    },
    createOutputChannel(name: string): MockOutputChannel {
        const c = new MockOutputChannel(name);
        _state.outputChannels.push(c);
        return c;
    },
    createStatusBarItem(alignment: number, priority: number): MockStatusBarItem {
        const item = new MockStatusBarItem(alignment, priority);
        _state.statusBarItems.push(item);
        return item;
    },
    get activeTextEditor(): MockTextEditor | undefined {
        return _state.activeTextEditor;
    },
};

export const commands = {
    registerCommand(name: string, handler: AnyFn): Disposable {
        _state.commands.set(name, handler);
        return new Disposable(() => {
            if (_state.commands.get(name) === handler) {
                _state.commands.delete(name);
            }
        });
    },
    async executeCommand<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
        const handler = _state.commands.get(name);
        if (!handler) {
            throw new Error(`Command not found: ${name}`);
        }
        return handler(...args) as T;
    },
};

export { Uri, Disposable, ThemeColor, RelativePattern, StatusBarAlignment, MockFileSystemWatcher, MockStatusBarItem, MockOutputChannel };

export type Memento = {
    get<T>(key: string, def: T): T;
    update(key: string, value: unknown): Promise<void>;
};

export type ExtensionContext = {
    subscriptions: { dispose(): unknown }[];
    globalState: Memento;
    workspaceState: Memento;
    // Real vscode.ExtensionContext exposes the install directory; the
    // production code reads it to locate the bundled @types/ copies under
    // dist/types. Tests give a stable placeholder so path.join doesn't crash.
    extensionPath: string;
};

// Constructs an in-memory Memento, mirroring vscode.ExtensionContext.globalState /
// workspaceState semantics tightly enough for the activation flow: get-with-default,
// update returns void, no events.
export function _makeMemento(initial?: Record<string, unknown>): Memento {
    const store = new Map<string, unknown>(initial ? Object.entries(initial) : []);
    return {
        get<T>(key: string, def: T): T {
            return (store.has(key) ? store.get(key) : def) as T;
        },
        update(key: string, value: unknown): Promise<void> {
            if (value === undefined) {
                store.delete(key);
            } else {
                store.set(key, value);
            }
            return Promise.resolve();
        },
    };
}
export type OutputChannel = MockOutputChannel;
export type StatusBarItem = MockStatusBarItem;
export type FileSystemWatcher = MockFileSystemWatcher;
export type TextDocument = MockTextDocument;
export type TextEditor = MockTextEditor;
export type WorkspaceFolder = MockWorkspaceFolder;
