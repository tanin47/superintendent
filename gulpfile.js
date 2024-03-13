const { series, parallel } = require('gulp')
const { execSync } = require('child_process')

const WIN32_LOAD_CL = '"C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat"'

function exec (cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'inherit' })
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

exports.buildEletron = buildElectron
exports.build = parallel(buildElectron)
exports.release = series(parallel(buildElectronProd), pack)
exports.start = series(exports.build, startElectron)
exports.default = defaultTask
