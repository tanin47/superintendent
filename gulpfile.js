const { series, parallel } = require('gulp')
const { execSync } = require('child_process')

const WIN32_LOAD_CL = '"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat"'

function exec (cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'inherit' })
}

function buildCsv (done) {
  const cwd = './deps/csv'

  switch (process.platform) {
    case 'win32':
      exec(`${WIN32_LOAD_CL} && cl csv.c -I . -link -dll -out:csv.dll`, cwd)
      break

    case 'linux':
      exec('gcc -g -fPIC -shared csv.c -I . -o csv.so', cwd)
      break

    case 'darwin':
      exec('gcc -g -fPIC -dynamiclib csv.c -o csv.dylib', cwd)
      break
    default:
      throw new Error()
  }
  done()
}

function buildCsvWriter (done) {
  const cwd = './deps/csv_writer'
  switch (process.platform) {
    case 'win32':
      exec(`${WIN32_LOAD_CL} && cl csv_writer.c -I . -link -dll -out:csv_writer.dll`, cwd)
      break

    case 'linux':
      exec('gcc -g -fPIC -shared csv_writer.c -I . -o csv_writer.so', cwd)
      break

    case 'darwin':
      exec('gcc -g -fPIC -dynamiclib csv_writer.c -o csv_writer.dylib', cwd)
      break
    default:
      throw new Error()
  }
  done()
}

function buildExt (done) {
  const cwd = './deps/ext'
  exec('cargo build --release', cwd)
  switch (process.platform) {
    case 'win32':
      exec(`${WIN32_LOAD_CL} && cl c\\ext.c target\\release\\ext.lib advapi32.lib ws2_32.lib userenv.lib -I c -link -dll -out:ext.dll`, cwd)
      break

    case 'linux':
      exec('gcc -g -fPIC -shared c/ext.c target/release/libext.a -I c -o ext.so', cwd)
      break

    case 'darwin':
      exec('gcc -g -fPIC -dynamiclib c/ext.c target/release/libext.a -o ext.dylib', cwd)
      break
    default:
      throw new Error()
  }
  done()
}

function buildElectron (done) {
  exec('yarn run build')
  done()
}

function buildElectronProd (done) {
  exec('yarn run webpack --config webpack.prod.js')
  done()
}

function pack (done) {
  let opt = '--mac'
  switch (process.platform) {
    case 'win32':
      opt = '--win'
      break

    case 'linux':
      opt = '--linux'
      break

    case 'darwin':
      opt = '--mac'
      break
    default:
      throw new Error()
  }
  exec(`yarn run electron-builder ${opt}`)
  done()
}

function startElectron (done) {
  exec('yarn start')
  done()
}

function defaultTask (done) {
  // place code for your default task here
  console.log(execSync('ls -l', { encoding: 'utf8' }))
  done()
}

exports.buildExt = buildExt
exports.buildCsv = buildCsv
exports.buildCsvWriter = buildCsvWriter
exports.buildEletron = buildElectron
exports.buildDeps = parallel(buildExt, buildCsv, buildCsvWriter)
exports.build = parallel(exports.buildDeps, buildElectron)
exports.release = series(parallel(exports.buildDeps, buildElectronProd), pack)
exports.start = series(exports.build, startElectron)
exports.default = defaultTask
