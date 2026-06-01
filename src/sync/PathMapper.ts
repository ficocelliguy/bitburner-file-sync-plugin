import * as path from 'path';
import * as vscode from 'vscode';
import type { Configuration } from '../config/Configuration';

export class PathMapper {
    constructor(private readonly config: Configuration) {}

    mapToRemote(uri: vscode.Uri): string {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            throw new Error(`File ${uri.fsPath} is not in a workspace folder`);
        }

        const syncDir = this.config.syncDirectory;
        const baseFsPath = syncDir
            ? path.join(workspaceFolder.uri.fsPath, syncDir)
            : workspaceFolder.uri.fsPath;

        let relativePath = path.relative(baseFsPath, uri.fsPath);
        relativePath = relativePath.replace(/\\/g, '/');

        if (relativePath === '..' || relativePath.startsWith('../')) {
            throw new Error(`File ${uri.fsPath} is outside the sync directory '${syncDir}'`);
        }

        if (!relativePath.startsWith('/')) {
            relativePath = '/' + relativePath;
        }

        this.validate(relativePath);
        return relativePath;
    }

    private validate(remotePath: string): void {
        validateRemotePath(remotePath);
    }
}

// Shared validation for any remote (Bitburner-side) path, in either
// direction. Used for outgoing paths produced by PathMapper and for incoming
// filenames returned by the server. Defensive against path traversal,
// platform-specific separators, drive letters, control characters, and glob
// meta-characters that would confuse downstream tooling.
export function validateRemotePath(remotePath: string): void {
    if (!remotePath) {
        throw new Error('Empty remote path');
    }
    // Reject C0 controls (\x00-\x1f), DEL (\x7f), and C1 controls
    // (\x80-\x9f). DEL erases the preceding character in many terminal/IDE
    // font stacks, so a server-supplied filename containing DEL could
    // mis-render in our overwrite confirmation modal.
    if (/[\x00-\x1f\x7f-\x9f]/.test(remotePath)) {
        throw new Error(`Control character in remote path: ${JSON.stringify(remotePath)}`);
    }
    if (/[*?\[\]]/.test(remotePath)) {
        throw new Error(`Invalid characters in path: ${remotePath}`);
    }
    // Only treat `..` as traversal when it appears as a *complete* path
    // segment. `foo..bar.js` is a legitimate filename, not an escape attempt.
    if (remotePath.split('/').some(seg => seg === '..')) {
        throw new Error(`Path traversal not allowed: ${remotePath}`);
    }
    if (remotePath.includes('\\')) {
        throw new Error(`Backslash not allowed in remote path: ${remotePath}`);
    }
    if (remotePath.includes('//')) {
        throw new Error(`Double slashes not allowed: ${remotePath}`);
    }
    // Reject any colon — not just `^[A-Za-z]:` drive letters. A server-supplied
    // filename like `home:secret.js` would otherwise pass and, on Windows/NTFS,
    // `vscode.workspace.fs.writeFile` writes to an alternate data stream
    // attached to `home`, invisible in Explorer. Bitburner script names never
    // legitimately contain `:`.
    if (remotePath.includes(':')) {
        throw new Error(`Colon not allowed in remote path: ${remotePath}`);
    }
}
