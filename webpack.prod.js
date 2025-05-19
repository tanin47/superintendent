const common = require('./webpack.common.js')
const { merge } = require('webpack-merge')
const { DefinePlugin } = require('webpack')
const fs = require('fs')

const definePlugin = new DefinePlugin({
  'process.env.SUPERINTENDENT_IS_PROD': JSON.stringify(true)
})

const conf = {
  mode: 'production',
  devtool: 'inline-source-map',
  output: {
    path: __dirname + '/dist/prod'
  },
  plugins: [
    definePlugin
  ]
}

module.exports = function() {
  fs.rmSync(conf.output.path, { recursive: true, force: true})

  return [
    common.electronWorkerConfiguration,
    common.electronPreload,
    common.electronConfiguration,
    common.reactConfiguration
  ].map((mod) => merge(mod, conf))
}
