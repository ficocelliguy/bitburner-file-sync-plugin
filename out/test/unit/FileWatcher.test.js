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
const Configuration_1 = require("../../config/Configuration");
const FileWatcher_1 = require("../../sync/FileWatcher");
const helpers_1 = require("./helpers");
const { Uri, _reset, _state, _triggerSave, _setConfig, _setWorkspaceFolders } = vscodeMock;
function buildEngine() {
    return {
        handleFileChange: new helpers_1.Spy(),
    };
}
function asEngine(fake) {
    return {
        handleFileChange: fake.handleFileChange.fn,
    };
}
suite('FileWatcher', () => {
    setup(() => {
        _reset();
    });
    test('creates a FileSystemWatcher using the config glob pattern', () => {
        const watcher = new FileWatcher_1.FileWatcher(asEngine(buildEngine()), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.fileWatchers.length, 1);
        assert_1.strict.equal(_state.fileWatchers[0].pattern, '**/*.{js,ts,jsx,tsx,txt,json,css,py}');
        watcher.dispose();
    });
    test('forwards onDidChange to syncEngine.handleFileChange', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        const uri = Uri.file('/workspace/a.js');
        _state.fileWatchers[0].onChangeListeners.forEach(fn => fn(uri));
        assert_1.strict.equal(engine.handleFileChange.callCount, 1);
        assert_1.strict.equal(engine.handleFileChange.calls[0][0], uri);
        watcher.dispose();
    });
    test('forwards onDidCreate to syncEngine.handleFileChange', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        const uri = Uri.file('/workspace/new.js');
        _state.fileWatchers[0].onCreateListeners.forEach(fn => fn(uri));
        assert_1.strict.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });
    test('does NOT subscribe to onDidDelete — local deletes never propagate to Bitburner', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.fileWatchers[0].onDeleteListeners.length, 0, 'FileWatcher must not register a delete listener — sync is push-only');
        watcher.dispose();
    });
    test('forwards onDidSaveTextDocument when the extension matches', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/foo.ts'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });
    test('ignores save events for files whose extension is not configured', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/notes.md'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 0);
        watcher.dispose();
    });
    test('uses the syncDirectory in the watcher glob pattern', () => {
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        const watcher = new FileWatcher_1.FileWatcher(asEngine(buildEngine()), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.fileWatchers[0].pattern, 'src/**/*.{js,ts,jsx,tsx,txt,json,css,py}');
        watcher.dispose();
    });
    test('ignores save events for files outside the syncDirectory', () => {
        _setWorkspaceFolders(['/workspace']);
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/outside.js'));
        _triggerSave(Uri.file('/workspace/src/inside.js'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });
    test('respects custom fileExtensions on save', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.ns']);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/foo.ns'));
        _triggerSave(Uri.file('/workspace/foo.js'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });
    test('matches files with dotless extension config (e.g., "ns" matches foo.ns)', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['ns']);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/foo.ns'));
        _triggerSave(Uri.file('/workspace/foo.js'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });
    test('matches case-insensitively on the file extension', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/foo.JS'));
        _triggerSave(Uri.file('/workspace/bar.Js'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 2);
        watcher.dispose();
    });
    test('does not create a watcher or save listener when fileExtensions is explicitly []', () => {
        _setConfig('bitburnerSync', 'fileExtensions', []);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        // No watcher should have been registered, no save listener attached.
        assert_1.strict.equal(_state.fileWatchers.length, 0, 'expected no FileSystemWatcher to be created');
        assert_1.strict.equal(_state.onSaveListeners.length, 0, 'expected no save listener to be registered');
        // Saving a file does nothing — handleFileChange would never be called.
        _triggerSave(Uri.file('/workspace/foo.js'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 0);
        watcher.dispose();
    });
    test('does not match files with no extension at all', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        // No dot anywhere — previous impl would compare the whole path
        _triggerSave(Uri.file('/workspace/Makefile'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 0);
        watcher.dispose();
    });
    test('stop() disposes the watcher and removes the save listener', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.onSaveListeners.length, 1);
        const fileWatcher = _state.fileWatchers[0];
        watcher.stop();
        assert_1.strict.equal(fileWatcher.disposed, true);
        assert_1.strict.equal(_state.onSaveListeners.length, 0);
    });
    test('start() after stop() creates a fresh watcher', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        watcher.start(); // restart
        assert_1.strict.equal(_state.fileWatchers.length, 2);
        assert_1.strict.equal(_state.fileWatchers[0].disposed, true);
        watcher.dispose();
    });
    test('dispose is an alias for stop', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        watcher.dispose();
        assert_1.strict.equal(_state.fileWatchers[0].disposed, true);
        assert_1.strict.equal(_state.onSaveListeners.length, 0);
    });
});
//# sourceMappingURL=FileWatcher.test.js.map