#!/usr/bin/env node
'use strict';

var arg = require('arg');
var execa = require('execa');
var webpack = require('webpack');
var chalk = require('chalk');
var fs = require('fs');
var path = require('path');
var webpackMerge = require('webpack-merge');
var TsconfigPathsPlugins = require('tsconfig-paths-webpack-plugin');

const info = text => {
  console.log(chalk`{cyan [nextron]} ${text}`);
};
const error = message => {
  console.log(chalk`{cyan [nextron]} {red ${message}}`);
};

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
  mode: 'development',
  plugins: [new webpack.EnvironmentPlugin({
    NODE_ENV: 'development'
  }), new webpack.LoaderOptionsPlugin({
    debug: true
  })],
  devtool: 'inline-source-map'
});
if (typeof userWebpack === 'function') {
  config = userWebpack(config, 'development');
}

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
const args = arg({
  '--renderer-port': Number,
  '--run-only': Boolean,
  '--startup-delay': Number,
  '--electron-options': String,
  // removed since v8.11.0
  '--port': Number,
  '--remote-debugging-port': Number,
  '--inspect': Number
});
if (args['--port']) {
  error(`The option \`--port\` has been removed. Please use \`--renderer-port ${args['--port']}\` instead.`);
  process.exit(1);
}
if (args['--remote-debugging-port']) {
  error(`The option \`--remote-debugging-port\` has been removed. Please use \`--electron-options="--remote-debugging-port=${args['--remote-debugging-port']}"\` instead.`);
  process.exit(1);
}
if (args['--inspect']) {
  error(`The option \`--inspect\` has been removed. Please use \`--electron-options="--inspect=${args['--inspect']}"\` instead.`);
  process.exit(1);
}
const nextronConfig = getNextronConfig();
const rendererPort = args['--renderer-port'] || 8888;
const startupDelay = nextronConfig.startupDelay || args['--startup-delay'] || 0;
let electronOptions = args['--electron-options'] || '';
if (!electronOptions.includes('--remote-debugging-port')) {
  electronOptions += ' --remote-debugging-port=5858';
}
if (!electronOptions.includes('--inspect')) {
  electronOptions += ' --inspect=9292';
}
electronOptions = electronOptions.trim();
const execaOptions = {
  cwd: process.cwd(),
  stdio: 'inherit'
};
(async () => {
  let firstCompile = true;
  let watching;
  let mainProcess;
  let rendererProcess; // eslint-disable-line prefer-const

  const startMainProcess = () => {
    info(`Run main process: electron . ${rendererPort} ${electronOptions}`);
    mainProcess = execa('electron', ['.', `${rendererPort}`, ...electronOptions.split(' ')], _objectSpread({
      detached: true
    }, execaOptions));
    mainProcess.unref();
  };
  const startRendererProcess = () => {
    info(`Run renderer process: next -p ${rendererPort} ${nextronConfig.rendererSrcDir || 'renderer'}`);
    const child = execa('next', ['-p', rendererPort, nextronConfig.rendererSrcDir || 'renderer'], execaOptions);
    child.on('close', () => {
      process.exit(0);
    });
    return child;
  };
  const killWholeProcess = () => {
    if (watching) {
      watching.close(() => {});
    }
    if (mainProcess) {
      mainProcess.kill();
    }
    if (rendererProcess) {
      rendererProcess.kill();
    }
  };
  process.on('SIGINT', killWholeProcess);
  process.on('SIGTERM', killWholeProcess);
  process.on('exit', killWholeProcess);
  rendererProcess = startRendererProcess();

  // wait until renderer process is ready
  await new Promise(resolve => setTimeout(() => resolve(), startupDelay));

  // wait until main process is ready
  await new Promise(resolve => {
    const compiler = webpack(config);
    watching = compiler.watch({}, error => {
      if (error) {
        console.error(error.stack || error);
      }
      if (!args['--run-only']) {
        if (!firstCompile && mainProcess) {
          mainProcess.kill();
        }
        startMainProcess();
        if (firstCompile) {
          firstCompile = false;
        }
      }
      resolve();
    });
  });
  if (args['--run-only']) {
    startMainProcess();
  }
})();
