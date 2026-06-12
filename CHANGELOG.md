# Change Log

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