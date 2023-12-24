const common = require('./webpack.common.js')
const { merge } = require('webpack-merge')
const { DefinePlugin } = require('webpack')

const definePlugin = new DefinePlugin({
  'process.env.SUPERINTENDENT_IS_PROD': JSON.stringify(false)
})

const conf = {
  mode: 'development',
  devtool: 'inline-source-map',
  output: {
    path: __dirname + '/dist/dev'
  },
  plugins: [
    definePlugin
  ]
}

module.exports = [
  common.electronPreload,
  common.electronWorkerConfiguration,
  common.electronConfiguration,
  common.reactConfiguration
].map((mod) => merge(mod, conf))
