"use strict";
/**
 * Minimal in-memory mock of the `vscode` extension host API.
 *
 * Tests redirect imports of `vscode` to this file (see `../setup.ts`).
 * Each test should call `_reset()` in `beforeEach` to clear state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockOutputChannel = exports.MockStatusBarItem = exports.MockFileSystemWatcher = exports.StatusBarAlignment = exports.RelativePattern = exports.ThemeColor = exports.Disposable = exports.Uri = exports.commands = exports.window = exports.workspace = exports._state = void 0;
exports._reset = _reset;
exports._queueWarningResponse = _queueWarningResponse;
exports._queueInputBoxResponse = _queueInputBoxResponse;
exports._setConfig = _setConfig;
exports._setLanguageConfig = _setLanguageConfig;
exports._setWorkspaceFolders = _setWorkspaceFolders;
exports._writeFile = _writeFile;
exports._readFile = _readFile;
exports._triggerSave = _triggerSave;
exports._setActiveEditor = _setActiveEditor;
exports._queueQuickPickResponse = _queueQuickPickResponse;
exports._triggerDeleteFiles = _triggerDeleteFiles;
exports._triggerRenameFiles = _triggerRenameFiles;
exports._triggerConfigChange = _triggerConfigChange;
exports._makeMemento = _makeMemento;
class Uri {
    fsPath;
    scheme;
    authority = '';
    query = '';
    fragment = '';
    constructor(fsPath, scheme = 'file') {
        this.fsPath = fsPath;
        this.scheme = scheme;
    }
    get path() {
        return this.fsPath.replace(/\\/g, '/');
    }
    static file(p) {
        return new Uri(p);
    }
    static parse(value) {
        if (value.startsWith('file://')) {
            return new Uri(value.slice(7));
        }
        return new Uri(value);
    }
    static joinPath(base, ...segments) {
        let p = base.fsPath.replace(/\\/g, '/');
        for (const seg of segments) {
            const cleanSeg = seg.replace(/\\/g, '/').replace(/^\/+/, '');
            p = p.replace(/\/+$/, '') + '/' + cleanSeg;
        }
        return new Uri(p);
    }
    toString() {
        return `${this.scheme}://${this.fsPath}`;
    }
    toJSON() {
        return { scheme: this.scheme, fsPath: this.fsPath };
    }
    with(_change) {
        return this;
    }
}
exports.Uri = Uri;
class Disposable {
    fn;
    constructor(fn) {
        this.fn = fn;
    }
    dispose() {
        this.fn();
    }
    static from(...disposables) {
        return new Disposable(() => disposables.forEach(d => d.dispose()));
    }
}
exports.Disposable = Disposable;
class ThemeColor {
    id;
    constructor(id) {
        this.id = id;
    }
}
exports.ThemeColor = ThemeColor;
// Minimal stand-in for vscode.RelativePattern. Mirrors the real shape closely
// enough for the production code to construct it; the mock filesystem APIs
// only care about the `.pattern` string.
class RelativePattern {
    pattern;
    baseUri;
    base;
    constructor(base, pattern) {
        this.pattern = pattern;
        if (typeof base === 'string') {
            this.baseUri = Uri.file(base);
            this.base = base;
        }
        else if (base instanceof Uri) {
            this.baseUri = base;
            this.base = base.fsPath;
        }
        else {
            this.baseUri = base.uri;
            this.base = base.uri.fsPath;
        }
    }
}
exports.RelativePattern = RelativePattern;
const StatusBarAlignment = { Left: 1, Right: 2 };
exports.StatusBarAlignment = StatusBarAlignment;
class MockOutputChannel {
    name;
    lines = [];
    disposed = false;
    constructor(name) {
        this.name = name;
    }
    append(text) {
        this.lines.push(text);
    }
    appendLine(line) {
        this.lines.push(line);
    }
    replace(text) {
        this.lines.length = 0;
        this.lines.push(text);
    }
    clear() {
        this.lines.length = 0;
    }
    show() { }
    hide() { }
    dispose() {
        this.disposed = true;
    }
}
exports.MockOutputChannel = MockOutputChannel;
class MockStatusBarItem {
    alignment;
    priority;
    text = '';
    tooltip = '';
    command;
    backgroundColor;
    shown = false;
    disposed = false;
    constructor(alignment, priority) {
        this.alignment = alignment;
        this.priority = priority;
    }
    show() {
        this.shown = true;
    }
    hide() {
        this.shown = false;
    }
    dispose() {
        this.disposed = true;
    }
}
exports.MockStatusBarItem = MockStatusBarItem;
class MockFileSystemWatcher {
    pattern;
    disposed = false;
    onChangeListeners = [];
    onCreateListeners = [];
    onDeleteListeners = [];
    constructor(pattern) {
        this.pattern = pattern;
    }
    register(list, handler, disposables) {
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
    onDidChange(handler, _ctx, disposables) {
        return this.register(this.onChangeListeners, handler, disposables);
    }
    onDidCreate(handler, _ctx, disposables) {
        return this.register(this.onCreateListeners, handler, disposables);
    }
    onDidDelete(handler, _ctx, disposables) {
        return this.register(this.onDeleteListeners, handler, disposables);
    }
    dispose() {
        this.disposed = true;
    }
}
exports.MockFileSystemWatcher = MockFileSystemWatcher;
exports._state = {
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
    onActiveEditorListeners: [],
    onSaveListeners: [],
    quickPickCalls: [],
    quickPickResponseQueue: [],
    onDeleteFilesListeners: [],
    onRenameFilesListeners: [],
    onConfigChangeListeners: [],
    statusBarItems: [],
    outputChannels: [],
    fileWatchers: [],
    readFileError: undefined,
    writeFileError: undefined,
    warningResponseQueue: [],
    inputBoxResponseQueue: [],
    inputBoxCalls: [],
};
function _reset() {
    exports._state.configValues = new Map();
    exports._state.languageConfigValues = new Map();
    exports._state.workspaceFolders = undefined;
    exports._state.files = new Map();
    exports._state.statSizeOverride = new Map();
    exports._state.findFilesQueue = [];
    exports._state.findFilesCalls = [];
    exports._state.notifications = [];
    exports._state.commands = new Map();
    exports._state.activeTextEditor = undefined;
    exports._state.onActiveEditorListeners = [];
    exports._state.onSaveListeners = [];
    exports._state.quickPickCalls = [];
    exports._state.quickPickResponseQueue = [];
    exports._state.onDeleteFilesListeners = [];
    exports._state.onRenameFilesListeners = [];
    exports._state.onConfigChangeListeners = [];
    exports._state.statusBarItems = [];
    exports._state.outputChannels = [];
    exports._state.fileWatchers = [];
    exports._state.readFileError = undefined;
    exports._state.writeFileError = undefined;
    exports._state.warningResponseQueue = [];
    exports._state.inputBoxResponseQueue = [];
    exports._state.inputBoxCalls = [];
}
function _queueWarningResponse(value) {
    exports._state.warningResponseQueue.push(value);
}
function _queueInputBoxResponse(value) {
    exports._state.inputBoxResponseQueue.push(value);
}
function _setConfig(section, key, value) {
    exports._state.configValues.set(`${section}.${key}`, value);
}
// Set a per-language config override (the `[javascript]bitburnerSync.X` form
// in user settings). Mirrors what VS Code's WorkspaceConfiguration.inspect()
// returns under the *LanguageValue keys.
function _setLanguageConfig(section, key, value) {
    exports._state.languageConfigValues.set(`${section}.${key}`, value);
}
function _setWorkspaceFolders(paths) {
    exports._state.workspaceFolders = paths.map((p, i) => ({
        uri: Uri.file(p),
        name: `folder-${i}`,
        index: i,
    }));
}
function _writeFile(fsPath, content) {
    exports._state.files.set(fsPath, typeof content === 'string' ? Buffer.from(content) : content);
}
function _readFile(fsPath) {
    const buf = exports._state.files.get(fsPath);
    return buf ? buf.toString() : undefined;
}
function _triggerSave(uri, text) {
    const doc = text === undefined ? { uri } : { uri, getText: () => text };
    for (const listener of exports._state.onSaveListeners) {
        listener(doc);
    }
}
function _setActiveEditor(editor) {
    exports._state.activeTextEditor = editor;
    for (const listener of exports._state.onActiveEditorListeners) {
        listener(editor);
    }
}
function _queueQuickPickResponse(value) {
    exports._state.quickPickResponseQueue.push(value);
}
function _triggerDeleteFiles(uris) {
    const event = { files: uris };
    for (const listener of exports._state.onDeleteFilesListeners) {
        listener(event);
    }
}
function _triggerRenameFiles(pairs) {
    const event = { files: pairs };
    for (const listener of exports._state.onRenameFilesListeners) {
        listener(event);
    }
}
function _triggerConfigChange(affectedSection) {
    const evt = {
        affectsConfiguration: (s) => s === affectedSection || affectedSection.startsWith(s + '.'),
    };
    for (const listener of exports._state.onConfigChangeListeners) {
        listener(evt);
    }
}
exports.workspace = {
    getConfiguration(section) {
        return {
            get(key, def) {
                const fullKey = section ? `${section}.${key}` : key;
                if (exports._state.languageConfigValues.has(fullKey)) {
                    return exports._state.languageConfigValues.get(fullKey);
                }
                if (exports._state.configValues.has(fullKey)) {
                    return exports._state.configValues.get(fullKey);
                }
                return def;
            },
            inspect(key) {
                const fullKey = section ? `${section}.${key}` : key;
                const hasGlobal = exports._state.configValues.has(fullKey);
                const hasLang = exports._state.languageConfigValues.has(fullKey);
                return {
                    key: fullKey,
                    globalValue: hasGlobal ? exports._state.configValues.get(fullKey) : undefined,
                    globalLanguageValue: hasLang ? exports._state.languageConfigValues.get(fullKey) : undefined,
                };
            },
        };
    },
    get workspaceFolders() {
        return exports._state.workspaceFolders;
    },
    getWorkspaceFolder(uri) {
        if (!exports._state.workspaceFolders) {
            return undefined;
        }
        for (const folder of exports._state.workspaceFolders) {
            const folderPath = folder.uri.fsPath.replace(/\\/g, '/');
            const target = uri.fsPath.replace(/\\/g, '/');
            if (target === folderPath || target.startsWith(folderPath + '/')) {
                return folder;
            }
        }
        return undefined;
    },
    fs: {
        async readFile(uri) {
            if (exports._state.readFileError) {
                throw exports._state.readFileError;
            }
            const content = exports._state.files.get(uri.fsPath);
            if (!content) {
                throw new Error(`ENOENT: ${uri.fsPath}`);
            }
            return content;
        },
        async writeFile(uri, data) {
            if (exports._state.writeFileError) {
                throw exports._state.writeFileError;
            }
            exports._state.files.set(uri.fsPath, Buffer.from(data));
        },
        async stat(uri) {
            const content = exports._state.files.get(uri.fsPath);
            if (!content) {
                throw new Error(`ENOENT: ${uri.fsPath}`);
            }
            const override = exports._state.statSizeOverride.get(uri.fsPath);
            const size = override !== undefined ? override : content.length;
            return { type: 1, ctime: 0, mtime: 0, size };
        },
    },
    async findFiles(include, exclude) {
        exports._state.findFilesCalls.push({ include, exclude });
        return exports._state.findFilesQueue.slice();
    },
    createFileSystemWatcher(pattern) {
        const w = new MockFileSystemWatcher(pattern);
        exports._state.fileWatchers.push(w);
        return w;
    },
    onDidSaveTextDocument(handler) {
        exports._state.onSaveListeners.push(handler);
        return new Disposable(() => {
            const i = exports._state.onSaveListeners.indexOf(handler);
            if (i >= 0) {
                exports._state.onSaveListeners.splice(i, 1);
            }
        });
    },
    onDidDeleteFiles(handler) {
        exports._state.onDeleteFilesListeners.push(handler);
        return new Disposable(() => {
            const i = exports._state.onDeleteFilesListeners.indexOf(handler);
            if (i >= 0) {
                exports._state.onDeleteFilesListeners.splice(i, 1);
            }
        });
    },
    onDidRenameFiles(handler) {
        exports._state.onRenameFilesListeners.push(handler);
        return new Disposable(() => {
            const i = exports._state.onRenameFilesListeners.indexOf(handler);
            if (i >= 0) {
                exports._state.onRenameFilesListeners.splice(i, 1);
            }
        });
    },
    onDidChangeConfiguration(handler) {
        exports._state.onConfigChangeListeners.push(handler);
        return new Disposable(() => {
            const i = exports._state.onConfigChangeListeners.indexOf(handler);
            if (i >= 0) {
                exports._state.onConfigChangeListeners.splice(i, 1);
            }
        });
    },
};
exports.window = {
    showInformationMessage(message) {
        exports._state.notifications.push({ kind: 'info', message });
        return Promise.resolve(undefined);
    },
    showWarningMessage(message, ...rest) {
        let modal = false;
        let detail;
        let items;
        if (rest.length > 0 && typeof rest[0] === 'object' && rest[0] !== null) {
            const opts = rest[0];
            modal = !!opts.modal;
            detail = opts.detail;
            items = rest.slice(1).filter((x) => typeof x === 'string');
        }
        else {
            items = rest.filter((x) => typeof x === 'string');
        }
        exports._state.notifications.push({ kind: 'warning', message, items, modal, detail });
        return Promise.resolve(exports._state.warningResponseQueue.shift());
    },
    showErrorMessage(message) {
        exports._state.notifications.push({ kind: 'error', message });
        return Promise.resolve(undefined);
    },
    showInputBox(options) {
        exports._state.inputBoxCalls.push({ options: options ?? {} });
        return Promise.resolve(exports._state.inputBoxResponseQueue.shift());
    },
    showQuickPick(items, options) {
        exports._state.quickPickCalls.push({ items, options: options ?? {} });
        return Promise.resolve(exports._state.quickPickResponseQueue.shift());
    },
    onDidChangeActiveTextEditor(handler) {
        exports._state.onActiveEditorListeners.push(handler);
        return new Disposable(() => {
            const i = exports._state.onActiveEditorListeners.indexOf(handler);
            if (i >= 0) {
                exports._state.onActiveEditorListeners.splice(i, 1);
            }
        });
    },
    createOutputChannel(name) {
        const c = new MockOutputChannel(name);
        exports._state.outputChannels.push(c);
        return c;
    },
    createStatusBarItem(alignment, priority) {
        const item = new MockStatusBarItem(alignment, priority);
        exports._state.statusBarItems.push(item);
        return item;
    },
    get activeTextEditor() {
        return exports._state.activeTextEditor;
    },
};
exports.commands = {
    registerCommand(name, handler) {
        exports._state.commands.set(name, handler);
        return new Disposable(() => {
            if (exports._state.commands.get(name) === handler) {
                exports._state.commands.delete(name);
            }
        });
    },
    async executeCommand(name, ...args) {
        const handler = exports._state.commands.get(name);
        if (!handler) {
            throw new Error(`Command not found: ${name}`);
        }
        return handler(...args);
    },
};
// Constructs an in-memory Memento, mirroring vscode.ExtensionContext.globalState /
// workspaceState semantics tightly enough for the activation flow: get-with-default,
// update returns void, no events.
function _makeMemento(initial) {
    const store = new Map(initial ? Object.entries(initial) : []);
    function get(key, def) {
        return (store.has(key) ? store.get(key) : def);
    }
    return {
        keys: () => Array.from(store.keys()),
        get,
        update(key, value) {
            if (value === undefined) {
                store.delete(key);
            }
            else {
                store.set(key, value);
            }
            return Promise.resolve();
        },
    };
}
//# sourceMappingURL=vscode.js.map