"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const BitburnerApi_1 = require("../../api/BitburnerApi");
const helpers_1 = require("./helpers");
suite('BitburnerApi', () => {
    let rpc;
    let api;
    setup(() => {
        rpc = new helpers_1.FakeRpcClient();
        api = new BitburnerApi_1.BitburnerApi(rpc);
    });
    suite('pushFile', () => {
        test('sends pushFile with filename, content, and default server', async () => {
            rpc.queueResponse('pushFile', 'OK');
            const result = await api.pushFile('/main.js', 'export const x = 1;');
            assert_1.strict.equal(result, 'OK');
            assert_1.strict.equal(rpc.calls.length, 1);
            assert_1.strict.deepEqual(rpc.calls[0], {
                method: 'pushFile',
                params: { filename: '/main.js', content: 'export const x = 1;', server: 'home' },
            });
        });
        test('honors a server override when one is provided', async () => {
            rpc.queueResponse('pushFile', 'OK');
            await api.pushFile('/main.js', 'x', 'n00dles');
            assert_1.strict.equal(rpc.calls[0].params.server, 'n00dles');
        });
        test('uses the default server passed to the constructor', async () => {
            const customRpc = new helpers_1.FakeRpcClient();
            customRpc.queueResponse('pushFile', 'OK');
            const customApi = new BitburnerApi_1.BitburnerApi(customRpc, 'foodnstuff');
            await customApi.pushFile('/a.js', 'x');
            assert_1.strict.equal(customRpc.calls[0].params.server, 'foodnstuff');
        });
    });
    suite('getFile', () => {
        test('returns content from the RPC layer', async () => {
            rpc.queueResponse('getFile', 'file contents');
            const result = await api.getFile('/main.js');
            assert_1.strict.equal(result, 'file contents');
            assert_1.strict.deepEqual(rpc.calls[0], {
                method: 'getFile',
                params: { filename: '/main.js', server: 'home' },
            });
        });
        test('honors server override', async () => {
            rpc.queueResponse('getFile', '');
            await api.getFile('/x.js', 'other');
            assert_1.strict.equal(rpc.calls[0].params.server, 'other');
        });
    });
    suite('deleteFile', () => {
        test('sends deleteFile with filename and default server', async () => {
            rpc.queueResponse('deleteFile', 'OK');
            const result = await api.deleteFile('/main.js');
            assert_1.strict.equal(result, 'OK');
            assert_1.strict.equal(rpc.calls.length, 1);
            assert_1.strict.deepEqual(rpc.calls[0], {
                method: 'deleteFile',
                params: { filename: '/main.js', server: 'home' },
            });
        });
        test('honors a server override when one is provided', async () => {
            rpc.queueResponse('deleteFile', 'OK');
            await api.deleteFile('/main.js', 'n00dles');
            assert_1.strict.equal(rpc.calls[0].params.server, 'n00dles');
        });
        test('propagates errors from the RPC layer', async () => {
            rpc.queueError('deleteFile', new Error('file not found'));
            await assert_1.strict.rejects(api.deleteFile('/missing.js'), /file not found/);
        });
    });
    suite('getFileNames', () => {
        test('returns the array from the RPC layer', async () => {
            rpc.queueResponse('getFileNames', ['/a.js', '/b.js']);
            const names = await api.getFileNames();
            assert_1.strict.deepEqual(names, ['/a.js', '/b.js']);
            assert_1.strict.deepEqual(rpc.calls[0], {
                method: 'getFileNames',
                params: { server: 'home' },
            });
        });
        test('passes a server override through', async () => {
            rpc.queueResponse('getFileNames', []);
            await api.getFileNames('other');
            assert_1.strict.equal(rpc.calls[0].params.server, 'other');
        });
    });
    suite('getAllFiles', () => {
        test('calls getAllFiles without parameters', async () => {
            rpc.queueResponse('getAllFiles', [{ filename: '/a.js', content: 'x', server: 'home' }]);
            const result = await api.getAllFiles();
            assert_1.strict.equal(result.length, 1);
            assert_1.strict.deepEqual(rpc.calls[0], { method: 'getAllFiles', params: undefined });
        });
    });
    suite('getDefinitionFile', () => {
        test('calls getDefinitionFile without parameters', async () => {
            rpc.queueResponse('getDefinitionFile', 'declare module ...');
            const result = await api.getDefinitionFile();
            assert_1.strict.equal(result, 'declare module ...');
            assert_1.strict.deepEqual(rpc.calls[0], { method: 'getDefinitionFile', params: undefined });
        });
    });
    test('propagates errors raised by the RPC layer', async () => {
        rpc.queueError('pushFile', new Error('boom'));
        await assert_1.strict.rejects(api.pushFile('/x.js', 'x'), /boom/);
    });
});
//# sourceMappingURL=BitburnerApi.test.js.map