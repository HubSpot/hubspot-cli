// UI messages for the UI module - separate file to avoid circular imports with lang/en.ts
// This contains the same strings that would be in lib.ui.* from lang/en.ts

import { uiCommandReference, uiLink } from './index.js';

export const uiMessages = {
  betaTag: '[BETA]',
  deprecatedTag: '[DEPRECATED]',
  deprecatedDescription: (message: string, command: string, url?: string) =>
    `${message}. The ${uiCommandReference(command)} command is deprecated and will be disabled soon. ${url ? uiLink('Learn more', url) : ''}`,
  disabledMessage: (command: string, url?: string) =>
    `The ${uiCommandReference(command)} command is disabled. Run ${uiCommandReference('npm i -g @hubspot/cli@latest')} to update to the latest HubSpot CLI version. ${url ? uiLink('Learn more', url) : ''}`,
  disabledUrlText: 'See all HubSpot CLI commands here.',
  commandRenamedMessage: (newCommand: string) =>
    `This command has been deprecated. Please use ${uiCommandReference(newCommand)} instead.`,
  featureHighlight: {
    defaultTitle: "What's next?",
    featureKeys: {
      accountOption: {
        command: '--account',
        message: (command: string) =>
          `Use the ${command} option with any command to override the default account`,
      },
      accountsListCommand: {
        command: 'hs accounts list',
        message: (command: string) =>
          `${command} - See a list of configured HubSpot accounts`,
      },
      accountsUseCommand: {
        command: 'hs accounts use',
        message: (command: string) =>
          `${command} - Set the Hubspot account that the CLI will target by default`,
      },
      authCommand: {
        command: 'hs auth',
        message: (command: string) =>
          `${command} - Connect the CLI to additional HubSpot accounts`,
      },
      feedbackCommand: {
        command: 'hs feedback',
        message: (command: string) =>
          `${command} - Report a bug or leave feedback`,
      },
      getStartedCommand: {
        command: 'hs get-started',
        message: (command: string) =>
          `${command} - Get started with HubSpot development`,
      },
      helpCommand: {
        command: 'hs help',
        message: (command: string) =>
          `${command} - See a list of available commands`,
      },
      projectCreateCommand: {
        command: 'hs project create',
        message: (command: string) => `${command} - Create a new project`,
      },
      projectDeployCommand: {
        command: 'hs project deploy',
        message: (command: string) =>
          `Ready to take your project live? Run ${command}`,
      },
      projectHelpCommand: {
        command: 'hs project --help',
        message: (command: string) =>
          `${command} - Learn more about available project commands`,
      },
      projectUploadCommand: {
        command: 'hs project upload',
        message: (command: string) =>
          `${command} - Upload your project to HubSpot and trigger builds`,
      },
      projectDevCommand: {
        command: 'hs project dev',
        message: (command: string) =>
          `${command} - Set up a test environment and start local development`,
      },
      projectInstallDepsCommand: {
        command: 'hs project install-deps',
        message: (command: string) =>
          `${command} - Install all project dependencies`,
      },
      projectCommandTip: {
        message:
          'Tip: All project commands must be run from within a project directory',
      },
      sampleProjects: {
        linkText: "HubSpot's sample projects",
        url: 'https://developers.hubspot.com/docs/platform/sample-projects?utm_source=cli&utm_content=project_create_whats_next',
        message: (link: string) => `See ${link}`,
      },
    },
  },
};
