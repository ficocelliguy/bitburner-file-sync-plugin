/**
 * Mocha --require hook. Redirects all `require('vscode')` calls
 * to the in-memory mock under `./mocks/vscode.js`.
 *
 * Must run before any source modules are loaded.
 */

import Module = require('module');
import * as path from 'path';

const mockPath = path.resolve(__dirname, 'mocks', 'vscode.js');

interface ResolvableModule {
    _resolveFilename(request: string, parent: unknown, ...rest: unknown[]): string;
}

const M = Module as unknown as ResolvableModule;
const original = M._resolveFilename;

M._resolveFilename = function (this: unknown, request: string, parent: unknown, ...rest: unknown[]): string {
    if (request === 'vscode') {
        return mockPath;
    }
    return original.call(this, request, parent, ...rest);
};
