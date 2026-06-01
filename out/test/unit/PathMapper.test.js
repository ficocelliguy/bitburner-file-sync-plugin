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
const PathMapper_1 = require("../../sync/PathMapper");
const Configuration_1 = require("../../config/Configuration");
const vscodeMock = __importStar(require("./mocks/vscode"));
const { Uri, _reset, _setWorkspaceFolders, _setConfig } = vscodeMock;
suite('PathMapper', () => {
    let mapper;
    setup(() => {
        _reset();
        mapper = new PathMapper_1.PathMapper(new Configuration_1.Configuration());
    });
    test('maps a file in the workspace root to a leading-slash remote path', () => {
        _setWorkspaceFolders(['/workspace']);
        const uri = Uri.file('/workspace/script.js');
        assert_1.strict.equal(mapper.mapToRemote(uri), '/script.js');
    });
    test('maps a nested file using forward slashes', () => {
        _setWorkspaceFolders(['/workspace']);
        const uri = Uri.file('/workspace/src/lib/utils.js');
        assert_1.strict.equal(mapper.mapToRemote(uri), '/src/lib/utils.js');
    });
    test('normalises Windows backslashes to forward slashes', () => {
        _setWorkspaceFolders(['C:\\workspace']);
        const uri = Uri.file('C:\\workspace\\src\\script.js');
        assert_1.strict.equal(mapper.mapToRemote(uri), '/src/script.js');
    });
    test('throws when the file is outside any workspace folder', () => {
        _setWorkspaceFolders(['/workspace']);
        const uri = Uri.file('/elsewhere/script.js');
        assert_1.strict.throws(() => mapper.mapToRemote(uri), /not in a workspace folder/);
    });
    test('throws when there are no workspace folders at all', () => {
        const uri = Uri.file('/anywhere/script.js');
        assert_1.strict.throws(() => mapper.mapToRemote(uri), /not in a workspace folder/);
    });
    test('rejects glob meta-characters in remote path', () => {
        _setWorkspaceFolders(['/workspace']);
        const cases = [
            '/workspace/file*.js',
            '/workspace/file?.js',
            '/workspace/[abc].js',
        ];
        for (const p of cases) {
            assert_1.strict.throws(() => mapper.mapToRemote(Uri.file(p)), /Invalid characters/, `expected ${p} to fail`);
        }
    });
    test('rejects path traversal segments', () => {
        _setWorkspaceFolders(['/workspace']);
        const uri = Uri.file('/workspace/../escape.js');
        // path.relative collapses '..' — we have to inject a literal '..'
        // by using a sibling workspace path that produces traversal.
        _setWorkspaceFolders(['/workspace/inner']);
        const escaping = Uri.file('/workspace/sibling/file.js');
        assert_1.strict.throws(() => mapper.mapToRemote(escaping), /not in a workspace folder/);
        // Direct check: any path containing ".." must be rejected by the validator.
        // We exercise the validator via mapToRemote with a crafted workspace folder layout
        // where the relative path contains ".." (only possible when the file is outside
        // the folder, which already triggers the workspace check). To cover the validator
        // directly, we assert via the inner check below.
        const mapperAny = mapper;
        assert_1.strict.throws(() => mapperAny.validate('/foo/../bar'), /Path traversal not allowed/);
        // Silence "uri unused" linter possibility.
        void uri;
    });
    test('rejects double slashes', () => {
        const mapperAny = mapper;
        assert_1.strict.throws(() => mapperAny.validate('/foo//bar.js'), /Double slashes not allowed/);
    });
    test('handles a workspace folder whose path itself contains spaces', () => {
        _setWorkspaceFolders(['/work space']);
        const uri = Uri.file('/work space/foo.js');
        assert_1.strict.equal(mapper.mapToRemote(uri), '/foo.js');
    });
    suite('syncDirectory', () => {
        test('strips the configured sync directory from the remote path', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const uri = Uri.file('/workspace/src/foo.js');
            assert_1.strict.equal(mapper.mapToRemote(uri), '/foo.js');
        });
        test('preserves subdirectories under the sync directory', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const uri = Uri.file('/workspace/src/lib/utils.js');
            assert_1.strict.equal(mapper.mapToRemote(uri), '/lib/utils.js');
        });
        test('throws when the file is outside the sync directory', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const uri = Uri.file('/workspace/outside.js');
            assert_1.strict.throws(() => mapper.mapToRemote(uri), /outside the sync directory/);
        });
        test('normalises leading and trailing slashes on the configured directory', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', '/src/');
            const uri = Uri.file('/workspace/src/foo.js');
            assert_1.strict.equal(mapper.mapToRemote(uri), '/foo.js');
        });
        test('treats "/" the same as the workspace root', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', '/');
            const uri = Uri.file('/workspace/foo.js');
            assert_1.strict.equal(mapper.mapToRemote(uri), '/foo.js');
        });
    });
});
suite('validateRemotePath', () => {
    test('accepts ordinary forward-slash paths', () => {
        assert_1.strict.doesNotThrow(() => (0, PathMapper_1.validateRemotePath)('/foo.js'));
        assert_1.strict.doesNotThrow(() => (0, PathMapper_1.validateRemotePath)('/nested/dir/file.ts'));
        assert_1.strict.doesNotThrow(() => (0, PathMapper_1.validateRemotePath)('no-leading-slash.js'));
    });
    test('rejects empty strings', () => {
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)(''), /Empty remote path/);
    });
    test('rejects path traversal segments', () => {
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('../escape.js'), /Path traversal/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('/a/../b.js'), /Path traversal/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('/../etc/passwd'), /Path traversal/);
    });
    test('allows ".." inside a segment name (only segments equal to ".." are rejected)', () => {
        // Legitimate filenames with two adjacent dots that are NOT a traversal segment.
        assert_1.strict.doesNotThrow(() => (0, PathMapper_1.validateRemotePath)('foo..bar.js'));
        assert_1.strict.doesNotThrow(() => (0, PathMapper_1.validateRemotePath)('/my..file.js'));
        assert_1.strict.doesNotThrow(() => (0, PathMapper_1.validateRemotePath)('/dir/foo..bar'));
        assert_1.strict.doesNotThrow(() => (0, PathMapper_1.validateRemotePath)('/...weird-but-legal.js'));
    });
    test('rejects backslashes (Windows separator or UNC smuggling)', () => {
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo\\bar.js'), /Backslash not allowed/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('\\\\server\\share\\file.js'), /Backslash not allowed/);
    });
    test('rejects any colon — drive letters and NTFS alternate-data-stream syntax', () => {
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('C:/Windows/system.ini'), /Colon not allowed/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('c:foo.js'), /Colon not allowed/);
        // NTFS ADS smuggling — a server-supplied filename like this must NOT
        // reach vscode.workspace.fs.writeFile, where on Windows it would attach
        // the content to an alternate data stream of `home`.
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('home:secret.js'), /Colon not allowed/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('/dir/file:stream.js'), /Colon not allowed/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo:bar:.js'), /Colon not allowed/);
    });
    test('rejects control characters including NUL, DEL, and C1 range', () => {
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo\x00.js'), /Control character/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo\nbar.js'), /Control character/);
        // DEL — would erase the preceding character in many terminals.
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo\x7f.js'), /Control character/);
        // C1 controls — undefined rendering, similarly unsafe in modals.
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo\x80.js'), /Control character/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo\x9f.js'), /Control character/);
    });
    test('rejects glob meta-characters', () => {
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo*.js'), /Invalid characters/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('foo?.js'), /Invalid characters/);
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('[abc].js'), /Invalid characters/);
    });
    test('rejects double slashes', () => {
        assert_1.strict.throws(() => (0, PathMapper_1.validateRemotePath)('/foo//bar.js'), /Double slashes/);
    });
});
//# sourceMappingURL=PathMapper.test.js.map