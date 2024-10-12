'use strict';

var webpack = require('webpack');
var webpackMerge = require('webpack-merge');
var TerserPlugin = require('terser-webpack-plugin');
var fs = require('fs');
var path = require('path');
var TsconfigPathsPlugins = require('tsconfig-paths-webpack-plugin');

const getNextronConfig = () => {
  const nextronConfigPath = path.join(process.cwd(), 'nextron.config.js');
  if (fs.existsSync(nextronConfigPath)) {
    return require(nextronConfigPath);
  } else {
    return {};
  }
};

const cwd$1 = process.cwd();
const getBabelConfig = () => {
  if (fs.existsSync(path.join(cwd$1, '.babelrc'))) return path.join(cwd$1, '.babelrc');
  if (fs.existsSync(path.join(cwd$1, '.babelrc.js'))) return path.join(cwd$1, '.babelrc.js');
  if (fs.existsSync(path.join(cwd$1, 'babel.config.js'))) return path.join(cwd$1, 'babel.config.js');
  return path.join(__dirname, '../babel.js');
};

/* eslint-disable @typescript-eslint/no-var-requires */

const cwd = process.cwd();
const isTs = fs.existsSync(path.join(cwd, 'tsconfig.json'));
const ext = isTs ? '.ts' : '.js';
const externals = require(path.join(cwd, 'package.json')).dependencies;
const {
  mainSrcDir
} = getNextronConfig();
const backgroundPath = path.join(cwd, mainSrcDir || 'main', `background${ext}`);
const preloadPath = path.join(cwd, mainSrcDir || 'main', `preload${ext}`);
const entry = {
  background: backgroundPath
};
if (fs.existsSync(preloadPath)) {
  entry.preload = preloadPath;
}
const baseConfig = {
  target: 'electron-main',
  entry,
  output: {
    filename: '[name].js',
    path: path.join(cwd, 'app'),
    library: {
      type: 'umd'
    }
  },
  externals: [...Object.keys(externals || {})],
  module: {
    rules: [{
      test: /\.(js|ts)x?$/,
      use: {
        loader: require.resolve('babel-loader'),
        options: {
          cacheDirectory: true,
          extends: getBabelConfig()
        }
      },
      exclude: [/node_modules/, path.join(cwd, 'renderer')]
    }]
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: ['node_modules'],
    plugins: [isTs ? new TsconfigPathsPlugins() : null].filter(Boolean)
  },
  stats: 'errors-only',
  node: {
    __dirname: false,
    __filename: false
  }
};

const {
  webpack: userWebpack
} = getNextronConfig();
let config = webpackMerge.merge(baseConfig, {
  mode: 'production',
  optimization: {
    minimizer: [new TerserPlugin({
      parallel: true
    })]
  },
  plugins: [new webpack.EnvironmentPlugin({
    NODE_ENV: 'production',
    DEBUG_PROD: false,
    START_MINIMIZED: false
  }), new webpack.DefinePlugin({
    'process.type': '"browser"'
  })],
  devtool: 'source-map'
});
if (typeof userWebpack === 'function') {
  config = userWebpack(config, 'development');
}
const compiler = webpack(config);
compiler.run((error, stats) => {
  if (error) {
    console.error(error.stack || error);
  }
  if (stats) {
    console.log(stats.toString());
  }
});
