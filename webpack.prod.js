const common = require('./webpack.common.js');
const {merge} = require('webpack-merge');
const {DefinePlugin} = require('webpack');

const definePlugin = new DefinePlugin({
  'process.env.SUPERINTENDENT_SERVER_BASE_URL': JSON.stringify('https://superintendent.app'),
  'process.env.SUPERINTENDENT_IS_PROD': JSON.stringify(true)
})

module.exports = [
  merge(common.electronWorkerConfiguration, {
    mode: 'production',
    devtool: 'inline-source-map',
    output: {
      path: __dirname + '/dist/prod',
      clean: true
    },
    plugins: [
      definePlugin
    ]
  }),
  merge(common.electronConfiguration, {
    mode: 'production',
    output: {
      path: __dirname + '/dist/prod',
    },
    plugins: [
      definePlugin
    ]
  }),
  merge(common.reactConfiguration, {
    mode: 'production',
    output: {
      path: __dirname + '/dist/prod',
    },
    plugins: [
      definePlugin
    ]
  }),
];
