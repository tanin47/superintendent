const common = require('./webpack.common.js');
const {merge} = require('webpack-merge');

module.exports = [
  merge(common.electronConfiguration, {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
      path: __dirname + '/dist/dev',
    }
  }),
  merge(common.reactConfiguration, {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
      path: __dirname + '/dist/dev',
    }
  }),
];
