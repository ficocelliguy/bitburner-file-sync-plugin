# Bitburner File Sync Plugin

A VS Code extension that syncs your local script files to [Bitburner](https://github.com/bitburner-official/bitburner-src) via its Remote File API. It allows you to write scripts in VS Code with full editor support and have them automatically pushed to the game over WebSocket.

## Features

- **Auto-sync on save** — files are pushed to Bitburner whenever you save
- **Sync all files** — push every matching file in your workspace at once on command
- **Type definitions** — automatically downloads `NetscriptDefinitions.d.ts` for full autocomplete and type checking
- **Status bar indicator** — shows connection state (stopped, waiting, connected)
- **Configurable file types** — choose which extensions to sync (`.js`, `.ts`, `.tsx`, `.py`, etc.)

## Setup

1 - Install the extension in VS Code. On first install the extension auto-opens its settings page so you can review per-project options.

2 - Open the Command Palette (`Ctrl+Shift+P`) and run **Bitburner: Start Sync Server**.

3 - In Bitburner, go to **Options > Remote API** and enter the port (default `12525`), then click `Connect`. The status bar will show "Connected" once linked.

4 - The first time you connect to Bitburner from a workspace, the extension offers to download in-game scripts you don't have locally — or, if the game has nothing new, offers to push up any local scripts the game is missing. You can trigger either operation manually at any time via **Bitburner: Download Files from Server** or **Bitburner: Sync All Files**.

5 - All your files will be synced into Bitburner on save.


If you have any questions, ask on the [official Discord](https://discord.gg/TFc3hKD) or on the [issues page for this plugin](https://github.com/ficocelliguy/bitburner-file-sync-plugin/issues).

## Downloading scripts from Bitburner

`Bitburner: Download Files from Server` pulls every script whose extension is in `bitburnerSync.fileExtensions`. Files unique to the server (not present locally) are downloaded automatically. If any of the server's files would *overwrite* an existing local file, the extension prompts before clobbering — you can confirm or decline; declining keeps your local conflicts intact but the brand-new files are still downloaded.

`Bitburner: Download Files Matching Pattern...` is the same operation narrowed to a glob you type in (e.g. `**/*.js`, `scripts/**`, `lib/utils.js`). The extension's `fileExtensions` filter still applies, so the result is the intersection of "extension allowed" and "matches your pattern." Pattern syntax matches the [`minimatch`](https://github.com/isaacs/minimatch) rules described under [Pattern syntax](#pattern-syntax) — in particular, `*` does not cross `/`, so use `**/*.js` (not `*.js`) to match `.js` files anywhere in the tree.

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and search for:

| Command | Description                                                  |
|---|--------------------------------------------------------------|
| `Bitburner: Start Sync Server` | Start the WebSocket server and begin listening for Bitburner |
| `Bitburner: Stop Sync Server` | Stop the server and disconnect                               |
| `Bitburner: Sync Current File` | Push the active editor file to Bitburner                     |
| `Bitburner: Sync All Files` | Push all matching workspace files to Bitburner               |
| `Bitburner: Download Files from Server` | Pull all files to the workspace from Bitburner               |
| `Bitburner: Download Files Matching Pattern...` | Prompt for a glob and pull only files whose remote path matches |
| `Bitburner: Download Type Definitions` | Download `NetscriptDefinitions.d.ts` to your workspace root  |

## Extension Settings

| Setting | Default                                                          | Description |
|---|------------------------------------------------------------------|---|
| `bitburnerSync.port` | `12525`                                                          | WebSocket server port |
| `bitburnerSync.autoSync` | `true`                                                           | Automatically push files on save |
| `bitburnerSync.targetServer` | `"home"`                                                         | Target server name in Bitburner |
| `bitburnerSync.fileExtensions` | `[".js", ".ts", ".jsx", ".tsx", ".txt", ".json", ".css", ".py"]` | File extensions to sync |
| `bitburnerSync.showNotifications` | `true`                                                           | Show notifications when files are synced |
| `bitburnerSync.autoStart` | `false`                                                          | Start the sync server automatically when VS Code opens |
| `bitburnerSync.autoDownloadDefinitions` | `true`                                                           | Download type definitions when Bitburner connects |
| `bitburnerSync.syncDirectory` | `""`                                                             | Workspace-relative directory used for both upload and download. Files inside this directory are pushed into Bitburner relative to it (e.g. with `"src"`, `src/foo.js` becomes `/foo.js` on `home`), and files pulled from the game land under this same directory. An empty string or `"/"` means the workspace root. |
| `bitburnerSync.exclude` | `[]`                                                             | Workspace-relative glob patterns to skip when syncing, *in addition to* a hardcoded baseline (see [Excluding files](#excluding-files) below). |

### How to edit the configuration

These settings live under `bitburnerSync` in VS Code. To edit them:

1. Open the Command Palette (`Ctrl+Shift+P`) and run **Preferences: Open Settings (UI)**, or press `Ctrl+,`.
2. In the search bar at the top, type `bitburnerSync` to filter to just this extension's settings.
3. Edit any value inline. Changes are saved automatically.
4. Use the gear icon at the top right of the settings tab to switch between **User** (applies to every workspace) and **Workspace** (applies only to the current project) scopes.

Individual workspace settings are stored in `.vscode/settings.json` inside your project and override your global user settings — useful if you want a different `syncDirectory` per project.

## Excluding files

By default, the extension syncs every workspace file whose extension is in `bitburnerSync.fileExtensions` and that lives under `bitburnerSync.syncDirectory`. The same `fileExtensions` filter applies in reverse: `Bitburner: Download Files from Server` only pulls down files whose extension is in the list.

```md
- **`bitburnerSync.exclude`.** Your own list of additional workspace-relative glob patterns.
- **Baseline:** These paths are *always* excluded:
  - `NetscriptDefinitions.d.ts` (the local type-hint file)
  - `NetscriptGlobals.d.ts` (the auto-generated global-scope shim for the type-hint file)
  - `.git/**`
  - `.gitignore`
  - `.vscode/**`
  - `node_modules/**`
```
Excluded files are silently ignored on auto-save and on `Bitburner: Sync All Files`. If you run `Bitburner: Sync Current File` against one, the extension logs `Excluded from sync: ...` to the **Bitburner Sync** output channel and does nothing.

### Pattern syntax

The extension uses [`minimatch`](https://github.com/isaacs/minimatch) for exclude matching — the same glob semantics VS Code's own `findFiles` uses.

| Token | Meaning |
|---|---|
| `**`  | Any characters, including `/`. Spans path segments. |
| `**/` | Zero or more leading path segments. `**/foo` matches `foo` at the root *and* `bar/foo`. |
| `*`   | Any characters except `/`. Stays within one segment. |
| `?`   | A single non-`/` character. |
| `{a,b}` | Brace expansion. `build/{js,ts}/**` matches both `build/js/...` and `build/ts/...`. |
| `[abc]` | Character class. `file[123].js` matches `file1.js`, `file2.js`, `file3.js`. |
| anything else | Literal. Regex metacharacters are escaped automatically. |

Forward slashes (`/`) are the path separator. Backslashes you paste in (e.g. `node_modules\foo`) are normalized to forward slashes automatically.

### Examples

```jsonc
{
  "bitburnerSync.exclude": [
    "**/*.test.ts",         // any *.test.ts file at any depth
    "**/*.test.js",
    "node_modules/**",      // everything inside node_modules
    "secrets/api-key.txt",  // one exact file
    "**/scratch/**",        // anything inside any directory named "scratch"
    "build/{js,ts}/**",     // brace expansion: build/js/** AND build/ts/**
    "tmp[0-9].log"          // character class: tmp0.log..tmp9.log
  ]
}
```

Note: `*.js` only matches `.js` files at the workspace root. To exclude `.js` files at any depth, use `**/*.js`.

## Type Definitions

When Bitburner connects (or on demand via the command), the extension downloads `NetscriptDefinitions.d.ts` and sets up `NetscriptGlobals.d.ts` in your workspace root, and creates/updates a `tsconfig.json`, so your editor provides autocomplete and type checking for the Netscript API. Then you can use `NS` (and other Netscript types like `Server`, `AutocompleteData`, `ReactNode`, …) directly in your scripts without importing anything.

For compatibility with the [bitburner-official typescript template](https://github.com/bitburner-official/typescript-template) convention, the extension also adds a `paths` alias so `import { NS } from '@ns'` resolves to the local `NetscriptDefinitions.d.ts`.

`React` and `ReactDOM` are also exposed as ambient globals (matching the in-game runtime), so you can call `React.useState` or use JSX/TSX without importing React.

### How imports are wired up

The generated `tsconfig.json` makes imports between your scripts work the same way in VS Code as they do in Bitburner. Specifically, it sets:

- **`baseUrl`** to your `bitburnerSync.syncDirectory` (or the workspace root when no `syncDirectory` is set). Non-relative imports — e.g. `import { foo } from "utils.js"` from a script anywhere in the sync tree — resolve against this root, matching how Bitburner treats `/utils.js` on `home`.
- **`paths["@ns"]`** to `NetscriptDefinitions.d.ts` (depth-adjusted with `../` when `syncDirectory` is nested) so the d.ts at the workspace root is reachable even though `baseUrl` is inside `syncDirectory`.
- **`paths["@/*"]`** to `./*` (relative to `baseUrl`), giving you an explicit absolute-to-sync-root alias: `import { foo } from "@/lib/utils"` works regardless of how deep the importing file lives.

Both `@ns` and `@/*` are added only if missing — if you've customized either alias the extension won't overwrite it. `baseUrl` is only written for fresh tsconfigs; an existing one keeps whatever value you set.

## Troubleshooting

### A file failed to sync with a "1.0 MB sync limit" error

The extension refuses to push any single file larger than **1 MB**. The cap exists because a script that large is almost always a build artifact, an accidentally-committed binary, or a runaway log — none of which belong in Bitburner. If you're hitting it on a real script, split it into modules; if it's an artifact, add the path (or its directory) to `bitburnerSync.exclude` so it stops trying to sync.

On `Bitburner: Sync All Files`, oversized files are counted in the `N failed` total in the completion notification and each one logs a line to the **Bitburner Sync** output channel with the actual size.

### Type hints aren't working / I got a warning that `tsconfig.json` couldn't be updated

The extension will only rewrite `tsconfig.json` when it parses as strict JSON. If your file contains comments (`//`, `/* */`) or trailing commas — i.e. it's JSONC — the extension leaves it alone to avoid stripping your formatting, and asks you to wire the type definitions in manually.

To enable type hints, make sure `NetscriptDefinitions.d.ts` and `NetscriptGlobals.d.ts` are both in the `files` array at the top level of your `tsconfig.json`, and that `compilerOptions.paths` contains the `@ns` alias. A minimal working config looks like:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "jsx": "react",
    "baseUrl": ".",
    "paths": {
      "@ns": ["NetscriptDefinitions.d.ts"],
      "@/*": ["./*"]
    }
  },
  "include": ["**/*"],
  "files": ["NetscriptDefinitions.d.ts", "NetscriptGlobals.d.ts"]
}
```

If `bitburnerSync.syncDirectory` is set (e.g. `"src"`), point `baseUrl` at it and prefix the `@ns` target with one `../` per directory level so it still reaches the d.ts at the workspace root:

```jsonc
"baseUrl": "src",
"paths": {
  "@ns": ["../NetscriptDefinitions.d.ts"],
  "@/*": ["./*"]
}
```

If you already have a `files` array, append both entries to it:

```jsonc
"files": [
  "some/other/entry.ts",
  "NetscriptDefinitions.d.ts",
  "NetscriptGlobals.d.ts"
]
```

If you don't have a `files` array at all, add one at the top level of the config object (alongside `compilerOptions` and `include`). Likewise, if `compilerOptions.paths` doesn't yet exist, add it with the `@ns` entry.

`NetscriptGlobals.d.ts` is auto-generated from `NetscriptDefinitions.d.ts` whenever the extension downloads the definitions. If it's missing from your workspace, run **Bitburner: Download Type Definitions** (which regenerates it) or reload VS Code (the extension regenerates it on activation when the definitions file is present).

After saving the file, reload the window (`Ctrl+Shift+P` → **Developer: Reload Window**) so the TypeScript server picks up the change.

### VS Code can't resolve imports between my scripts

If VS Code red-squigglies an `import { foo } from "utils.js"` (or `"@/lib/utils"`, or `"@ns"`) even though the file exists and runs fine in Bitburner, the cause is almost always a mismatch between the tsconfig's `baseUrl` / `paths` and your `bitburnerSync.syncDirectory`. Run through this checklist in your `tsconfig.json`:

1. **`baseUrl` matches `syncDirectory`.** If `bitburnerSync.syncDirectory` is `"src"`, `compilerOptions.baseUrl` should be `"src"`. If `syncDirectory` is empty (workspace root), `baseUrl` should be `"."`. With a wrong `baseUrl`, bare imports like `import "utils.js"` look in the wrong folder.
2. **`@ns` climbs back to the workspace root.** The d.ts files (`NetscriptDefinitions.d.ts`, `NetscriptGlobals.d.ts`) always live at the workspace root, but `paths` entries are resolved relative to `baseUrl`. So when `baseUrl` is a subdirectory, `@ns` must use `../`:
   - `syncDirectory: ""` → `"@ns": ["NetscriptDefinitions.d.ts"]`
   - `syncDirectory: "src"` → `"@ns": ["../NetscriptDefinitions.d.ts"]`
   - `syncDirectory: "src/scripts"` → `"@ns": ["../../NetscriptDefinitions.d.ts"]`
3. **`@/*` is relative to `baseUrl`.** `"@/*": ["./*"]` should work in every case — together with the right `baseUrl`, `import "@/lib/x"` resolves to the sync directory's `lib/x`.
4. **The `files` array names both d.ts files at workspace-root paths.** `files` is resolved relative to the tsconfig's directory (not `baseUrl`), so they stay as `"NetscriptDefinitions.d.ts"` and `"NetscriptGlobals.d.ts"` regardless of `syncDirectory`.

If you changed `bitburnerSync.syncDirectory` after the extension first wrote your `tsconfig.json`, the extension does *not* retroactively rewrite `baseUrl` (to avoid stomping on customizations) — update it by hand or delete the file and run **Bitburner: Download Type Definitions** to regenerate it.

After saving the file, reload the window (`Ctrl+Shift+P` → **Developer: Reload Window**) so the TypeScript server picks up the new resolution rules.

### Where did the warning go?

Ouput from the plugin is also written to the **Bitburner Sync** output channel. Open it via **View → Output**, then pick "Bitburner Sync" from the dropdown.
