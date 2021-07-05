1. run `yarn run build:watch` and `yarn run start` in 2 separate windows to start Electron with hot reload.
2. To build the prod artifacts, run `yarn run pack`.


TODO
-----

- [x] Make a layout for one csv with one workspace first
- [x] After querying, it should create a new table for the result and create that table
- [x] Support hot reload
- [x] Fix the slowness
- [x] Style it to look nicer
  - [x] Add line number
  - [x] Add syntax highlight on the editor
- [x] Add CSV to stop loading; The loading needs to stop when it succeeds or fails. API should abstract that away.
- [x] Convert API to promise  
- [x] Export the table into a CSV
- [x] Support showing error message
- [x] Package app for Mac  
- [x] Hide the "Reload HTML" button
  - Need to differentiate by prod and dev
- [x] Support changing config between vim, emacs, and normal mode
- [x] Make hints decent
- [x] Package into an app
  - [x] Test on Mac
  - [x] Test on Windows
- [x] Support resizing
- [x] Support large CSV  
  - [x] Batch insert
- [x] Build the landing page  
  - [x] Complete the feature section
  - [x] Setup an email  
  - [x] Make a believable CSV
    - [x] Make a name for each index
  - [x] Make an intro gif
- [x] Implement the auto hint using keyUp and remember the state (e.g. typing 2 characters)
- [x] The table header to be sticky
- [x] Find a way to load and download sqlite natively? Maybe we embed the sqlite executable into electron?  
- [x] Solve the editor bug on windows by using a different dialog
- [x] Windows cannot export file because it doesn't flush database  
- [x] List the test scenarios
- [x] Try adding regex, date parse
- [x] Import/export CSV with C  
- [x] Don't send column name with rows. Just use raw  
- [x] Add a set of tests  
- [ ] Set up cross compilation  
- [ ] Restore query of the table
- [ ] Save and open workspace


Testing
--------

1. Test importing bom.csv
2. Test importing a large csv file (600MB)
3. Test importing quote.csv
4. Test importing height_weight.csv + user.csv and do a join.
5. Test exporting a table especially windows

License for testing on prod
----------------------------

```
---- Superintendent license ----
Type: Beta
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
