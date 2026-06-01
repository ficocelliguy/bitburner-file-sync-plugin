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
const Configuration_1 = require("../../config/Configuration");
const vscodeMock = __importStar(require("./mocks/vscode"));
const { _reset, _setConfig, _setLanguageConfig } = vscodeMock;
suite('Configuration', () => {
    let config;
    setup(() => {
        _reset();
        config = new Configuration_1.Configuration();
    });
    test('returns documented defaults when nothing is set', () => {
        assert_1.strict.equal(config.port, 12525);
        assert_1.strict.equal(config.autoSync, true);
        assert_1.strict.equal(config.targetServer, 'home');
        assert_1.strict.equal(config.showNotifications, true);
        assert_1.strict.equal(config.autoStart, false);
        assert_1.strict.equal(config.autoDownloadDefinitions, true);
        assert_1.strict.equal(config.syncDirectory, '');
        assert_1.strict.deepEqual(config.fileExtensions, [
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
        assert_1.strict.equal(config.port, 4242);
        assert_1.strict.equal(config.autoSync, false);
        assert_1.strict.equal(config.targetServer, 'n00dles');
        assert_1.strict.equal(config.showNotifications, false);
        assert_1.strict.equal(config.autoStart, true);
        assert_1.strict.equal(config.autoDownloadDefinitions, false);
        assert_1.strict.equal(config.syncDirectory, 'src');
        assert_1.strict.deepEqual(config.fileExtensions, ['.js', '.ns']);
    });
    test('syncDirectory strips leading and trailing slashes', () => {
        _setConfig('bitburnerSync', 'syncDirectory', '/src/');
        assert_1.strict.equal(config.syncDirectory, 'src');
    });
    test('syncDirectory normalises a lone "/" to the empty (root) value', () => {
        _setConfig('bitburnerSync', 'syncDirectory', '/');
        assert_1.strict.equal(config.syncDirectory, '');
    });
    test('fileGlob builds a brace-expanded glob pattern from extensions', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.js', '.ts', '.script']);
        assert_1.strict.equal(config.fileGlob, '**/*.{js,ts,script}');
    });
    test('fileGlob uses the default extensions when none configured', () => {
        assert_1.strict.equal(config.fileGlob, '**/*.{js,ts,jsx,tsx,txt,json,css,py}');
    });
    test('fileGlob handles a single extension', () => {
        _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
        assert_1.strict.equal(config.fileGlob, '**/*.{js}');
    });
    test('fileGlob scopes to the configured syncDirectory when set', () => {
        _setConfig('bitburnerSync', 'syncDirectory', 'src');
        _setConfig('bitburnerSync', 'fileExtensions', ['.js', '.ts']);
        assert_1.strict.equal(config.fileGlob, 'src/**/*.{js,ts}');
    });
    test('reads fresh values on every access (live config)', () => {
        assert_1.strict.equal(config.port, 12525);
        _setConfig('bitburnerSync', 'port', 99);
        assert_1.strict.equal(config.port, 99);
    });
    suite('exclude', () => {
        test('defaults to an empty user list — baseline tooling excludes live in SyncEngine, not here', () => {
            assert_1.strict.deepEqual(config.exclude, []);
        });
        test('returns configured patterns verbatim', () => {
            _setConfig('bitburnerSync', 'exclude', ['**/*.test.ts', 'node_modules/**']);
            assert_1.strict.deepEqual(config.exclude, ['**/*.test.ts', 'node_modules/**']);
        });
        test('trims surrounding whitespace and drops empty entries', () => {
            _setConfig('bitburnerSync', 'exclude', ['  **/foo  ', '', '  ', 'bar']);
            assert_1.strict.deepEqual(config.exclude, ['**/foo', 'bar']);
        });
    });
    suite('fileExtensions empty vs unset', () => {
        test('returns defaults when the key is not set in any scope', () => {
            // Default Configuration setup with no _setConfig call.
            assert_1.strict.deepEqual(config.fileExtensions, [
                '.js', '.ts', '.jsx', '.tsx', '.txt', '.json', '.css', '.py',
            ]);
        });
        test('returns [] when the user explicitly sets fileExtensions to []', () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            assert_1.strict.deepEqual(config.fileExtensions, []);
        });
        test('fileGlob returns a sentinel that no real file matches when extensions is empty', () => {
            _setConfig('bitburnerSync', 'fileExtensions', []);
            const glob = config.fileGlob;
            // Whatever the sentinel looks like, it must not be the broken `**/*.{}`
            // pattern that used to be produced.
            assert_1.strict.notEqual(glob, '**/*.{}');
            assert_1.strict.ok(!/\{\s*\}/.test(glob), `glob should not contain empty braces: ${glob}`);
        });
        test('a value of [""] (only whitespace/empty entries) still produces an empty list', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['', '   ', '.']);
            assert_1.strict.deepEqual(config.fileExtensions, []);
        });
        test('honors per-language overrides (e.g. [javascript]bitburnerSync.fileExtensions)', () => {
            // VS Code reports per-language settings under inspect()'s
            // *LanguageValue keys, NOT globalValue/workspaceValue. The
            // user-set check must look there too — otherwise the hardcoded
            // defaults silently win over the user's explicit choice.
            _setLanguageConfig('bitburnerSync', 'fileExtensions', ['.js']);
            assert_1.strict.deepEqual(config.fileExtensions, ['.js']);
        });
        test('honors per-language [] override (treats it as "sync nothing", not "fall back to defaults")', () => {
            _setLanguageConfig('bitburnerSync', 'fileExtensions', []);
            assert_1.strict.deepEqual(config.fileExtensions, []);
        });
    });
    suite('fileExtensions normalization', () => {
        test('accepts dotless extensions and adds the leading dot', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['js', 'ts', 'script']);
            assert_1.strict.deepEqual(config.fileExtensions, ['.js', '.ts', '.script']);
        });
        test('lower-cases mixed-case extensions', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['.JS', '.Ts', 'JSX']);
            assert_1.strict.deepEqual(config.fileExtensions, ['.js', '.ts', '.jsx']);
        });
        test('trims surrounding whitespace and drops empty entries', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['  .js  ', '', '  ', '.ts']);
            assert_1.strict.deepEqual(config.fileExtensions, ['.js', '.ts']);
        });
        test('collapses multiple leading dots to one', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['..js', '...ts']);
            assert_1.strict.deepEqual(config.fileExtensions, ['.js', '.ts']);
        });
        test('drops bare-dot entries', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['.', '..', '.js']);
            assert_1.strict.deepEqual(config.fileExtensions, ['.js']);
        });
        test('fileGlob works with dotless user input', () => {
            _setConfig('bitburnerSync', 'fileExtensions', ['js', 'ts']);
            assert_1.strict.equal(config.fileGlob, '**/*.{js,ts}');
        });
    });
    suite('syncDirectory traversal protection', () => {
        test('falls back to empty (workspace root) when syncDirectory contains ".."', () => {
            _setConfig('bitburnerSync', 'syncDirectory', '../escape');
            assert_1.strict.equal(config.syncDirectory, '');
            assert_1.strict.match(config.syncDirectoryError() ?? '', /would escape the workspace/);
        });
        test('rejects ".." anywhere in the path, not just at the start', () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src/../../outside');
            assert_1.strict.equal(config.syncDirectory, '');
            assert_1.strict.ok(config.syncDirectoryError());
        });
        test('falls back to empty when syncDirectory has a Windows drive letter', () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'C:/Windows');
            assert_1.strict.equal(config.syncDirectory, '');
            assert_1.strict.ok(config.syncDirectoryError());
        });
        test('does not flag valid relative paths containing ".." in a segment name', () => {
            // A folder literally named "foo..bar" — odd but not a traversal
            _setConfig('bitburnerSync', 'syncDirectory', 'foo..bar');
            assert_1.strict.equal(config.syncDirectory, 'foo..bar');
            assert_1.strict.equal(config.syncDirectoryError(), null);
        });
        test('syncDirectoryError is null when nothing is configured', () => {
            assert_1.strict.equal(config.syncDirectoryError(), null);
        });
        test('syncDirectoryError is null for a normal path', () => {
            _setConfig('bitburnerSync', 'syncDirectory', 'src/scripts');
            assert_1.strict.equal(config.syncDirectoryError(), null);
        });
        test('a rejected syncDirectory does not poison fileGlob (no prefix)', () => {
            _setConfig('bitburnerSync', 'syncDirectory', '../escape');
            _setConfig('bitburnerSync', 'fileExtensions', ['.js']);
            assert_1.strict.equal(config.fileGlob, '**/*.{js}');
        });
    });
});
//# sourceMappingURL=Configuration.test.js.map