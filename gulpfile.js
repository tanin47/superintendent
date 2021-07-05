const {series, parallel} = require('gulp');
const {execSync} = require('child_process');

function exec(cmd, cwd) {
  return execSync(cmd, {cwd, encoding: 'utf8', stdio: 'inherit'});
}

function buildCsv(done) {
  const cwd = './deps/csv';
  exec('gcc -g -fPIC -dynamiclib csv.c -o csv.dylib', cwd);
  done();
}

function buildCsvWriter(done) {
  const cwd = './deps/csv_writer';
  exec('gcc -g -fPIC -dynamiclib csv_writer.c -o csv_writer.dylib', cwd);
  done();
}

function buildExt(done) {
  const cwd = './deps/ext';
  exec('cargo build --release', cwd);
  exec('gcc -g -fPIC -dynamiclib c/ext.c target/release/libext.a -o ext.dylib', cwd);
  done();
}

function buildElectron(done) {
  exec('yarn run build');
  done();
}

function buildElectronProd(done) {
  exec('yarn run webpack --config webpack.prod.js');
  done();
}

function pack(done) {
  // exec('yarn run electron-builder --mac --linux --win');
  exec('yarn run electron-builder --mac');
  done();
}

function startElectron(done) {
  exec('yarn start');
  done();
}


function defaultTask(done) {
  // place code for your default task here
  console.log(execSync('ls -l', {encoding: 'utf8'}));
  done();
}


exports.buildExt = buildExt;
exports.buildCsv = buildCsv;
exports.buildCsvWriter = buildCsvWriter;
exports.buildEletron = buildElectron;
exports.buildDeps = parallel(buildExt, buildCsv, buildCsvWriter);
exports.build = parallel(exports.buildDeps, buildElectron);
exports.release = series(parallel(exports.buildDeps, buildElectronProd), pack);
exports.start = series(exports.build, startElectron);
exports.default = defaultTask
