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
exports.PathMapper = void 0;
exports.validateRemotePath = validateRemotePath;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class PathMapper {
    config;
    constructor(config) {
        this.config = config;
    }
    mapToRemote(uri) {
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
    validate(remotePath) {
        validateRemotePath(remotePath);
    }
}
exports.PathMapper = PathMapper;
// Shared validation for any remote (Bitburner-side) path, in either
// direction. Used for outgoing paths produced by PathMapper and for incoming
// filenames returned by the server. Defensive against path traversal,
// platform-specific separators, drive letters, control characters, and glob
// meta-characters that would confuse downstream tooling.
function validateRemotePath(remotePath) {
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
//# sourceMappingURL=PathMapper.js.map