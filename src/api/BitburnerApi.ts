import type { JsonRpcClient } from '../server/JsonRpcClient';
import type {
    FileInfo,
    PushFileParams,
    GetFileParams,
    DeleteFileParams,
    GetFileNamesParams,
    CalculateRamParams,
} from '../types';

export class BitburnerApi {
    constructor(
        private readonly rpc: JsonRpcClient,
        private readonly defaultServer = 'home'
    ) {}

    async pushFile(filename: string, content: string, server?: string): Promise<string> {
        const params: PushFileParams = {
            filename,
            content,
            server: server ?? this.defaultServer
        };
        return this.rpc.request<string>('pushFile', params);
    }

    async getFile(filename: string, server?: string): Promise<string> {
        const params: GetFileParams = {
            filename,
            server: server ?? this.defaultServer
        };
        return this.rpc.request<string>('getFile', params);
    }

    async deleteFile(filename: string, server?: string): Promise<string> {
        const params: DeleteFileParams = {
            filename,
            server: server ?? this.defaultServer
        };
        return this.rpc.request<string>('deleteFile', params);
    }

    async getFileNames(server?: string): Promise<string[]> {
        const params: GetFileNamesParams = {
            server: server ?? this.defaultServer
        };
        return this.rpc.request<string[]>('getFileNames', params);
    }

    async getAllFiles(): Promise<FileInfo[]> {
        return this.rpc.request<FileInfo[]>('getAllFiles');
    }

    async getDefinitionFile(): Promise<string> {
        return this.rpc.request<string>('getDefinitionFile');
    }

    async calculateRam(filename: string, server?: string): Promise<number> {
        const params: CalculateRamParams = {
            filename,
            server: server ?? this.defaultServer
        };
        return this.rpc.request<number>('calculateRam', params);
    }
}
