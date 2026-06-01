import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { Configuration } from '../../config/Configuration';
import { FileWatcher } from '../../sync/FileWatcher';
import type { SyncEngine } from '../../sync/SyncEngine';
import { Spy } from './helpers';

const { Uri, _reset, _state, _triggerSave, _setConfig, _setWorkspaceFolders } = vscodeMock;

interface FakeEngine {
    handleFileChange: Spy<[unknown]>;
}

function buildEngine(): FakeEngine {
    return {
        handleFileChange: new Spy(),
    };
}

function asEngine(fake: FakeEngine): SyncEngine {
    return {
        handleFileChange: fake.handleFileChange.fn,
    } as unknown as SyncEngine;
}

suite('FileWatcher', () => {
    setup(() => {
        _reset();
    });

    test('creates a FileSystemWatcher using the config glob pattern', () => {
        const watcher = new FileWatcher(asEngine(buildEngine()), new Configuration());
        watcher.start();
        assert.equal(_state.fileWatchers.length, 1);
        assert.equal(_state.fileWatchers[0].pattern, '**/*.{js,ts,jsx,tsx,txt,json,css,py}');
        watcher.dispose();
    });

    test('forwards onDidChange to syncEngine.handleFileChange', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        const uri = Uri.file('/workspace/a.js');
        _state.fileWatchers[0].onChangeListeners.forEach(fn => fn(uri));
        assert.equal(engine.handleFileChange.callCount, 1);
        assert.equal(engine.handleFileChange.calls[0][0], uri);
        watcher.dispose();
    });

    test('forwards onDidCreate to syncEngine.handleFileChange', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        const uri = Uri.file('/workspace/new.js');
        _state.fileWatchers[0].onCreateListeners.forEach(fn => fn(uri));
        assert.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });

    test('does NOT subscribe to onDidDelete — local deletes never propagate to Bitburner', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        assert.equal(
            _state.fileWatchers[0].onDeleteListeners.length, 0,
            'FileWatcher must not register a delete listener — sync is push-only'
        );
        watcher.dispose();
    });

    test('forwards onDidSaveTextDocument when the extension matches', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/foo.ts'));
        assert.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });

    test('ignores save events for files whose extension is not configured', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/notes.md'));
        assert.equal(engine.handleFileChange.callCount, 0);
        watcher.dispose();
    });

    test('uses the syncDirectory in the watcher glob pattern', () => {
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        const watcher = new FileWatcher(asEngine(buildEngine()), new Configuration());
        watcher.start();
        assert.equal(_state.fileWatchers[0].pattern, 'src/**/*.{js,ts,jsx,tsx,txt,json,css,py}');
        watcher.dispose();
    });

    test('ignores save events for files outside the syncDirectory', () => {
        _setWorkspaceFolders(['/workspace']);
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/outside.js'));
        _triggerSave(Uri.file('/workspace/src/inside.js'));
        assert.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });

    test('respects custom fileExtensions on save', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.ns']);
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/foo.ns'));
        _triggerSave(Uri.file('/workspace/foo.js'));
        assert.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });

    test('matches files with dotless extension config (e.g., "ns" matches foo.ns)', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['ns']);
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/foo.ns'));
        _triggerSave(Uri.file('/workspace/foo.js'));
        assert.equal(engine.handleFileChange.callCount, 1);
        watcher.dispose();
    });

    test('matches case-insensitively on the file extension', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        _triggerSave(Uri.file('/workspace/foo.JS'));
        _triggerSave(Uri.file('/workspace/bar.Js'));
        assert.equal(engine.handleFileChange.callCount, 2);
        watcher.dispose();
    });

    test('does not create a watcher or save listener when fileExtensions is explicitly []', () => {
        _setConfig('bitburnerSync', 'fileExtensions', []);
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        // No watcher should have been registered, no save listener attached.
        assert.equal(_state.fileWatchers.length, 0, 'expected no FileSystemWatcher to be created');
        assert.equal(_state.onSaveListeners.length, 0, 'expected no save listener to be registered');
        // Saving a file does nothing — handleFileChange would never be called.
        _triggerSave(Uri.file('/workspace/foo.js'));
        assert.equal(engine.handleFileChange.callCount, 0);
        watcher.dispose();
    });

    test('does not match files with no extension at all', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        // No dot anywhere — previous impl would compare the whole path
        _triggerSave(Uri.file('/workspace/Makefile'));
        assert.equal(engine.handleFileChange.callCount, 0);
        watcher.dispose();
    });

    test('stop() disposes the watcher and removes the save listener', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        assert.equal(_state.onSaveListeners.length, 1);
        const fileWatcher = _state.fileWatchers[0];
        watcher.stop();
        assert.equal(fileWatcher.disposed, true);
        assert.equal(_state.onSaveListeners.length, 0);
    });

    test('start() after stop() creates a fresh watcher', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        watcher.start(); // restart
        assert.equal(_state.fileWatchers.length, 2);
        assert.equal(_state.fileWatchers[0].disposed, true);
        watcher.dispose();
    });

    test('dispose is an alias for stop', () => {
        const engine = buildEngine();
        const watcher = new FileWatcher(asEngine(engine), new Configuration());
        watcher.start();
        watcher.dispose();
        assert.equal(_state.fileWatchers[0].disposed, true);
        assert.equal(_state.onSaveListeners.length, 0);
    });
});
