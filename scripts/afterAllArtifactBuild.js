const { execFileSync } = require('child_process')
const os = require('os')

function readEnv (key) {
  const value = process.env[key]

  if (!value) {
    console.log(`Please set ${key}`)
    throw new Error(`Please set ${key}`)
  }
  return value
}

exports.default = function (context) {
  const platformName = os.platform()

  if (platformName === 'win32') {
    console.log('Signing the installer for win32.')

    const { artifactPaths } = context

    const codeSigningToolDir = readEnv('CODE_SIGNING_TOOL_DIR')
    const sslUsername = readEnv('SSL_USERNAME')
    const sslPassword = readEnv('SSL_PASSWORD')

    for (const file of artifactPaths) {
      if (!file.endsWith('.exe')) { continue }

      const binary = 'CodeSignTool.bat'
      const args = ['sign', `-username="${sslUsername}"`, `-password="${sslPassword}"`, '-override', `-input_file_path="${file}"`]
      const options = { cwd: codeSigningToolDir, stdio: 'inherit', shell: true }
      console.log('Executing:', binary, args, options)
      execFileSync(binary, args, options)
    }
  } else {
    console.log(`Signing the installer for ${platformName} is not supported.`)
  }
}
