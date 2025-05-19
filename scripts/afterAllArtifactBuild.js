const { execFileSync } = require('child_process')
const os = require('os')
const {Platform} = require("electron-builder");

function readEnv (key) {
  const value = process.env[key]

  if (!value) {
    console.log(`Please set ${key}`)
    throw new Error(`Please set ${key}`)
  }
  return value
}

exports.default = function (context) {
  const { platformToTargets } = context
  const platform = [...platformToTargets.keys()][0]

  if (platform === Platform.WINDOWS) {
    console.log(`Signing the installer for ${platform.name}.`)

    const { artifactPaths } = context

    const codeSigningToolDir = './scripts/CodeSignTool-v1.3.2'
    const sslUsername = readEnv('SSL_USERNAME')
    const sslPassword = readEnv('SSL_PASSWORD')

    for (const file of artifactPaths) {
      if (!file.endsWith('.exe') && !file.endsWith('.AppImage')) { continue }

      const binary = '/bin/bash'
      const args = ['./CodeSignTool.sh', 'sign', `-username="${sslUsername}"`, `-password="${sslPassword}"`, '-override', `-input_file_path="${file}"`]
      const options = { cwd: codeSigningToolDir, stdio: 'inherit', shell: true }
      console.log('Executing:', binary, args, options)
      execFileSync(binary, args, options)
    }
  } else {
    console.log(`Signing the installer for ${platform.name} is not supported.`)
  }
}
