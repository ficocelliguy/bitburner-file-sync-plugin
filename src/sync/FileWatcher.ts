import * as vscode from 'vscode';
import type { SyncEngine } from './SyncEngine';
import type { Configuration } from '../config/Configuration';

export class FileWatcher implements vscode.Disposable {
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(
        private readonly syncEngine: SyncEngine,
        private readonly config: Configuration
    ) {}

    start(): void {
        this.stop();

        // If the user has explicitly set fileExtensions to [], they want
        // nothing synced. Don't create the file watcher or the save listener
        // — both would be no-ops at best, confusing at worst.
        if (this.config.fileExtensions.length === 0) {
            return;
        }

        // Scope to the primary workspace folder. A bare-string glob would
        // watch every folder in a multi-root workspace, but downloads only
        // ever land in folder[0] and the activation warning promises the
        // sync stays inside it.
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            return;
        }

        const pattern = new vscode.RelativePattern(primary, this.config.fileGlob);
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidChange((uri) => {
            this.syncEngine.handleFileChange(uri);
        }, null, this.disposables);

        this.fileWatcher.onDidCreate((uri) => {
            this.syncEngine.handleFileChange(uri);
        }, null, this.disposables);

        // Note: we intentionally do NOT subscribe to onDidDelete. Bitburner
        // sync is one-way (local → remote) for pushes; deleting a file
        // locally — whether intentional, a rename (which fires delete+create),
        // a branch switch, or an external process — must not propagate to
        // the game. Users who want a file gone on both sides delete it on
        // both sides themselves.

        // Also hook into save events for reliable detection
        const saveWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
            if (this.matchesExtensions(doc.uri) && this.isInSyncDirectory(doc.uri)) {
                this.syncEngine.handleFileChange(doc.uri);
            }
        });
        this.disposables.push(saveWatcher);
    }

    private isInSyncDirectory(uri: vscode.Uri): boolean {
        // Save events fire for documents from any workspace folder. Filter
        // here to the primary folder (and the configured syncDirectory inside
        // it) so we don't try to push a file that's already out of scope.
        const primary = vscode.workspace.workspaceFolders?.[0];
        if (!primary) {
            return false;
        }
        const filePath = uri.fsPath.replace(/\\/g, '/');
        const folderPath = primary.uri.fsPath.replace(/\\/g, '/');
        const syncDir = this.config.syncDirectory;
        const expectedPrefix = syncDir ? `${folderPath}/${syncDir}/` : `${folderPath}/`;
        return filePath.startsWith(expectedPrefix);
    }

    stop(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
        this.disposables.forEach(d => d.dispose());
        this.disposables.length = 0;
    }

    private matchesExtensions(uri: vscode.Uri): boolean {
        const lastDot = uri.fsPath.lastIndexOf('.');
        // No dot in the filename → no extension. Reject explicitly: the prior
        // implementation matched the whole path via substring(-1).
        if (lastDot < 0) {
            return false;
        }
        const ext = uri.fsPath.slice(lastDot).toLowerCase();
        return this.config.fileExtensions.includes(ext);
    }

    dispose(): void {
        this.stop();
    }
}
