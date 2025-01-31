import { bold } from 'chalk';
export const doctor = {
  command: {
    describe:
      'Retrieve diagnostic information about your local HubSpot configurations.',
    options: {
      outputDir: 'Directory to save a detailed diagnosis JSON file in',
    },
    errors: {
      generatingDiagnosis: 'Error generating diagnosis',
      unableToWriteOutputFile: (file: string, errorMessage: unknown) =>
        `Unable to write output to ${bold(file)}, ${errorMessage}`,
    },
    outputWritten: (file: string) => `Output written to ${bold(file)}`,
  },
  runningDiagnostics: `Running diagnostics...`,
  diagnosticsComplete: `Diagnostics complete`,
  accountChecks: {
    active: `Default account active`,
    inactive: 'Default account isn`t active',
    inactiveSecondary: (command: string) =>
      `Run ${command} to remove inactive accounts from your CLI config`,
    unableToDetermine: `Unable to determine if the portal is active`,
  },
  pak: {
    invalid: `Personal access key is invalid`,
    invalidSecondary: (command: string) =>
      `To get a new key, run ${command}, deactivate your access key, and generate a new one. Then use that new key to authenticate your account.`,
    valid: (link: string) => `Personal Access Key is valid. ${link}`,
    viewScopes: `View selected scopes`,
  },
  nodeChecks: {
    unableToDetermine: `Unable to determine what version of node is installed`,
    minimumNotMet: (nodeVersion: string) =>
      `Minimum Node version is not met. Upgrade to ${nodeVersion} or higher`,
    success: (nodeVersion: string) => `node v${nodeVersion} is installed`,
  },
  npmChecks: {
    notInstalled: `npm is not installed`,
    installed: (npmVersion: string) => `npm v${npmVersion} is installed`,
    unableToDetermine: `Unable to determine if npm is installed`,
  },
  hsChecks: {
    notLatest: (hsVersion: string) => `Version ${hsVersion} outdated`,
    notLatestSecondary: (command: string, hsVersion: string) =>
      `Run ${command} to upgrade to the latest version ${hsVersion}`,
    latest: (hsVersion: string) => `HubSpot CLI v${hsVersion} up to date`,
    unableToDetermine: `Unable to determine if HubSpot CLI is up to date.`,
    unableToDetermineSecondary: (command: string, link: string) =>
      `Run ${command} to check your installed version, then visit the ${link} to validate whether you have the latest version`,
    unableToDetermineSecondaryLink: `npm HubSpot CLI version history`,
  },
  projectDependencyChecks: {
    missingDependencies: (dir: string) =>
      `missing dependencies in ${bold(dir)}`,
    missingDependenciesSecondary: (command: string) =>
      `Run ${command} to install all project dependencies locally`,

    unableToDetermine: (dir: string) =>
      `Unable to determine if dependencies are installed ${dir}`,

    success: `App dependencies are installed and up to date`,
  },
  files: {
    validJson: `JSON files valid`,
    invalidJson: (filename: string) => `invalid JSON in ${bold(filename)}`,
  },
  port: {
    inUse: (port: string | number) => `Port ${port} is in use`,
    inUseSecondary: (command: string) =>
      `Make sure it is available if before running ${command}`,
    available: (port: string | number) =>
      `Port ${port} available for local development`,
  },
  diagnosis: {
    cli: {
      header: `HubSpot CLI install`,
    },
    cliConfig: {
      header: `CLI configuration`,
      configFileSubHeader: (filename: string) =>
        `Config File: ${bold(filename)}`,
      defaultAccountSubHeader: (accountDetails: string) =>
        `Default Account: ${accountDetails}`,
      noConfigFile: `CLI configuration not found`,
      noConfigFileSecondary: (command: string) =>
        `Run ${command} and follow the prompts to create your CLI configuration file and connect it to your HubSpot account`,
    },
    projectConfig: {
      header: `Project configuration`,
      projectDirSubHeader: (projectDir: unknown) =>
        `Project dir: ${bold(projectDir)}`,
      projectNameSubHeader: (projectName: unknown) =>
        `Project name: ${projectName}`,
    },
    counts: {
      errors: (count: number) => `${bold('Errors:')} ${count}`,
      warnings: (count: number) => `${bold('Warnings:')} ${count}`,
    },
    oauth: {
      missingClientId: `Error building oauth URL: missing client ID.`,
    },
  },
};
