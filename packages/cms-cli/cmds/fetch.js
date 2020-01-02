const { getCwd } = require('@hubspot/cms-lib/path');

exports.command = 'fetch <src> [dest]';

exports.describe =
  'Fetch a file, directory or module from HubSpot and write to a path on your computer';

exports.builder = yargs => {
  return yargs
    .positional('src', {
      describe: 'Remote hubspot path',
      type: 'string',
    })
    .positional('dest', {
      default: getCwd(),
      describe: 'Local filesystem path',
      type: 'string',
    })
    .epilog('EPILOG here ....');
};

exports.handler = argv => {
  // console.log('asdfasdfasdf');
  console.log('****** src: ', argv.src, ' ******');
  console.log('****** dest: ', argv.dest, ' ******');
};
