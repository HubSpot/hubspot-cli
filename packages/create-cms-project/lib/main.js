const { version } = require('../package.json');
const program = require('commander');
const chalk = require('chalk');
const createProject = require('./createProject');
const { defaultOptions } = require('./config');

const projectSlug = '<cms-project-name>';
const optionsSlug = '[options]';

let projectName;

program
  .version(version, '-v, --version')
  .usage(`${chalk.green(projectSlug)} ${chalk.yellow(optionsSlug)}`)
  .arguments(`${projectSlug} ${optionsSlug}`)
  .option(
    '-r, --repo [repo]',
    'specify CMS boilerplate git repo to clone',
    defaultOptions.repo
  )
  .option('-s, --ssh', 'use SSH to clone CMS boilerplate git repo')
  .option('-i, --skip-install', 'skip installation of boilerplate deps')
  .action(name => {
    projectName = name;
  })
  .parse(process.argv);

if (!projectName) {
  console.error(chalk.red('Please specifiy a HubSpot CMS project name'));
  console.log(`${chalk.green(program.name())} ${chalk.yellow(projectSlug)}`);
  process.exit(1);
}

/**
 * @typedef {Object} AppOptions
 * @property {String}  repo
 * @property {Boolean} ssh
 * @property {Boolean} skipInstall
 */

const options = ['repo', 'ssh', 'skipInstall'].reduce((hash, name) => {
  hash[name] = program[name] != null ? program[name] : defaultOptions[name];
  return hash;
}, {});

createProject(projectName, options);
