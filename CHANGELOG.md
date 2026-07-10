# Change Log

## 0.1.3
- React / ReactDOM types are now inlined into `NetscriptGlobals.d.ts` in the workspace instead of referenced via absolute paths into the extension install directory. Previously every extension upgrade broke React IntelliSense until you re-ran `Bitburner: Download Type Definitions`, because the `tsconfig.json` `paths` entries pointed at a versioned folder (`.…/bitburner-file-sync-plugin-0.1.2/…`) that stopped existing after the upgrade. Upgrading users get the stale `react` / `react-dom` `paths` entries scrubbed automatically the next time the extension writes `tsconfig.json`.

## 0.1.2
- Added additional static ram cost calc based on scraping NetscriptDefinitions.d.ts for the listed costs. Used when not connected to bitburner
- Added a breakdown of each ram-costing ns method found when you click the ram estimate at the bottom of the editor

## 0.1.1
- Added static RAM cost estimate for the active script in the status bar. Click for a per-method breakdown!
- Added a periodic liveness ping to the connected Bitburner instance. A second tab now only takes over the connection if the current one has gone stale, so a second Bitburner tab can't kick a working session

## 0.1.0
- Renames and moves in VS Code now mirror to Bitburner
- Deletes done in VS Code moves the deleted file in-game to `/trashbin/<original-path>` instead of being erased, so accidental deletes are recoverable from inside the game
- Only user-initiated VS Code actions propagate; external changes (git branch switches, terminal `rm`, edits from other editors) are ignored

## 0.0.9
- Tweaked error UX to return to "off" state after a moment, rather than staying red forever
- Added relative file location prefix to netscript definitions file in tsconfig

## 0.0.8
- Added `Bitburner: Download Files Matching Pattern...` command, which prompts for a minimatch glob and pulls only files whose remote path matches
- The last pattern used is remembered per-workspace and pre-fills the input box next time.
- Improved generated tsconfig file in user workspace to better match Bitburner's

## 0.0.7
- Added baseUrl based on the sync directory to .tsconfig, so `import x from "foo.js";` is handled relative to the script root, like in-game
- Added support for the `@/` import notation

## 0.0.6
- Enhanced .tsconfig to support @ns imports
- Added global shim to make `NS` and other types available in-game also available in VS Code
- Added global typing for React, so the type hints are available like they are in-game

## 0.0.3 - 0.0.5
- Prompt to sync files into the game on connect, if there are files missing from game
- Prompt to download files to workspace, if there are files in-game nto in the workspace
- Improve documentation, support info, and readme
- Update icon

## 0.0.2

- Marketplace Publication

## 0.0.1

- Initial release
- File sync features using the bitburner Remote API
- Command to pull code from game
- Pull netscript definitions from game on first connection
- Update .tsconfig to use netscript definitions file