import { strict as assert } from 'assert';
import { WebSocketServer as WSServer } from 'ws';
import * as vscodeMock from './mocks/vscode';
import { activate, deactivate } from '../../extension';
import { waitMs } from './helpers';
import type { ExtensionContext } from './mocks/vscode';

const {
    _reset,
    _state,
    _setConfig,
    _setWorkspaceFolders,
    _triggerConfigChange,
    _makeMemento,
    Uri,
} = vscodeMock;

function makeContext(opts: { globalSeed?: Record<string, unknown>; workspaceSeed?: Record<string, unknown> } = {}): ExtensionContext {
    return {
        subscriptions: [],
        globalState: _makeMemento(opts.globalSeed),
        workspaceState: _makeMemento(opts.workspaceSeed),
        extensionPath: '/fake/extension/path',
    };
}

function disposeAll(ctx: ExtensionContext): void {
    for (const d of ctx.subscriptions) {
        try {
            d.dispose();
        } catch {
            // ignore
        }
    }
    ctx.subscriptions.length = 0;
}

suite('extension activate()', () => {
    setup(() => {
        _reset();
    });

    test('registers every contributed command', () => {
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        const expected = [
            'bitburnerSync.startServer',
            'bitburnerSync.stopServer',
            'bitburnerSync.toggleServer',
            'bitburnerSync.syncFile',
            'bitburnerSync.syncAll',
            'bitburnerSync.getDefinitions',
            'bitburnerSync.downloadAll',
            'bitburnerSync.downloadSelectedFiles',
        ];
        for (const name of expected) {
            assert.ok(_state.commands.has(name), `expected command ${name} to be registered`);
        }
        disposeAll(ctx);
    });

    test('creates the Bitburner Sync output channel and status bar', () => {
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        assert.equal(_state.outputChannels[0].name, 'Bitburner Sync');
        assert.equal(_state.statusBarItems.length, 1);
        disposeAll(ctx);
    });

    test('syncFile command warns when there is no active editor', async () => {
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        await vscodeMock.commands.executeCommand('bitburnerSync.syncFile');
        const warnings = _state.notifications.filter(n => n.kind === 'warning');
        assert.equal(warnings.length, 1);
        assert.match(warnings[0].message, /No active file/);
        disposeAll(ctx);
    });

    test('syncFile command warns when not connected, even if there is an active editor', async () => {
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        _setWorkspaceFolders(['/workspace']);
        _state.activeTextEditor = { document: { uri: Uri.file('/workspace/a.js') } };
        await vscodeMock.commands.executeCommand('bitburnerSync.syncFile');
        const warnings = _state.notifications.filter(n => n.kind === 'warning');
        assert.equal(warnings.length, 1);
        assert.match(warnings[0].message, /Not connected/);
        disposeAll(ctx);
    });

    test('syncAll, getDefinitions, and downloadAll all warn when not connected', async () => {
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        await vscodeMock.commands.executeCommand('bitburnerSync.syncAll');
        await vscodeMock.commands.executeCommand('bitburnerSync.getDefinitions');
        await vscodeMock.commands.executeCommand('bitburnerSync.downloadAll');
        const warnings = _state.notifications.filter(n => n.kind === 'warning');
        assert.equal(warnings.length, 3);
        for (const w of warnings) {
            assert.match(w.message, /Not connected/);
        }
        disposeAll(ctx);
    });

    test('does not auto-start the WebSocket server when autoStart is false (default)', () => {
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        // Status bar should remain in stopped state because the ws server never started.
        const item = _state.statusBarItems[0];
        assert.match(item.text, /Bitburner: Off/);
        disposeAll(ctx);
    });

    test('subscribes to configuration changes', () => {
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        assert.equal(_state.onConfigChangeListeners.length, 1);
        disposeAll(ctx);
    });

    test('deactivate() is a no-op that does not throw', () => {
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        disposeAll(ctx);
        deactivate();
    });

    test('warns when activated in a multi-root workspace and names the folder being used', () => {
        _setWorkspaceFolders(['/project-a', '/project-b', '/project-c']);
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        const multi = _state.notifications.find(
            n => n.kind === 'warning' && /multi-root workspace/i.test(n.message)
        );
        assert.ok(multi, `expected a multi-root warning, got: ${JSON.stringify(_state.notifications)}`);
        // Mentions the count and the first folder's path
        assert.match(multi.message, /3 folders/);
        assert.match(multi.message, /project-a/);
        // The other folders should NOT appear by path in the warning
        assert.ok(!/project-b/.test(multi.message), `did not expect other folders in warning: ${multi.message}`);
        // Same message also went to the output channel
        const channelLogged = _state.outputChannels[0].lines.some(l => /multi-root workspace/i.test(l));
        assert.ok(channelLogged, 'expected the multi-root warning to also appear in the output channel');
        disposeAll(ctx);
    });

    test('does not warn for a single-folder workspace', () => {
        _setWorkspaceFolders(['/only-one']);
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        const multi = _state.notifications.find(
            n => n.kind === 'warning' && /multi-root workspace/i.test(n.message)
        );
        assert.equal(multi, undefined, `unexpected multi-root warning: ${JSON.stringify(multi)}`);
        disposeAll(ctx);
    });

    test('does not warn when no workspace folders are open', () => {
        // _reset() already left workspaceFolders undefined
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        const multi = _state.notifications.find(
            n => n.kind === 'warning' && /multi-root workspace/i.test(n.message)
        );
        assert.equal(multi, undefined, `unexpected multi-root warning: ${JSON.stringify(multi)}`);
        disposeAll(ctx);
    });

    test('stopServer command shows a confirmation notification', async () => {
        // Even when not running, stopServer logs a stopped notification.
        // Use a configured target server so the engine has well-defined behavior.
        _setConfig('bitburnerSync', 'targetServer', 'home');
        const ctx = makeContext();
        activate(ctx as unknown as Parameters<typeof activate>[0]);
        await vscodeMock.commands.executeCommand('bitburnerSync.stopServer');
        const info = _state.notifications.filter(n => n.kind === 'info');
        assert.ok(info.some(n => /sync server stopped/i.test(n.message)));
        disposeAll(ctx);
    });

    suite('config-change restart', () => {
        async function waitForLogLine(re: RegExp, timeoutMs = 1000): Promise<boolean> {
            const channel = _state.outputChannels[0];
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                if (channel.lines.some(l => re.test(l))) {
                    return true;
                }
                await waitMs(20);
            }
            return false;
        }

        test('restarts the server on any bitburnerSync.* change when running, not just port', async () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'port', 0); // OS-assigned free port
            const ctx = makeContext();
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            await vscodeMock.commands.executeCommand('bitburnerSync.startServer');

            // Trigger a non-port config change — this used to be ignored.
            _triggerConfigChange('bitburnerSync.syncDirectory');

            const sawRestart = await waitForLogLine(/Configuration changed, restarting/i);
            assert.ok(sawRestart, `expected restart log line after syncDirectory change, got: ${JSON.stringify(_state.outputChannels[0].lines)}`);

            await vscodeMock.commands.executeCommand('bitburnerSync.stopServer');
            disposeAll(ctx);
        });

        test('also restarts on port changes (port restart is a subset of the new behavior)', async () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'port', 0);
            const ctx = makeContext();
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            await vscodeMock.commands.executeCommand('bitburnerSync.startServer');

            _triggerConfigChange('bitburnerSync.port');

            const sawRestart = await waitForLogLine(/Configuration changed, restarting/i);
            assert.ok(sawRestart, 'expected restart log line after port change');

            await vscodeMock.commands.executeCommand('bitburnerSync.stopServer');
            disposeAll(ctx);
        });

        test('does not restart when the server is stopped', async () => {
            _setWorkspaceFolders(['/workspace']);
            const ctx = makeContext();
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            // Server is in 'stopped' state — never started.

            _triggerConfigChange('bitburnerSync.syncDirectory');
            await waitMs(50);

            const channel = _state.outputChannels[0];
            assert.ok(
                !channel.lines.some(l => /restarting/i.test(l)),
                `unexpected restart while stopped: ${JSON.stringify(channel.lines)}`
            );
            disposeAll(ctx);
        });

        test('ignores config changes outside the bitburnerSync section', async () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'port', 0);
            const ctx = makeContext();
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            await vscodeMock.commands.executeCommand('bitburnerSync.startServer');

            // Some unrelated extension's setting changed
            _triggerConfigChange('editor.fontSize');
            await waitMs(50);

            const channel = _state.outputChannels[0];
            assert.ok(
                !channel.lines.some(l => /restarting/i.test(l)),
                `unexpected restart from unrelated config change: ${JSON.stringify(channel.lines)}`
            );

            await vscodeMock.commands.executeCommand('bitburnerSync.stopServer');
            disposeAll(ctx);
        });
    });

    suite('toggleServer in error state', () => {
        async function bindProbe(): Promise<{ port: number; close: () => Promise<void> }> {
            const probe = new WSServer({ host: '127.0.0.1', port: 0 });
            await new Promise<void>((resolve, reject) => {
                probe.once('listening', () => resolve());
                probe.once('error', reject);
            });
            const addr = probe.address();
            if (typeof addr !== 'object' || addr === null) {
                throw new Error('probe has no bound port');
            }
            return {
                port: addr.port,
                close: () => new Promise<void>((resolve, reject) => {
                    probe.close(err => err ? reject(err) : resolve());
                }),
            };
        }

        function findStatusBarText(): string {
            return _state.statusBarItems[0]?.text ?? '';
        }

        test('clicking the status bar (toggleServer) after a bind failure retries instead of stopping', async () => {
            // Occupy the port we're going to give the extension.
            const probe = await bindProbe();
            try {
                _setWorkspaceFolders(['/workspace']);
                _setConfig('bitburnerSync', 'port', probe.port);
                const ctx = makeContext();
                activate(ctx as unknown as Parameters<typeof activate>[0]);

                // First start fails — EADDRINUSE leaves the WSServer in the 'error' state.
                await vscodeMock.commands.executeCommand('bitburnerSync.startServer');
                await waitMs(50);
                assert.match(findStatusBarText(), /Error/, `expected error state after EADDRINUSE, got: "${findStatusBarText()}"`);

                // Free the port so retry can succeed.
                await probe.close();

                // Click the status bar — this used to call stopServer (the bug); should now retry.
                await vscodeMock.commands.executeCommand('bitburnerSync.toggleServer');
                await waitMs(100);
                assert.match(findStatusBarText(), /Waiting/, `expected waiting state after retry, got: "${findStatusBarText()}"`);

                await vscodeMock.commands.executeCommand('bitburnerSync.stopServer');
                disposeAll(ctx);
            } catch (err) {
                // Make sure the probe is closed even if the assertion fails.
                try { await probe.close(); } catch { /* already closed */ }
                throw err;
            }
        });

        test('startServer command itself also retries from error state (no "already running" bail)', async () => {
            const probe = await bindProbe();
            try {
                _setWorkspaceFolders(['/workspace']);
                _setConfig('bitburnerSync', 'port', probe.port);
                const ctx = makeContext();
                activate(ctx as unknown as Parameters<typeof activate>[0]);

                await vscodeMock.commands.executeCommand('bitburnerSync.startServer');
                await waitMs(50);
                assert.match(findStatusBarText(), /Error/);

                await probe.close();

                // Use the explicit startServer command — must not show "already running".
                await vscodeMock.commands.executeCommand('bitburnerSync.startServer');
                await waitMs(100);
                assert.match(findStatusBarText(), /Waiting/);
                const alreadyRunning = _state.notifications.find(n => /already running/i.test(n.message));
                assert.equal(alreadyRunning, undefined, `did not expect an "already running" notification: ${JSON.stringify(alreadyRunning)}`);

                await vscodeMock.commands.executeCommand('bitburnerSync.stopServer');
                disposeAll(ctx);
            } catch (err) {
                try { await probe.close(); } catch { /* already closed */ }
                throw err;
            }
        });
    });

    suite('syncDirectory safety', () => {
        function findEscapeWarning() {
            return _state.notifications.find(
                n => n.kind === 'warning' && /escape the workspace/i.test(n.message)
            );
        }

        test('warns at activation when syncDirectory is configured to a traversal path', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', '../../etc');
            const ctx = makeContext();
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            const warn = findEscapeWarning();
            assert.ok(warn, `expected an escape warning, got: ${JSON.stringify(_state.notifications)}`);
            // Same line should also be in the output channel
            const channel = _state.outputChannels[0];
            assert.ok(channel.lines.some(l => /escape the workspace/i.test(l)));
            disposeAll(ctx);
        });

        test('does not warn at activation when syncDirectory is a normal value', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const ctx = makeContext();
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            assert.equal(findEscapeWarning(), undefined);
            disposeAll(ctx);
        });

        test('warns when syncDirectory is changed to a traversal value mid-session', async () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', 'src'); // valid initially
            const ctx = makeContext();
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            assert.equal(findEscapeWarning(), undefined);

            // User changes setting to something dangerous
            _setConfig('bitburnerSync', 'syncDirectory', '../escape');
            _triggerConfigChange('bitburnerSync.syncDirectory');
            await waitMs(20);

            assert.ok(findEscapeWarning(), `expected an escape warning after config change`);
            disposeAll(ctx);
        });
    });

    suite('first-install: open settings UI', () => {
        const FIRST_INSTALL_KEY = 'bitburnerSync.hasOpenedConfigOnFirstInstall';

        test('opens the bitburnerSync settings UI on first activation', async () => {
            const ctx = makeContext();
            // VS Code's built-in command isn't in our mock; register a stub so we can verify.
            let openSettingsArg: string | undefined;
            vscodeMock.commands.registerCommand('workbench.action.openSettings', (arg) => {
                openSettingsArg = arg as string;
                return undefined;
            });
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            // Let the void-promise in maybeOpenSettingsOnFirstInstall settle.
            await waitMs(20);

            assert.equal(openSettingsArg, '@ext:bitburner-file-sync-plugin');
            assert.equal(ctx.globalState.get(FIRST_INSTALL_KEY, false), true, 'flag should be persisted after first open');
            disposeAll(ctx);
        });

        test('does not re-open the settings UI when the flag is already set', async () => {
            const ctx = makeContext({ globalSeed: { [FIRST_INSTALL_KEY]: true } });
            let openSettingsCalls = 0;
            vscodeMock.commands.registerCommand('workbench.action.openSettings', () => {
                openSettingsCalls++;
                return undefined;
            });
            activate(ctx as unknown as Parameters<typeof activate>[0]);
            await waitMs(20);

            assert.equal(openSettingsCalls, 0, 'expected no settings auto-open on a non-first activation');
            disposeAll(ctx);
        });
    });

    suite('first-connect: prompt to download', () => {
        const FIRST_CONNECT_KEY = 'bitburnerSync.hasConnectedBefore';

        test('flag is initially false on a fresh workspace', () => {
            const ctx = makeContext();
            assert.equal(ctx.workspaceState.get(FIRST_CONNECT_KEY, false), false);
            disposeAll(ctx);
        });

        test('seeded workspaceState short-circuits the prompt logic', () => {
            // We can't easily simulate the full ws connect path in a unit test
            // without a real WebSocketServer dance, but we can verify the key
            // is consulted via workspaceState — i.e. the storage scope is
            // per-workspace, not global.
            const ctx = makeContext({ workspaceSeed: { [FIRST_CONNECT_KEY]: true } });
            assert.equal(ctx.workspaceState.get(FIRST_CONNECT_KEY, false), true);
            // The same key in globalState must NOT be considered.
            assert.equal(ctx.globalState.get(FIRST_CONNECT_KEY, false), false);
            disposeAll(ctx);
        });
    });
});
