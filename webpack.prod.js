const common = require('./webpack.common.js');
const {merge} = require('webpack-merge');

module.exports = [
  merge(common.electronConfiguration, {
    mode: 'production',
    output: {
      path: __dirname + '/dist/prod',
      clean: true,
    }
  }),
  merge(common.reactConfiguration, {
    mode: 'production',
    output: {
      path: __dirname + '/dist/prod',
    }
  }),
];
