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
const SyncEngine_1 = require("../../sync/SyncEngine");
const helpers_1 = require("./helpers");
const BitburnerApi_1 = require("../../api/BitburnerApi");
const { Uri, RelativePattern, _reset, _setWorkspaceFolders, _setConfig, _writeFile, _readFile, _state, _queueWarningResponse, _queueInputBoxResponse, _makeMemento, } = vscodeMock;
function buildEngine(opts = {}) {
    const rpc = new helpers_1.FakeRpcClient();
    const api = new BitburnerApi_1.BitburnerApi(rpc);
    const config = new Configuration_1.Configuration();
    const output = vscodeMock.window.createOutputChannel('test');
    const memento = opts.memento ?? _makeMemento();
    const engine = new SyncEngine_1.SyncEngine(api, config, output, memento);
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
            assert_1.strict.equal(rpc.calls.length, 1);
            assert_1.strict.deepEqual(rpc.calls[0], {
                method: 'pushFile',
                params: { filename: '/main.js', content: 'console.log("hi");', server: 'home' },
            });
        });
        test('uses the configured target server', async () => {
            _setConfig('bitburnerSync', 'targetServer', 'n00dles');
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            await engine.pushFile(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(rpc.calls[0].params.server, 'n00dles');
        });
        test('strips the configured syncDirectory from the remote path', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/src/main.js', 'console.log("hi");');
            await engine.pushFile(Uri.file('/workspace/src/main.js'));
            assert_1.strict.equal(rpc.calls.length, 1);
            assert_1.strict.equal(rpc.calls[0].params.filename, '/main.js');
        });
        test('rejects files outside the configured syncDirectory', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine } = buildEngine();
            _writeFile('/workspace/outside.js', 'x');
            await assert_1.strict.rejects(engine.pushFile(Uri.file('/workspace/outside.js')), /outside the sync directory/);
        });
        test('shows an info notification when showNotifications is true', async () => {
            const { engine } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            await engine.pushFile(Uri.file('/workspace/a.js'));
            const info = _state.notifications.filter(n => n.kind === 'info');
            assert_1.strict.equal(info.length, 1);
            assert_1.strict.match(info[0].message, /Synced: \/a\.js/);
        });
        test('does not show a notification when showNotifications is false', async () => {
            _setConfig('bitburnerSync', 'showNotifications', false);
            const { engine } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            await engine.pushFile(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(_state.notifications.length, 0);
        });
        test('writes an entry to the output channel', async () => {
            const { engine, output } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            await engine.pushFile(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(output.lines.length, 1);
            assert_1.strict.match(output.lines[0], /Pushed: \/a\.js/);
        });
        test('notifies onDidPush listeners with the remote path after success', async () => {
            const { engine } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            const seen = [];
            const sub = engine.onDidPush((remote) => { seen.push(remote); });
            await engine.pushFile(Uri.file('/workspace/a.js'));
            assert_1.strict.deepEqual(seen, ['/a.js']);
            sub.dispose();
            // After dispose, further pushes should not fire the listener.
            _writeFile('/workspace/b.js', 'y');
            await engine.pushFile(Uri.file('/workspace/b.js'));
            assert_1.strict.deepEqual(seen, ['/a.js']);
        });
        test('does not fire onDidPush when the push itself fails', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueError('pushFile', new Error('boom'));
            _writeFile('/workspace/a.js', 'x');
            const seen = [];
            engine.onDidPush((remote) => { seen.push(remote); });
            await assert_1.strict.rejects(engine.pushFile(Uri.file('/workspace/a.js')), /boom/);
            assert_1.strict.deepEqual(seen, []);
        });
    });
    suite('syncAll', () => {
        test('warns and bails out when no files match', async () => {
            const { engine, rpc } = buildEngine();
            await engine.syncAll();
            assert_1.strict.equal(rpc.calls.length, 0);
            assert_1.strict.equal(_state.notifications.filter(n => n.kind === 'warning').length, 1);
        });
        test('passes a RelativePattern scoped to the primary workspace folder', async () => {
            const { engine } = buildEngine();
            await engine.syncAll();
            assert_1.strict.equal(_state.findFilesCalls.length, 1, 'expected exactly one findFiles call');
            const include = _state.findFilesCalls[0].include;
            assert_1.strict.ok(include instanceof RelativePattern, 'include must be a RelativePattern, not a bare string');
            assert_1.strict.equal(include.baseUri.fsPath, '/workspace');
            assert_1.strict.equal(include.pattern, '**/*.{js,ts,jsx,tsx,txt,json,css,py}');
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
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /0 pushed, 1 failed/);
            const failedLog = output.lines.find(l => /Failed to push .*secondary\/a\.js/.test(l)) ?? '';
            assert_1.strict.match(failedLog, /not in the primary workspace folder/);
        });
        test('pushes every file found and reports the count', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/a.js', 'a');
            _writeFile('/workspace/b.js', 'b');
            _state.findFilesQueue = [Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js')];
            await engine.syncAll();
            assert_1.strict.equal(rpc.calls.length, 2);
            const lastLine = output.lines[output.lines.length - 1];
            assert_1.strict.match(lastLine, /Sync complete: 2 pushed, 0 failed/);
        });
        test('counts failures and continues on errors', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/a.js', 'a');
            _writeFile('/workspace/b.js', 'b');
            _state.findFilesQueue = [Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js')];
            rpc.queueError('pushFile', new Error('first call failed'));
            // second call has no error queued — succeeds
            await engine.syncAll();
            assert_1.strict.equal(rpc.calls.length, 2);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /1 pushed, 1 failed/);
        });
    });
    suite('handleFileChange (debounced auto-sync)', () => {
        test('does nothing when autoSync is disabled', async () => {
            _setConfig('bitburnerSync', 'autoSync', false);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(400);
            assert_1.strict.equal(rpc.calls.length, 0);
        });
        test('pushes the file after the 300ms debounce window elapses', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(350);
            assert_1.strict.equal(rpc.calls.length, 1);
        });
        test('coalesces rapid changes to the same file into a single push', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(100);
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(100);
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(rpc.calls.length, 0);
            await (0, helpers_1.waitMs)(350);
            assert_1.strict.equal(rpc.calls.length, 1);
        });
        test('debounces independently per file', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'a');
            _writeFile('/workspace/b.js', 'b');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            engine.handleFileChange(Uri.file('/workspace/b.js'));
            await (0, helpers_1.waitMs)(350);
            assert_1.strict.equal(rpc.calls.length, 2);
        });
        test('logs auto-sync failures without throwing', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            rpc.queueError('pushFile', new Error('boom'));
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(350);
            const matches = output.lines.filter(l => /Auto-sync failed/.test(l));
            assert_1.strict.equal(matches.length, 1);
        });
        test('logs a skip (not a failure) when the file disappears during the debounce window', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            // Simulate an external delete (terminal / another editor) before the timer fires.
            _state.files.delete('/workspace/a.js');
            await (0, helpers_1.waitMs)(350);
            assert_1.strict.equal(rpc.calls.length, 0, 'should not push a deleted file');
            const failed = output.lines.filter(l => /Auto-sync failed/.test(l));
            const skipped = output.lines.filter(l => /Auto-sync skipped \(file no longer exists\)/.test(l));
            assert_1.strict.equal(failed.length, 0, `expected no failure log, got: ${JSON.stringify(failed)}`);
            assert_1.strict.equal(skipped.length, 1, `expected one skip log, got: ${JSON.stringify(output.lines)}`);
        });
    });
    suite('file size limit (1 MB)', () => {
        const ONE_MB = 1024 * 1024;
        test('rejects an explicit push of a file over 1 MB with a clear error', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/big.js', 'x'.repeat(ONE_MB + 1));
            await assert_1.strict.rejects(engine.pushFile(Uri.file('/workspace/big.js')), /exceeds the 1\.0 MB sync limit/);
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
        });
        test('accepts a file exactly at the 1 MB boundary', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/atlimit.js', 'x'.repeat(ONE_MB));
            await engine.pushFile(Uri.file('/workspace/atlimit.js'));
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 1);
        });
        test('auto-sync logs (does not throw or notify) when a file exceeds the limit', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/big.js', 'x'.repeat(ONE_MB + 1));
            engine.handleFileChange(Uri.file('/workspace/big.js'));
            await (0, helpers_1.waitMs)(350);
            assert_1.strict.equal(rpc.calls.length, 0, 'no RPC for an oversize file');
            const matches = output.lines.filter(l => /Auto-sync failed.*exceeds.*sync limit/.test(l));
            assert_1.strict.equal(matches.length, 1, `expected one log entry, got: ${JSON.stringify(output.lines)}`);
            // And critically — no user-facing notification spam on save.
            const errorNotifications = _state.notifications.filter(n => n.kind === 'error');
            assert_1.strict.equal(errorNotifications.length, 0);
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/main.js']);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /1 pushed, 1 failed/);
        });
        test('error message includes the actual file size, not just the limit', async () => {
            const { engine } = buildEngine();
            const size = ONE_MB + 512 * 1024; // 1.5 MB
            _writeFile('/workspace/big.js', 'x'.repeat(size));
            await assert_1.strict.rejects(engine.pushFile(Uri.file('/workspace/big.js')), /1\.5 MB/);
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
            await assert_1.strict.rejects(engine.pushFile(Uri.file(path)), /exceeds the 1\.0 MB sync limit/);
            assert_1.strict.equal(rpc.calls.length, 0, 'must not push an oversized buffer even when stat said it was small');
        });
    });
    suite('fileExtensions = []', () => {
        test('syncAll warns and does nothing when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            _state.findFilesQueue = [Uri.file('/workspace/main.js')]; // would be returned if findFiles were called
            const { engine, rpc } = buildEngine();
            await engine.syncAll();
            assert_1.strict.equal(rpc.calls.length, 0, 'no RPC calls expected with empty extensions');
            const warning = _state.notifications.find(n => n.kind === 'warning' && /fileExtensions is set to \[\]/.test(n.message));
            assert_1.strict.ok(warning, `expected a "set to []" warning, got: ${JSON.stringify(_state.notifications)}`);
        });
        test('downloadAll warns and skips even the listing RPC when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine, rpc } = buildEngine();
            // Queue a getFileNames response that would be consumed if we got
            // there — the early-bail must prevent the RPC entirely.
            rpc.queueResponse('getFileNames', ['/main.js', '/foo.ts', '/notes.txt']);
            await engine.downloadAll();
            assert_1.strict.equal(rpc.calls.length, 0, 'no RPCs expected — should bail before getFileNames');
            assert_1.strict.equal(_readFile('/workspace/main.js'), undefined);
            const warning = _state.notifications.find(n => n.kind === 'warning' && /fileExtensions is set to \[\]/.test(n.message));
            assert_1.strict.ok(warning, `expected a "set to []" warning, got: ${JSON.stringify(_state.notifications)}`);
            assert_1.strict.match(warning.message, /Nothing will be downloaded/);
        });
        test('pushFile (explicit syncFile command) honors the [] opt-out', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            _writeFile('/workspace/main.js', 'x');
            const { engine, rpc } = buildEngine();
            await engine.pushFile(Uri.file('/workspace/main.js'));
            assert_1.strict.equal(rpc.calls.length, 0, 'no push expected — the user opted out');
            const warning = _state.notifications.find(n => n.kind === 'warning' && /fileExtensions is set to \[\]/.test(n.message));
            assert_1.strict.ok(warning, `expected a "set to []" warning, got: ${JSON.stringify(_state.notifications)}`);
        });
    });
    suite('exclude patterns', () => {
        test('NetscriptDefinitions.d.ts is always excluded from explicit pushFile', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/NetscriptDefinitions.d.ts', 'declare const ns: NS;');
            await engine.pushFile(Uri.file('/workspace/NetscriptDefinitions.d.ts'));
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
            assert_1.strict.ok(output.lines.some(l => /Excluded from sync.*NetscriptDefinitions/.test(l)));
        });
        test('NetscriptDefinitions.d.ts is silently excluded from auto-sync', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/NetscriptDefinitions.d.ts', 'declare const ns: NS;');
            engine.handleFileChange(Uri.file('/workspace/NetscriptDefinitions.d.ts'));
            await (0, helpers_1.waitMs)(350);
            assert_1.strict.equal(rpc.calls.length, 0);
            // Silent — no log line because handleFileChange short-circuits before scheduling
            assert_1.strict.ok(!output.lines.some(l => /Excluded from sync/.test(l)));
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/main.js']);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /1 pushed, 0 failed, 1 excluded/);
        });
        test('NetscriptGlobals.d.ts is always excluded from explicit pushFile', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/NetscriptGlobals.d.ts', 'declare global { type NS = never; }');
            await engine.pushFile(Uri.file('/workspace/NetscriptGlobals.d.ts'));
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
            assert_1.strict.ok(output.lines.some(l => /Excluded from sync.*NetscriptGlobals/.test(l)));
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/main.js']);
            const summary = output.lines.find(l => /Sync complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /1 pushed, 0 failed, 1 excluded/);
        });
        test('user-configured exclude pattern blocks an explicit pushFile', async () => {
            _setConfig('bitburnerSync', 'exclude', ['**/*.test.js']);
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/foo.test.js', 'x');
            await engine.pushFile(Uri.file('/workspace/foo.test.js'));
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
            assert_1.strict.ok(output.lines.some(l => /Excluded from sync/.test(l)));
        });
        test('user-configured exclude pattern blocks auto-sync', async () => {
            _setConfig('bitburnerSync', 'exclude', ['secrets/**']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/secrets/api-key.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/secrets/api-key.js'));
            await (0, helpers_1.waitMs)(350);
            assert_1.strict.equal(rpc.calls.length, 0);
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/main.js']);
        });
        test('non-matching exclude patterns do not block sync', async () => {
            _setConfig('bitburnerSync', 'exclude', ['**/*.test.ts']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/main.js', 'x');
            await engine.pushFile(Uri.file('/workspace/main.js'));
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 1);
        });
        test('**/foo glob matches at the root as well as nested', async () => {
            _setConfig('bitburnerSync', 'exclude', ['**/secret.js']);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/secret.js', 'a');
            _writeFile('/workspace/lib/secret.js', 'b');
            await engine.pushFile(Uri.file('/workspace/secret.js'));
            await engine.pushFile(Uri.file('/workspace/lib/secret.js'));
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'pushFile').length, 0);
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/main.js']);
            const excludeLogs = output.lines.filter(l => /Excluded from sync/.test(l));
            assert_1.strict.equal(excludeLogs.length, 4, `expected 4 excludes, got: ${JSON.stringify(excludeLogs)}`);
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/main.js']);
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/lib/bar.js']);
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/main.js']);
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/main.js']);
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
            const pushed = rpc.calls.filter(c => c.method === 'pushFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(pushed, ['/file9.js']);
        });
    });
    suite('dispose', () => {
        test('clears any pending debounce timers', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            engine.dispose();
            await (0, helpers_1.waitMs)(350);
            assert_1.strict.equal(rpc.calls.length, 0);
        });
    });
    suite('deleteRemoteFile', () => {
        test('maps the path and calls api.deleteFile', async () => {
            const { engine, rpc } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/main.js'));
            assert_1.strict.equal(rpc.calls.length, 1);
            assert_1.strict.deepEqual(rpc.calls[0], {
                method: 'deleteFile',
                params: { filename: '/main.js', server: 'home' },
            });
        });
        test('uses the configured target server', async () => {
            _setConfig('bitburnerSync', 'targetServer', 'n00dles');
            const { engine, rpc } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(rpc.calls[0].params.server, 'n00dles');
        });
        test('strips the configured syncDirectory from the remote path', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine, rpc } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/src/main.js'));
            assert_1.strict.equal(rpc.calls[0].params.filename, '/main.js');
        });
        test('shows an info notification when showNotifications is true', async () => {
            const { engine } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/a.js'));
            const info = _state.notifications.filter(n => n.kind === 'info');
            assert_1.strict.equal(info.length, 1);
            assert_1.strict.match(info[0].message, /Deleted: \/a\.js/);
        });
        test('does not show a notification when showNotifications is false', async () => {
            _setConfig('bitburnerSync', 'showNotifications', false);
            const { engine } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(_state.notifications.length, 0);
        });
        test('writes an entry to the output channel', async () => {
            const { engine, output } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/a.js'));
            assert_1.strict.match(output.lines[output.lines.length - 1], /Deleted: \/a\.js/);
        });
        test('does nothing (no RPC) when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine, rpc } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(rpc.calls.length, 0);
        });
        test('skips files in the always-excluded baseline (no remote delete)', async () => {
            const { engine, rpc, output } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/NetscriptDefinitions.d.ts'));
            assert_1.strict.equal(rpc.calls.length, 0);
            assert_1.strict.ok(output.lines.some(l => /Excluded from delete-sync/.test(l)));
        });
        test('skips files whose extension is not configured', async () => {
            const { engine, rpc } = buildEngine();
            await engine.deleteRemoteFile(Uri.file('/workspace/notes.md'));
            assert_1.strict.equal(rpc.calls.length, 0);
        });
        test('rejects (throws) when the file is outside the configured syncDirectory', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine } = buildEngine();
            await assert_1.strict.rejects(engine.deleteRemoteFile(Uri.file('/workspace/outside.js')), /outside the sync directory/);
        });
    });
    suite('moveToTrashbin', () => {
        test('reads remote content, pushes to /trashbin/<path>, then deletes original', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFile', 'original contents');
            await engine.moveToTrashbin(Uri.file('/workspace/main.js'));
            assert_1.strict.equal(rpc.calls.length, 3);
            assert_1.strict.deepEqual(rpc.calls[0], {
                method: 'getFile',
                params: { filename: '/main.js', server: 'home' },
            });
            assert_1.strict.deepEqual(rpc.calls[1], {
                method: 'pushFile',
                params: { filename: '/trashbin/main.js', content: 'original contents', server: 'home' },
            });
            assert_1.strict.deepEqual(rpc.calls[2], {
                method: 'deleteFile',
                params: { filename: '/main.js', server: 'home' },
            });
        });
        test('preserves nested original path under the trashbin prefix', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFile', 'x');
            await engine.moveToTrashbin(Uri.file('/workspace/scripts/lib/foo.js'));
            assert_1.strict.equal(rpc.calls[1].params.filename, '/trashbin/scripts/lib/foo.js');
        });
        test('honors the configured targetServer for all three RPCs', async () => {
            _setConfig('bitburnerSync', 'targetServer', 'n00dles');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFile', 'x');
            await engine.moveToTrashbin(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(rpc.calls.length, 3);
            for (const call of rpc.calls) {
                assert_1.strict.equal(call.params.server, 'n00dles');
            }
        });
        test('strips the configured syncDirectory before deciding the trashbin target', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFile', 'x');
            await engine.moveToTrashbin(Uri.file('/workspace/src/main.js'));
            assert_1.strict.equal(rpc.calls[0].params.filename, '/main.js');
            assert_1.strict.equal(rpc.calls[1].params.filename, '/trashbin/main.js');
            assert_1.strict.equal(rpc.calls[2].params.filename, '/main.js');
        });
        test('hard-deletes a file already inside /trashbin/ instead of nesting deeper', async () => {
            const { engine, rpc } = buildEngine();
            await engine.moveToTrashbin(Uri.file('/workspace/trashbin/main.js'));
            assert_1.strict.equal(rpc.calls.length, 1, 'should be a single deleteFile, not getFile/pushFile/deleteFile');
            assert_1.strict.deepEqual(rpc.calls[0], {
                method: 'deleteFile',
                params: { filename: '/trashbin/main.js', server: 'home' },
            });
        });
        test('skips silently when the remote file does not exist (getFile fails)', async () => {
            const { engine, rpc, output } = buildEngine();
            rpc.queueError('getFile', new Error('file not found'));
            await engine.moveToTrashbin(Uri.file('/workspace/main.js'));
            // getFile fired, but no pushFile / deleteFile — nothing to move.
            assert_1.strict.equal(rpc.calls.length, 1);
            assert_1.strict.equal(rpc.calls[0].method, 'getFile');
            assert_1.strict.ok(output.lines.some(l => /Trashbin move skipped:.*not found/.test(l)));
            // And no user-facing notification spam.
            assert_1.strict.equal(_state.notifications.filter(n => n.kind === 'error').length, 0);
        });
        test('does NOT delete the original when the trashbin push fails', async () => {
            // Safety property: if we can't park a copy in the trashbin, we
            // must not destroy the only remaining copy.
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFile', 'x');
            rpc.queueError('pushFile', new Error('disk full'));
            await assert_1.strict.rejects(engine.moveToTrashbin(Uri.file('/workspace/main.js')), /disk full/);
            const deleteCalls = rpc.calls.filter(c => c.method === 'deleteFile');
            assert_1.strict.equal(deleteCalls.length, 0, 'no deleteFile should run when pushFile failed');
        });
        test('writes an info notification when showNotifications is true', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFile', 'x');
            await engine.moveToTrashbin(Uri.file('/workspace/a.js'));
            const info = _state.notifications.filter(n => n.kind === 'info');
            assert_1.strict.equal(info.length, 1);
            assert_1.strict.match(info[0].message, /Moved to trashbin: \/a\.js/);
        });
        test('does not show a notification when showNotifications is false', async () => {
            _setConfig('bitburnerSync', 'showNotifications', false);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFile', 'x');
            await engine.moveToTrashbin(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(_state.notifications.length, 0);
        });
        test('logs the move to the output channel', async () => {
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFile', 'x');
            await engine.moveToTrashbin(Uri.file('/workspace/a.js'));
            assert_1.strict.ok(output.lines.some(l => /Moved to trashbin: \/a\.js -> \/trashbin\/a\.js/.test(l)));
        });
        test('does nothing (no RPCs) when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine, rpc } = buildEngine();
            await engine.moveToTrashbin(Uri.file('/workspace/a.js'));
            assert_1.strict.equal(rpc.calls.length, 0);
        });
        test('skips files in the always-excluded baseline', async () => {
            const { engine, rpc, output } = buildEngine();
            await engine.moveToTrashbin(Uri.file('/workspace/NetscriptDefinitions.d.ts'));
            assert_1.strict.equal(rpc.calls.length, 0);
            assert_1.strict.ok(output.lines.some(l => /Excluded from trashbin-move/.test(l)));
        });
        test('skips files whose extension is not configured', async () => {
            const { engine, rpc } = buildEngine();
            await engine.moveToTrashbin(Uri.file('/workspace/notes.md'));
            assert_1.strict.equal(rpc.calls.length, 0);
        });
        test('rejects (throws) when the file is outside the configured syncDirectory', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine } = buildEngine();
            await assert_1.strict.rejects(engine.moveToTrashbin(Uri.file('/workspace/outside.js')), /outside the sync directory/);
        });
    });
    suite('handleFileDelete', () => {
        test('does nothing when autoSync is disabled', async () => {
            _setConfig('bitburnerSync', 'autoSync', false);
            const { engine, rpc } = buildEngine();
            engine.handleFileDelete(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(10);
            assert_1.strict.equal(rpc.calls.length, 0);
        });
        test('moves the file to /trashbin/<path> instead of deleting outright', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFile', 'old content');
            engine.handleFileDelete(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(20);
            const methods = rpc.calls.map(c => c.method);
            assert_1.strict.deepEqual(methods, ['getFile', 'pushFile', 'deleteFile']);
            assert_1.strict.equal(rpc.calls[1].params.filename, '/trashbin/a.js');
            assert_1.strict.equal(rpc.calls[1].params.content, 'old content');
            // Final delete clears the original location, not the trashbin one.
            assert_1.strict.equal(rpc.calls[2].params.filename, '/a.js');
        });
        test('hard-deletes (no nested trashbin) when the deleted file already lives in /trashbin/', async () => {
            const { engine, rpc } = buildEngine();
            engine.handleFileDelete(Uri.file('/workspace/trashbin/a.js'));
            await (0, helpers_1.waitMs)(20);
            assert_1.strict.deepEqual(rpc.calls.map(c => c.method), ['deleteFile']);
            assert_1.strict.equal(rpc.calls[0].params.filename, '/trashbin/a.js');
        });
        test('logs (does not throw or notify) when an RPC in the move chain fails', async () => {
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFile', 'x');
            rpc.queueError('pushFile', new Error('boom'));
            engine.handleFileDelete(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(20);
            const matches = output.lines.filter(l => /Auto-trashbin failed/.test(l));
            assert_1.strict.equal(matches.length, 1);
            const errors = _state.notifications.filter(n => n.kind === 'error');
            assert_1.strict.equal(errors.length, 0);
            // And the original was NOT deleted — the safety property still holds
            // when triggered from the auto path.
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'deleteFile').length, 0);
        });
        test('cancels a pending debounced push for the same file', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'x');
            rpc.queueResponse('getFile', 'x');
            // Queue a save…
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            // …then delete before the 300 ms debounce window elapses.
            engine.handleFileDelete(Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(400);
            // No pushFile to /a.js — only the trashbin pushFile to /trashbin/a.js.
            const pushedTargets = rpc.calls
                .filter(c => c.method === 'pushFile')
                .map(c => c.params.filename);
            assert_1.strict.deepEqual(pushedTargets, ['/trashbin/a.js'], 'pending save-push must be cancelled');
        });
    });
    suite('handleFileRename', () => {
        test('does nothing when autoSync is disabled', async () => {
            _setConfig('bitburnerSync', 'autoSync', false);
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/b.js', 'new');
            engine.handleFileRename(Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js'));
            await (0, helpers_1.waitMs)(10);
            assert_1.strict.equal(rpc.calls.length, 0);
        });
        test('deletes the old remote path and pushes the new file', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/b.js', 'renamed content');
            engine.handleFileRename(Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js'));
            await (0, helpers_1.waitMs)(20);
            const methods = rpc.calls.map(c => c.method);
            assert_1.strict.deepEqual(methods, ['deleteFile', 'pushFile']);
            assert_1.strict.deepEqual(rpc.calls[0].params, { filename: '/a.js', server: 'home' });
            assert_1.strict.equal(rpc.calls[1].params.filename, '/b.js');
            assert_1.strict.equal(rpc.calls[1].params.content, 'renamed content');
        });
        test('delete runs even when the push side has a disallowed extension', async () => {
            // Rename a.js -> notes.md. The new path falls out of the syncable
            // set, so the push side should no-op — but the delete must still
            // fire so the in-game copy of a.js disappears.
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/notes.md', 'x');
            engine.handleFileRename(Uri.file('/workspace/a.js'), Uri.file('/workspace/notes.md'));
            await (0, helpers_1.waitMs)(20);
            assert_1.strict.deepEqual(rpc.calls.map(c => c.method), ['deleteFile']);
        });
        test('push runs even when the old path was outside the synced set', async () => {
            // Rename notes.md -> a.js. The old path is not syncable (no remote
            // file exists to delete) — the delete side becomes a no-op — but
            // the push must still happen so the new a.js lands in-game.
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'fresh');
            engine.handleFileRename(Uri.file('/workspace/notes.md'), Uri.file('/workspace/a.js'));
            await (0, helpers_1.waitMs)(20);
            assert_1.strict.deepEqual(rpc.calls.map(c => c.method), ['pushFile']);
            assert_1.strict.equal(rpc.calls[0].params.filename, '/a.js');
        });
        test('skips the push when the new file no longer exists', async () => {
            // External race: the file moves *out* of disk between the rename
            // event and the push attempt. The push should silently skip
            // rather than logging a generic auto-sync failure.
            const { engine, rpc, output } = buildEngine();
            // Don't _writeFile the new path — fileExists returns false.
            engine.handleFileRename(Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js'));
            await (0, helpers_1.waitMs)(20);
            const methods = rpc.calls.map(c => c.method);
            assert_1.strict.deepEqual(methods, ['deleteFile']);
            const failed = output.lines.filter(l => /Auto-sync \(rename\) failed/.test(l));
            assert_1.strict.equal(failed.length, 0);
        });
        test('logs both halves independently on RPC failure', async () => {
            const { engine, rpc, output } = buildEngine();
            _writeFile('/workspace/b.js', 'x');
            rpc.queueError('deleteFile', new Error('delete-fail'));
            rpc.queueError('pushFile', new Error('push-fail'));
            engine.handleFileRename(Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js'));
            await (0, helpers_1.waitMs)(20);
            assert_1.strict.equal(output.lines.filter(l => /Auto-delete \(rename\) failed/.test(l)).length, 1);
            assert_1.strict.equal(output.lines.filter(l => /Auto-sync \(rename\) failed/.test(l)).length, 1);
        });
        test('cancels a pending debounced push for the old path', async () => {
            const { engine, rpc } = buildEngine();
            _writeFile('/workspace/a.js', 'old');
            _writeFile('/workspace/b.js', 'new');
            // Queue a save on a.js…
            engine.handleFileChange(Uri.file('/workspace/a.js'));
            // …then rename it before the debounce window fires.
            engine.handleFileRename(Uri.file('/workspace/a.js'), Uri.file('/workspace/b.js'));
            await (0, helpers_1.waitMs)(400);
            // We expect exactly: deleteFile(/a.js), pushFile(/b.js) — and
            // *not* the cancelled pushFile(/a.js).
            assert_1.strict.equal(rpc.calls.length, 2);
            assert_1.strict.equal(rpc.calls[0].method, 'deleteFile');
            assert_1.strict.equal(rpc.calls[1].method, 'pushFile');
            assert_1.strict.equal(rpc.calls[1].params.filename, '/b.js');
        });
    });
    suite('downloadAll', () => {
        test('throws when no workspace folder is open', async () => {
            _state.workspaceFolders = undefined;
            const { engine } = buildEngine();
            await assert_1.strict.rejects(engine.downloadAll(), /No workspace folder open/);
        });
        test('warns when the remote has no files', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', []);
            await engine.downloadAll();
            assert_1.strict.equal(_state.notifications.filter(n => n.kind === 'warning').length, 1);
        });
        test('writes each remote file at the workspace root by default, preserving subdirs', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/lib/helpers.js']);
            rpc.queueResponse('getFile', 'main content');
            rpc.queueResponse('getFile', 'helper content');
            await engine.downloadAll();
            assert_1.strict.equal(_readFile('/workspace/main.js'), 'main content');
            assert_1.strict.equal(_readFile('/workspace/lib/helpers.js'), 'helper content');
        });
        test('writes under the configured syncDirectory when set', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/lib/helpers.js']);
            rpc.queueResponse('getFile', 'main content');
            rpc.queueResponse('getFile', 'helper content');
            await engine.downloadAll();
            assert_1.strict.equal(_readFile('/workspace/src/main.js'), 'main content');
            assert_1.strict.equal(_readFile('/workspace/src/lib/helpers.js'), 'helper content');
        });
        test('treats syncDirectory "/" as the workspace root on download', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', '/');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js']);
            rpc.queueResponse('getFile', 'main content');
            await engine.downloadAll();
            assert_1.strict.equal(_readFile('/workspace/main.js'), 'main content');
        });
        test('strips a leading slash on remote names before joining', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/foo.js']);
            rpc.queueResponse('getFile', 'foo');
            await engine.downloadAll();
            assert_1.strict.equal(_readFile('/workspace/foo.js'), 'foo');
        });
        test('reports per-file failures without aborting the batch', async () => {
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js', '/b.js']);
            rpc.queueError('getFile', new Error('nope'));
            rpc.queueResponse('getFile', 'b ok');
            await engine.downloadAll();
            assert_1.strict.equal(_readFile('/workspace/b.js'), 'b ok');
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /1 downloaded, 1 failed/);
        });
        test('refuses to write a remote file that exceeds the 1 MB sync limit', async () => {
            const ONE_MB = 1024 * 1024;
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['/huge.js', '/ok.js']);
            rpc.queueResponse('getFile', 'x'.repeat(ONE_MB + 1));
            rpc.queueResponse('getFile', 'small');
            await engine.downloadAll();
            // The oversize file was NOT written to disk; the small one was.
            assert_1.strict.equal(_readFile('/workspace/huge.js'), undefined);
            assert_1.strict.equal(_readFile('/workspace/ok.js'), 'small');
            // It's reflected in the summary as a failure, with the size in the log.
            const failed = output.lines.filter(l => /Failed to download.*huge\.js.*exceeds.*sync limit/.test(l));
            assert_1.strict.equal(failed.length, 1, `expected one failure log, got: ${JSON.stringify(output.lines)}`);
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /1 downloaded, 1 failed/);
        });
        test('does not prompt when no local files would be overwritten', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/fresh.js']);
            rpc.queueResponse('getFile', 'content');
            await engine.downloadAll();
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.equal(warnings.length, 0, 'no warning expected when there are no conflicts');
            assert_1.strict.equal(_readFile('/workspace/fresh.js'), 'content');
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
            assert_1.strict.equal(warnings.length, 1, 'expected exactly one warning prompt');
            const prompt = warnings[0];
            assert_1.strict.equal(prompt.modal, true);
            assert_1.strict.match(prompt.message, /Overwrite 2 local files\?/);
            assert_1.strict.ok(prompt.detail && prompt.detail.includes('/a.js'), `detail missing /a.js: ${prompt.detail}`);
            assert_1.strict.ok(prompt.detail && prompt.detail.includes('/lib/b.js'), `detail missing /lib/b.js: ${prompt.detail}`);
            assert_1.strict.ok(prompt.detail && !prompt.detail.includes('/c.js'), `non-conflict /c.js should not appear in detail: ${prompt.detail}`);
            assert_1.strict.deepEqual(prompt.items, ['Overwrite']);
            // Conflicts kept; the new file came down anyway; only one getFile RPC fired
            assert_1.strict.equal(_readFile('/workspace/a.js'), 'local a');
            assert_1.strict.equal(_readFile('/workspace/lib/b.js'), 'local b');
            assert_1.strict.equal(_readFile('/workspace/c.js'), 'remote c');
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(fetched, ['/c.js']);
        });
        test('proceeds with the full download when the user confirms the overwrite, preserving server-listing order', async () => {
            _writeFile('/workspace/a.js', 'local a');
            _queueWarningResponse('Overwrite');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js', '/b.js']);
            rpc.queueResponse('getFile', 'remote a', 'remote b');
            await engine.downloadAll();
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.equal(warnings.length, 1, 'expected exactly one warning prompt');
            assert_1.strict.equal(_readFile('/workspace/a.js'), 'remote a');
            assert_1.strict.equal(_readFile('/workspace/b.js'), 'remote b');
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
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(fetched, ['/good.js', '/ok2.js']);
            assert_1.strict.equal(_readFile('/workspace/good.js'), 'g');
            assert_1.strict.equal(_readFile('/workspace/ok2.js'), 'o2');
            // Nothing got written outside the workspace
            assert_1.strict.equal(_readFile('/etc/passwd'), undefined);
            assert_1.strict.equal(_readFile('/workspace/etc/passwd'), undefined);
            // Each invalid name produced a per-file log entry
            const skippedLines = output.lines.filter(l => /Skipped \(invalid name from server\)/.test(l));
            assert_1.strict.equal(skippedLines.length, 6, `expected 6 skip log lines, got: ${JSON.stringify(skippedLines)}`);
            // Summary line counts the skips
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /2 downloaded, 0 failed, 6 skipped/);
        });
        test('does not prompt when conflicts only appear on invalid (skipped) names', async () => {
            // A pre-existing local file at a path that the server can't legally name —
            // the skip should happen before existence is checked, so no confirm modal.
            _writeFile('/workspace/clobber.js', 'local');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/../clobber.js']);
            await engine.downloadAll();
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.equal(warnings.length, 0, 'no prompt expected — the invalid name was skipped before existence check');
            assert_1.strict.equal(_readFile('/workspace/clobber.js'), 'local');
        });
        test('skips server files whose extension is not in fileExtensions', async () => {
            // Defaults include .js / .txt but NOT .cct or .script
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/contract.cct', '/script-of-doom.script', '/readme.txt']);
            rpc.queueResponse('getFile', 'main', 'readme'); // only the two allowed files
            await engine.downloadAll();
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(fetched, ['/main.js', '/readme.txt']);
            assert_1.strict.equal(_readFile('/workspace/main.js'), 'main');
            assert_1.strict.equal(_readFile('/workspace/readme.txt'), 'readme');
            assert_1.strict.equal(_readFile('/workspace/contract.cct'), undefined);
            assert_1.strict.equal(_readFile('/workspace/script-of-doom.script'), undefined);
            const extSkips = output.lines.filter(l => /Skipped \(extension not in bitburnerSync\.fileExtensions\)/.test(l));
            assert_1.strict.equal(extSkips.length, 2, `expected two extension-skip log lines, got: ${JSON.stringify(extSkips)}`);
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /2 downloaded, 0 failed, 2 skipped/);
        });
        test('skips server files that live under /trashbin/ — they belong to the extension\'s delete bucket', async () => {
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', [
                '/main.js',
                '/trashbin/old.js',
                '/trashbin/lib/helpers.js',
                // Listing variant without leading slash — the canonicalizer
                // should normalize it so it's still recognized as in trashbin.
                'trashbin/no-slash.js',
            ]);
            rpc.queueResponse('getFile', 'main');
            await engine.downloadAll();
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(fetched, ['/main.js'], 'only the non-trashbin file should be downloaded');
            assert_1.strict.equal(_readFile('/workspace/main.js'), 'main');
            assert_1.strict.equal(_readFile('/workspace/trashbin/old.js'), undefined);
            assert_1.strict.equal(_readFile('/workspace/trashbin/lib/helpers.js'), undefined);
            assert_1.strict.equal(_readFile('/workspace/trashbin/no-slash.js'), undefined);
            const trashbinSkips = output.lines.filter(l => /Skipped \(in \/trashbin\/\)/.test(l));
            assert_1.strict.equal(trashbinSkips.length, 3, `expected three trashbin-skip log lines, got: ${JSON.stringify(trashbinSkips)}`);
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /1 downloaded, 0 failed, 3 skipped/);
        });
        test('countNewRemoteFiles ignores /trashbin/ entries (no spurious first-connect download prompt)', async () => {
            const { engine, rpc } = buildEngine();
            // No local files written — every server file would be "new" if
            // counted. /trashbin entries must be excluded so the user doesn't
            // get prompted to download the very files they just deleted.
            rpc.queueResponse('getFileNames', ['/trashbin/just-deleted.js', '/trashbin/lib/also-deleted.js']);
            const count = await engine.countNewRemoteFiles();
            assert_1.strict.equal(count, 0);
        });
        test('user-configured fileExtensions narrows what gets downloaded', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['.ns']);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/script.ns', '/notes.txt']);
            rpc.queueResponse('getFile', 'ns-content');
            await engine.downloadAll();
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(fetched, ['/script.ns']);
            assert_1.strict.equal(_readFile('/workspace/script.ns'), 'ns-content');
        });
        test('extension match is case-insensitive (same as auto-sync filter)', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/Foo.JS']);
            rpc.queueResponse('getFile', 'js-content');
            await engine.downloadAll();
            assert_1.strict.equal(_readFile('/workspace/Foo.JS'), 'js-content');
        });
        test('accepts dotless fileExtensions input (e.g. "js") via Configuration normalization', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['ns']);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/main.js', '/script.ns']);
            rpc.queueResponse('getFile', 'ns');
            await engine.downloadAll();
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(fetched, ['/script.ns']);
        });
        test('files with no extension at all are skipped', async () => {
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['/Makefile']);
            await engine.downloadAll();
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'getFile').length, 0);
            assert_1.strict.ok(output.lines.some(l => /Skipped \(extension not in bitburnerSync\.fileExtensions\)/.test(l)));
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
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'getFile').length, 0);
            // No files were written.
            assert_1.strict.equal(_readFile('/workspace/file0.js'), undefined);
            // User saw an error notification explaining the refusal.
            const errs = _state.notifications.filter(n => n.kind === 'error');
            assert_1.strict.equal(errs.length, 1, `expected one error notification, got: ${JSON.stringify(_state.notifications)}`);
            assert_1.strict.match(errs[0].message, /Refusing to download.*5001/);
            // Same line in the output channel for later diagnosis.
            assert_1.strict.ok(output.lines.some(l => /Refusing to download.*5001/.test(l)));
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
            assert_1.strict.equal(errs.length, 0, `expected no error at the limit boundary, got: ${JSON.stringify(errs)}`);
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'getFile').length, 5000);
        });
        test('downloads new files even when there are no conflicts and never prompts', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/x.js', '/y.js']);
            rpc.queueResponse('getFile', 'X', 'Y');
            await engine.downloadAll();
            assert_1.strict.equal(_readFile('/workspace/x.js'), 'X');
            assert_1.strict.equal(_readFile('/workspace/y.js'), 'Y');
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.equal(warnings.length, 0, 'no prompt when there are no conflicts');
        });
    });
    suite('downloadSelectedFiles', () => {
        test('returns without listing the server when the user cancels the input box', async () => {
            _queueInputBoxResponse(undefined);
            const { engine, rpc } = buildEngine();
            await engine.downloadSelectedFiles();
            assert_1.strict.equal(rpc.calls.length, 0, 'cancelled input must not trigger the listing RPC');
            assert_1.strict.equal(_state.inputBoxCalls.length, 1);
        });
        test('downloads only files whose remote path matches the supplied glob', async () => {
            _queueInputBoxResponse('lib/**');
            const { engine, rpc } = buildEngine();
            // Server returns mixed paths; only the two under lib/ match.
            rpc.queueResponse('getFileNames', ['main.js', 'lib/util.js', 'lib/nested/deep.js', 'scripts/foo.js']);
            rpc.queueResponse('getFile', 'util', 'deep');
            await engine.downloadSelectedFiles();
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(fetched, ['lib/util.js', 'lib/nested/deep.js']);
            assert_1.strict.equal(_readFile('/workspace/lib/util.js'), 'util');
            assert_1.strict.equal(_readFile('/workspace/lib/nested/deep.js'), 'deep');
            assert_1.strict.equal(_readFile('/workspace/main.js'), undefined);
            assert_1.strict.equal(_readFile('/workspace/scripts/foo.js'), undefined);
        });
        test('extension filter still applies — pattern matches do not override fileExtensions', async () => {
            _queueInputBoxResponse('**/*');
            const { engine, rpc } = buildEngine();
            // .cct is not in the default fileExtensions; the pattern matches but the extension does not.
            rpc.queueResponse('getFileNames', ['main.js', 'contract.cct']);
            rpc.queueResponse('getFile', 'main');
            await engine.downloadSelectedFiles();
            const fetched = rpc.calls.filter(c => c.method === 'getFile').map(c => c.params.filename);
            assert_1.strict.deepEqual(fetched, ['main.js']);
        });
        test('makes no getFile calls when the pattern matches nothing and reports skips in the summary', async () => {
            _queueInputBoxResponse('nonexistent/**');
            const { engine, rpc, output } = buildEngine();
            rpc.queueResponse('getFileNames', ['main.js', 'lib/util.js']);
            await engine.downloadSelectedFiles();
            assert_1.strict.equal(rpc.calls.filter(c => c.method === 'getFile').length, 0);
            const summary = output.lines.find(l => /Download complete/.test(l)) ?? '';
            assert_1.strict.match(summary, /0 downloaded, 0 failed, 2 skipped/);
        });
        test('honors syncDirectory for the download destination', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            _queueInputBoxResponse('lib/**');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['lib/util.js']);
            rpc.queueResponse('getFile', 'util');
            await engine.downloadSelectedFiles();
            assert_1.strict.equal(_readFile('/workspace/src/lib/util.js'), 'util');
        });
        test('warns and skips the listing RPC when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            _queueInputBoxResponse('**/*.js');
            const { engine, rpc } = buildEngine();
            await engine.downloadSelectedFiles();
            assert_1.strict.equal(rpc.calls.length, 0);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.equal(warnings.length, 1);
            assert_1.strict.match(warnings[0].message, /Nothing will be downloaded/);
        });
        suite('saved pattern (workspaceState)', () => {
            const KEY = 'bitburnerSync.downloadSelectedFilesSelection';
            test("pre-fills the input box with '**/*.js' when no pattern has been saved", async () => {
                _queueInputBoxResponse(undefined); // cancel
                const { engine } = buildEngine();
                await engine.downloadSelectedFiles();
                assert_1.strict.equal(_state.inputBoxCalls.length, 1);
                const opts = _state.inputBoxCalls[0].options;
                assert_1.strict.equal(opts.value, '**/*.js');
            });
            test('pre-fills the input box with the last-used pattern from workspaceState', async () => {
                const memento = _makeMemento({ [KEY]: 'scripts/**' });
                _queueInputBoxResponse(undefined); // cancel — we only care about the seeded value
                const { engine } = buildEngine({ memento });
                await engine.downloadSelectedFiles();
                const opts = _state.inputBoxCalls[0].options;
                assert_1.strict.equal(opts.value, 'scripts/**');
            });
            test('persists the entered pattern to workspaceState after a successful run', async () => {
                _queueInputBoxResponse('lib/**');
                const { engine, rpc, memento } = buildEngine();
                rpc.queueResponse('getFileNames', ['lib/util.js']);
                rpc.queueResponse('getFile', 'util');
                await engine.downloadSelectedFiles();
                assert_1.strict.equal(memento.get(KEY), 'lib/**');
            });
            test('does not overwrite the saved pattern when the user cancels the input box', async () => {
                const memento = _makeMemento({ [KEY]: 'lib/**' });
                _queueInputBoxResponse(undefined); // user hits Escape
                const { engine } = buildEngine({ memento });
                await engine.downloadSelectedFiles();
                assert_1.strict.equal(memento.get(KEY), 'lib/**');
            });
            test('updates the saved pattern when the user enters a different one', async () => {
                const memento = _makeMemento({ [KEY]: 'lib/**' });
                _queueInputBoxResponse('scripts/**');
                const { engine, rpc } = buildEngine({ memento });
                rpc.queueResponse('getFileNames', ['scripts/foo.js']);
                rpc.queueResponse('getFile', 'foo');
                await engine.downloadSelectedFiles();
                assert_1.strict.equal(memento.get(KEY), 'scripts/**');
            });
        });
    });
    suite('countNewRemoteFiles', () => {
        test('counts only filenames that are not already present locally', async () => {
            _writeFile('/workspace/existing.js', 'local');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/existing.js', '/new1.js', '/new2.js']);
            const n = await engine.countNewRemoteFiles();
            assert_1.strict.equal(n, 2);
        });
        test('returns 0 when every remote file already exists locally', async () => {
            _writeFile('/workspace/a.js', 'local');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js']);
            assert_1.strict.equal(await engine.countNewRemoteFiles(), 0);
        });
        test('returns 0 when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine } = buildEngine();
            // No RPC needed: short-circuited before the listing call.
            assert_1.strict.equal(await engine.countNewRemoteFiles(), 0);
        });
        test('returns 0 when no workspace folder is open (silent: does not throw)', async () => {
            _state.workspaceFolders = undefined;
            const { engine } = buildEngine();
            assert_1.strict.equal(await engine.countNewRemoteFiles(), 0);
        });
        test('ignores skipped (invalid / wrong-extension) entries in the count', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/good.js', '/bad.cct', '/../escape.js']);
            assert_1.strict.equal(await engine.countNewRemoteFiles(), 1);
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
            assert_1.strict.equal(await engine.countNewLocalFiles(), 2);
        });
        test('returns 0 when every local file already exists remotely', async () => {
            _writeFile('/workspace/a.js', 'a');
            _state.findFilesQueue = [Uri.file('/workspace/a.js')];
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getFileNames', ['/a.js']);
            assert_1.strict.equal(await engine.countNewLocalFiles(), 0);
        });
        test('returns 0 when fileExtensions is explicitly []', async () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const { engine, rpc } = buildEngine();
            // No RPC needed: short-circuited before the listing call.
            assert_1.strict.equal(await engine.countNewLocalFiles(), 0);
            assert_1.strict.equal(rpc.calls.length, 0);
        });
        test('returns 0 when no workspace folder is open (silent: does not throw)', async () => {
            _state.workspaceFolders = undefined;
            const { engine } = buildEngine();
            assert_1.strict.equal(await engine.countNewLocalFiles(), 0);
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
            assert_1.strict.equal(await engine.countNewLocalFiles(), 1);
        });
        test('matches local-to-remote paths even when the server omits leading slashes', async () => {
            _writeFile('/workspace/a.js', 'a');
            _state.findFilesQueue = [Uri.file('/workspace/a.js')];
            const { engine, rpc } = buildEngine();
            // Server returns the name without the leading slash that
            // PathMapper produces; the canonicalizer should make them match.
            rpc.queueResponse('getFileNames', ['a.js']);
            assert_1.strict.equal(await engine.countNewLocalFiles(), 0);
        });
        test('honors syncDirectory when comparing — strips it from the remote-equivalent path', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            _writeFile('/workspace/src/main.js', 'm');
            _state.findFilesQueue = [Uri.file('/workspace/src/main.js')];
            const { engine, rpc } = buildEngine();
            // With syncDirectory 'src', src/main.js maps to /main.js on the server.
            rpc.queueResponse('getFileNames', ['/main.js']);
            assert_1.strict.equal(await engine.countNewLocalFiles(), 0);
        });
        test('returns 0 when the server returns an unreasonable number of filenames', async () => {
            _writeFile('/workspace/a.js', 'a');
            _state.findFilesQueue = [Uri.file('/workspace/a.js')];
            const { engine, rpc } = buildEngine();
            const flood = Array.from({ length: 5001 }, (_, i) => `/file${i}.js`);
            rpc.queueResponse('getFileNames', flood);
            // Don't trust the listing — refuse to compute a difference.
            assert_1.strict.equal(await engine.countNewLocalFiles(), 0);
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
            assert_1.strict.equal(await engine.countNewLocalFiles(), 1);
        });
    });
    suite('downloadDefinitions', () => {
        test('throws when no workspace folder is open', async () => {
            _state.workspaceFolders = undefined;
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', 'declare ...');
            await assert_1.strict.rejects(engine.downloadDefinitions(), /No workspace folder open/);
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
            assert_1.strict.ok(onDisk);
            // Already-exported declaration is untouched (not double-exported).
            assert_1.strict.match(onDisk, /^export interface NS \{/m);
            assert_1.strict.doesNotMatch(onDisk, /^export export /m);
            // Previously-unexported declarations now have `export` prepended.
            assert_1.strict.match(onDisk, /^export type ScriptArg = /m);
            assert_1.strict.match(onDisk, /^export interface AutocompleteData \{/m);
        });
        test('generates NetscriptGlobals.d.ts with every top-level type (including patched ones) aliased into the global scope', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const shim = _readFile('/workspace/NetscriptGlobals.d.ts');
            assert_1.strict.ok(shim, 'expected NetscriptGlobals.d.ts to be written');
            // Pulls types from the sibling definitions file, not a bare module spec.
            assert_1.strict.match(shim, /import type \* as _NS from "\.\/NetscriptDefinitions"/);
            // Each top-level name gets a `declare global` re-export — including
            // the ones that needed to be patched to export status.
            assert_1.strict.match(shim, /declare global \{/);
            assert_1.strict.match(shim, /type NS = _NS\.NS;/);
            assert_1.strict.match(shim, /type ScriptArg = _NS\.ScriptArg;/);
            assert_1.strict.match(shim, /type AutocompleteData = _NS\.AutocompleteData;/);
            // Module-marker so the file is treated as a module (so `declare global` works).
            assert_1.strict.match(shim, /export \{\};/);
        });
        test('inlines a React namespace and re-exports it as the "react" module', async () => {
            // Types now ship *inside* NetscriptGlobals.d.ts as global
            // `namespace React { … }` (wrapped in `declare global`) + ambient
            // `declare module "react" { export = React; }` blocks. That
            // means the workspace is self-contained: an extension upgrade
            // never leaves the user with a stale absolute path pointing
            // into an old install dir (the bug the old `bundledTypesDir`
            // mechanism suffered from).
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const shim = _readFile('/workspace/NetscriptGlobals.d.ts');
            assert_1.strict.ok(shim);
            // Namespaces live inside `declare global { … }` so they're
            // visible as globals from the user's .ts/.tsx files.
            assert_1.strict.match(shim, /declare global \{[\s\S]*namespace React \{/);
            assert_1.strict.match(shim, /namespace ReactDOM \{/);
            assert_1.strict.match(shim, /namespace JSX \{/);
            // Ambient module re-exports at the top level so `import { NS }
            // from "@ns"` (which transitively imports from "react") resolves.
            assert_1.strict.match(shim, /declare module "react" \{\s*export = React;\s*\}/);
            assert_1.strict.match(shim, /declare module "react-dom" \{\s*export = ReactDOM;\s*\}/);
            // A handful of the surface everyone actually uses — hooks,
            // component classes, HTMLAttributes.
            assert_1.strict.match(shim, /function useState/);
            assert_1.strict.match(shim, /class Component/);
            assert_1.strict.match(shim, /interface HTMLAttributes/);
        });
        test('does not add react/react-dom paths pointing at the extension install dir', async () => {
            // The old behavior wrote absolute paths into tsconfig that broke
            // on every extension upgrade. Types now live in
            // NetscriptGlobals.d.ts, so tsconfig should be clean.
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            assert_1.strict.deepEqual(parsed.compilerOptions.paths['@ns'], ['NetscriptDefinitions.d.ts']);
            assert_1.strict.equal(parsed.compilerOptions.paths['react'], undefined);
            assert_1.strict.equal(parsed.compilerOptions.paths['react-dom'], undefined);
        });
        test('scrubs stale react/react-dom paths left by prior extension installs', async () => {
            // Existing users who upgrade past this fix will have `react` /
            // `react-dom` entries pointing at `.…/bitburner-file-sync-plugin-0.1.2/dist/types/…`
            // from an earlier extension install. Those are dangling — the
            // upgrade removes the old install dir — so we actively delete
            // them so IntelliSense goes back to using our inlined types.
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
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            assert_1.strict.equal(parsed.compilerOptions.paths['react'], undefined);
            assert_1.strict.equal(parsed.compilerOptions.paths['react-dom'], undefined);
            // @ns is add-if-missing, so it's untouched.
            assert_1.strict.deepEqual(parsed.compilerOptions.paths['@ns'], ['NetscriptDefinitions.d.ts']);
        });
        test('the d.ts patcher is idempotent across re-downloads', async () => {
            // Pre-patched content (already `export interface Foo`) should not
            // grow a second `export ` on re-download.
            const prePatched = 'export interface Foo { x: number; }\nexport type Bar = string;\n';
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', prePatched);
            await engine.downloadDefinitions();
            assert_1.strict.equal(_readFile('/workspace/NetscriptDefinitions.d.ts'), prePatched);
        });
        test('skips generating NetscriptGlobals.d.ts when the d.ts has no top-level declarations to patch or export', async () => {
            const { engine, rpc, output } = buildEngine();
            // No interface/type/enum/class declarations at all — the patcher
            // produces an empty (no-export) file, so the extractor finds
            // nothing and we skip writing the shim.
            rpc.queueResponse('getDefinitionFile', '// just a comment\n');
            await engine.downloadDefinitions();
            assert_1.strict.equal(_readFile('/workspace/NetscriptGlobals.d.ts'), undefined);
            assert_1.strict.ok(output.lines.some(l => /Skipped NetscriptGlobals\.d\.ts/.test(l)), `expected an output channel log about skipping, got: ${JSON.stringify(output.lines)}`);
        });
        test('creates a tsconfig.json with both files, the @ns path alias, and jsx config if none exists', async () => {
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const raw = _readFile('/workspace/tsconfig.json');
            assert_1.strict.ok(raw, 'expected tsconfig.json to be written');
            const parsed = JSON.parse(raw);
            assert_1.strict.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert_1.strict.equal(parsed.compilerOptions.target, 'ESNext');
            assert_1.strict.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
                // Replaces baseUrl: bare imports like `import "utils.js"`
                // and Bitburner's absolute-from-home imports like
                // `import "/lib/utils.js"` resolve against the script root.
                '*': ['./*'],
                '/*': ['./*'],
            });
            // `moduleResolution: "node"` and `baseUrl` were both deprecated
            // in TS 5.x and removed in 7.0; we generate the modern
            // equivalents instead.
            assert_1.strict.equal(parsed.compilerOptions.moduleResolution, 'bundler');
            assert_1.strict.equal(parsed.compilerOptions.baseUrl, undefined);
            // Matches Bitburner's runtime (classic React.createElement factory).
            assert_1.strict.equal(parsed.compilerOptions.jsx, 'react');
        });
        test('creates a tsconfig.json with sync-directory-rooted paths when syncDirectory is set', async () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            // `@ns` is at the workspace root, not under syncDirectory.
            assert_1.strict.deepEqual(parsed.compilerOptions.paths['@ns'], ['NetscriptDefinitions.d.ts']);
            // `@/*`, `*`, and `/*` all point at the sync root.
            assert_1.strict.deepEqual(parsed.compilerOptions.paths['@/*'], ['./src/*']);
            assert_1.strict.deepEqual(parsed.compilerOptions.paths['*'], ['./src/*']);
            assert_1.strict.deepEqual(parsed.compilerOptions.paths['/*'], ['./src/*']);
            assert_1.strict.equal(parsed.compilerOptions.baseUrl, undefined);
        });
        test('appends to an existing tsconfig.json files array and adds the @ns path alias and jsx mode', async () => {
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { target: 'ES2020' },
                files: ['existing.d.ts'],
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            assert_1.strict.deepEqual(parsed.files, ['existing.d.ts', 'NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert_1.strict.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            assert_1.strict.equal(parsed.compilerOptions.jsx, 'react');
            // Preserves untouched fields
            assert_1.strict.equal(parsed.compilerOptions.target, 'ES2020');
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
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            assert_1.strict.equal(parsed.compilerOptions.jsx, 'react-jsx');
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
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            assert_1.strict.deepEqual(parsed.compilerOptions.paths, {
                '~/*': ['src/*'],
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            // User-set baseUrl is untouched.
            assert_1.strict.equal(parsed.compilerOptions.baseUrl, '.');
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
            assert_1.strict.equal(_readFile('/workspace/tsconfig.json'), original);
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
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            assert_1.strict.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert_1.strict.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            assert_1.strict.equal(parsed.compilerOptions.jsx, 'react');
        });
        test('creates a files array if the existing tsconfig has none', async () => {
            _writeFile('/workspace/tsconfig.json', JSON.stringify({
                compilerOptions: { target: 'ES2020' },
            }));
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            assert_1.strict.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert_1.strict.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
            assert_1.strict.equal(parsed.compilerOptions.jsx, 'react');
        });
        test('leaves an unparseable tsconfig untouched and warns the user', async () => {
            const original = '{ this is not json';
            _writeFile('/workspace/tsconfig.json', original);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            assert_1.strict.equal(_readFile('/workspace/tsconfig.json'), original);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.ok(warnings.some(w => /could not be parsed/i.test(w.message)), `expected a warning about an unparseable tsconfig, got: ${JSON.stringify(warnings)}`);
        });
        test('leaves a JSONC tsconfig untouched and warns when entries are missing', async () => {
            const jsonc = [
                '{',
                '  // comment that strict JSON.parse rejects',
                '  "compilerOptions": { "target": "ES2020" },',
                '  "files": ["other.d.ts"],', // trailing comma intentional
                '}',
            ].join('\n');
            _writeFile('/workspace/tsconfig.json', jsonc);
            const { engine, rpc } = buildEngine();
            rpc.queueResponse('getDefinitionFile', SAMPLE_DEFS);
            await engine.downloadDefinitions();
            assert_1.strict.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.ok(warnings.some(w => /JSONC|comments or trailing commas/i.test(w.message)), `expected a warning about JSONC, got: ${JSON.stringify(warnings)}`);
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
            assert_1.strict.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.equal(warnings.length, 0, `expected no warnings, got: ${JSON.stringify(warnings)}`);
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
            assert_1.strict.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.ok(warnings.some(w => /JSONC|comments or trailing commas/i.test(w.message)), `expected a warning, got: ${JSON.stringify(warnings)}`);
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
            assert_1.strict.equal(_readFile('/workspace/tsconfig.json'), jsonc);
            const warnings = _state.notifications.filter(n => n.kind === 'warning');
            assert_1.strict.equal(warnings.length, 0, `expected no warnings, got: ${JSON.stringify(warnings)}`);
        });
    });
    suite('ensureTypeDefinitionsSetup', () => {
        const SAMPLE_DEFS = 'export interface NS { x: number; }\nexport type Y = string;\n';
        test('is a no-op when no NetscriptDefinitions.d.ts exists in the workspace', async () => {
            const { engine } = buildEngine();
            await engine.ensureTypeDefinitionsSetup();
            assert_1.strict.equal(_readFile('/workspace/NetscriptGlobals.d.ts'), undefined);
            assert_1.strict.equal(_readFile('/workspace/tsconfig.json'), undefined);
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
            assert_1.strict.equal(rpc.calls.length, 0);
            const shim = _readFile('/workspace/NetscriptGlobals.d.ts');
            assert_1.strict.ok(shim, 'expected NetscriptGlobals.d.ts to be generated');
            assert_1.strict.match(shim, /type NS = _NS\.NS;/);
            const parsed = JSON.parse(_readFile('/workspace/tsconfig.json'));
            assert_1.strict.deepEqual(parsed.files, ['NetscriptDefinitions.d.ts', 'NetscriptGlobals.d.ts']);
            assert_1.strict.deepEqual(parsed.compilerOptions.paths, {
                '@ns': ['NetscriptDefinitions.d.ts'],
                '@/*': ['./*'],
            });
        });
    });
});
//# sourceMappingURL=SyncEngine.test.js.map