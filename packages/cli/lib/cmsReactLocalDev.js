const { spawn, execSync } = require('child_process');
const { findProjectComponents } = require('./projectStructure');
const path = require('path');
const fs = require('fs');
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

const packageName = '@hubspot/cms-dev-server';

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

function isCmsDevServerPackageInstalled() {
  try {
    const localPath = path.resolve('node_modules', packageName);
    if (fs.existsSync(localPath)) {
      return true;
    }

    execSync(`npm list -g ${packageName}`);
    return true;
  } catch (error) {
    return false;
  }
}

function cmsLocalDevServer(project) {
  const { path: cmsReactProjectPath } = project;
  const additionalArgs = process.argv.slice(4);
  const validArgs = validateArgs(additionalArgs);

  if (!isCmsDevServerPackageInstalled(packageName)) {
    console.error(
      `The ${packageName} package was not found. Please install it locally or globally before proceeding.`
    );
    process.exit(1);
  }

  let devServerBinary;
  const localBinaryPath = path.resolve(
    'node_modules',
    '.bin',
    'hs-cms-dev-server'
  );

  if (fs.existsSync(localBinaryPath)) {
    devServerBinary = localBinaryPath;
  } else {
    devServerBinary = 'hs-cms-dev-server';
  }

  // Using the resolved binary path
  const devServerProcess = spawn(
    devServerBinary,
    [cmsReactProjectPath, ...validArgs],
    {
      stdio: 'inherit',
      shell: true, // Required if using the global binary name
    }
  );

  devServerProcess.on('close', code => {
    console.log(`Project dev server exited with code ${code}`);
    process.exit(code);
  });
}

module.exports = {
  cmsLocalDevServer,
  getCmsReactProject,
};
