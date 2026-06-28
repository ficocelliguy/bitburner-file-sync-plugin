"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitburnerApi = void 0;
class BitburnerApi {
    rpc;
    defaultServer;
    constructor(rpc, defaultServer = 'home') {
        this.rpc = rpc;
        this.defaultServer = defaultServer;
    }
    async pushFile(filename, content, server) {
        const params = {
            filename,
            content,
            server: server ?? this.defaultServer
        };
        return this.rpc.request('pushFile', params);
    }
    async getFile(filename, server) {
        const params = {
            filename,
            server: server ?? this.defaultServer
        };
        return this.rpc.request('getFile', params);
    }
    async deleteFile(filename, server) {
        const params = {
            filename,
            server: server ?? this.defaultServer
        };
        return this.rpc.request('deleteFile', params);
    }
    async getFileNames(server) {
        const params = {
            server: server ?? this.defaultServer
        };
        return this.rpc.request('getFileNames', params);
    }
    async getAllFiles() {
        return this.rpc.request('getAllFiles');
    }
    async getDefinitionFile() {
        return this.rpc.request('getDefinitionFile');
    }
}
exports.BitburnerApi = BitburnerApi;
//# sourceMappingURL=BitburnerApi.js.map