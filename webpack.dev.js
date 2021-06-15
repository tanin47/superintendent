const common = require('./webpack.common.js');
const {merge} = require('webpack-merge');
const {DefinePlugin} = require('webpack');

const definePlugin = new DefinePlugin({
  'process.env.SUPERINTENDENT_SERVER_BASE_URL': JSON.stringify('http://localhost:9000'),
  'process.env.SUPERINTENDENT_IS_PROD': JSON.stringify(false)
})

module.exports = [
  merge(common.electronConfiguration, {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
      path: __dirname + '/dist/dev',
    },
    plugins: [
      definePlugin
    ]
  }),
  merge(common.reactConfiguration, {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
      path: __dirname + '/dist/dev',
    },
    plugins: [
      definePlugin
    ]
  }),
];
