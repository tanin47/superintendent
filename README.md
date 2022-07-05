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
Type: Trial
Name: Tanin Na Nakorn
Email: tanin47@gmail.com
Key0: dUuqMR2QWJW9HvD1skEl0iKWFib3JtQWM5aeCnJvB8BDPBb==
Key1:
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAg8v7CvbqlPPjkLjIuPR0
AYMwMcBi+UJfecGM2OG+Vu1SIAk4w25jAaVn38N6LpHAovDSjVLQw8BAfkjd13RG
vmyBI7C0HkdnEx9nJTcex0X3PPwVRdz8ynwHtwdOqlN0w1/+AQ+H9WHgBAwS+7aZ
Id8vxdyr9IoQQJLfWYqmlHkZO/hIVHbW39f33gkqrPIdtkjof151HM3OuA1ldxpM
9ecpPlqweq84k+OLZ74446OeSFTa0PQIwe1FXyp7J7plHdd+AT83nUV/cCnbMHXY
ziZHOOet9t0t10YnNOyIwxWRLJtAzBj9Qt+yKSZVIiRTymz8BnEn0kqg7pWdoLIF
39lKknGiYC9TPkc4GOCSobhgaZHcT8OxU6ng/WpwdMcQKRiEG09xzzKO+v0tkDd5
16BuZ+jhbzDE52WNTfkQU+g5xcap9zQKXMTNwQmAys9++LK44bvmigK/dESb2DCA
t6d1lgatq0CxHRNhGa+BVp/U0jMhkTtSUy43hI+1YM82q32dBQJ+AVtSPqRXywYB
aFo0QBQtQKqlWqJD1PaIBONpU0mock2vx7OZwn7o4Tsy3wJyM0qO3cZfKEy9d91u
D+k9JBqhKQXPpp5yBbDjAufuyniB6SW7lwo/5ync4mSYSgQcm2q3xLyx+DmPpG7F
4lbQ2nubYjERV8n9JGYKrIMCAwEAAQ==
---- End of Superintendent license ----
```

License for testing on dev
---------------------------

```
---- Superintendent license ----
Type: Trial
Name: tanintest
Email: tanin47+test09290@gmail.com
Expired at: 2021-08-08T23:46:01.401641
Key0: 2hM8XON2WRIbz7OsheZFmEoXbJSkGFOj5WL2HaFwNmvshBt==
Key1:
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAmf2m4eYHgqxrruZgE0Jz
jtXZaPwjUEhXXdruXzmB0Cdwd03F5QhFMaekp6vvHXPANnWiJmW18b17lKVLJMqL
f/9xb3YXGJO8mKTvoAtuVk0pf6RYtdXwqsQ94GourLiFooIHaIkDiRKS+OF/65WM
v1JwkoncKuDKzfm7N26PRmaKvaAQHJMJvOoZPiN9eJ7VG66jZaBwUjl+jlxkLgfE
pHZoz2DeD0kBp6uccVtwaioEtuQXM/ksYD31R0TjjObzxtkg4THjsZhDqjC1HcTP
2Xc1ZzxMfjaT805fx1k83BK0wHA7QvsMEBfjHedGgqExOmGnSb9/upc+A3mVgWLi
dDEAOjhLE8nr/05LaLbcJ1DIOMcLNWBTPVTJgzoDqxoR26Fgmb9xxOXTIv+W8zDb
FE+ruDjqBPPccJ4xeQt2hpPxCKlRIWPU0ZOX7YUcvBk1rCWHlkTxAEvVvVQShWPF
Gsz+TF0RjGZhi92mbswbEEhPXVYO7cKtFzk1s+gnaqLER8PBKuplfMJo0TLAUdvG
PUrNFHdLuU3rB2RKbwGoL5EZaE9HyoXW/AgwgBeMyI6j7E/gBv10FzNc/0j4Gk+C
Lrwz20PtxhqB/GdyfOtebJ43tI9TZHYQ2VuD1SZRHK2fQFPiNsqT9flX/yTfCWAj
1HX9PcZ2WIKjqP8kbWfnAYcCAwEAAQ==
---- End of Superintendent license ----
```
