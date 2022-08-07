1. `yarn` to install the dependencies. 
   1. We may need to `cp -R ~/projects/react-window/dist ./node_modules/react-window/` because the dist is not pulled.
2. Run `yarn run electron-builder install-app-deps` to build native binaries.
3. run `yarn run build:watch` and `yarn run start` in 2 separate windows to start Electron with hot reload.
   - or `yarn run gulp start`
4. To build the prod artifacts:
   - Mac: run `APPLEID=<EMAIL> APPLEIDPASS=<PASS> yarn run gulp release`
   - Windows: run `set CSC_LINK=c:\Users\tanin\projects\tanin_na_nakorn.p12`, `set CSC_KEY_PASSWORD=<ssl.com password>` and `yarn run gulp release`
   - Linux: run `yarn run gulp release`

Testing
--------

1. Test importing bom.csv
2. Test importing a large csv file (600MB)
3. Test importing quote.csv
4. Test importing height_weight.csv + user.csv and do a join.
5. Test exporting a table especially windows
6. Test evaluation mode
7. Test import sqlite
8. Test exporting schema

License for testing on prod
----------------------------

```
---- Superintendent license ----
Name: tanin
Email: tanin47@gmail.com
Expired: 2022-08-21T00:27:25.612284
Signature:
Y29BL9uhWUepYzZjHli/zUJ6iPwzt6fhrJ/s6ertwbVcAZuRykKScLxsNlQ8yJNE
M5cbVZuakeWez8MJA68TbtI3il5wIcQF5dK+x+bUDkh9unrXlsMJ0pedU/ufTCPN
vJa2Iu6tMtk5CF39ddlSfwyGmrCPtLN1li4mo2nkluc=
---- End of Superintendent license ----
```
