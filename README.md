1. `yarn` to install the dependencies. 
   1. We may need to `cp -R ~/projects/react-window/dist ./node_modules/react-window/` because the dist is not pulled.
2. Run `yarn run electron-builder install-app-deps` to build native binaries.
3. run `yarn run build:watch` and `yarn run start` in 2 separate windows to start Electron with hot reload.
   - or `yarn run gulp start`
4. To build the prod artifacts:
   - Mac: run `APPLEID=<EMAIL> APPLEIDPASS=<PASS> yarn run gulp release`
   - Windows: run `set CSC_LINK=c:\Users\tanin\projects\tanin_na_nakorn.p12`, `set CSC_KEY_PASSWORD=474747` and `yarn run gulp release`
   - Linux: run `yarn run gulp release`

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
