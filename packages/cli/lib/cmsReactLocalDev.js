const { spawn } = require('child_process');
const { findProjectComponents } = require('./projectStructure');
// cms-dev-server allowed flags
// https://git.hubteam.com/HubSpot/cms-js-platform/blob/master/cms-dev-server/src/lib/cli.ts#L4
const allowedFlags = [
  '-c',
  '--config',
  '-a',
  '--account',
  '--ssl',
  '--storybook',
  '--generateFieldsTypes',
];
async function getCmsReactProject(projectDir) {
  const allComponents = await findProjectComponents(projectDir);
  return allComponents.filter(component => component.isCmsReactProject);
}

function validateArgs(args) {
  return args.filter(arg => {
    if (allowedFlags.includes(arg)) return true;
    const flagValue = args[args.indexOf(arg) - 1];
    if (allowedFlags.includes(flagValue)) return true;
    // Reject and log unknown arguments
    console.warn(`Unknown argument: ${arg}`);
    return false;
  });
}

function cmsLocalDevServer(project) {
  const { path: cmsReactProjectPath } = project;
  // Grab all args after 'project dev' to pass through to the cms-dev-server
  const additionalArgs = process.argv.slice(4);
  const validArgs = validateArgs(additionalArgs);
  const devServerArgs = [cmsReactProjectPath, ...validArgs];

  // Alternative approach to having an explicit dep
  const devServerProcess = spawn(
    'npx',
    ['hs-cms-dev-server', ...devServerArgs],
    {
      stdio: 'inherit',
      shell: true,
    }
  );

  devServerProcess.on('close', code => {
    console.log(`projects dev server exited with code ${code}`);
    process.exit(code);
  });
}

module.exports = {
  cmsLocalDevServer,
  getCmsReactProject,
};
