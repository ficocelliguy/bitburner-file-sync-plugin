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
const { Uri, RelativePattern, _reset, _state, _triggerSave, _triggerDeleteFiles, _triggerRenameFiles, _setConfig, _setWorkspaceFolders, } = vscodeMock;
function patternString(p) {
    return typeof p === 'string' ? p : p.pattern;
}
function patternBase(p) {
    return typeof p === 'string' ? undefined : p.baseUri.fsPath;
}
function buildEngine() {
    return {
        handleFileChange: new helpers_1.Spy(),
        handleFileDelete: new helpers_1.Spy(),
        handleFileRename: new helpers_1.Spy(),
    };
}
function asEngine(fake) {
    return {
        handleFileChange: fake.handleFileChange.fn,
        handleFileDelete: fake.handleFileDelete.fn,
        handleFileRename: fake.handleFileRename.fn,
    };
}
suite('FileWatcher', () => {
    setup(() => {
        _reset();
        // FileWatcher scopes to the primary workspace folder via RelativePattern;
        // every test below needs at least one folder for the watcher to attach to.
        _setWorkspaceFolders(['/workspace']);
    });
    test('creates a FileSystemWatcher using the config glob pattern scoped to folder[0]', () => {
        const watcher = new FileWatcher_1.FileWatcher(asEngine(buildEngine()), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.fileWatchers.length, 1);
        const pattern = _state.fileWatchers[0].pattern;
        assert_1.strict.ok(pattern instanceof RelativePattern, 'expected a RelativePattern, not a bare string glob');
        assert_1.strict.equal(patternString(pattern), '**/*.{js,ts,jsx,tsx,txt,json,css,py}');
        assert_1.strict.equal(patternBase(pattern), '/workspace');
        watcher.dispose();
    });
    test('does not create a watcher when no workspace folder is open', () => {
        _state.workspaceFolders = undefined;
        const watcher = new FileWatcher_1.FileWatcher(asEngine(buildEngine()), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.fileWatchers.length, 0);
        assert_1.strict.equal(_state.onSaveListeners.length, 0);
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
    test('does NOT subscribe to the low-level FileSystemWatcher.onDidDelete', () => {
        // FileSystemWatcher.onDidDelete fires for *every* filesystem-level
        // delete (renames on Windows, branch switches, terminal `rm`,
        // external editors). We propagate user-initiated deletes via the
        // higher-level workspace.onDidDeleteFiles instead — see the next
        // test. This assertion guards against an accidental regression.
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.fileWatchers[0].onDeleteListeners.length, 0, 'FileWatcher must not register a low-level delete listener — only the user-initiated workspace.onDidDeleteFiles');
        watcher.dispose();
    });
    test('forwards workspace.onDidDeleteFiles to syncEngine.handleFileDelete', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        const uri = Uri.file('/workspace/gone.js');
        _triggerDeleteFiles([uri]);
        assert_1.strict.equal(engine.handleFileDelete.callCount, 1);
        assert_1.strict.equal(engine.handleFileDelete.calls[0][0], uri);
        watcher.dispose();
    });
    test('forwards each URI in a multi-file delete event independently', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerDeleteFiles([
            Uri.file('/workspace/a.js'),
            Uri.file('/workspace/b.js'),
        ]);
        assert_1.strict.equal(engine.handleFileDelete.callCount, 2);
    });
    test('ignores deleted files whose extension is not configured', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerDeleteFiles([Uri.file('/workspace/notes.md')]);
        assert_1.strict.equal(engine.handleFileDelete.callCount, 0);
        watcher.dispose();
    });
    test('ignores deleted files outside the syncDirectory', () => {
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerDeleteFiles([
            Uri.file('/workspace/outside.js'),
            Uri.file('/workspace/src/inside.js'),
        ]);
        assert_1.strict.equal(engine.handleFileDelete.callCount, 1);
        assert_1.strict.equal(engine.handleFileDelete.calls[0][0].fsPath, '/workspace/src/inside.js');
        watcher.dispose();
    });
    test('ignores deleted files in non-primary workspace folders', () => {
        _setWorkspaceFolders(['/primary', '/secondary']);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerDeleteFiles([Uri.file('/secondary/a.js')]);
        assert_1.strict.equal(engine.handleFileDelete.callCount, 0);
        watcher.dispose();
    });
    test('does not subscribe to workspace.onDidDeleteFiles when fileExtensions is explicitly []', () => {
        _setConfig('bitburnerSync', 'fileExtensions', []);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.onDeleteFilesListeners.length, 0);
        // And a delete event fires nothing even if it slipped through.
        _triggerDeleteFiles([Uri.file('/workspace/a.js')]);
        assert_1.strict.equal(engine.handleFileDelete.callCount, 0);
        watcher.dispose();
    });
    test('forwards workspace.onDidRenameFiles to syncEngine.handleFileRename', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        const oldUri = Uri.file('/workspace/a.js');
        const newUri = Uri.file('/workspace/b.js');
        _triggerRenameFiles([{ oldUri, newUri }]);
        assert_1.strict.equal(engine.handleFileRename.callCount, 1);
        assert_1.strict.equal(engine.handleFileRename.calls[0][0], oldUri);
        assert_1.strict.equal(engine.handleFileRename.calls[0][1], newUri);
        watcher.dispose();
    });
    test('forwards a rename whose old path leaves the synced area (delete-side only)', () => {
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        const oldUri = Uri.file('/workspace/src/a.js');
        const newUri = Uri.file('/workspace/outside/a.js');
        _triggerRenameFiles([{ oldUri, newUri }]);
        assert_1.strict.equal(engine.handleFileRename.callCount, 1, 'old-path-in-sync renames must still forward');
        watcher.dispose();
    });
    test('forwards a rename whose new path enters the synced area (push-side only)', () => {
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        const oldUri = Uri.file('/workspace/outside/a.js');
        const newUri = Uri.file('/workspace/src/a.js');
        _triggerRenameFiles([{ oldUri, newUri }]);
        assert_1.strict.equal(engine.handleFileRename.callCount, 1, 'new-path-in-sync renames must still forward');
        watcher.dispose();
    });
    test('ignores a rename whose endpoints both fall outside the synced area', () => {
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        const oldUri = Uri.file('/workspace/outside/a.js');
        const newUri = Uri.file('/workspace/somewhere/b.js');
        _triggerRenameFiles([{ oldUri, newUri }]);
        assert_1.strict.equal(engine.handleFileRename.callCount, 0);
        watcher.dispose();
    });
    test('ignores a rename whose endpoints both have disallowed extensions', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerRenameFiles([{
                oldUri: Uri.file('/workspace/notes.md'),
                newUri: Uri.file('/workspace/notes2.md'),
            }]);
        assert_1.strict.equal(engine.handleFileRename.callCount, 0);
        watcher.dispose();
    });
    test('does not subscribe to workspace.onDidRenameFiles when fileExtensions is explicitly []', () => {
        _setConfig('bitburnerSync', 'fileExtensions', []);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.onRenameFilesListeners.length, 0);
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
        assert_1.strict.equal(patternString(_state.fileWatchers[0].pattern), 'src/**/*.{js,ts,jsx,tsx,txt,json,css,py}');
        watcher.dispose();
    });
    test('ignores save events for files in non-primary workspace folders', () => {
        _setWorkspaceFolders(['/primary', '/secondary']);
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        _triggerSave(Uri.file('/secondary/a.js'));
        _triggerSave(Uri.file('/primary/a.js'));
        assert_1.strict.equal(engine.handleFileChange.callCount, 1, 'only the primary-folder save should fire');
        watcher.dispose();
    });
    test('ignores save events for files outside the syncDirectory', () => {
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
    test('stop() disposes the watcher and removes the save/delete/rename listeners', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher_1.FileWatcher(asEngine(engine), new Configuration_1.Configuration());
        watcher.start();
        assert_1.strict.equal(_state.onSaveListeners.length, 1);
        assert_1.strict.equal(_state.onDeleteFilesListeners.length, 1);
        assert_1.strict.equal(_state.onRenameFilesListeners.length, 1);
        const fileWatcher = _state.fileWatchers[0];
        watcher.stop();
        assert_1.strict.equal(fileWatcher.disposed, true);
        assert_1.strict.equal(_state.onSaveListeners.length, 0);
        assert_1.strict.equal(_state.onDeleteFilesListeners.length, 0);
        assert_1.strict.equal(_state.onRenameFilesListeners.length, 0);
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
        assert_1.strict.equal(_state.onDeleteFilesListeners.length, 0);
        assert_1.strict.equal(_state.onRenameFilesListeners.length, 0);
    });
});
//# sourceMappingURL=FileWatcher.test.js.map