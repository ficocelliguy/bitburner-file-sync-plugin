import { strict as assert } from 'assert';
import { Configuration } from '../../config/Configuration';
import * as vscodeMock from './mocks/vscode';

const { _reset, _setConfig, _setLanguageConfig } = vscodeMock;

suite('Configuration', () => {
    let config: Configuration;

    setup(() => {
        _reset();
        config = new Configuration();
    });

    test('returns documented defaults when nothing is set', () => {
        assert.equal(config.port, 12525);
        assert.equal(config.autoSync, true);
        assert.equal(config.targetServer, 'home');
        assert.equal(config.showNotifications, true);
        assert.equal(config.autoStart, false);
        assert.equal(config.autoDownloadDefinitions, true);
        assert.equal(config.syncDirectory, '');
        assert.deepEqual(config.fileExtensions, [
            '.js', '.ts', '.jsx', '.tsx', '.txt', '.json', '.css', '.py',
        ]);
    });

    test('reads user-supplied values from vscode configuration', () => {
        _setConfig('bitburnerSync', 'port', 4242);
        _setConfig('bitburnerSync', 'autoSync', false);
        _setConfig('bitburnerSync', 'targetServer', 'n00dles');
        _setConfig('bitburnerSync', 'showNotifications', false);
        _setConfig('bitburnerSync', 'autoStart', true);
        _setConfig('bitburnerSync', 'autoDownloadDefinitions', false);
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        _setConfig('bitburnerSync', 'fileExtensions', ['.js', '.ns']);

        assert.equal(config.port, 4242);
        assert.equal(config.autoSync, false);
        assert.equal(config.targetServer, 'n00dles');
        assert.equal(config.showNotifications, false);
        assert.equal(config.autoStart, true);
        assert.equal(config.autoDownloadDefinitions, false);
        assert.equal(config.syncDirectory, 'src');
        assert.deepEqual(config.fileExtensions, ['.js', '.ns']);
    });

    test('syncDirectory strips leading and trailing slashes', () => {
        _setConfig('bitburnerSync', 'syncDirectory', '/src/');
        assert.equal(config.syncDirectory, 'src');
    });

    test('syncDirectory normalises a lone "/" to the empty (root) value', () => {
        _setConfig('bitburnerSync', 'syncDirectory', '/');
        assert.equal(config.syncDirectory, '');
    });

    test('fileGlob builds a brace-expanded glob pattern from extensions', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.js', '.ts', '.script']);
        assert.equal(config.fileGlob, '**/*.{js,ts,script}');
    });

    test('fileGlob uses the default extensions when none configured', () => {
        assert.equal(config.fileGlob, '**/*.{js,ts,jsx,tsx,txt,json,css,py}');
    });

    test('fileGlob handles a single extension', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
        assert.equal(config.fileGlob, '**/*.{js}');
    });

    test('fileGlob scopes to the configured syncDirectory when set', () => {
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        _setConfig('bitburnerSync', 'fileExtensions', ['.js', '.ts']);
        assert.equal(config.fileGlob, 'src/**/*.{js,ts}');
    });

    test('reads fresh values on every access (live config)', () => {
        assert.equal(config.port, 12525);
        _setConfig('bitburnerSync', 'port', 99);
        assert.equal(config.port, 99);
    });

    suite('exclude', () => {
        test('defaults to an empty user list — baseline tooling excludes live in SyncEngine, not here', () => {
            assert.deepEqual(config.exclude, []);
        });

        test('returns configured patterns verbatim', () => {
            _setConfig('bitburnerSync', 'exclude', ['**/*.test.ts', 'node_modules/**']);
            assert.deepEqual(config.exclude, ['**/*.test.ts', 'node_modules/**']);
        });

        test('trims surrounding whitespace and drops empty entries', () => {
            _setConfig('bitburnerSync', 'exclude', ['  **/foo  ', '', '  ', 'bar']);
            assert.deepEqual(config.exclude, ['**/foo', 'bar']);
        });
    });

    suite('fileExtensions empty vs unset', () => {
        test('returns defaults when the key is not set in any scope', () => {
            // Default Configuration setup with no _setConfig call.
            assert.deepEqual(config.fileExtensions, [
                '.js', '.ts', '.jsx', '.tsx', '.txt', '.json', '.css', '.py',
            ]);
        });

        test('returns [] when the user explicitly sets fileExtensions to []', () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            assert.deepEqual(config.fileExtensions, []);
        });

        test('fileGlob returns a sentinel that no real file matches when extensions is empty', () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const glob = config.fileGlob;
            // Whatever the sentinel looks like, it must not be the broken `**/*.{}`
            // pattern that used to be produced.
            assert.notEqual(glob, '**/*.{}');
            assert.ok(!/\{\s*\}/.test(glob), `glob should not contain empty braces: ${glob}`);
        });

        test('a value of [""] (only whitespace/empty entries) still produces an empty list', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['', '   ', '.']);
            assert.deepEqual(config.fileExtensions, []);
        });

        test('honors per-language overrides (e.g. [javascript]bitburnerSync.fileExtensions)', () => {
            // VS Code reports per-language settings under inspect()'s
            // *LanguageValue keys, NOT globalValue/workspaceValue. The
            // user-set check must look there too — otherwise the hardcoded
            // defaults silently win over the user's explicit choice.
            _setLanguageConfig('bitburnerSync', 'fileExtensions', ['.js']);
            assert.deepEqual(config.fileExtensions, ['.js']);
        });

        test('honors per-language [] override (treats it as "sync nothing", not "fall back to defaults")', () => {
            _setLanguageConfig('bitburnerSync', 'fileExtensions', []);
            assert.deepEqual(config.fileExtensions, []);
        });
    });

    suite('fileExtensions normalization', () => {
        test('accepts dotless extensions and adds the leading dot', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['js', 'ts', 'script']);
            assert.deepEqual(config.fileExtensions, ['.js', '.ts', '.script']);
        });

        test('lower-cases mixed-case extensions', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['.JS', '.Ts', 'JSX']);
            assert.deepEqual(config.fileExtensions, ['.js', '.ts', '.jsx']);
        });

        test('trims surrounding whitespace and drops empty entries', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['  .js  ', '', '  ', '.ts']);
            assert.deepEqual(config.fileExtensions, ['.js', '.ts']);
        });

        test('collapses multiple leading dots to one', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['..js', '...ts']);
            assert.deepEqual(config.fileExtensions, ['.js', '.ts']);
        });

        test('drops bare-dot entries', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['.', '..', '.js']);
            assert.deepEqual(config.fileExtensions, ['.js']);
        });

        test('fileGlob works with dotless user input', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['js', 'ts']);
            assert.equal(config.fileGlob, '**/*.{js,ts}');
        });
    });

    suite('syncDirectory traversal protection', () => {
        test('falls back to empty (workspace root) when syncDirectory contains ".."', () => {
            _setConfig('bitburnerSync', 'syncDirectory', '../escape');
            assert.equal(config.syncDirectory, '');
            assert.match(config.syncDirectoryError() ?? '', /would escape the workspace/);
        });

        test('rejects ".." anywhere in the path, not just at the start', () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src/../../outside');
            assert.equal(config.syncDirectory, '');
            assert.ok(config.syncDirectoryError());
        });

        test('falls back to empty when syncDirectory has a Windows drive letter', () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'C:/Windows');
            assert.equal(config.syncDirectory, '');
            assert.ok(config.syncDirectoryError());
        });

        test('does not flag valid relative paths containing ".." in a segment name', () => {
            // A folder literally named "foo..bar" — odd but not a traversal
            _setConfig('bitburnerSync', 'syncDirectory', 'foo..bar');
            assert.equal(config.syncDirectory, 'foo..bar');
            assert.equal(config.syncDirectoryError(), null);
        });

        test('syncDirectoryError is null when nothing is configured', () => {
            assert.equal(config.syncDirectoryError(), null);
        });

        test('syncDirectoryError is null for a normal path', () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src/scripts');
            assert.equal(config.syncDirectoryError(), null);
        });

        test('a rejected syncDirectory does not poison fileGlob (no prefix)', () => {
            _setConfig('bitburnerSync', 'syncDirectory', '../escape');
            _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
            assert.equal(config.fileGlob, '**/*.{js}');
        });
    });
});
