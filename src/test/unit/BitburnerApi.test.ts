import { strict as assert } from 'assert';
import { BitburnerApi } from '../../api/BitburnerApi';
import { FakeRpcClient } from './helpers';

suite('BitburnerApi', () => {
    let rpc: FakeRpcClient;
    let api: BitburnerApi;

    setup(() => {
        rpc = new FakeRpcClient();
        api = new BitburnerApi(rpc as unknown as import('../../server/JsonRpcClient').JsonRpcClient);
    });

    suite('pushFile', () => {
        test('sends pushFile with filename, content, and default server', async () => {
            rpc.queueResponse('pushFile', 'OK');
            const result = await api.pushFile('/main.js', 'export const x = 1;');
            assert.equal(result, 'OK');
            assert.equal(rpc.calls.length, 1);
            assert.deepEqual(rpc.calls[0], {
                method: 'pushFile',
                params: { filename: '/main.js', content: 'export const x = 1;', server: 'home' },
            });
        });

        test('honors a server override when one is provided', async () => {
            rpc.queueResponse('pushFile', 'OK');
            await api.pushFile('/main.js', 'x', 'n00dles');
            assert.equal((rpc.calls[0].params as { server: string }).server, 'n00dles');
        });

        test('uses the default server passed to the constructor', async () => {
            const customRpc = new FakeRpcClient();
            customRpc.queueResponse('pushFile', 'OK');
            const customApi = new BitburnerApi(
                customRpc as unknown as import('../../server/JsonRpcClient').JsonRpcClient,
                'foodnstuff'
            );
            await customApi.pushFile('/a.js', 'x');
            assert.equal((customRpc.calls[0].params as { server: string }).server, 'foodnstuff');
        });
    });

    suite('getFile', () => {
        test('returns content from the RPC layer', async () => {
            rpc.queueResponse('getFile', 'file contents');
            const result = await api.getFile('/main.js');
            assert.equal(result, 'file contents');
            assert.deepEqual(rpc.calls[0], {
                method: 'getFile',
                params: { filename: '/main.js', server: 'home' },
            });
        });

        test('honors server override', async () => {
            rpc.queueResponse('getFile', '');
            await api.getFile('/x.js', 'other');
            assert.equal((rpc.calls[0].params as { server: string }).server, 'other');
        });
    });

    suite('deleteFile', () => {
        test('sends deleteFile with filename and default server', async () => {
            rpc.queueResponse('deleteFile', 'OK');
            const result = await api.deleteFile('/main.js');
            assert.equal(result, 'OK');
            assert.equal(rpc.calls.length, 1);
            assert.deepEqual(rpc.calls[0], {
                method: 'deleteFile',
                params: { filename: '/main.js', server: 'home' },
            });
        });

        test('honors a server override when one is provided', async () => {
            rpc.queueResponse('deleteFile', 'OK');
            await api.deleteFile('/main.js', 'n00dles');
            assert.equal((rpc.calls[0].params as { server: string }).server, 'n00dles');
        });

        test('propagates errors from the RPC layer', async () => {
            rpc.queueError('deleteFile', new Error('file not found'));
            await assert.rejects(api.deleteFile('/missing.js'), /file not found/);
        });
    });

    suite('getFileNames', () => {
        test('returns the array from the RPC layer', async () => {
            rpc.queueResponse('getFileNames', ['/a.js', '/b.js']);
            const names = await api.getFileNames();
            assert.deepEqual(names, ['/a.js', '/b.js']);
            assert.deepEqual(rpc.calls[0], {
                method: 'getFileNames',
                params: { server: 'home' },
            });
        });

        test('passes a server override through', async () => {
            rpc.queueResponse('getFileNames', []);
            await api.getFileNames('other');
            assert.equal((rpc.calls[0].params as { server: string }).server, 'other');
        });
    });

    suite('getAllFiles', () => {
        test('calls getAllFiles without parameters', async () => {
            rpc.queueResponse('getAllFiles', [{ filename: '/a.js', content: 'x', server: 'home' }]);
            const result = await api.getAllFiles();
            assert.equal(result.length, 1);
            assert.deepEqual(rpc.calls[0], { method: 'getAllFiles', params: undefined });
        });
    });

    suite('getDefinitionFile', () => {
        test('calls getDefinitionFile without parameters', async () => {
            rpc.queueResponse('getDefinitionFile', 'declare module ...');
            const result = await api.getDefinitionFile();
            assert.equal(result, 'declare module ...');
            assert.deepEqual(rpc.calls[0], { method: 'getDefinitionFile', params: undefined });
        });
    });

    suite('calculateRam', () => {
        test('sends calculateRam with filename and default server, returns the number', async () => {
            rpc.queueResponse('calculateRam', 3.75);
            const result = await api.calculateRam('/main.js');
            assert.equal(result, 3.75);
            assert.deepEqual(rpc.calls[0], {
                method: 'calculateRam',
                params: { filename: '/main.js', server: 'home' },
            });
        });

        test('honors a server override when one is provided', async () => {
            rpc.queueResponse('calculateRam', 0);
            await api.calculateRam('/main.js', 'n00dles');
            assert.equal((rpc.calls[0].params as { server: string }).server, 'n00dles');
        });

        test('propagates errors from the RPC layer (e.g. file not found)', async () => {
            rpc.queueError('calculateRam', new Error('File not found'));
            await assert.rejects(api.calculateRam('/missing.js'), /File not found/);
        });
    });

    test('propagates errors raised by the RPC layer', async () => {
        rpc.queueError('pushFile', new Error('boom'));
        await assert.rejects(api.pushFile('/x.js', 'x'), /boom/);
    });
});
