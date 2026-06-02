import * as path from 'path';
import * as vscode from 'vscode';
import type { Configuration } from '../config/Configuration';

export class PathMapper {
    constructor(private readonly config: Configuration) {}

    mapToRemote(uri: vscode.Uri): string {
        // Always resolve against the primary (first) workspace folder. In a
        // multi-root workspace, files in folders 2+ are out of scope — sync
        // is documented as primary-folder-only and the activation warning
        // tells the user as much.
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            throw new Error(`File ${uri.fsPath} is not in a workspace folder`);
        }

        const rootRel = path.relative(primary.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        if (rootRel === '..' || rootRel.startsWith('../') || path.isAbsolute(rootRel)) {
            throw new Error(`File ${uri.fsPath} is not in the primary workspace folder (${primary.uri.fsPath})`);
        }

        const syncDir = this.config.syncDirectory;
        let relativePath = rootRel;
        if (syncDir) {
            if (rootRel !== syncDir && !rootRel.startsWith(syncDir + '/')) {
                throw new Error(`File ${uri.fsPath} is outside the sync directory '${syncDir}'`);
            }
            relativePath = rootRel.slice(syncDir.length);
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
