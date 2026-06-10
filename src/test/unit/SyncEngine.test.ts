import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { Configuration } from '../../config/Configuration';
import { SyncEngine } from '../../sync/SyncEngine';
import { FakeRpcClient, waitMs } from './helpers';
import { BitburnerApi } from '../../api/BitburnerApi';

const {
    Uri,
    RelativePattern,
    _reset,
    _setWorkspaceFolders,
    _setConfig,
    _writeFile,
    _readFile,
    _state,
    _queueWarningResponse,
    _queueInputBoxResponse,
    _makeMemento,
} = vscodeMock;

function buildEngine(opts: { bundledTypesDir?: string; memento?: vscodeMock.Memento } = {}): {
    engine: SyncEngine;
    api: BitburnerApi;
    rpc: FakeRpcClient;
    output: vscodeMock.OutputChannel;
    memento: vscodeMock.Memento;
} {
    const rpc = new FakeRpcClient();
    const api = new BitburnerApi(rpc as unknown as import('../../server/JsonRpcClient').JsonRpcClient);
    const config = new Configuration();
    const output = vscodeMock.window.createOutputChannel('test');
    const memento = opts.memento ?? _makeMemento();
    const engine = new SyncEngine(api, config, output, opts.bundledTypesDir, memento);
    return { engine, api, rpc, output, memento };
}

suite('SyncEngine', () => {
    setup(() => {
        _reset();
        _setWorkspaceFolders(['/workspace']);
    });

    suite('pushFile', () => {
        test('reads the local file, maps the path, and calls api.pushFile', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/main.js', 'console.log("hi");');
            await engine.pushFile(Uri.file('/workspace/main.js'));
            assert.equal(rpc.calls.length, 1);
            assert.deepEqual(rpc.calls[0], {
                method: 'pushFile',
                params: { filename: '/main.js', content: 'console.log("hi");', server: 'home' },
            });
        });

        test('uses the configured target server', async () => {
            _setConfig('bitburnerSync', 'targetServer', 'n00dles');
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            await engine.pushFile(Uri.file('/workspace/a.js'));
            assert.equal((rpc.calls[0].params as { server: string }).server, 'n00dles');
        });

        test('strips the configured syncDirectory from the remote path', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/src/main.js', 'console.log("hi");');
            await engine.pushFile(Uri.file('/workspace/src/main.js'));
            assert.equal(rpc.calls.length, 1);
            assert.equal((rpc.calls[0].params as { filename: string }).filename, '/main.js');
        });

        test('rejects files outside the configured syncDirectory', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine } = buildEngine();
            _writeFile('/workspace/outside.js', 'x');
            await assert.rejects(
                engine.pushFile(Uri.file('/workspace/outside.js')),
                /outside the sync directory/
            );
        });

        test('shows an info notification when showNotifications is true', async () => {
            const { engine } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            await engine.pushFile(Uri.file('/workspace/a.js'));
            const info = _state.notifications.filter(n => n.kind === 'info');
            assert.equal(info.length, 1);
            assert.match(info[0].message, /Synced: \/a\.js/);
        });

        test('does not show a notification when showNotifications is false', async () => {
            _setConfig('bitburnerSync', 'showNotifications', false);
            const { engine } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            await engine.pushFile(Uri.file('/workspace/a.js'));
            assert.equal(_state.notifications.length, 0);
        });

        test('writes an entry to the output channel', async () => {
            const { engine, output } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            await engine.pushFile(Uri.file('/workspace/a.js'));
            assert.equal(output.lines.length, 1);
            assert.match(output.lines[0], /Pushed: \/a\.js/);
        });
    });

    suite('syncAll', () => {
        test('warns and bails out when no files match', async () => {
            const { engine, rpc } = buildEngine();
            await engine.syncAll();
            assert.equal(rpc.calls.length, 0);
            assert.equal(_state.notifications.filter(n => n.kind === 'warning').length, 1);
        });

        test('passes a RelativePattern scoped to the primary workspace folder', async () => {
            const { engine } = buildEngine();
            await engine.syncAll();
            assert.equal(_state.findFilesCalls.length, 1, 'expected exactly one findFiles call');
            const include = _state.findFilesCalls[0].include;
            assert.ok(include instanceof RelativePattern, 'include must be a RelativePattern, not a bare string');
            assert.equal(include.baseUri.fsPath, '/workspace');
            assert.equal(include.pattern, '**/*.{js,ts,jsx,tsx,txt,json,css,py}');
        });

        test('rejects files from non-primary folders in a multi-root workspace', async () => {
            _setWorkspaceFolders(['/primary', '/secondary']);
            _writeFile('/secondary/a.js', 'secondary');
            // VS Code's findFiles with a RelativePattern would never return this URI;
            // simulate a worst-case path where it slips in anyway and check PathMapper
            // throws (counted as a failure in the summary, not silently pushed).
            _state.findFilesQueue = [Uri.file('/secondary/a.js')];
            const { engine, rpc, output } = buildEngine();
            await engine.syncAll();
            assert.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert.match(summary, /0 pushed, 1 failed/);
            const failedLog = output.lines.find(l => /Failed to push .*secondary\/a\.js/.test(l)) ?? '';
            assert.match(failedLog, /not in the primary workspace folder/);
        });

        test('pushes every file found and reports the count', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/a.js', 'a');
            _writeFile('/workspace/b.js', 'b');
            _state.findFilesQueue = [Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js')];
            await engine.syncAll();
            assert.equal(rpc.calls.length, 2);
            const lastLine = output.lines[output.lines.length - 1];
            assert.match(lastLine, /Sync complete: 2 pushed, 0 failed/);
        });

        test('counts failures and continues on errors', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/a.js', 'a');
            _writeFile('/workspace/b.js', 'b');
            _state.findFilesQueue = [Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js')];
            rpc.queueError('pushFile', new Error('first call failed'));
            // second call has no error queued — succeeds
            await engine.syncAll();
            assert.equal(rpc.calls.length, 2);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert.match(summary, /1 pushed, 1 failed/);
        });
    });

    suite('handleFileChange (debounced auto-sync)', () => {
        test('does nothing when autoSync is disabled', async () => {
            _setConfig('bitburnerSync', 'autoSync', false);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await waitMs(400);
            assert.equal(rpc.calls.length, 0);
        });

        test('pushes the file after the 300ms debounce window elapses', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await waitMs(350);
            assert.equal(rpc.calls.length, 1);
        });

        test('coalesces rapid changes to the same file into a single push', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await waitMs(100);
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await waitMs(100);
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            assert.equal(rpc.calls.length, 0);
            await waitMs(350);
            assert.equal(rpc.calls.length, 1);
        });

        test('debounces independently per file', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'a');
            _writeFile('/workspace/b.js', 'b');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            engine.handleFileChange(Uri.file('/workspace/b.js'));
            await waitMs(350);
            assert.equal(rpc.calls.length, 2);
        });

        test('logs auto-sync failures without throwing', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            rpc.queueError('pushFile', new Error('boom'));
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await waitMs(350);
            const matches = output.lines.filter(l => /Auto-sync failed/.test(l));
            assert.equal(matches.length, 1);
        });

        test('logs a skip (not a failure) when the file disappears during the debounce window', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            // Simulate an external delete (terminal / another editor) before the timer fires.
            _state.files.delete('/workspace/a.js');
            await waitMs(350);
            assert.equal(rpc.calls.length, 0, 'should not push a deleted file');
            const failed = output.lines.filter(l => /Auto-sync failed/.test(l));
            const skipped = output.lines.filter(l => /Auto-sync skipped \(file no longer exists\)/.test(l));
            assert.equal(failed.length, 0, `expected no failure log, got: ${JSON.stringify(failed)}`);
            assert.equal(skipped.length, 1, `expected one skip log, got: ${JSON.stringify(output.lines)}`);
        });

    });

    suite('file size limit (1 MB)', () => {
        const ONE_MB = 1024 * 1024;

        test('rejects an explicit push of a file over 1 MB with a clear error', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/big.js', 'x'.repeat(ONE_MB + 1));
            await assert.rejects(
                engine.pushFile(Uri.file('/workspace/big.js')),
                /exceeds the 1\.0 MB sync limit/
            );
            assert.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
        });

        test('accepts a file exactly at the 1 MB boundary', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/atlimit.js', 'x'.repeat(ONE_MB));
            await engine.pushFile(Uri.file('/workspace/atlimit.js'));
            assert.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 1);
        });

        test('auto-sync logs (does not throw or notify) when a file exceeds the limit', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/big.js', 'x'.repeat(ONE_MB + 1));
            engine.handleFileChange(Uri.file('/workspace/big.js'));
            await waitMs(350);
            assert.equal(rpc.calls.length, 0, 'no RPC for an oversize file');
            const matches = output.lines.filter(l => /Auto-sync failed.*exceeds.*sync limit/.test(l));
            assert.equal(matches.length, 1, `expected one log entry, got: ${JSON.stringify(output.lines)}`);
            // And critically — no user-facing notification spam on save.
            const errorNotifications = _state.notifications.filter(n => n.kind === 'error');
            assert.equal(errorNotifications.length, 0);
        });

        test('syncAll counts an over-limit file as a failure and includes it in the summary', async () => {
            _state.findFilesQueue = [
                Uri.file('/workspace/big.js'),
                Uri.file('/workspace/main.js'),
            ];
            _writeFile('/workspace/big.js', 'x'.repeat(ONE_MB + 1));
            _writeFile('/workspace/main.js', 'small content');
            const { engine, rpc, output } = buildEngine();
            await engine.syncAll();
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/main.js']);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert.match(summary, /1 pushed, 1 failed/);
        });

        test('error message includes the actual file size, not just the limit', async () => {
            const { engine } = buildEngine();
            const size = ONE_MB + 512 * 1024; // 1.5 MB
            _writeFile('/workspace/big.js', 'x'.repeat(size));
            await assert.rejects(
                engine.pushFile(Uri.file('/workspace/big.js')),
                /1\.5 MB/
            );
        });

        test('post-read size check catches a file that grew over the cap between stat and readFile', async () => {
            // Simulate the TOCTOU window: stat reported a small size but
            // readFile latches a much larger buffer (a writer expanded the
            // file between the two syscalls). The original cap check would
            // have let the oversized content through; the post-read check
            // rejects it.
            const { engine, rpc } = buildEngine();
            const path = '/workspace/grew.js';
            _writeFile(path, 'x'.repeat(ONE_MB + 1));
            _state.statSizeOverride.set(path, 100);
            await assert.rejects(
                engine.pushFile(Uri.file(path)),
                /exceeds the 1\.0 MB sync limit/,
            );
            assert.equal(rpc.calls.length, 0, 'must not push an oversized buffer even when stat said it was small');
        });
    });

    suite('fileExtensions = []', () => {
        test('syncAll warns and does nothing when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            _state.findFilesQueue = [Uri.file('/workspace/main.js')]; // would be returned if findFiles were called
            const { engine, rpc } = buildEngine();
            await engine.syncAll();
            assert.equal(rpc.calls.length, 0, 'no RPC calls expected with empty extensions');
            const warning = _state.notifications.find(
                n => n.kind === 'warning' && /fileExtensions is set to \[\]/.test(n.message)
            );
            assert.ok(warning, `expected a "set to []" warning, got: ${JSON.stringify(_state.notifications)}`);
        });

        test('downloadAll warns and skips even the listing RPC when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine, rpc } = buildEngine();
            // Queue a getFileNames response that would be consumed if we got
            // there — the early-bail must prevent the RPC entirely.
            rpc.queueResponse('getFileNames', ['/main.js', '/foo.ts', '/notes.txt']);
            await engine.downloadAll();
            assert.equal(rpc.calls.length, 0, 'no RPCs expected — should bail before getFileNames');
            assert.equal(_readFile('/workspace/main.js'), undefined);
            const warning = _state.notifications.find(
                n => n.kind === 'warning' && /fileExtensions is set to \[\]/.test(n.message)
            );
            assert.ok(warning, `expected a "set to []" warning, got: ${JSON.stringify(_state.notifications)}`);
            assert.match(warning.message, /Nothing will be downloaded/);
        });

        test('pushFile (explicit syncFile command) honors the [] opt-out', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            _writeFile('/workspace/main.js', 'x');
            const { engine, rpc } = buildEngine();
            await engine.pushFile(Uri.file('/workspace/main.js'));
            assert.equal(rpc.calls.length, 0, 'no push expected — the user opted out');
            const warning = _state.notifications.find(
                n => n.kind === 'warning' && /fileExtensions is set to \[\]/.test(n.message)
            );
            assert.ok(warning, `expected a "set to []" warning, got: ${JSON.stringify(_state.notifications)}`);
        });
    });

    suite('exclude patterns', () => {
        test('NetscriptDefinitions.d.ts is always excluded from explicit pushFile', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/NetscriptDefinitions.d.ts', 'declare const ns: NS;');
            await engine.pushFile(Uri.file('/workspace/NetscriptDefinitions.d.ts'));
            assert.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
            assert.ok(output.lines.some(l => /Excluded from sync.*NetscriptDefinitions/.test(l)));
        });

        test('NetscriptDefinitions.d.ts is silently excluded from auto-sync', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/NetscriptDefinitions.d.ts', 'declare const ns: NS;');
            engine.handleFileChange(Uri.file('/workspace/NetscriptDefinitions.d.ts'));
            await waitMs(350);
            assert.equal(rpc.calls.length, 0);
            // Silent — no log line because handleFileChange short-circuits before scheduling
            assert.ok(!output.lines.some(l => /Excluded from sync/.test(l)));
        });

        test('NetscriptDefinitions.d.ts is excluded from syncAll', async () => {
            _state.findFilesQueue = [
                Uri.file('/workspace/main.js'),
                Uri.file('/workspace/NetscriptDefinitions.d.ts'),
            ];
            _writeFile('/workspace/main.js', 'main');
            _writeFile('/workspace/NetscriptDefinitions.d.ts', 'declare ...');
            const { engine, rpc, output } = buildEngine();
            await engine.syncAll();
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/main.js']);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert.match(summary, /1 pushed, 0 failed, 1 excluded/);
        });

        test('NetscriptGlobals.d.ts is always excluded from explicit pushFile', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/NetscriptGlobals.d.ts', 'declare global { type NS = never; }');
            await engine.pushFile(Uri.file('/workspace/NetscriptGlobals.d.ts'));
            assert.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
            assert.ok(output.lines.some(l => /Excluded from sync.*NetscriptGlobals/.test(l)));
        });

        test('NetscriptGlobals.d.ts is excluded from syncAll', async () => {
            _state.findFilesQueue = [
                Uri.file('/workspace/main.js'),
                Uri.file('/workspace/NetscriptGlobals.d.ts'),
            ];
            _writeFile('/workspace/main.js', 'main');
            _writeFile('/workspace/NetscriptGlobals.d.ts', 'declare global { type NS = never; }');
            const { engine, rpc, output } = buildEngine();
            await engine.syncAll();
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/main.js']);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert.match(summary, /1 pushed, 0 failed, 1 excluded/);
        });

        test('user-configured exclude pattern blocks an explicit pushFile', async () => {
            _setConfig('bitburnerSync', 'exclude', ['**/*.test.js']);
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/foo.test.js', 'x');
            await engine.pushFile(Uri.file('/workspace/foo.test.js'));
            assert.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
            assert.ok(output.lines.some(l => /Excluded from sync/.test(l)));
        });

        test('user-configured exclude pattern blocks auto-sync', async () => {
            _setConfig('bitburnerSync', 'exclude', ['secrets/**']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/secrets/api-key.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/secrets/api-key.js'));
            await waitMs(350);
            assert.equal(rpc.calls.length, 0);
        });

        test('user-configured exclude pattern blocks files in syncAll', async () => {
            _setConfig('bitburnerSync', 'exclude', ['**/*.test.js']);
            _state.findFilesQueue = [
                Uri.file('/workspace/main.js'),
                Uri.file('/workspace/lib/foo.test.js'),
                Uri.file('/workspace/foo.test.js'),
            ];
            _writeFile('/workspace/main.js', 'm');
            _writeFile('/workspace/lib/foo.test.js', 't1');
            _writeFile('/workspace/foo.test.js', 't2');
            const { engine, rpc } = buildEngine();
            await engine.syncAll();
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/main.js']);
        });

        test('non-matching exclude patterns do not block sync', async () => {
            _setConfig('bitburnerSync', 'exclude', ['**/*.test.ts']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/main.js', 'x');
            await engine.pushFile(Uri.file('/workspace/main.js'));
            assert.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 1);
        });

        test('**/foo glob matches at the root as well as nested', async () => {
            _setConfig('bitburnerSync', 'exclude', ['**/secret.js']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/secret.js', 'a');
            _writeFile('/workspace/lib/secret.js', 'b');
            await engine.pushFile(Uri.file('/workspace/secret.js'));
            await engine.pushFile(Uri.file('/workspace/lib/secret.js'));
            assert.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
        });

        test('hardcoded ALWAYS_EXCLUDE blocks .vscode/, node_modules/, .git/, and .gitignore out of the box', async () => {
            // No _setConfig for exclude — these come from the SyncEngine baseline.
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/.vscode/settings.json', 'a');
            _writeFile('/workspace/node_modules/pkg/index.js', 'b');
            _writeFile('/workspace/.git/HEAD', 'c');
            _writeFile('/workspace/.gitignore', 'd');
            _writeFile('/workspace/main.js', 'e');

            // Explicit pushes for each — only main.js should reach the API.
            await engine.pushFile(Uri.file('/workspace/.vscode/settings.json'));
            await engine.pushFile(Uri.file('/workspace/node_modules/pkg/index.js'));
            await engine.pushFile(Uri.file('/workspace/.git/HEAD'));
            await engine.pushFile(Uri.file('/workspace/.gitignore'));
            await engine.pushFile(Uri.file('/workspace/main.js'));

            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/main.js']);
            const excludeLogs = output.lines.filter(l => /Excluded from sync/.test(l));
            assert.equal(excludeLogs.length, 4, `expected 4 excludes, got: ${JSON.stringify(excludeLogs)}`);
        });

        test('baseline excludes still apply even when the user sets an unrelated exclude list', async () => {
            // A user explicitly overrides `exclude` to something narrow —
            // .vscode/ etc. should *still* be excluded because they live in
            // the hardcoded list, not in user config.
            _setConfig('bitburnerSync', 'exclude', ['secrets/**']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/.vscode/launch.json', 'a');
            _writeFile('/workspace/node_modules/foo.js', 'b');
            _writeFile('/workspace/main.js', 'c');
            await engine.pushFile(Uri.file('/workspace/.vscode/launch.json'));
            await engine.pushFile(Uri.file('/workspace/node_modules/foo.js'));
            await engine.pushFile(Uri.file('/workspace/main.js'));
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/main.js']);
        });

        test('* does not cross path segments', async () => {
            // `*.js` should match foo.js but NOT nested/foo.js
            _setConfig('bitburnerSync', 'exclude', ['*.js']);
            _setConfig('bitburnerSync', 'targetServer', 'home');
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/foo.js', 'a');
            _writeFile('/workspace/lib/bar.js', 'b');
            await engine.pushFile(Uri.file('/workspace/foo.js'));
            await engine.pushFile(Uri.file('/workspace/lib/bar.js'));
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/lib/bar.js']);
        });

        test('brace expansion {a,b} in user exclude patterns (matches VS Code findFiles)', async () => {
            // Previously: home-grown matcher literal-escaped braces and never
            // matched. VS Code's findFiles supports brace expansion, so the
            // two engines diverged for this case. Now: minimatch handles it
            // and isExcluded agrees with what syncAll would have excluded.
            _setConfig('bitburnerSync', 'exclude', ['build/{js,ts}/**']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/build/js/out.js', 'a');
            _writeFile('/workspace/build/ts/out.ts', 'b');
            _writeFile('/workspace/main.js', 'c');
            await engine.pushFile(Uri.file('/workspace/build/js/out.js'));
            await engine.pushFile(Uri.file('/workspace/build/ts/out.ts'));
            await engine.pushFile(Uri.file('/workspace/main.js'));
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/main.js']);
        });

        test('Windows-style backslashes in user exclude patterns are normalized', async () => {
            // A user with Windows muscle memory pastes `node_modules\foo`.
            // The matcher must still excludes files under that subtree.
            _setConfig('bitburnerSync', 'exclude', ['secrets\\private\\**']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/secrets/private/api-key.txt', 'a');
            _writeFile('/workspace/main.js', 'b');
            await engine.pushFile(Uri.file('/workspace/secrets/private/api-key.txt'));
            await engine.pushFile(Uri.file('/workspace/main.js'));
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/main.js']);
        });

        test('character classes [abc] in user exclude patterns work', async () => {
            // minimatch supports POSIX-style character classes; the old
            // home-grown matcher did not.
            _setConfig('bitburnerSync', 'exclude', ['file[123].js']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/file1.js', 'a');
            _writeFile('/workspace/file2.js', 'b');
            _writeFile('/workspace/file9.js', 'c');
            await engine.pushFile(Uri.file('/workspace/file1.js'));
            await engine.pushFile(Uri.file('/workspace/file2.js'));
            await engine.pushFile(Uri.file('/workspace/file9.js'));
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(pushed, ['/file9.js']);
        });
    });

    suite('dispose', () => {
        test('clears any pending debounce timers', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            engine.dispose();
            await waitMs(350);
            assert.equal(rpc.calls.length, 0);
        });
    });

    suite('downloadAll', () => {
        test('throws when no workspace folder is open', async () => {
            _state.workspaceFolders = undefined;
            const { engine } = buildEngine();
            await assert.rejects(engine.downloadAll(), /No workspace folder open/);
        });

        test('warns when the remote has no files', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', []);
            await engine.downloadAll();
            assert.equal(_state.notifications.filter(n => n.kind === 'warning').length, 1);
        });

        test('writes each remote file at the workspace root by default, preserving subdirs', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/lib/helpers.js']);
            rpc.queueResponse('getFile', 'main content');
            rpc.queueResponse('getFile', 'helper content');
            await engine.downloadAll();
            assert.equal(_readFile('/workspace/main.js'), 'main content');
            assert.equal(_readFile('/workspace/lib/helpers.js'), 'helper content');
        });

        test('writes under the configured syncDirectory when set', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/lib/helpers.js']);
            rpc.queueResponse('getFile', 'main content');
            rpc.queueResponse('getFile', 'helper content');
            await engine.downloadAll();
            assert.equal(_readFile('/workspace/src/main.js'), 'main content');
            assert.equal(_readFile('/workspace/src/lib/helpers.js'), 'helper content');
        });

        test('treats syncDirectory "/" as the workspace root on download', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', '/');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js']);
            rpc.queueResponse('getFile', 'main content');
            await engine.downloadAll();
            assert.equal(_readFile('/workspace/main.js'), 'main content');
        });

        test('strips a leading slash on remote names before joining', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/foo.js']);
            rpc.queueResponse('getFile', 'foo');
            await engine.downloadAll();
            assert.equal(_readFile('/workspace/foo.js'), 'foo');
        });

        test('reports per-file failures without aborting the batch', async () => {
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js', '/b.js']);
            rpc.queueError('getFile', new Error('nope'));
            rpc.queueResponse('getFile', 'b ok');
            await engine.downloadAll();
            assert.equal(_readFile('/workspace/b.js'), 'b ok');
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert.match(summary, /1 downloaded, 1 failed/);
        });

        test('refuses to write a remote file that exceeds the 1 MB sync limit', async () => {
            const ONE_MB = 1024 * 1024;
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['/huge.js', '/ok.js']);
            rpc.queueResponse('getFile', 'x'.repeat(ONE_MB + 1));
            rpc.queueResponse('getFile', 'small');
            await engine.downloadAll();
            // The oversize file was NOT written to disk; the small one was.
            assert.equal(_readFile('/workspace/huge.js'), undefined);
            assert.equal(_readFile('/workspace/ok.js'), 'small');
            // It's reflected in the summary as a failure, with the size in the log.
            const failed = output.lines.filter(l => /Failed to download.*huge\.js.*exceeds.*sync limit/.test(l));
            assert.equal(failed.length, 1, `expected one failure log, got: ${JSON.stringify(output.lines)}`);
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert.match(summary, /1 downloaded, 1 failed/);
        });

        test('does not prompt when no local files would be overwritten', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/fresh.js']);
            rpc.queueResponse('getFile', 'content');
            await engine.downloadAll();
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 0, 'no warning expected when there are no conflicts');
            assert.equal(_readFile('/workspace/fresh.js'), 'content');
        });

        test('prompts before overwriting and, when declined, still downloads brand-new files but leaves conflicts alone', async () => {
            _writeFile('/workspace/a.js', 'local a');
            _writeFile('/workspace/lib/b.js', 'local b');
            _queueWarningResponse(undefined); // simulate user cancelling the modal
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js', '/lib/b.js', '/c.js']);
            // /c.js is new — it will still be pulled. The two conflicts must NOT be fetched.
            rpc.queueResponse('getFile', 'remote c');

            await engine.downloadAll();

            // Modal prompt was shown, listing only the conflicts (not /c.js)
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 1, 'expected exactly one warning prompt');
            const prompt = warnings[0];
            assert.equal(prompt.modal, true);
            assert.match(prompt.message, /Overwrite 2 local files\?/);
            assert.ok(prompt.detail && prompt.detail.includes('/a.js'), `detail missing /a.js: ${prompt.detail}`);
            assert.ok(prompt.detail && prompt.detail.includes('/lib/b.js'), `detail missing /lib/b.js: ${prompt.detail}`);
            assert.ok(prompt.detail && !prompt.detail.includes('/c.js'), `non-conflict /c.js should not appear in detail: ${prompt.detail}`);
            assert.deepEqual(prompt.items, ['Overwrite']);

            // Conflicts kept; the new file came down anyway; only one getFile RPC fired
            assert.equal(_readFile('/workspace/a.js'), 'local a');
            assert.equal(_readFile('/workspace/lib/b.js'), 'local b');
            assert.equal(_readFile('/workspace/c.js'), 'remote c');
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(fetched, ['/c.js']);
        });

        test('proceeds with the full download when the user confirms the overwrite, preserving server-listing order', async () => {
            _writeFile('/workspace/a.js', 'local a');
            _queueWarningResponse('Overwrite');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js', '/b.js']);
            rpc.queueResponse('getFile', 'remote a', 'remote b');

            await engine.downloadAll();

            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 1, 'expected exactly one warning prompt');
            assert.equal(_readFile('/workspace/a.js'), 'remote a');
            assert.equal(_readFile('/workspace/b.js'), 'remote b');
        });

        test('skips server-supplied filenames that would escape the destination directory', async () => {
            const { engine, rpc, output } = buildEngine();
            // Mix valid and several flavors of invalid filenames returned by the server.
            rpc.queueResponse('getFileNames', [
                '/good.js',
                '/../../etc/passwd',
                '..\\windows\\system.ini',
                'C:/Windows/system.ini',
                '/with*glob.js',
                '/double//slash.js',
                '',
                '/ok2.js',
            ]);
            // Only the two valid names should trigger a getFile call.
            rpc.queueResponse('getFile', 'g', 'o2');

            await engine.downloadAll();

            // Only the good files were fetched and written
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(fetched, ['/good.js', '/ok2.js']);
            assert.equal(_readFile('/workspace/good.js'), 'g');
            assert.equal(_readFile('/workspace/ok2.js'), 'o2');

            // Nothing got written outside the workspace
            assert.equal(_readFile('/etc/passwd'), undefined);
            assert.equal(_readFile('/workspace/etc/passwd'), undefined);

            // Each invalid name produced a per-file log entry
            const skippedLines = output.lines.filter(l => /Skipped \(invalid name from server\)/.test(l));
            assert.equal(skippedLines.length, 6, `expected 6 skip log lines, got: ${JSON.stringify(skippedLines)}`);

            // Summary line counts the skips
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert.match(summary, /2 downloaded, 0 failed, 6 skipped/);
        });

        test('does not prompt when conflicts only appear on invalid (skipped) names', async () => {
            // A pre-existing local file at a path that the server can't legally name —
            // the skip should happen before existence is checked, so no confirm modal.
            _writeFile('/workspace/clobber.js', 'local');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/../clobber.js']);
            await engine.downloadAll();
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 0, 'no prompt expected — the invalid name was skipped before existence check');
            assert.equal(_readFile('/workspace/clobber.js'), 'local');
        });

        test('skips server files whose extension is not in fileExtensions', async () => {
            // Defaults include .js / .txt but NOT .cct or .script
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/contract.cct', '/script-of-doom.script', '/readme.txt']);
            rpc.queueResponse('getFile', 'main', 'readme'); // only the two allowed files

            await engine.downloadAll();

            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(fetched, ['/main.js', '/readme.txt']);
            assert.equal(_readFile('/workspace/main.js'), 'main');
            assert.equal(_readFile('/workspace/readme.txt'), 'readme');
            assert.equal(_readFile('/workspace/contract.cct'), undefined);
            assert.equal(_readFile('/workspace/script-of-doom.script'), undefined);

            const extSkips = output.lines.filter(l => /Skipped \(extension not in bitburnerSync\.fileExtensions\)/.test(l));
            assert.equal(extSkips.length, 2, `expected two extension-skip log lines, got: ${JSON.stringify(extSkips)}`);
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert.match(summary, /2 downloaded, 0 failed, 2 skipped/);
        });

        test('user-configured fileExtensions narrows what gets downloaded', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['.ns']);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/script.ns', '/notes.txt']);
            rpc.queueResponse('getFile', 'ns-content');

            await engine.downloadAll();

            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(fetched, ['/script.ns']);
            assert.equal(_readFile('/workspace/script.ns'), 'ns-content');
        });

        test('extension match is case-insensitive (same as auto-sync filter)', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/Foo.JS']);
            rpc.queueResponse('getFile', 'js-content');
            await engine.downloadAll();
            assert.equal(_readFile('/workspace/Foo.JS'), 'js-content');
        });

        test('accepts dotless fileExtensions input (e.g. "js") via Configuration normalization', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['ns']);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/script.ns']);
            rpc.queueResponse('getFile', 'ns');
            await engine.downloadAll();
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(fetched, ['/script.ns']);
        });

        test('files with no extension at all are skipped', async () => {
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['/Makefile']);
            await engine.downloadAll();
            assert.equal(rpc.calls.filter(c => c.method === 'getFile').length, 0);
            assert.ok(output.lines.some(l => /Skipped \(extension not in bitburnerSync\.fileExtensions\)/.test(l)));
        });

        test('refuses to proceed when the server returns an unreasonable number of filenames', async () => {
            // 5001 is one over the documented MAX_DOWNLOAD_FILE_COUNT. A
            // buggy/hostile server returning a flood like this would
            // otherwise trigger one sequential getFile RPC per name.
            const { engine, rpc, output } = buildEngine();
            const flood = Array.from({ length: 5001 }, (_, i) => `/file${i}.js`);
            rpc.queueResponse('getFileNames', flood);
            await engine.downloadAll();
            // No getFile call was made — we bailed before the loop.
            assert.equal(rpc.calls.filter(c => c.method === 'getFile').length, 0);
            // No files were written.
            assert.equal(_readFile('/workspace/file0.js'), undefined);
            // User saw an error notification explaining the refusal.
            const errs = _state.notifications.filter(n => n.kind === 'error');
            assert.equal(errs.length, 1, `expected one error notification, got: ${JSON.stringify(_state.notifications)}`);
            assert.match(errs[0].message, /Refusing to download.*5001/);
            // Same line in the output channel for later diagnosis.
            assert.ok(output.lines.some(l => /Refusing to download.*5001/.test(l)));
        });

        test('accepts a listing exactly at the per-call cap', async () => {
            // The boundary: 5000 files is allowed, the loop runs normally.
            const { engine, rpc } = buildEngine();
            const atLimit = Array.from({ length: 5000 }, (_, i) => `/f${i}.js`);
            rpc.queueResponse('getFileNames', atLimit);
            for (let i = 0; i < 5000; i++) {
                rpc.queueResponse('getFile', `c${i}`);
            }
            await engine.downloadAll();
            const errs = _state.notifications.filter(n => n.kind === 'error');
            assert.equal(errs.length, 0, `expected no error at the limit boundary, got: ${JSON.stringify(errs)}`);
            assert.equal(rpc.calls.filter(c => c.method === 'getFile').length, 5000);
        });

        test('downloads new files even when there are no conflicts and never prompts', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/x.js', '/y.js']);
            rpc.queueResponse('getFile', 'X', 'Y');
            await engine.downloadAll();
            assert.equal(_readFile('/workspace/x.js'), 'X');
            assert.equal(_readFile('/workspace/y.js'), 'Y');
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 0, 'no prompt when there are no conflicts');
        });
    });

    suite('downloadSelectedFiles', () => {
        test('returns without listing the server when the user cancels the input box', async () => {
            _queueInputBoxResponse(undefined);
            const { engine, rpc } = buildEngine();
            await engine.downloadSelectedFiles();
            assert.equal(rpc.calls.length, 0, 'cancelled input must not trigger the listing RPC');
            assert.equal(_state.inputBoxCalls.length, 1);
        });

        test('downloads only files whose remote path matches the supplied glob', async () => {
            _queueInputBoxResponse('lib/**');
            const { engine, rpc } = buildEngine();
            // Server returns mixed paths; only the two under lib/ match.
            rpc.queueResponse('getFileNames', ['main.js', 'lib/util.js', 'lib/nested/deep.js', 'scripts/foo.js']);
            rpc.queueResponse('getFile', 'util', 'deep');

            await engine.downloadSelectedFiles();

            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(fetched, ['lib/util.js', 'lib/nested/deep.js']);
            assert.equal(_readFile('/workspace/lib/util.js'), 'util');
            assert.equal(_readFile('/workspace/lib/nested/deep.js'), 'deep');
            assert.equal(_readFile('/workspace/main.js'), undefined);
            assert.equal(_readFile('/workspace/scripts/foo.js'), undefined);
        });

        test('extension filter still applies — pattern matches do not override fileExtensions', async () => {
            _queueInputBoxResponse('**/*');
            const { engine, rpc } = buildEngine();
            // .cct is not in the default fileExtensions; the pattern matches but the extension does not.
            rpc.queueResponse('getFileNames', ['main.js', 'contract.cct']);
            rpc.queueResponse('getFile', 'main');

            await engine.downloadSelectedFiles();

            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => (c.params as { filename: string }).filename);
            assert.deepEqual(fetched, ['main.js']);
        });

        test('makes no getFile calls when the pattern matches nothing and reports skips in the summary', async () => {
            _queueInputBoxResponse('nonexistent/**');
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['main.js', 'lib/util.js']);

            await engine.downloadSelectedFiles();

            assert.equal(rpc.calls.filter(c => c.method === 'getFile').length, 0);
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert.match(summary, /0 downloaded, 0 failed, 2 skipped/);
        });

        test('honors syncDirectory for the download destination', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            _queueInputBoxResponse('lib/**');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['lib/util.js']);
            rpc.queueResponse('getFile', 'util');

            await engine.downloadSelectedFiles();

            assert.equal(_readFile('/workspace/src/lib/util.js'), 'util');
        });

        test('warns and skips the listing RPC when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            _queueInputBoxResponse('**/*.js');
            const { engine, rpc } = buildEngine();

            await engine.downloadSelectedFiles();

            assert.equal(rpc.calls.length, 0);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 1);
            assert.match(warnings[0].message, /Nothing will be downloaded/);
        });

        suite('saved pattern (workspaceState)', () => {
            const KEY = 'bitburnerSync.downloadSelectedFilesSelection';

            test("pre-fills the input box with '**/*.js' when no pattern has been saved", async () => {
                _queueInputBoxResponse(undefined); // cancel
                const { engine } = buildEngine();

                await engine.downloadSelectedFiles();

                assert.equal(_state.inputBoxCalls.length, 1);
                const opts = _state.inputBoxCalls[0].options as { value?: string };
                assert.equal(opts.value, '**/*.js');
            });

            test('pre-fills the input box with the last-used pattern from workspaceState', async () => {
                const memento = _makeMemento({ [KEY]: 'scripts/**' });
                _queueInputBoxResponse(undefined); // cancel — we only care about the seeded value
                const { engine } = buildEngine({ memento });

                await engine.downloadSelectedFiles();

                const opts = _state.inputBoxCalls[0].options as { value?: string };
                assert.equal(opts.value, 'scripts/**');
            });

            test('persists the entered pattern to workspaceState after a successful run', async () => {
                _queueInputBoxResponse('lib/**');
                const { engine, rpc, memento } = buildEngine();
                rpc.queueResponse('getFileNames', ['lib/util.js']);
                rpc.queueResponse('getFile', 'util');

                await engine.downloadSelectedFiles();

                assert.equal(memento.get<string>(KEY), 'lib/**');
            });

            test('does not overwrite the saved pattern when the user cancels the input box', async () => {
                const memento = _makeMemento({ [KEY]: 'lib/**' });
                _queueInputBoxResponse(undefined); // user hits Escape
                const { engine } = buildEngine({ memento });

                await engine.downloadSelectedFiles();

                assert.equal(memento.get<string>(KEY), 'lib/**');
            });

            test('updates the saved pattern when the user enters a different one', async () => {
                const memento = _makeMemento({ [KEY]: 'lib/**' });
                _queueInputBoxResponse('scripts/**');
                const { engine, rpc } = buildEngine({ memento });
                rpc.queueResponse('getFileNames', ['scripts/foo.js']);
                rpc.queueResponse('getFile', 'foo');

                await engine.downloadSelectedFiles();

                assert.equal(memento.get<string>(KEY), 'scripts/**');
            });
        });
    });

    suite('countNewRemoteFiles', () => {
        test('counts only filenames that are not already present locally', async () => {
            _writeFile('/workspace/existing.js', 'local');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/existing.js', '/new1.js', '/new2.js']);
            const n = await engine.countNewRemoteFiles();
            assert.equal(n, 2);
        });

        test('returns 0 when every remote file already exists locally', async () => {
            _writeFile('/workspace/a.js', 'local');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js']);
            assert.equal(await engine.countNewRemoteFiles(), 0);
        });

        test('returns 0 when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine } = buildEngine();
            // No RPC needed: short-circuited before the listing call.
            assert.equal(await engine.countNewRemoteFiles(), 0);
        });

        test('returns 0 when no workspace folder is open (silent: does not throw)', async () => {
            _state.workspaceFolders = undefined;
            const { engine } = buildEngine();
            assert.equal(await engine.countNewRemoteFiles(), 0);
        });

        test('ignores skipped (invalid / wrong-extension) entries in the count', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/good.js', '/bad.cct', '/../escape.js']);
            assert.equal(await engine.countNewRemoteFiles(), 1);
        });
    });

    suite('countNewLocalFiles', () => {
        test('counts only local files whose remote-equivalent is not on the server', async () => {
            _writeFile('/workspace/shared.js', 'local');
            _writeFile('/workspace/new1.js', 'a');
            _writeFile('/workspace/new2.js', 'b');
            _state.findFilesQueue = [
                Uri.file('/workspace/shared.js'),
                Uri.file('/workspace/new1.js'),
                Uri.file('/workspace/new2.js'),
            ];
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/shared.js']);
            assert.equal(await engine.countNewLocalFiles(), 2);
        });

        test('returns 0 when every local file already exists remotely', async () => {
            _writeFile('/workspace/a.js', 'a');
            _state.findFilesQueue = [Uri.file('/workspace/a.js')];
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js']);
            assert.equal(await engine.countNewLocalFiles(), 0);
        });

        test('returns 0 when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine, rpc } = buildEngine();
            // No RPC needed: short-circuited before the listing call.
            assert.equal(await engine.countNewLocalFiles(), 0);
            assert.equal(rpc.calls.length, 0);
        });

        test('returns 0 when no workspace folder is open (silent: does not throw)', async () => {
            _state.workspaceFolders = undefined;
            const { engine } = buildEngine();
            assert.equal(await engine.countNewLocalFiles(), 0);
        });

        test('does not count files excluded by user-configured exclude patterns', async () => {
            _setConfig('bitburnerSync', 'exclude', ['**/*.test.js']);
            _writeFile('/workspace/main.js', 'm');
            _writeFile('/workspace/foo.test.js', 't');
            // findFiles itself would normally apply the same exclude glob;
            // queue both anyway to verify the in-engine isExcluded check
            // catches the test file as a backstop.
            _state.findFilesQueue = [
                Uri.file('/workspace/main.js'),
                Uri.file('/workspace/foo.test.js'),
            ];
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', []);
            assert.equal(await engine.countNewLocalFiles(), 1);
        });

        test('matches local-to-remote paths even when the server omits leading slashes', async () => {
            _writeFile('/workspace/a.js', 'a');
            _state.findFilesQueue = [Uri.file('/workspace/a.js')];
            const { engine, rpc } = buildEngine();
            // Server returns the name without the leading slash that
            // PathMapper produces; the canonicalizer should make them match.
            rpc.queueResponse('getFileNames', ['a.js']);
            assert.equal(await engine.countNewLocalFiles(), 0);
        });

        test('honors syncDirectory when comparing — strips it from the remote-equivalent path', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            _writeFile('/workspace/src/main.js', 'm');
            _state.findFilesQueue = [Uri.file('/workspace/src/main.js')];
            const { engine, rpc } = buildEngine();
            // With syncDirectory 'src', src/main.js maps to /main.js on the server.
            rpc.queueResponse('getFileNames', ['/main.js']);
            assert.equal(await engine.countNewLocalFiles(), 0);
        });

        test('returns 0 when the server returns an unreasonable number of filenames', async () => {
            _writeFile('/workspace/a.js', 'a');
            _state.findFilesQueue = [Uri.file('/workspace/a.js')];
            const { engine, rpc } = buildEngine();
            const flood = Array.from({ length: 5001 }, (_, i) => `/file${i}.js`);
            rpc.queueResponse('getFileNames', flood);
            // Don't trust the listing — refuse to compute a difference.
            assert.equal(await engine.countNewLocalFiles(), 0);
        });

        test('counts files in subdirectories using their full remote-equivalent paths', async () => {
            _writeFile('/workspace/lib/helper.js', 'h');
            _writeFile('/workspace/main.js', 'm');
            _state.findFilesQueue = [
                Uri.file('/workspace/lib/helper.js'),
                Uri.file('/workspace/main.js'),
            ];
            const { engine, rpc } = buildEngine();
            // Only main.js is on the server — lib/helper.js is new.
            rpc.queueResponse('getFileNames', ['/main.js']);
            assert.equal(await engine.countNewLocalFiles(), 1);
        });
    });

    suite('downloadDefinitions', () => {
        test('throws when no workspace folder is open', async () => {
            _state.workspaceFolders = undefined;
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'declare ...');
            await assert.rejects(engine.downloadDefinitions(), /No workspace folder open/);
        });

        // A minimal Netscript-shaped d.ts exercising the patcher: one already-
        // exported declaration (must be left alone) and two upstream-style
        // non-exported `@public` declarations (must be patched to `export`
        // and globalized). Mirrors the real bitburner d.ts where types like
        // `AutocompleteData` and `ReactNode` ship without `export`.
        const SAMPLE_DEFS = [
            'export interface NS {',
            '  hack(host: string): Promise<number>;',
            '}',
            'type ScriptArg = string | number | boolean;', // patched -> exported
            'interface AutocompleteData { servers: string[]; }', // patched -> exported
        ].join('\n');

        test('writes the patched NetscriptDefinitions.d.ts (top-level types exported) at the workspace root', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const onDisk = _readFile('/workspace/NetscriptDefinitions.d.ts');
            assert.ok(onDisk);
            // Already-exported declaration is untouched (not double-exported).
            assert.match(onDisk, /^export interface NS \{/m);
            assert.doesNotMatch(onDisk, /^export export /m);
            // Previously-unexported declarations now have `export` prepended.
            assert.match(onDisk, /^export type ScriptArg = /m);
            assert.match(onDisk, /^export interface AutocompleteData \{/m);
        });

        test('generates NetscriptGlobals.d.ts with every top-level type (including patched ones) aliased into the global scope', async () => {
            // Without a bundledTypesDir the shim falls back to typing React /
            // ReactDOM as `any` so editor errors don't block scripts without
            // a workspace-installed @types/react.
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const shim = _readFile('/workspace/NetscriptGlobals.d.ts');
            assert.ok(shim, 'expected NetscriptGlobals.d.ts to be written');
            // Pulls types from the sibling definitions file, not a bare module spec.
            assert.match(shim, /import type \* as _NS from "\.\/NetscriptDefinitions"/);
            // Each top-level name gets a `declare global` re-export — including
            // the ones that needed to be patched to export status.
            assert.match(shim, /declare global \{/);
            assert.match(shim, /type NS = _NS\.NS;/);
            assert.match(shim, /type ScriptArg = _NS\.ScriptArg;/);
            assert.match(shim, /type AutocompleteData = _NS\.AutocompleteData;/);
            // React and ReactDOM are also globally available because the
            // Bitburner runtime exposes them.
            assert.match(shim, /const React: any;/);
            assert.match(shim, /const ReactDOM: any;/);
            // Module-marker so the file is treated as a module (so `declare global` works).
            assert.match(shim, /export \{\};/);
        });

        test('with bundledTypesDir set, the shim types React/ReactDOM via the bundled @types', async () => {
            // Production path: the extension passes its own dist/types/
            // directory, which holds copies of @types/react@^17 and
            // @types/react-dom@^17. The shim then uses the real types.
            const { engine, rpc } = buildEngine({ bundledTypesDir: '/ext/dist/types' });
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const shim = _readFile('/workspace/NetscriptGlobals.d.ts');
            assert.ok(shim);
            assert.match(shim, /const React: typeof import\("react"\);/);
            assert.match(shim, /const ReactDOM: typeof import\("react-dom"\);/);
            assert.doesNotMatch(shim, /const React: any;/);
        });

        test('with bundledTypesDir set, tsconfig gets absolute react/react-dom path aliases', async () => {
            const { engine, rpc } = buildEngine({ bundledTypesDir: '/ext/dist/types' });
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.compilerOptions.paths['@ns'], ['NetscriptDefinitions.d.ts']);
            // Absolute paths into the extension dir.
            assert.deepEqual(parsed.compilerOptions.paths['react'], ['/ext/dist/types/react']);
            assert.deepEqual(parsed.compilerOptions.paths['react-dom'], ['/ext/dist/types/react-dom']);
        });

        test('with bundledTypesDir, stale react paths from a prior extension install get rewritten', async () => {
            // Simulates the upgrade case: an older extension install wrote
            // `react` pointing at /old/ext/.... The new install must
            // overwrite that to its own current location, not leave the
            // dangling pointer.
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: {
                    jsx: 'react',
                    paths: {
                        '@ns': ['NetscriptDefinitions.d.ts'],
                        'react': ['/old/ext/dist/types/react'],
                        'react-dom': ['/old/ext/dist/types/react-dom'],
                    },
                },
                files: ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts'],
            }));
            const { engine, rpc } = buildEngine({ bundledTypesDir: '/new/ext/dist/types' });
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.compilerOptions.paths['react'], ['/new/ext/dist/types/react']);
            assert.deepEqual(parsed.compilerOptions.paths['react-dom'], ['/new/ext/dist/types/react-dom']);
            // @ns is add-if-missing, so it's untouched.
            assert.deepEqual(parsed.compilerOptions.paths['@ns'], ['NetscriptDefinitions.d.ts']);
        });

        test('on Windows-style bundledTypesDir, paths are normalized to forward slashes', async () => {
            const { engine, rpc } = buildEngine({ bundledTypesDir: 'C:\\Users\\u\\.vscode\\extensions\\bitburner-sync\\dist\\types' });
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(
                parsed.compilerOptions.paths['react'],
                ['C:/Users/u/.vscode/extensions/bitburner-sync/dist/types/react']
            );
        });

        test('the d.ts patcher is idempotent across re-downloads', async () => {
            // Pre-patched content (already `export interface Foo`) should not
            // grow a second `export ` on re-download.
            const prePatched = 'export interface Foo { x: number; }\nexport type Bar = string;\n';
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', prePatched);
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/NetscriptDefinitions.d.ts'), prePatched);
        });

        test('skips generating NetscriptGlobals.d.ts when the d.ts has no top-level declarations to patch or export', async () => {
            const { engine, rpc, output } = buildEngine();
            // No interface/type/enum/class declarations at all — the patcher
            // produces an empty (no-export) file, so the extractor finds
            // nothing and we skip writing the shim.
            rpc.queueResponse('getDefinitionFile', '// just a comment\n');
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/NetscriptGlobals.d.ts'), undefined);
            assert.ok(
                output.lines.some(l => /Skipped NetscriptGlobals\.d\.ts/.test(l)),
                `expected an output channel log about skipping, got: ${JSON.stringify(output.lines)}`
            );
        });

        test('creates a tsconfig.json with both files, the @ns path alias, and jsx config if none exists', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const raw = _readFile('/workspace/tsconfig.json');
            assert.ok(raw, 'expected tsconfig.json to be written');
            const parsed = JSON.parse(raw);
            assert.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert.equal(parsed.compilerOptions.target, 'ES2022');
            assert.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            // baseUrl defaults to the workspace root when no syncDirectory is set.
            assert.equal(parsed.compilerOptions.baseUrl, '.');
            // Matches Bitburner's runtime (classic React.createElement factory).
            assert.equal(parsed.compilerOptions.jsx, 'react');
        });

        test('appends to an existing tsconfig.json files array and adds the @ns path alias and jsx mode', async () => {
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { target: 'ES2020' },
                files: ['existing.d.ts'],
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.files, ['existing.d.ts', 'NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            assert.equal(parsed.compilerOptions.jsx, 'react');
            // Preserves untouched fields
            assert.equal(parsed.compilerOptions.target, 'ES2020');
        });

        test('preserves an existing user-set jsx mode (does not overwrite)', async () => {
            // A user already chose `react-jsx` (the automatic runtime). We
            // must not silently downgrade them to classic just because we'd
            // pick `react` for a fresh template.
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { jsx: 'react-jsx', paths: { '@ns': ['NetscriptDefinitions.d.ts'] } },
                files: ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts'],
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.equal(parsed.compilerOptions.jsx, 'react-jsx');
        });

        test('preserves existing user paths aliases when adding @ns', async () => {
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: {
                    target: 'ES2020',
                    baseUrl: '.',
                    jsx: 'react',
                    paths: { '~/*': ['src/*'] },
                },
                files: ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts'],
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.compilerOptions.paths, {
                '~/*': ['src/*'],
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            // User-set baseUrl is untouched.
            assert.equal(parsed.compilerOptions.baseUrl, '.');
        });

        test('leaves tsconfig.json alone if files, the @ns alias, and jsx are all already present', async () => {
            const original = JSON.stringify({
                compilerOptions: {
                    target: 'ES2020',
                    jsx: 'react',
                    paths: {
                        '@ns': ['NetscriptDefinitions.d.ts'],
                        '@/*': ['./*'],
                    },
                },
                files: ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts'],
            });
            _writeFile('/workspace/tsconfig.json', original);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), original);
        });

        test('migrates a pre-globals tsconfig by adding NetscriptGlobals.d.ts, the @ns alias, and jsx mode', async () => {
            // Simulates a workspace set up by an older version of the
            // extension: files[] has the definitions but no globals shim,
            // no paths alias, and no jsx config.
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { target: 'ES2020' },
                files: ['NetscriptDefinitions.d.ts'],
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            assert.equal(parsed.compilerOptions.jsx, 'react');
        });

        test('creates a files array if the existing tsconfig has none', async () => {
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { target: 'ES2020' },
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            assert.equal(parsed.compilerOptions.jsx, 'react');
        });

        test('leaves an unparseable tsconfig untouched and warns the user', async () => {
            const original = '{ this is not json';
            _writeFile('/workspace/tsconfig.json', original);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), original);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.ok(
                warnings.some(w => /could not be parsed/i.test(w.message)),
                `expected a warning about an unparseable tsconfig, got: ${JSON.stringify(warnings)}`
            );
        });

        test('leaves a JSONC tsconfig untouched and warns when entries are missing', async () => {
            const jsonc = [
                '{',
                '  // comment that strict JSON.parse rejects',
                '  "compilerOptions": { "target": "ES2020" },',
                '  "files": ["other.d.ts"],',  // trailing comma intentional
                '}',
            ].join('\n');
            _writeFile('/workspace/tsconfig.json', jsonc);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.ok(
                warnings.some(w => /JSONC|comments or trailing commas/i.test(w.message)),
                `expected a warning about JSONC, got: ${JSON.stringify(warnings)}`
            );
        });

        test('does nothing and does not warn when a JSONC tsconfig already has all wanted entries', async () => {
            const jsonc = [
                '{',
                '  // already wired up',
                '  "compilerOptions": {',
                '    "jsx": "react",',
                '    "paths": { "@ns": ["NetscriptDefinitions.d.ts"], "@/*": ["./*"] },',
                '  },',
                '  "files": ["NetscriptDefinitions.d.ts", "NetscriptGlobals.d.ts"],',
                '}',
            ].join('\n');
            _writeFile('/workspace/tsconfig.json', jsonc);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 0, `expected no warnings, got: ${JSON.stringify(warnings)}`);
        });

        test('warns on a JSONC tsconfig that has files but is missing the @ns path alias', async () => {
            // The pre-globals shape: files[] is right but paths is absent.
            // We can't rewrite a JSONC file safely, so the user needs a warning.
            const jsonc = [
                '{',
                '  // older config — no paths alias yet',
                '  "files": ["NetscriptDefinitions.d.ts", "NetscriptGlobals.d.ts"],',
                '}',
            ].join('\n');
            _writeFile('/workspace/tsconfig.json', jsonc);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.ok(
                warnings.some(w => /JSONC|comments or trailing commas/i.test(w.message)),
                `expected a warning, got: ${JSON.stringify(warnings)}`
            );
        });

        test('JSONC detection preserves string contents that look like trailing commas (string-aware scan)', async () => {
            // A previous regex-based trailing-comma sweep would have stripped
            // the `,` inside the "banner" string, corrupting the parse and
            // sending the user down the manual-fix path even though the entry
            // is already present. The scanner now ignores commas inside
            // strings, so this case parses cleanly and we recognize the
            // existing entry.
            const jsonc = [
                '{',
                '  // user comment forces the JSONC path',
                '  "banner": "{ foo ,} bar",',
                '  "compilerOptions": {',
                '    "jsx": "react",',
                '    "paths": { "@ns": ["NetscriptDefinitions.d.ts"], "@/*": ["./*"] },',
                '  },',
                '  "files": ["NetscriptDefinitions.d.ts", "NetscriptGlobals.d.ts"],',
                '}',
            ].join('\n');
            _writeFile('/workspace/tsconfig.json', jsonc);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 0, `expected no warnings, got: ${JSON.stringify(warnings)}`);
        });
    });

    suite('ensureTypeDefinitionsSetup', () => {
        const SAMPLE_DEFS = 'export interface NS { x: number; }\nexport type Y = string;\n';

        test('is a no-op when no NetscriptDefinitions.d.ts exists in the workspace', async () => {
            const { engine } = buildEngine();
            await engine.ensureTypeDefinitionsSetup();
            assert.equal(_readFile('/workspace/NetscriptGlobals.d.ts'), undefined);
            assert.equal(_readFile('/workspace/tsconfig.json'), undefined);
        });

        test('is a no-op when no workspace folder is open', async () => {
            _state.workspaceFolders = undefined;
            const { engine } = buildEngine();
            // Must not throw — activation must never be blocked by this.
            await engine.ensureTypeDefinitionsSetup();
        });

        test('generates NetscriptGlobals.d.ts and patches tsconfig from an existing d.ts (existing-user migration)', async () => {
            // Simulate an upgrade: an older version of the extension already
            // put NetscriptDefinitions.d.ts in the workspace and wrote a
            // pre-globals tsconfig. The user updates, reloads VS Code, and
            // we set up the globals shim + paths alias on activation.
            _writeFile('/workspace/NetscriptDefinitions.d.ts', SAMPLE_DEFS);
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { target: 'ES2020' },
                files: ['NetscriptDefinitions.d.ts'],
            }));
            const { engine, rpc } = buildEngine();
            await engine.ensureTypeDefinitionsSetup();
            // No server round-trip — migration reads the local d.ts.
            assert.equal(rpc.calls.length, 0);

            const shim = _readFile('/workspace/NetscriptGlobals.d.ts');
            assert.ok(shim, 'expected NetscriptGlobals.d.ts to be generated');
            assert.match(shim, /type NS = _NS\.NS;/);

            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
        });
    });
});
