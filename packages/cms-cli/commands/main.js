const { version } = require('../package.json');
const { addLoggerOptions } = require('../lib/commonOpts');
const { addHelpUsageTracking } = require('../lib/usageTracking');

function configureMainCommand(program) {
  program
    .version(version)
    .description('Tools for working with the HubSpot CMS')
    .command('init', 'initialize a hubspot config file')
    .command('auth [type]', 'configure authentication with HubSpot')
    .command('upload <src> <dest>', 'upload a file or folder to HubSpot')
    .command('fetch <src> [dest]', 'fetch a file or folder')
    .command('server [src]', 'run the local server', { noHelp: true })
    .command(
      'watch <src> <dest>',
      'watch a folder of assets and upload files when they change'
    )
    .command('create <type> <name> [dest]', 'create an asset')
    .command('lint <path>', 'lint a file or folder for HubL syntax', {
      noHelp: true,
    })
    .command('hubdb <subcommand> <src>', 'manage hubdb tables', {
      noHelp: true,
    })
    .command(
      'filemanager <subcommand>',
      'commands for working with the File Manager'
    )
    .command('remove <path>', 'delete a file or folder from HubSpot')
    .alias('rm')
    .command('secrets', 'manage HubSpot secrets', {
      noHelp: true,
    })
    .command('logs', 'get logs for a function', {
      noHelp: true,
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program);
}

module.exports = {
  configureMainCommand,
};
