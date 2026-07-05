"use strict";
/**
 * Mocha --require hook. Redirects all `require('vscode')` calls
 * to the in-memory mock under `./mocks/vscode.js`.
 *
 * Must run before any source modules are loaded.
 */
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
const Module = require("module");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Compiled runs land at out/test/unit/setup.js next to mocks/vscode.js;
// ts-node runs land at src/test/unit/setup.ts next to mocks/vscode.ts.
const jsMock = path.resolve(__dirname, 'mocks', 'vscode.js');
const tsMock = path.resolve(__dirname, 'mocks', 'vscode.ts');
const mockPath = fs.existsSync(jsMock) ? jsMock : tsMock;
const M = Module;
const original = M._resolveFilename;
M._resolveFilename = function (request, parent, ...rest) {
    if (request === 'vscode') {
        return mockPath;
    }
    return original.call(this, request, parent, ...rest);
};
//# sourceMappingURL=setup.js.map