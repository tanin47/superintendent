const HtmlWebpackPlugin = require('html-webpack-plugin')
const ThreadsPlugin = require('threads-plugin')
const { DefinePlugin } = require('webpack')
const CopyPlugin = require("copy-webpack-plugin");
const fs = require("fs");

let envs = {
  'process.env.GLITCHTIP_URL': 'false',
  'process.env.APTABASE_KEY': 'false'
}

if (fs.existsSync('./secrets/GLITCHTIP_URL')) {
  envs['process.env.GLITCHTIP_URL'] = JSON.stringify(fs.readFileSync('./secrets/GLITCHTIP_URL', 'utf-8'))
}

if (fs.existsSync('./secrets/APTABASE_KEY')) {
  envs['process.env.APTABASE_KEY'] = JSON.stringify(fs.readFileSync('./secrets/APTABASE_KEY', 'utf-8'))
}

const definePlugin = new DefinePlugin(envs)

const runtimePlatformArch = process.env.TARGET_PLATFORM ? process.env.TARGET_PLATFORM : `${process.platform}-${process.arch}`
let libduckdbFilename = ''

switch(runtimePlatformArch) {
  case `linux-x64`:
  case 'linux-arm64':
    libduckdbFilename = 'libduckdb.so'
    break
  case 'darwin-arm64':
  case 'darwin-x64':
    libduckdbFilename = 'libduckdb.dylib'
    break
  case 'win32-x64':
    libduckdbFilename = 'duckdb.dll'
    break
  default:
    throw new Error(`Error determining the duckdb lib filename: unsupported arch '${runtimePlatformArch}'`);
}

const electronPreload = {
  entry: './src/preload.ts',
  target: 'electron-preload',
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{ loader: 'ts-loader' }]
      }
    ]
  },
  output: {
    filename: 'preload.js'
  },
  plugins: [
    definePlugin
  ],
}

const electronWorkerConfiguration = {
  entry: './src/data-store/worker.ts',
  target: 'node',
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{ loader: 'ts-loader' }]
      },
      {
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  },
  output: {
    filename: 'worker.js'
  },
  externals: [
      function ({ _context, request }, callback) {
        if (request === '@duckdb/node-bindings') {
          // Externalize to a commonjs module using the request path
          let newPath = ''
          switch(runtimePlatformArch) {
            case `linux-x64`:
              newPath = '@duckdb/node-bindings-linux-x64/duckdb.node'
              break
            case 'linux-arm64':
              newPath = '@duckdb/node-bindings-linux-arm64/duckdb.node'
              break
            case 'darwin-arm64':
              newPath = '@duckdb/node-bindings-darwin-arm64/duckdb.node'
              break
            case 'darwin-x64':
              newPath = '@duckdb/node-bindings-darwin-x64/duckdb.node'
              break
            case 'win32-x64':
              newPath = '@duckdb/node-bindings-win32-x64/duckdb.node'
              break
            default:
              throw new Error(`Error loading duckdb native binding: unsupported arch '${runtimePlatformArch}'`);
          }

          return callback(null, 'commonjs ' + newPath);
        }

        callback();
      },
    ],
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: `./node_modules/@duckdb/node-bindings-${runtimePlatformArch}/${libduckdbFilename}`,
          to: libduckdbFilename,
          noErrorOnMissing: false
        },
      ],
    }),
    definePlugin
  ],
}

const electronConfiguration = {
  entry: './src/app.ts',
  target: 'electron-main',
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{ loader: 'ts-loader' }]
      },
      {
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  },
  output: {
    filename: 'main.js'
  },
  plugins: [
    new ThreadsPlugin(),
    definePlugin
  ],
}

const reactConfiguration = {
  entry: './src/frontend/renderer.tsx',
  target: 'web',
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
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
          {
            loader: 'sass-loader',
            options: {
              api: 'modern-compiler',
              sassOptions: {
                // Your sass options
              }
            }
          }
        ]
      },
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          'css-loader'
        ]
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
    filename: 'renderer.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/frontend/index.html'
    }),
    definePlugin
  ]
}

module.exports = {
  electronPreload,
  electronWorkerConfiguration,
  electronConfiguration,
  reactConfiguration
}
