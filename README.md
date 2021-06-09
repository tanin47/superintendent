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

Later
------
- [x] Implement the auto hint using keyUp and remember the state (e.g. typing 2 characters)
- [x] The table header to be sticky
- [ ] Change to better-sqlite3
- [ ] Find a way to load and download sqlite natively? Maybe we embed the sqlite executable into electron?  
