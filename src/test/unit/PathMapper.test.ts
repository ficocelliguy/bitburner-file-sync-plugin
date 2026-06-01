import { strict as assert } from 'assert';
import { PathMapper, validateRemotePath } from '../../sync/PathMapper';
import { Configuration } from '../../config/Configuration';
import * as vscodeMock from './mocks/vscode';

const { Uri, _reset, _setWorkspaceFolders, _setConfig } = vscodeMock;

suite('PathMapper', () => {
    let mapper: PathMapper;

    setup(() => {
        _reset();
        mapper = new PathMapper(new Configuration());
    });

    test('maps a file in the workspace root to a leading-slash remote path', () => {
        _setWorkspaceFolders(['/workspace']);
        const uri = Uri.file('/workspace/script.js');
        assert.equal(mapper.mapToRemote(uri), '/script.js');
    });

    test('maps a nested file using forward slashes', () => {
        _setWorkspaceFolders(['/workspace']);
        const uri = Uri.file('/workspace/src/lib/utils.js');
        assert.equal(mapper.mapToRemote(uri), '/src/lib/utils.js');
    });

    test('normalises Windows backslashes to forward slashes', () => {
        _setWorkspaceFolders(['C:\\workspace']);
        const uri = Uri.file('C:\\workspace\\src\\script.js');
        assert.equal(mapper.mapToRemote(uri), '/src/script.js');
    });

    test('throws when the file is outside any workspace folder', () => {
        _setWorkspaceFolders(['/workspace']);
        const uri = Uri.file('/elsewhere/script.js');
        assert.throws(() => mapper.mapToRemote(uri), /not in a workspace folder/);
    });

    test('throws when there are no workspace folders at all', () => {
        const uri = Uri.file('/anywhere/script.js');
        assert.throws(() => mapper.mapToRemote(uri), /not in a workspace folder/);
    });

    test('rejects glob meta-characters in remote path', () => {
        _setWorkspaceFolders(['/workspace']);
        const cases = [
            '/workspace/file*.js',
            '/workspace/file?.js',
            '/workspace/[abc].js',
        ];
        for (const p of cases) {
            assert.throws(() => mapper.mapToRemote(Uri.file(p)), /Invalid characters/, `expected ${p} to fail`);
        }
    });

    test('rejects path traversal segments', () => {
        _setWorkspaceFolders(['/workspace']);
        const uri = Uri.file('/workspace/../escape.js');
        // path.relative collapses '..' — we have to inject a literal '..'
        // by using a sibling workspace path that produces traversal.
        _setWorkspaceFolders(['/workspace/inner']);
        const escaping = Uri.file('/workspace/sibling/file.js');
        assert.throws(() => mapper.mapToRemote(escaping), /not in a workspace folder/);

        // Direct check: any path containing ".." must be rejected by the validator.
        // We exercise the validator via mapToRemote with a crafted workspace folder layout
        // where the relative path contains ".." (only possible when the file is outside
        // the folder, which already triggers the workspace check). To cover the validator
        // directly, we assert via the inner check below.
        const mapperAny = mapper as unknown as { validate: (p: string) => void };
        assert.throws(() => mapperAny.validate('/foo/../bar'), /Path traversal not allowed/);
        // Silence "uri unused" linter possibility.
        void uri;
    });

    test('rejects double slashes', () => {
        const mapperAny = mapper as unknown as { validate: (p: string) => void };
        assert.throws(() => mapperAny.validate('/foo//bar.js'), /Double slashes not allowed/);
    });

    test('handles a workspace folder whose path itself contains spaces', () => {
        _setWorkspaceFolders(['/work space']);
        const uri = Uri.file('/work space/foo.js');
        assert.equal(mapper.mapToRemote(uri), '/foo.js');
    });

    suite('syncDirectory', () => {
        test('strips the configured sync directory from the remote path', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const uri = Uri.file('/workspace/src/foo.js');
            assert.equal(mapper.mapToRemote(uri), '/foo.js');
        });

        test('preserves subdirectories under the sync directory', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const uri = Uri.file('/workspace/src/lib/utils.js');
            assert.equal(mapper.mapToRemote(uri), '/lib/utils.js');
        });

        test('throws when the file is outside the sync directory', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', 'src');
            const uri = Uri.file('/workspace/outside.js');
            assert.throws(() => mapper.mapToRemote(uri), /outside the sync directory/);
        });

        test('normalises leading and trailing slashes on the configured directory', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', '/src/');
            const uri = Uri.file('/workspace/src/foo.js');
            assert.equal(mapper.mapToRemote(uri), '/foo.js');
        });

        test('treats "/" the same as the workspace root', () => {
            _setWorkspaceFolders(['/workspace']);
            _setConfig('bitburnerSync', 'syncDirectory', '/');
            const uri = Uri.file('/workspace/foo.js');
            assert.equal(mapper.mapToRemote(uri), '/foo.js');
        });
    });
});

suite('validateRemotePath', () => {
    test('accepts ordinary forward-slash paths', () => {
        assert.doesNotThrow(() => validateRemotePath('/foo.js'));
        assert.doesNotThrow(() => validateRemotePath('/nested/dir/file.ts'));
        assert.doesNotThrow(() => validateRemotePath('no-leading-slash.js'));
    });

    test('rejects empty strings', () => {
        assert.throws(() => validateRemotePath(''), /Empty remote path/);
    });

    test('rejects path traversal segments', () => {
        assert.throws(() => validateRemotePath('../escape.js'), /Path traversal/);
        assert.throws(() => validateRemotePath('/a/../b.js'), /Path traversal/);
        assert.throws(() => validateRemotePath('/../etc/passwd'), /Path traversal/);
    });

    test('allows ".." inside a segment name (only segments equal to ".." are rejected)', () => {
        // Legitimate filenames with two adjacent dots that are NOT a traversal segment.
        assert.doesNotThrow(() => validateRemotePath('foo..bar.js'));
        assert.doesNotThrow(() => validateRemotePath('/my..file.js'));
        assert.doesNotThrow(() => validateRemotePath('/dir/foo..bar'));
        assert.doesNotThrow(() => validateRemotePath('/...weird-but-legal.js'));
    });

    test('rejects backslashes (Windows separator or UNC smuggling)', () => {
        assert.throws(() => validateRemotePath('foo\\bar.js'), /Backslash not allowed/);
        assert.throws(() => validateRemotePath('\\\\server\\share\\file.js'), /Backslash not allowed/);
    });

    test('rejects any colon — drive letters and NTFS alternate-data-stream syntax', () => {
        assert.throws(() => validateRemotePath('C:/Windows/system.ini'), /Colon not allowed/);
        assert.throws(() => validateRemotePath('c:foo.js'), /Colon not allowed/);
        // NTFS ADS smuggling — a server-supplied filename like this must NOT
        // reach vscode.workspace.fs.writeFile, where on Windows it would attach
        // the content to an alternate data stream of `home`.
        assert.throws(() => validateRemotePath('home:secret.js'), /Colon not allowed/);
        assert.throws(() => validateRemotePath('/dir/file:stream.js'), /Colon not allowed/);
        assert.throws(() => validateRemotePath('foo:bar:.js'), /Colon not allowed/);
    });

    test('rejects control characters including NUL, DEL, and C1 range', () => {
        assert.throws(() => validateRemotePath('foo\x00.js'), /Control character/);
        assert.throws(() => validateRemotePath('foo\nbar.js'), /Control character/);
        // DEL — would erase the preceding character in many terminals.
        assert.throws(() => validateRemotePath('foo\x7f.js'), /Control character/);
        // C1 controls — undefined rendering, similarly unsafe in modals.
        assert.throws(() => validateRemotePath('foo\x80.js'), /Control character/);
        assert.throws(() => validateRemotePath('foo\x9f.js'), /Control character/);
    });

    test('rejects glob meta-characters', () => {
        assert.throws(() => validateRemotePath('foo*.js'), /Invalid characters/);
        assert.throws(() => validateRemotePath('foo?.js'), /Invalid characters/);
        assert.throws(() => validateRemotePath('[abc].js'), /Invalid characters/);
    });

    test('rejects double slashes', () => {
        assert.throws(() => validateRemotePath('/foo//bar.js'), /Double slashes/);
    });
});
