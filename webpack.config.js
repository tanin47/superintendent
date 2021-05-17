const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

const electronConfiguration = {
  mode: 'development',
  entry: './src/app.ts',
  target: 'electron-main',
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: { sqlite3: 'commonjs sqlite3' },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{loader: 'ts-loader'}]
      },
    ]
  },
  output: {
    path: __dirname + '/dist',
    filename: 'main.js'
  }
}

const reactConfiguration = {
  mode: 'development',
  entry: './src/frontend/renderer.tsx',
  target: 'electron-renderer',
  devtool: 'source-map',
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        include: /frontend|api/,
        use: [{ loader: 'ts-loader' }]
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ],
      }
    ]
  },
  output: {
    path: __dirname + '/dist',
    filename: 'renderer.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/frontend/index.html'
    })
  ]
}

module.exports = [
  electronConfiguration,
  reactConfiguration,
];
