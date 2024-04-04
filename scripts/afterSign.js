const { notarize } = require('@electron/notarize')
const { execFileSync } = require('child_process')

function readEnv(key) {
  const value = process.env[key]

  if (!value) {
    console.log(`Please set ${key}`)
    throw new Error(`Please set ${key}`)
  }
  return value
}

exports.default = async function (context) {
  const { electronPlatformName, appOutDir } = context
  const appName = context.packager.appInfo.productFilename

  if (electronPlatformName === 'darwin') {
    console.log('Signing the app for darwin.')
    await notarize({
      teamId: 'S6482XAL5E',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASS
    })
  } else if (electronPlatformName === 'win32') {
    console.log('Signing the app for win32.')

    const codeSigningToolDir = readEnv('CODE_SIGNING_TOOL_DIR')
    const sslUsername = readEnv('SSL_USERNAME')
    const sslPassword = readEnv('SSL_PASSWORD')

    const binary = 'CodeSignTool.bat'
    const args = ['sign', `-username="${sslUsername}"`, `-password="${sslPassword}"`, '-override', `-input_file_path="${appOutDir}/${appName}.exe"`]
    const options = { cwd: codeSigningToolDir, stdio: 'inherit', shell: true }
    console.log('Executing:', binary, args, options)
    execFileSync(binary, args, options)
  } else {
    console.log(`Signing the app for ${electronPlatformName} is not supported.`)
  }
}
