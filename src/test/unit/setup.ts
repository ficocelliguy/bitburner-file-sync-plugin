/**
 * Mocha --require hook. Redirects all `require('vscode')` calls
 * to the in-memory mock under `./mocks/vscode.js`.
 *
 * Must run before any source modules are loaded.
 */

import Module = require('module');
import * as fs from 'fs';
import * as path from 'path';

// Compiled runs land at out/test/unit/setup.js next to mocks/vscode.js;
// ts-node runs land at src/test/unit/setup.ts next to mocks/vscode.ts.
const jsMock = path.resolve(__dirname, 'mocks', 'vscode.js');
const tsMock = path.resolve(__dirname, 'mocks', 'vscode.ts');
const mockPath = fs.existsSync(jsMock) ? jsMock : tsMock;

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
