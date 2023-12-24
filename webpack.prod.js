const common = require('./webpack.common.js')
const { merge } = require('webpack-merge')
const { DefinePlugin } = require('webpack')

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

module.exports = [
  common.electronWorkerConfiguration,
  common.electronPreload,
  common.electronConfiguration,
  common.reactConfiguration
].map((mod, index) => merge(mod, conf, { output: { clean: index === 0 } }))
