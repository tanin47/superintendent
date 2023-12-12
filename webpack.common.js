const HtmlWebpackPlugin = require('html-webpack-plugin');
const ThreadsPlugin = require('threads-plugin');

const electronPreload = {
  entry: './src/preload.ts',
  target: 'electron-preload',
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{loader: 'ts-loader'}]
      },
    ]
  },
  output: {
    filename: 'preload.js',
  },
};

const electronWorkerConfiguration = {
  entry: './src/data-store/worker.ts',
  target: 'node',
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{loader: 'ts-loader'}]
      },
      {
        test: /\.node$/,
        loader: 'node-loader'
      },
    ]
  },
  output: {
    filename: 'worker.js',
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3'
  },
};

const electronConfiguration = {
  entry: './src/app.ts',
  target: 'electron-main',
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{loader: 'ts-loader'}]
      },
      {
        test: /\.node$/,
        loader: 'node-loader'
      },
    ]
  },
  output: {
    filename: 'main.js',
  },
  plugins: [
    new ThreadsPlugin(),
  ],
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
  },
};

const reactConfiguration = {
  entry: './src/frontend/renderer.tsx',
  target: 'web',
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        use: [{ loader: 'ts-loader' }]
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: 'fonts'
          }
        }]
      }
    ]
  },
  output: {
    filename: 'renderer.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/frontend/index.html'
    })
  ],
};

module.exports = {
  electronPreload,
  electronWorkerConfiguration,
  electronConfiguration,
  reactConfiguration
};
