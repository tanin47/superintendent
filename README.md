Superintendent.app
====================

You can use VSCode.

1. `yarn` to install the dependencies. 
   1. We may need to `cp -R ~/projects/react-window/dist ./node_modules/react-window/` because the dist is not pulled.
2. Run `yarn run electron-builder install-app-deps` to build native binaries.
3. run `yarn run build:watch` and `yarn run start` in 2 separate windows to start Electron with hot reload.
   - or `yarn run gulp start`
4. Run tests: `yarn install --force` and `yarn jest`.
   - Run specific test based on pattern: `yarn jest -t <substring>`
5. Run UI tests: `yarn run electron-builder install-app-deps` and `yarn wdio`. 
   - For now, we should modify: `./node_modules/wdio-electron-service/dist/launcher.js` in order to make it work with the dev build.
     - Add:
       ```
       appBinaryPath = './node_modules/.bin/electron';
       appArgs = ['--app=./dist/dev/main.js'];
       ```
   - See: https://github.com/webdriverio-community/wdio-electron-service/issues/331
   - Run `yarn wdio --spec ./test/specs/draft_notice.e2e.ts` to run specific tests.
4. To build the prod artifacts:
   - Mac: run `APPLEID=<EMAIL> APPLEIDPASS=<PASS> yarn run gulp release`
   - Windows: run `CODE_SIGNING_TOOL_DIR="c:/Users/tanin/projects/CodeSignTool-v1.3.0-windows" SSL_USERNAME=tanin SSL_PASSWORD="<PASSWORD_FOR_SSL.COM>" yarn run gulp release`
     - This requires an OTP input
   - Linux: run `yarn run gulp release`

On Windows, we use MINGW64, not the Command-Line Tool.

Windows Code Signing
----------------------

### Validate that the binary is signed correctly

1. Open PowerShell
2. Run `powershell -command "Get-AuthenticodeSignature -FilePath \"<file>\""`

For convenience, here are the 2 files we should verify:

* `powershell -command "Get-AuthenticodeSignature -FilePath ./electron-builder/out/win-unpacked/superintendent.exe"`
* `powershell -command "Get-AuthenticodeSignature -FilePath \"./electron-builder/out/superintendent Setup 5.2.0.exe\""`

Testing
--------

1. Test importing bom.csv
2. Test importing a large csv file (600MB)
3. Test importing quote.csv
4. Test importing height_weight.csv + user.csv and do a join.
5. Test exporting a table especially windows
6. Test import sqlite
7. Test exporting schema

License for testing on prod
----------------------------

```
---- Superintendent license ----
Name: tanin
Email: tanin47@gmail.com
Expired: 2023-07-29T04:06:28.968065
Signature:
KKJH+knQXSf98lTEsCVie09ihhirm5rx2Vedaih9ZLj/mJ67Zoc3Av3jun9wQH84
pVVSDKPETB9TaDzMwus6/qXcDyyxVftUE7m0BA4LpjjEGvQPfR6O8trPPc+Iykr4
kIxCJ2VClFHW33JDFjlhcs77j6ES9Eeh/kSkw12rpXw=
---- End of Superintendent license ----
```
