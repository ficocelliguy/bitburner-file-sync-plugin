export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: unknown;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: unknown;
    error?: JsonRpcError;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

export interface FileInfo {
    filename: string;
    content: string;
    server: string;
}

export interface PushFileParams {
    filename: string;
    content: string;
    server: string;
}

export interface GetFileParams {
    filename: string;
    server: string;
}

export interface DeleteFileParams {
    filename: string;
    server: string;
}

export interface GetFileNamesParams {
    server: string;
}

export interface CalculateRamParams {
    filename: string;
    server: string;
}

export type ConnectionState = 'stopped' | 'waiting' | 'connected' | 'stale' | 'error';
