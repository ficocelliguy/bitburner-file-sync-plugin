const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Bundled @types packages that ship inside the .vsix so the extension can
// hand absolute paths to them in user tsconfigs. To update versions, change
// the entries in package.json devDependencies and rebuild — this list only
// governs which installed packages get copied into dist/types/.
const BUNDLED_TYPES = ['react', 'react-dom'];

// Mirror `node_modules/@types/<pkg>` into `dist/types/<pkg>` so it ships
// with the .vsix. `node_modules` is .vscodeignore'd, so we have to
// relocate the files into `dist/` where the packager picks them up.
// Idempotent: removes the destination first to handle version upgrades.
function copyBundledTypes() {
	const distTypesDir = path.join(__dirname, 'dist', 'types');
	fs.mkdirSync(distTypesDir, { recursive: true });
	for (const pkg of BUNDLED_TYPES) {
		const src = path.join(__dirname, 'node_modules', '@types', pkg);
		const dest = path.join(distTypesDir, pkg);
		if (!fs.existsSync(src)) {
			throw new Error(
				`Bundled-types source missing: ${src}. Run \`npm install\` to populate node_modules.`
			);
		}
		fs.rmSync(dest, { recursive: true, force: true });
		fs.cpSync(src, dest, { recursive: true });
	}
	console.log(`[bundled-types] copied ${BUNDLED_TYPES.join(', ')} -> dist/types/`);
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		// Initial type copy so a fresh `npm run watch` produces a usable
		// dist/ layout; subsequent runs of `npm install` won't update the
		// copy automatically, but that's acceptable in dev — types are
		// stable and `npm run compile` re-syncs them.
		copyBundledTypes();
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
		copyBundledTypes();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
