1. run `npm run build:watch` and `npm run dev` in 2 separate windows to start Electron with hot reload.


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
- [ ] Support changing config between vim, emacs, and normal mode
- [ ] Make hints good
