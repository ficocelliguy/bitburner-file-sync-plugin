import { strict as assert } from 'assert';
import * as vscodeMock from './mocks/vscode';
import { Configuration } from '../../config/Configuration';
import { SyncEngine } from '../../sync/SyncEngine';
import { FakeRpcClient, waitMs } from './helpers';
import { BitburnerApi } from '../../api/BitburnerApi';

const {
    Uri,
    _reset,
    _setWorkspaceFolders,
    _setConfig,
    _writeFile,
    _readFile,
    _state,
    _queueWarningResponse,
} = vscodeMock;

function buildEngine(): {
    engine: SyncEngine;
    api: BitburnerApi;
    rpc: FakeRpcClient;
    output: vscodeMock.OutputChannel;
} {
    const rpc = new FakeRpcClient();
    const api = new BitburnerApi(rpc as unknown as import('../../server/JsonRpcClient').JsonRpcClient);
    const config = new Configuration();
    const output = vscodeMock.window.createOutputChannel('test');
    const engine = new SyncEngine(api, config, output);
    return { engine, api, rpc, output };
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

        test('downloadAll downloads nothing when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/foo.ts', '/notes.txt']);
            await engine.downloadAll();
            // No getFile RPCs — every server file got filtered by the empty extension list.
            assert.equal(rpc.calls.filter(c => c.method === 'getFile').length, 0);
            assert.equal(_readFile('/workspace/main.js'), undefined);
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

        test('prompts before overwriting, listing each conflicting file, and aborts when the user declines', async () => {
            _writeFile('/workspace/a.js', 'local a');
            _writeFile('/workspace/lib/b.js', 'local b');
            _queueWarningResponse(undefined); // simulate user cancelling the modal
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js', '/lib/b.js', '/c.js']);
            // queue getFile responses; if downloadAll honors the cancel they must NOT be consumed
            rpc.queueResponse('getFile', 'remote a', 'remote b', 'remote c');

            await engine.downloadAll();

            // Modal prompt was shown, with the two conflicts and the 'Overwrite' button
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 1, 'expected exactly one warning prompt');
            const prompt = warnings[0];
            assert.equal(prompt.modal, true);
            assert.match(prompt.message, /Overwrite 2 local files\?/);
            assert.ok(prompt.detail && prompt.detail.includes('/a.js'), `detail missing /a.js: ${prompt.detail}`);
            assert.ok(prompt.detail && prompt.detail.includes('/lib/b.js'), `detail missing /lib/b.js: ${prompt.detail}`);
            assert.ok(prompt.detail && !prompt.detail.includes('/c.js'), `non-conflict /c.js should not appear in detail: ${prompt.detail}`);
            assert.deepEqual(prompt.items, ['Overwrite']);

            // Local files unchanged, and no getFile RPCs were made
            assert.equal(_readFile('/workspace/a.js'), 'local a');
            assert.equal(_readFile('/workspace/lib/b.js'), 'local b');
            assert.equal(_readFile('/workspace/c.js'), undefined);
            assert.equal(rpc.calls.filter(c => c.method === 'getFile').length, 0);
        });

        test('proceeds with the full download when the user confirms the overwrite', async () => {
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
    });

    suite('downloadDefinitions', () => {
        test('throws when no workspace folder is open', async () => {
            _state.workspaceFolders = undefined;
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'declare ...');
            await assert.rejects(engine.downloadDefinitions(), /No workspace folder open/);
        });

        test('writes NetscriptDefinitions.d.ts at the workspace root', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'declare const ns: NS;');
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/NetscriptDefinitions.d.ts'), 'declare const ns: NS;');
        });

        test('creates a tsconfig.json with the definitions entry if none exists', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'x');
            await engine.downloadDefinitions();
            const raw = _readFile('/workspace/tsconfig.json');
            assert.ok(raw, 'expected tsconfig.json to be written');
            const parsed = JSON.parse(raw);
            assert.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts']);
            assert.equal(parsed.compilerOptions.target, 'ES2022');
        });

        test('appends to an existing tsconfig.json files array', async () => {
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { target: 'ES2020' },
                files: ['existing.d.ts'],
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'x');
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.files, ['existing.d.ts', 'NetscriptDefinitions.d.ts']);
            // Preserves untouched fields
            assert.equal(parsed.compilerOptions.target, 'ES2020');
        });

        test('leaves tsconfig.json alone if the entry is already present', async () => {
            const original = JSON.stringify({
                compilerOptions: { target: 'ES2020' },
                files: ['NetscriptDefinitions.d.ts'],
            });
            _writeFile('/workspace/tsconfig.json', original);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'x');
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), original);
        });

        test('creates a files array if the existing tsconfig has none', async () => {
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { target: 'ES2020' },
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'x');
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json')!);
            assert.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts']);
        });

        test('leaves an unparseable tsconfig untouched and warns the user', async () => {
            const original = '{ this is not json';
            _writeFile('/workspace/tsconfig.json', original);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'x');
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), original);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.ok(
                warnings.some(w => /could not be parsed/i.test(w.message)),
                `expected a warning about an unparseable tsconfig, got: ${JSON.stringify(warnings)}`
            );
        });

        test('leaves a JSONC tsconfig untouched and warns when the entry is missing', async () => {
            const jsonc = [
                '{',
                '  // comment that strict JSON.parse rejects',
                '  "compilerOptions": { "target": "ES2020" },',
                '  "files": ["other.d.ts"],',  // trailing comma intentional
                '}',
            ].join('\n');
            _writeFile('/workspace/tsconfig.json', jsonc);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'x');
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.ok(
                warnings.some(w => /JSONC|comments or trailing commas/i.test(w.message)),
                `expected a warning about JSONC, got: ${JSON.stringify(warnings)}`
            );
        });

        test('does nothing and does not warn when a JSONC tsconfig already has the entry', async () => {
            const jsonc = [
                '{',
                '  // already wired up',
                '  "files": ["NetscriptDefinitions.d.ts"],',
                '}',
            ].join('\n');
            _writeFile('/workspace/tsconfig.json', jsonc);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'x');
            await engine.downloadDefinitions();
            assert.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert.equal(warnings.length, 0, `expected no warnings, got: ${JSON.stringify(warnings)}`);
        });
    });
});
