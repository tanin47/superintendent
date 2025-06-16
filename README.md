Superintendent.app
====================

You can use VSCode.

1. `yarn` to install the dependencies. 
2. Run `yarn run electron-builder install-app-deps` to build native binaries.
3. run `yarn run build:watch` and `yarn run start` in 2 separate windows to start Electron with hot reload.
4. Run tests: `yarn install --force` and `yarn jest`.
   - Run specific test based on pattern: `yarn jest -t <substring>`
5. Run UI tests: `yarn run electron-builder install-app-deps` and `yarn wdio`. 
   - Run `yarn wdio --spec ./test/specs/draft_notice.e2e.ts` to run specific tests.
5. Run tests: `npm install --force && yarn install`.
   - We need this to install `@duckdb/node-bindings-win32-x64` and `@duckdb/node-bindings-linux-x64`
6. To build the prod artifacts:
   - Mac: run `APPLEID=<EMAIL> APPLEIDPASS=<PASS> yarn dist:mac`
   - Windows: please see the Linux & Window build because we use the docker build approach.
   - Linux: please see the Linux & Window build because we use the docker build approach.

On Windows, we use git-bash, not the Command-Line Tool.

Linux & Window build
------------

We currently use the Docker option of electron-builder. However, we have to use a modified Docker image due to the new yarn version. 
See: https://github.com/electron-userland/electron-builder/issues/9040

1. Download the CodeSignTool from SSL.com: https://www.ssl.com/guide/esigner-codesigntool-command-guide/
2. Unzip and put it under `./scripts/CodeSignTool-v1.3.2`.
3. Run `chmod 755 /scripts/CodeSignTool-v1.3.2/CodeSignTool.sh`
4. Go to `cd ./scripts`
5. Run: `docker buildx build -t electronuserland/builder:wine --platform=linux/amd64 .`
6. Go to the project root with `cd ..`
7. Run the below docker command ([ref](https://www.electron.build/multi-platform-build.html#docker)):

```
docker run --rm -ti \
  --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS_TAG|TRAVIS|TRAVIS_REPO_|TRAVIS_BUILD_|TRAVIS_BRANCH|TRAVIS_PULL_REQUEST_|APPVEYOR_|CSC_|GH_|GITHUB_|BT_|AWS_|STRIP|BUILD_') \
  --env ELECTRON_CACHE="/root/.cache/electron" \
  --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
  --platform linux/amd64 \
  -v ${PWD}:/project \
  -v ${PWD##*/}-node-modules:/project/node_modules \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
  electronuserland/builder:wine
```

Now that you are in the docker console:

- Run `yarn && yarn dist:linux` for Linux
- Run `yarn && SSL_USERNAME=<ssl_com_user> SSL_PASSWORD=<ssl_com_pass> yarn dist:win` for Windows

Errors
-------

If we see this: `"mach-o file, but is an incompatible architecture (have 'arm64', need 'x86_64h' or 'x86_64')"`,
run `yarn run electron-builder install-app-deps` because duckdb.node is missing for Mac OS (Intel).

Windows Code Signing
----------------------

### Validate that the binary is signed correctly

1. Open PowerShell
2. Run `powershell -command "Get-AuthenticodeSignature -FilePath \"<file>\""`

For convenience, here are the 2 files we should verify:

* `powershell -command "Get-AuthenticodeSignature -FilePath ./electron-builder/out/win-unpacked/superintendent.exe"`
* `powershell -command "Get-AuthenticodeSignature -FilePath \"./electron-builder/out/superintendent Setup 7.0.0.exe\""`

Mac's notarization
--------------------

We can check the notarization status with: 

```
spctl -a -vvv -t install ./electron-builder/out/mac-arm64/superintendent.app
```

The DMG cannot be, and is not, notarized 

