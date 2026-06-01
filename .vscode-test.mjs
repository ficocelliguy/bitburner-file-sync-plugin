import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	// Integration tests only — unit tests live in `out/test/unit/` and run
	// via `npm run test:unit` against a mocked vscode module.
	files: 'out/test/*.test.js',
});
