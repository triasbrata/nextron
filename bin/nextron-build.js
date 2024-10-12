#!/usr/bin/env node
'use strict';

var fs$1 = require('fs-extra');
var path = require('path');
var arg = require('arg');
var chalk = require('chalk');
var execa = require('execa');
var fs = require('fs');

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

/* eslint-disable @typescript-eslint/no-var-requires */

const cwd$1 = process.cwd();
const pkgPath = path.join(cwd$1, 'package.json');
const nextConfigPath = path.join(cwd$1, getNextronConfig().rendererSrcDir || 'renderer', 'next.config.js');
const useExportCommand = async () => {
  const {
    dependencies,
    devDependencies
  } = await fs$1.readJSON(pkgPath);
  let nextVersion;
  nextVersion = dependencies.next;
  if (nextVersion) {
    info('To reduce the bundle size of the electron app, we recommend placing next and nextron in devDependencies instead of dependencies.');
  }
  if (!nextVersion) {
    nextVersion = devDependencies.next;
    if (!nextVersion) {
      error('Next not found in both dependencies and devDependencies.');
      process.exit(1);
    }
  }
  const majorVersion = ~~nextVersion.split('.').filter(v => v.trim() !== '')[0].replace('^', '').replace('~', '');
  if (majorVersion < 13) {
    return true;
  }
  if (majorVersion === 13) {
    const {
      output,
      distDir
    } = require(nextConfigPath);
    if (output === 'export') {
      if (distDir !== '../app') {
        error('Nextron export the build results to "app" directory, so please set "distDir" to "../app" in next.config.js.');
        process.exit(1);
      }
      return false;
    }
    return true;
  }
  if (majorVersion > 13) {
    const {
      output,
      distDir
    } = require(nextConfigPath);
    if (output !== 'export') {
      error('We must export static files so as Electron can handle them. Please set next.config.js#output to "export".');
      process.exit(1);
    }
    if (distDir !== '../app') {
      error('Nextron exports the build results to "app" directory, so please set "distDir" to "../app" in next.config.js.');
      process.exit(1);
    }
    return false;
  }
  error('Unexpected error occerred');
  process.exit(1);
};

const args = arg({
  '--mac': Boolean,
  '--linux': Boolean,
  '--win': Boolean,
  '--x64': Boolean,
  '--ia32': Boolean,
  '--armv7l': Boolean,
  '--arm64': Boolean,
  '--universal': Boolean,
  '--config': String,
  '--publish': String,
  '--no-pack': Boolean
});
const cwd = process.cwd();
const appDir = path.join(cwd, 'app');
const distDir = path.join(cwd, 'dist');
const rendererSrcDir = getNextronConfig().rendererSrcDir || 'renderer';
const execaOptions = {
  cwd,
  stdio: 'inherit'
};
(async () => {
  // Ignore missing dependencies
  process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';
  try {
    info('Clearing previous builds');
    await Promise.all([fs$1.remove(appDir), fs$1.remove(distDir)]);
    info('Building renderer process');
    await execa('next', ['build', path.join(cwd, rendererSrcDir)], execaOptions);
    if (await useExportCommand()) {
      await execa('next', ['export', '-o', appDir, path.join(cwd, rendererSrcDir)], execaOptions);
    }
    info('Building main process');
    await execa('node', [path.join(__dirname, 'webpack.config.js')], execaOptions);
    if (args['--no-pack']) {
      info('Skip packaging...');
    } else {
      info('Packaging - please wait a moment');
      await execa('electron-builder', createBuilderArgs(), execaOptions);
    }
    info('See `dist` directory');
  } catch (err) {
    console.log(chalk`

{bold.red Cannot build electron packages:}
{bold.yellow ${err}}
`);
    process.exit(1);
  }
})();
function createBuilderArgs() {
  const results = [];
  if (args['--config']) {
    results.push('--config');
    results.push(args['--config'] || 'electron-builder.yml');
  }
  if (args['--publish']) {
    results.push('--publish');
    results.push(args['--publish']);
  }
  args['--mac'] && results.push('--mac');
  args['--linux'] && results.push('--linux');
  args['--win'] && results.push('--win');
  args['--x64'] && results.push('--x64');
  args['--ia32'] && results.push('--ia32');
  args['--armv7l'] && results.push('--armv7l');
  args['--arm64'] && results.push('--arm64');
  args['--universal'] && results.push('--universal');
  return results;
}
