import chalk from 'chalk';
import {
  uiAccountDescription,
  uiBetaTag,
  uiCommandReference,
  uiLink,
} from '../lib/ui';
import {
  getProjectDetailUrl,
  getProjectSettingsUrl,
} from '../lib/projects/urls';
import { UI_COLORS } from '../lib/ui';

type LangFunction = (...args: never[]) => string;

type LangObject = {
  [key: string]: string | LangFunction | LangObject;
};

export const commands = {
  generalErrors: {
    srcIsProject: (src: string, command: string) =>
      `"${src}" is in a project folder. Did you mean "hs project ${command}"?`,
    handleDeprecatedEnvVariables: {
      portalEnvVarDeprecated:
        'The HUBSPOT_PORTAL_ID environment variable is deprecated. Please use HUBSPOT_ACCOUNT_ID instead.',
    },
    loadConfigMiddleware: {
      configFileExists: (configPath: string) =>
        `A configuration file already exists at ${configPath}. To specify a new configuration file, delete the existing one and try again.`,
    },
  },
  completion: {
    describe:
      'Enable bash completion shortcuts for commands. Concat the generated script to your .bashrc, .bash_profile, or .zshrc file.',
    examples: {
      default: 'Generate shell completion scripts for the zsh shell',
    },
  },
  account: {
    describe: 'Commands for managing configured accounts.',
    subcommands: {
      list: {
        accounts: `${chalk.bold('Accounts')}:`,
        defaultAccount: (account: string) =>
          `${chalk.bold('Default account')}: ${account}`,
        describe: 'List names of accounts defined in config.',
        configPath: (configPath: string) =>
          `${chalk.bold('Config path')}: ${configPath}`,
        labels: {
          accountId: 'Account ID',
          authType: 'Auth Type',
          name: 'Name',
        },
      },
      rename: {
        describe: 'Rename an account in the config.',
        positionals: {
          accountName: {
            describe: 'Name of account to be renamed.',
          },
          newName: {
            describe: 'New name for account.',
          },
        },
        success: {
          renamed: (name: string, newName: string) =>
            `Account "${name}" renamed to "${newName}"`,
        },
      },
      use: {
        describe:
          'Set the Hubspot account to use as the default account. The default account can be overridden with the "--account" option.',
        errors: {
          accountNotFound: (specifiedAccount: string, configPath: string) =>
            `The account "${specifiedAccount}" could not be found in ${configPath}`,
        },
        examples: {
          default: 'Select a HubSpot account to use as the default account',
          idBased:
            'Set the default account to the account in the config with accountId equal to "1234567"',
          nameBased:
            'Set the default account to the account in the config with name equal to "MyAccount"',
        },
        options: {
          account: {
            describe: 'Account name or id to use as the default',
          },
        },
        promptMessage: 'Select an account to use as the default',
        success: {
          defaultAccountUpdated: (accountName: string) =>
            `Default account updated to "${accountName}"`,
        },
      },
      remove: {
        describe: 'Remove an account from the config.',
        logs: {
          replaceDefaultAccount: 'The removed account was the default account.',
        },
        prompts: {
          selectAccountToRemove: 'Select an account to remove from the config',
        },
        errors: {
          accountNotFound: (specifiedAccount: string, configPath: string) =>
            `The account "${specifiedAccount}" could not be found in ${configPath}`,
        },
        examples: {
          default: 'Select a HubSpot account to remove from the config',
          byName: 'Remove the account "MyAccount" from the config',
        },
        options: {
          account: {
            describe: 'Account name or id to remove',
          },
        },
        promptMessage: 'Select an account to remove',
        success: {
          accountRemoved: (accountName: string) =>
            `Account "${accountName}" removed from the config`,
        },
      },
      info: {
        accountId: (accountId: string) =>
          `${chalk.bold('Account ID')}: ${accountId}`,
        describe:
          'Print information about the default account, or about the account specified with the "account" option.',
        errors: {
          notUsingPersonalAccessKey:
            'This command currently only supports fetching scopes for the personal access key auth type.',
        },
        examples: {
          default: 'Print information for the default account',
          idBased:
            'Print information for the account with accountId equal to "1234567"',
          nameBased:
            'Print information for the account in the config with name equal to "MyAccount"',
        },
        name: (name: string) => `${chalk.bold('Account name')}: ${name}`,
        scopeGroups: `${chalk.bold('Scopes available')}:`,
      },
      clean: {
        describe:
          'Check for inactive accounts and removes them from the CLI config.',
        noResults: 'No inactive accounts found to remove.',
        loading: {
          add: 'Looking for inactive accounts…',
        },
        inactiveAccountsFound: {
          one: '1 inactive account found:',
          other: (count: string) => `${count} inactive accounts found:`,
        },
        confirm: {
          one: 'Remove 1 inactive account from the CLI config?',
          other: (count: string) =>
            `Remove ${count} inactive accounts from the CLI config?`,
        },
        removeSuccess: (accountName: string) =>
          `Removed ${accountName} from the CLI config.`,
      },
    },
  },
  auth: {
    describe: (configName: string) =>
      `Configure authentication for your HubSpot account. This will update the ${configName} file that stores your account information.`,
    errors: {
      noConfigFileFound:
        'No config file was found. To create a new config file, use the "hs init" command.',
      unsupportedAuthType: (type: string, supportedProtocols: string) =>
        `Unsupported auth type: ${type}. The only supported authentication protocols are ${supportedProtocols}.`,
    },
    options: {
      authType: {
        describe: 'Authentication mechanism',
        defaultDescription: (authMethod: string) =>
          `"${authMethod}": An access token tied to a specific user account. This is the recommended way of authenticating with local development tools.`,
      },
      account: {
        describe: 'HubSpot account to authenticate',
      },
    },
    success: {
      configFileUpdated: (
        accountName: string,
        configFilename: string,
        authType: string
      ) =>
        `Account "${accountName}" updated in ${configFilename} using "${authType}"`,
    },
  },
  config: {
    describe: 'Commands for managing the CLI config file.',
    subcommands: {
      set: {
        describe:
          'Set various configuration options within the hubspot CLI config file.',
        promptMessage: 'Select a config option to update',
        examples: {
          default: 'Opens a prompt to select a config item to modify',
        },
        options: {
          defaultMode: {
            describe: 'Set the default CMS publish mode',
          },
          allowUsageTracking: {
            describe: 'Enable or disable usage tracking',
          },
          httpTimeout: {
            describe: 'Set the http timeout duration',
          },
          allowAutoUpdates: {
            describe: 'Enable or disable auto updates',
          },
        },
      },
    },
  },
  cms: {
    describe: 'Commands for working with the CMS.',
    subcommands: {
      lighthouseScore: {
        describe: 'Score a theme using Google lighthouse.',
        examples: {
          default: 'Get the lighthouse score for the my-theme theme',
        },
        info: {
          promptMessage: 'Select a theme to score',
          fetchingThemes: 'Fetching available themes',
          generatingScore: (theme: string) =>
            `Generating Google Lighthouse score for ${theme}`,
          targetDeviceNote: (target: string) =>
            `Scores are being shown for ${target} only.`,
          verboseOptionNote:
            'Theme scores are averages of all theme templates. Use the [--verbose] option to include individual template scores.',
          pageTemplateScoreTitle: 'Page template scores',
          lighthouseLinksTitle: 'Lighthouse links',
          failedTemplatePathsTitle:
            'The following templates could not be scored',
        },
        errors: {
          targetOptionRequired: '[--target] is required for detailed view',
          invalidTargetOption: '[--target] can only be used for detailed view',
          themeNotFound: (theme: string) =>
            `Theme "${theme}" not found. Please rerun using a valid theme path.`,
          failedToFetchThemes:
            'Failed to fetch available themes. Try running again with the [--theme] option',
          failedToGetLighthouseScore:
            'Failed to generate a Google Lighthouse score',
        },
        options: {
          theme: {
            describe: 'Path to the theme in the Design Manager',
          },
          target: {
            describe: 'Medium to test against',
          },
          verbose: {
            describe: 'View a detailed output of the lighthouse scores',
          },
        },
      },
      getReactModule: {
        describe: 'Get a specified default React module.',
        selectModulePrompt: 'Select a React module to download',
        positionals: {
          name: {
            describe: 'Name of the react modules to be fetched',
          },
          dest: {
            describe: 'Destination to download the react module to',
          },
        },
        success: {
          moduleDownloaded: (moduleName: string, path: string) =>
            `"${moduleName}" successfully downloaded to "${path}"`,
        },
        errors: {
          pathExists: (path: string) => `Folder already exists at "${path}"`,
          invalidName:
            'Module not found with that name, please check the spelling of the module you are trying to download.',
        },
      },
    },
  },
  create: {
    describe: (supportedAssetTypes: string) =>
      `Create HubSpot sample apps and CMS assets. Supported assets are ${supportedAssetTypes}.`,
    errors: {
      deprecatedAssetType: (
        assetType: string,
        newCommand: string,
        type: string
      ) =>
        `The CLI command for asset type ${assetType} has been deprecated in an effort to make it easier to know what asset types can be created. Run the ${uiCommandReference(newCommand)}" command instead. Then when prompted select "${type}".`,
      unsupportedAssetType: (assetType: string, supportedAssetTypes: string) =>
        `The asset type ${assetType} is not supported. Supported asset types are ${supportedAssetTypes}.`,
      unusablePath: (path: string) =>
        `The "${path}" is not a usable path to a directory.`,
    },
    positionals: {
      dest: {
        describe:
          'Destination folder for the new asset, relative to your current working directory. If omitted, this argument will default to your current working directory',
      },
      name: {
        describe: 'Name of new asset',
      },
      type: {
        describe: 'Type of asset',
      },
    },
    subcommands: {
      apiSample: {
        folderOverwritePrompt: (folderName: string) =>
          `The folder with name "${folderName}" already exists. Overwrite?`,
        errors: {
          nameRequired:
            'The "name" argument is required when creating an API Sample.',
          noSamples:
            'Currently there are no samples available. Please try again later.',
        },
        info: {
          sampleChosen: (sampleType: string, sampleLanguage: string) =>
            `You've chosen ${sampleType} sample written on ${sampleLanguage} language`,
        },
        success: {
          sampleCreated: (filePath: string) =>
            `Please follow ${filePath}/README.md to find out how to run the sample`,
        },
      },
      module: {
        errors: {
          nameRequired:
            'The "name" argument is required when creating a Custom Module.',
        },
      },
      template: {
        errors: {
          nameRequired:
            'The "name" argument is required when creating a Template.',
        },
      },
    },
  },
  customObject: {
    betaMessage: `${chalk.bold('[BETA]')} The Custom Object CLI is currently in beta and is subject to change.`,
    describe: 'Commands for managing custom objects.',
    seeMoreLink: 'View our docs to find out more.',
    subcommands: {
      create: {
        describe: 'Create custom object instances.',
        errors: {
          invalidObjectDefinition:
            'The object definition is invalid. Please check the schema and try again.',
          creationFailed: (definition: string) =>
            `Object creation from ${definition} failed`,
        },
        options: {
          path: {
            describe:
              'Local path to the JSON file containing an array of object definitions',
          },
        },
        positionals: {
          name: {
            describe: 'Schema name to add the object instance to',
          },
        },
        success: {
          objectsCreated: 'Objects created',
        },
        inputName:
          "[--name] Enter the name of the schema for the custom object(s) you'd like to create:",
        inputPath:
          '[--path] Enter the path to the JSON file containing the object definitions:',
      },
      schema: {
        describe: 'Commands for managing custom object schemas.',
        subcommands: {
          create: {
            describe: 'Create a custom object schema.',
            errors: {
              invalidSchema:
                'The schema definition is invalid. Please check the schema and try again.',
              creationFailed: (definition: string) =>
                `Schema creation from ${definition} failed`,
            },
            options: {
              definition: {
                describe:
                  'Local path to the JSON file containing the schema definition',
              },
            },
            success: {
              schemaCreated: (accountId: string) =>
                `Your schema has been created in account "${accountId}"`,
              schemaViewable: (url: string) => `Schema can be viewed at ${url}`,
            },
          },
          delete: {
            describe: 'Delete a custom object schema.',
            errors: {
              delete: (name: string) => `Unable to delete ${name}`,
            },
            examples: {
              default: 'Delete "schemaName" schema',
            },
            positionals: {
              name: {
                describe: 'Name of the target schema',
              },
            },
            options: {
              force: {
                describe: 'Force the deletion of the schema.',
              },
            },
            success: {
              delete: (name: string) =>
                `Successfully initiated deletion of ${name}`,
            },
            confirmDelete: (name: string) =>
              `Are you sure you want to delete the schema "${name}"?`,
            deleteCancelled: (name: string) =>
              `Deletion of schema "${name}" cancelled.`,
            selectSchema: 'Which schema would you like to delete?',
          },
          fetchAll: {
            describe: 'Fetch all custom object schemas for an account.',
            errors: {
              fetch: 'Unable to fetch schemas',
            },
            examples: {
              default:
                'Fetch all schemas for an account and put them in the current working directory',
              specifyPath:
                'Fetch all schemas for an account and put them in a directory named my/folder',
            },
            positionals: {
              dest: {
                describe: 'Local folder where schemas will be written',
              },
            },
            success: {
              fetch: (path: string) => `Saved schemas to ${path}`,
            },
            inputDest: 'Where would you like to save the schemas?',
          },
          fetch: {
            describe: 'Fetch a custom object schema.',
            errors: {
              fetch: (name: string) => `Unable to fetch ${name}`,
            },
            examples: {
              default:
                'Fetch "schemaId" schema and put it in the current working directory',
              specifyPath:
                'Fetch "schemaId" schema and put it in a directory named my/folder',
            },
            positionals: {
              dest: {
                describe: 'Local folder where schema will be written',
              },
              name: {
                describe: 'Name of the target schema',
              },
            },
            selectSchema: 'Which schema would you like to fetch?',
            inputDest: 'What would you like to name the destination file?',
            success: {
              save: (name: string, path: string) =>
                `The schema "${name}" has been saved to "${path}"`,
              savedToPath: (path: string) => `Saved schema to ${path}`,
            },
          },
          list: {
            describe: 'List custom object schemas.',
            errors: {
              list: 'Unable to list schemas',
            },
          },
          update: {
            describe: 'Update an existing custom object schema.',
            errors: {
              invalidSchema:
                'The schema definition is invalid. Please check the schema and try again.',
              update: (definition: string) =>
                `Schema update from ${definition} failed`,
            },
            options: {
              path: {
                describe:
                  'Local path to the JSON file containing the schema definition',
              },
            },
            positionals: {
              name: {
                describe: 'Name of the target schema',
              },
            },
            success: {
              update: (accountId: string) =>
                `Your schema has been updated in account "${accountId}"`,
              viewAtUrl: (url: string) => `Schema can be viewed at ${url}`,
            },
            selectSchema: 'Which schema would you like to update?',
          },
        },
      },
    },
  },
  doctor: {
    describe:
      'Retrieve diagnostic information about your local HubSpot configurations.',
    options: {
      outputDir: 'Directory to save a detailed diagnosis JSON file in',
    },
    errors: {
      generatingDiagnosis: 'Error generating diagnosis',
      unableToWriteOutputFile: (file: string, errorMessage: string) =>
        `Unable to write output to ${chalk.bold(file)}, ${errorMessage}`,
    },
    outputWritten: (filename: string) =>
      `Output written to ${chalk.bold(filename)}`,
  },
  fetch: {
    describe:
      'Fetch a file, directory or module from HubSpot and write to a path on your computer.',
    errors: {
      sourceRequired: 'A source to fetch is required.',
    },
    options: {
      staging: {
        describe: 'Retrieve staged changes for project',
      },
      assetVersion: {
        describe: 'Specify what version of a default asset to fetch',
      },
    },
    positionals: {
      dest: {
        describe:
          'Local directory you would like the files to be placed in, relative to your current working directory',
      },
      src: {
        describe: 'Path in HubSpot Design Tools',
      },
    },
  },
  filemanager: {
    describe: 'Commands for managing files in the File Manager.',
    subcommands: {
      fetch: {
        describe: 'Fetch a folder or file from the File Manager.',
        errors: {
          sourceRequired: 'A source to fetch is required.',
        },
        options: {
          includeArchived: {
            describe: 'Include files that have been marked as "archived"',
          },
        },
        positionals: {
          dest: {
            describe: 'Path in HubSpot Design Tools',
          },
          src: {
            describe:
              'Path to the local directory you would like the files to be placed, relative to your current working directory. If omitted, this argument will default to your current working directory',
          },
        },
      },
      upload: {
        describe: 'Upload a folder or file to the File Manager.',
        errors: {
          destinationRequired: 'A destination path needs to be passed',
          fileIgnored: (path: string) =>
            `The file "${path}" is being ignored via an .hsignore rule`,
          invalidPath: (path: string) =>
            `The path "${path}" is not a path to a file or folder`,
          upload: (src: string, dest: string) =>
            `Uploading file "${src}" to "${dest}" failed`,
          uploadingFailed: 'Uploading failed',
        },
        logs: {
          uploading: (src: string, dest: string, accountId: string) =>
            `Uploading files from "${src}" to "${dest}" in the File Manager of account ${accountId}`,
        },
        positionals: {
          dest: {
            describe: 'Path in HubSpot Design Tools, can be a net new path',
          },
          src: {
            describe:
              'Path to the local file, relative to your current working directory',
          },
        },
        success: {
          upload: (src: string, dest: string, accountId: string) =>
            `Uploaded file from "${src}" to "${dest}" in the File Manager of account ${accountId}`,
          uploadComplete: (dest: string) =>
            `Uploading files to "${dest}" in the File Manager is complete`,
        },
      },
    },
  },
  function: {
    describe: 'Commands for managing CMS serverless functions.',
    subcommands: {
      deploy: {
        debug: {
          startingBuildAndDeploy: (functionPath: string) =>
            `Starting build and deploy for .functions folder with path: ${functionPath}`,
        },
        errors: {
          buildError: (details: string) => `Build error: ${details}`,
          noPackageJson: (functionPath: string) =>
            `Unable to find package.json for function ${functionPath}.`,
          notFunctionsFolder: (functionPath: string) =>
            `Specified path ${functionPath} is not a .functions folder.`,
        },
        examples: {
          default:
            'Build and deploy a new bundle for all functions within the myFunctionFolder.functions folder',
        },
        loading: (functionPath: string, account: string) =>
          `Building and deploying bundle for "${functionPath}" on ${account}`,
        loadingFailed: (functionPath: string, account: string) =>
          `Failed to build and deploy bundle for "${functionPath}" on ${account}`,
        positionals: {
          path: {
            describe: 'Path to the ".functions" folder',
          },
        },
        success: {
          deployed: (
            functionPath: string,
            accountId: string,
            buildTimeSeconds: string
          ) =>
            `Built and deployed bundle from package.json for ${functionPath} on account ${accountId} in ${buildTimeSeconds}s.`,
        },
      },
      list: {
        debug: {
          gettingFunctions: 'Getting currently deployed functions',
        },
        describe: 'List the currently deployed CMS serverless functions.',
        info: {
          noFunctions: 'No functions found',
        },
        options: {
          json: {
            describe: 'output raw json data',
          },
        },
      },
      server: {
        debug: {
          startingServer: (functionPath: string) =>
            `Starting local test server for .functions folder with path: ${functionPath}`,
        },
        examples: {
          default: 'Run a local function test server.',
        },
        options: {
          contact: {
            describe: 'Pass contact data to the test function',
          },
          logOutput: {
            describe:
              'Output the response body from the serverless function execution (It is suggested not to use this in production environments as it can reveal any secure data returned by the function in logs)',
          },
          port: {
            describe: 'Port to run the test server on',
          },
          watch: {
            describe:
              'Watch the specified .functions folder for changes and restart the server',
          },
        },
        positionals: {
          path: {
            describe: 'Path to local .functions folder',
          },
        },
      },
    },
  },
  hubdb: {
    describe: 'Commands for managing HubDB tables.',
    subcommands: {
      clear: {
        describe: 'Clear all rows in a HubDB table.',
        logs: {
          removedRows: (deletedRowCount: string, tableId: string) =>
            `Removed ${deletedRowCount} rows from HubDB table ${tableId}`,
          rowCount: (tableId: string, rowCount: string) =>
            `HubDB table ${tableId} now contains ${rowCount} rows`,
          tableEmpty: (tableId: string) =>
            `HubDB table ${tableId} is already empty`,
        },
        positionals: {
          tableId: {
            describe: 'HubDB Table ID',
          },
        },
      },
      create: {
        describe: 'Create a HubDB table.',
        enterPath: '[--path] Enter the local path to the file used for import:',
        errors: {
          create: (filePath: string) =>
            `Creating the table at "${filePath}" failed`,
          pathRequired:
            'A path to a local file with a HubDB schema is required to create a HubDB table',
          invalidCharacters:
            'The selected file path contains invalid characters. Please provide a new path and try again.',
        },
        options: {
          path: {
            describe: 'Local path to file used for import',
          },
        },
        success: {
          create: (tableId: string, accountId: string, rowCount: string) =>
            `The table ${tableId} was created in ${accountId} with ${rowCount} rows`,
        },
      },
      delete: {
        describe: 'Delete a HubDB table.',
        shouldDeleteTable: (tableId: string) =>
          `Proceed with deleting HubDB table ${tableId}?`,
        errors: {
          delete: (tableId: string) => `Deleting the table ${tableId} failed`,
        },
        positionals: {
          tableId: {
            describe: 'HubDB Table ID',
          },
        },
        options: {
          force: {
            describe: 'Skips confirmation prompt when deleting a HubDB table',
          },
        },
        success: {
          delete: (tableId: string, accountId: string) =>
            `The table ${tableId} was deleted from ${accountId}`,
        },
      },
      fetch: {
        describe: 'Fetch the schema for a HubDB table.',
        positionals: {
          dest: {
            describe: 'Local destination folder to fetch table to',
          },
          tableId: {
            describe: 'HubDB Table ID',
          },
        },
        success: {
          fetch: (tableId: string, path: string) =>
            `Downloaded HubDB table ${tableId} to ${path}`,
        },
      },
    },
  },
  init: {
    describe: (configName: string) =>
      `Configure authentication for your HubSpot account. This will create a ${configName} file to store your account information.`,
    options: {
      authType: {
        describe: 'Authentication mechanism',
        defaultDescription: (authMethod: string) =>
          `"${authMethod}": An access token tied to a specific user account. This is the recommended way of authenticating with local development tools.`,
      },
      account: {
        describe: 'HubSpot account to authenticate',
      },
      useHiddenConfig: {
        describe:
          "Use the new HubSpot configuration file located in a hidden file in the user's home directory",
      },
    },
    success: {
      configFileCreated: (configPath: string) =>
        `Created config file "${configPath}"`,
      configFileUpdated: (account: string, authType: string) =>
        `Connected account "${account}" using "${authType}" and set it as the default account`,
    },
    logs: {
      updateConfig:
        'To update an existing config file, use the "hs auth" command.',
    },
    errors: {
      configFileExists: (configPath: string) =>
        `The config file ${configPath} already exists.`,
      bothConfigFilesNotAllowed: (path: string) =>
        `Unable to create config file, because there is an existing one at "${path}". To create a new config file, delete the existing one and try again.`,
    },
  },
  lint: {
    issuesFound: (count: string) => `${count} issues found.`,
    groupName: (path: string) => `Linting ${path}`,
    positionals: {
      path: {
        describe: 'Local folder to lint',
      },
    },
  },
  list: {
    describe: 'List remote contents of a directory.',
    gettingPathContents: (path: string) => `Getting contents of ${path}.`,
    noFilesFoundAtPath: (path: string) => `No files found in ${path}.`,
    positionals: {
      path: {
        describe: 'Remote directory to list contents',
      },
    },
  },
  logs: {
    describe: 'View logs for a CMS serverless function.',
    errors: {
      noLogsFound: (functionPath: string, accountId: string) =>
        `No logs were found for the function path "${functionPath}" in account "${accountId}".`,
    },
    examples: {
      default:
        'Get 5 most recent logs for function residing at /_hcms/api/my-endpoint',
      follow:
        'Poll for and output logs for function residing at /_hcms/api/my-endpoint immediately upon new execution',
      limit:
        'Get 10 most recent logs for function residing at /_hcms/api/my-endpoint',
    },
    endpointPrompt: 'Enter a serverless function endpoint:',
    gettingLogs: (latest: string, functionPath: string) =>
      `Getting ${latest ? 'latest ' : ''}logs for function with path: ${functionPath}.`,
    options: {
      compact: {
        describe: 'output compact logs',
      },
      follow: {
        describe: 'follow logs',
      },
      latest: {
        describe: 'retrieve most recent log only',
      },
      limit: {
        describe: 'limit the number of logs to output',
      },
    },
    positionals: {
      endpoint: {
        describe: 'Serverless function endpoint',
      },
    },
    tailLogs: (functionPath: string, accountId: string) =>
      `Waiting for log entries for "${functionPath}" on account "${accountId}".\n`,
  },
  mv: {
    describe:
      'Move a remote file or folder in HubSpot. This feature is currently in beta and the CLI contract is subject to change.',
    errors: {
      sourcePathExists: (srcPath: string, destPath: string) =>
        `The folder "${srcPath}" already exists in "${destPath}".`,
      moveFailed: (srcPath: string, destPath: string, accountId: string) =>
        `Moving "${srcPath}" to "${destPath}" in account ${accountId} failed`,
    },
    move: (srcPath: string, destPath: string, accountId: string) =>
      `Moved "${srcPath}" to "${destPath}" in account ${accountId}`,
  },
  open: {
    describe: 'Open a HubSpot page in your browser.',
    options: {
      list: {
        describe: 'List all supported shortcuts',
      },
    },
    positionals: {
      shortcut: {
        describe: "Shortcut of the link you'd like to open",
      },
    },
    selectLink: 'Select a link to open',
  },
  project: {
    profile: {
      describe: 'Commands for managing project profiles',
      verboseDescribe: `Commands for managing project profiles\n\nProfiles are stored at the root of your project's source directory and they make configuration dynamic. Use them to couple specialized configurations of your project to specific HubSpot accounts.\n\nRun ${uiCommandReference('hs project profile add')} to get started!`,
      add: {
        describe: 'Add a new project profile',
        verboseDescribe: `Add a new project profile\n\nProfiles enable you to reference variables in your component configuration files. Use the syntax ${chalk.bold('\${VARIABLE_NAME}')} to reference profile variables in your component configuration files. Then target the profile using the ${uiCommandReference('--profile')} flag when you upload your project.`,
        example: 'Add a new project profile named hsprofile.qa.json',
        logs: {
          copyExistingProfile: (profileName: string) =>
            `Found an existing profile. We can copy the variables from ${chalk.bold(
              profileName
            )} into your new profile.`,
          copyExistingProfiles:
            'We can copy the variables from one of your existing profiles into your new profile.',
          profileAdded: (profileName: string) =>
            `Project profile ${chalk.bold(profileName)} was successfully added`,
        },
        prompts: {
          namePrompt: '[name] Enter a name for the new project profile: ',
          emptyName: 'Profile name cannot be empty',
          targetAccountPrompt:
            '[target-account] Select a target account for this profile',
          copyExistingProfilePrompt: 'Select a profile to copy variables from',
          copyExistingProfilePromptEmpty: "Skip (don't copy any variables)",
          invalidProfileName:
            'Profile name cannot contain special characters or spaces',
        },
        warnings: {
          duplicateTargetAccount: (targetAccountId: number) =>
            `The account ${uiAccountDescription(targetAccountId)} is being used in an existing profile. Make sure to edit your project's name between uploads if you do not want to overwrite the existing project in this account.`,
        },
        errors: {
          noProjectConfig:
            'No project config found. Please run this command from a project directory.',
          profileExists: (profileName: string) =>
            `Profile ${chalk.bold(profileName)} already exists. Please choose a different name.`,
          invalidTargetAccount: 'Target account is not configured in the CLI',
          noAccountsConfigured: 'No accounts configured in the CLI',
          failedToLoadProfile: (profileName: string) =>
            `Unable to copy variables. Failed to load profile ${chalk.bold(profileName)}`,
          failedToCreateProfile: 'Failed to create profile',
        },
        positionals: {
          name: 'The name of the project profile',
        },
        options: {
          targetAccount: 'The target account ID for this profile',
        },
      },
      remove: {
        describe: 'Remove an existing project profile',
        example: 'Remove a project profile named hsprofile.qa.json',
        logs: {
          profileRemoved: (profileName: string) =>
            `Project profile ${chalk.bold(profileName)} was successfully removed`,
          removedProject: (accountId: number) =>
            `Successfully removed the project from ${uiAccountDescription(
              accountId
            )}`,
          didNotRemoveProject: (accountId: number) =>
            `Did not remove the project from ${uiAccountDescription(
              accountId
            )}`,
        },
        debug: {
          failedToLoadProfile: (profileName: string) =>
            `Failed to load profile ${chalk.bold(profileName)}`,
        },
        prompts: {
          removeProfilePrompt: 'Select a profile to remove from your project',
          removeProjectPrompt: (accountId: number) =>
            `Would you like to remove this project from ${uiAccountDescription(
              accountId
            )}?`,
        },
        errors: {
          noProjectConfig:
            'No project config found. Please run this command from a project directory.',
          noProfileFound: (profileName: string) =>
            `No profile with filename ${chalk.bold(profileName)} found in your project.`,
          failedToRemoveProfile: (profileName: string) =>
            `Unable to remove profile ${chalk.bold(profileName)}. Please try again.`,
        },
        positionals: {
          name: 'The name of the project profile',
        },
      },
    },
    dev: {
      describe: 'Start local dev for the current project.',
      logs: {
        betaMessage: 'HubSpot projects local development',
        placeholderAccountSelection:
          'Using default account as target account (for now)',
        learnMoreLocalDevServer:
          'Learn more about the projects local dev server',
        accountTypeInformation:
          'Testing in a developer test account is strongly recommended, but you can use a sandbox account if your plan allows you to create one.',
        learnMoreMessage: `Visit our ${uiLink('docs on Developer Test and Sandbox accounts', 'https://developers.hubspot.com/docs/getting-started/account-types')} to learn more.`,
      },
      errors: {
        noProjectConfig:
          'No project detected. Please run this command again from a project directory.',
        noAccount: (accountId: string, authCommand: string) =>
          `An error occurred while reading account ${accountId} from your config. Run ${chalk.bold(authCommand)} to re-auth this account.`,
        noAccountsInConfig: (authCommand: string) =>
          `No accounts found in your config. Run ${chalk.bold(authCommand)} to configure a HubSpot account with the CLI.`,
        invalidProjectComponents:
          'Projects cannot contain both private and public apps. Move your apps to separate projects before attempting local development.',
        noRunnableComponents: (command: string) =>
          `No supported components were found in this project. Run ${chalk.bold(command)} to see a list of available components and add one to your project.`,
      },
      examples: {
        default: 'Start local dev for the current project',
      },
    },
    create: {
      describe: 'Create a new project.',
      errors: {
        failedToDownloadProject:
          'Failed to download project. Please try again later.',
        invalidTemplateSource:
          'Invalid template source provided. Use the format <Owner>/<Repo> and try again.',
        failedToFetchProjectList:
          'Failed to fetch the list of available project templates. Please try again later.',
        cannotNestProjects: (projectDir: string) =>
          `A project already exists at ${projectDir}. Projects cannot be nested within other projects. Please choose a different destination and try again.`,
      },
      logs: {
        success: (projectName: string, projectDest: string) =>
          `Project ${chalk.bold(projectName)} was successfully created in ${projectDest}`,
        welcomeMessage: 'Welcome to HubSpot Developer Projects!',
      },
      examples: {
        default: 'Create a new project',
        templateSource:
          'Create a new project from a custom GitHub repository. The repository must contain a valid project template and a config.json file defining the available templates',
      },
      options: {
        dest: {
          describe: 'Directory where the project should be created',
        },
        name: {
          describe: 'Project name (cannot be changed)',
        },
        template: {
          describe: 'The starting template',
        },
        templateSource: {
          describe:
            'Path to custom GitHub repository from which to create project template',
        },
      },
    },
    migrateApp: {
      describe: 'Migrate a public app to the projects framework.',
      examples: {
        default: 'Migrate a public app to the projects framework',
      },
      options: {
        appId: {
          describe:
            'The ID for the public app being migrated to the projects framework',
        },
        dest: {
          describe: 'Directory where the project should be created',
        },
        name: {
          describe: 'Project name (cannot be changed)',
        },
      },
      header: {
        text: 'This command will migrate an app to the projects framework. It will walk you through the fields required to complete the migration and download the project source code into a directory of your choosing.',
        link: 'Learn more about migrating apps to the projects framework',
      },
      deprecationWarning: (oldCommand: string, newCommand: string) =>
        `The ${oldCommand} command is deprecated and will be removed. Use ${newCommand} going forward.`,
      migrationStatus: {
        inProgress: () =>
          `Converting app configuration to ${chalk.bold('public-app.json')} component definition ...`,
        success: () =>
          `${chalk.bold('Your app was converted and build #1 is deployed')}`,
        done: () =>
          'Converting app configuration to public-app.json component definition ... DONE',
        failure: () =>
          'Converting app configuration to public-app.json component definition ... FAILED',
      },
      warning: {
        title: () =>
          `${chalk.bold('You are about to migrate an app to the projects framework')}`,
        projectConversion: () =>
          `${chalk.bold('The selected app will be converted to a project component.')}`,
        appConfig: () =>
          `All supported app configuration will be moved to the ${chalk.bold('public-app.json')} component definition file. Future updates to those features must be made through the project build and deploy pipeline, not the developer account UI.`,
        buildAndDeploy:
          'This will create a new project with a single app component and immediately build and deploy it to your developer account (build #1).',
        existingApps: () =>
          `${chalk.bold('This will not affect existing app users or installs.')}`,
        copyApp:
          'We strongly recommend making a copy of your app to test this process in a development app before replacing production.',
      },
      migrationInterrupted:
        '\nThe command is terminated, but app migration is still in progress. Please check your account to ensure that the project and associated app have been created successfully.',
      createAppPrompt:
        "Proceed with migrating this app to a project component (this process can't be aborted)?",
      projectDetailsLink: 'View project details in your developer account',
    },
    migrate: {
      preamble: (platformVersion: string) =>
        `This command will migrate an existing project to platformVersion ${platformVersion}.  It will walk you through the fields required to complete the migration and download the new project source code into the project source directory.  It will also copy all of your existing files to a new directory (archive) in case you need access to your old files later.`,
      describe:
        'Migrate an existing project to the new version of the projects framework.',
      errors: {
        noProjectConfig: (command: string) =>
          `No project detected. Please run this command again from a project directory.  If you are trying to migrate an app, run ${command}`,
      },
      examples: {
        default:
          'Migrate an existing project to the new version of the projects framework.',
      },
    },
    cloneApp: {
      describe: 'Clone a public app using the projects framework.',
      examples: {
        default: 'Clone a public app using the projects framework',
      },
      options: {
        appId: {
          describe: 'The ID for the public app being cloned',
        },
        dest: {
          describe: 'Directory where the project should be created',
        },
      },
      cloneStatus: {
        inProgress: () =>
          `Cloning app configuration to ${chalk.bold('public-app.json')} component definition ...`,
        done: 'Cloning app configuration to public-app.json component definition ... DONE',
        success: (dest: string) => `Your cloned project was created in ${dest}`,
        failure:
          'Cloning app configuration to public-app.json component definition ... FAILED',
      },
      errors: {
        invalidAccountTypeTitle: () =>
          `${chalk.bold('Developer account not targeted')}`,
        invalidAccountTypeDescription: (
          useCommand: string,
          authCommand: string
        ) =>
          `Only public apps created in a developer account can be converted to a project component. Select a connected developer account with ${useCommand} or ${authCommand} and try again.`,
        couldNotWriteConfigPath: (configPath: string) =>
          `Failed to write project config at ${configPath}`,
      },
    },
    add: {
      describe: 'Create a new component within a project.',
      options: {
        name: {
          describe: 'The name for your newly created component',
        },
        type: {
          describe:
            "The path to the component type's location within the hubspot-project-components Github repo: https://github.com/HubSpot/hubspot-project-components",
        },
      },
      creatingComponent: (projectName: string) =>
        `Adding a new component to ${chalk.bold(projectName)}`,
      success: (componentName: string) =>
        `${componentName} was successfully added to your project.`,
      error: {
        failedToDownloadComponent:
          'Failed to download project component. Please try again later.',
        locationInProject:
          'This command must be run from within a project directory.',
        failedToFetchComponentList:
          'Failed to fetch the list of available components. Please try again later.',
        projectContainsPublicApp:
          'This project contains a public app. This command is currently only compatible with projects that contain private apps.',
      },
      examples: {
        default: 'Create a component within your project',
        withFlags: 'Use --name and --type flags to bypass the prompt.',
      },
    },
    deploy: {
      describe: 'Deploy a project build.',
      deployBuildIdPrompt: '[--build] Deploy which build?',
      debug: {
        deploying: (path: string) => `Deploying project at path: ${path}`,
      },
      errors: {
        deploy: (details: string) => `Deploy error: ${details}`,
        noBuilds: 'Deploy error: no builds for this project were found.',
        noBuildId: 'You must specify a build to deploy',
        projectNotFound: (
          projectName: string,
          accountIdentifier: string,
          command: string
        ) =>
          `The project ${chalk.bold(projectName)} does not exist in account ${accountIdentifier}. Run ${command} to upload your project files to HubSpot.`,
        buildIdDoesNotExist: (
          buildId: string,
          projectName: string,
          linkToProject: string
        ) =>
          `Build ${buildId} does not exist for project ${chalk.bold(projectName)}. ${linkToProject}`,
        buildAlreadyDeployed: (buildId: string, linkToProject: string) =>
          `Build ${buildId} is already deployed. ${linkToProject}`,
        viewProjectsBuilds: 'View project builds in HubSpot',
      },
      examples: {
        default: 'Deploy the latest build of the current project',
        withOptions: 'Deploy build 5 of the project my-project',
      },
      options: {
        build: {
          describe: 'Project build ID to be deployed',
        },
        project: {
          describe: 'Project name',
        },
      },
    },
    listBuilds: {
      describe: "List the project's builds.",
      continueOrExitPrompt: 'Press <enter> to load more, or ctrl+c to exit',
      viewAllBuildsLink: 'View all builds',
      showingNextBuilds: (count: string, projectName: string) =>
        `Showing the next ${count} builds for ${projectName}`,
      showingRecentBuilds: (
        count: string,
        projectName: string,
        viewAllBuildsLink: string
      ) =>
        `Showing the most ${count} recent builds for ${projectName}. ${viewAllBuildsLink}.`,
      errors: {
        noBuilds: 'No builds for this project were found.',
        projectNotFound: (projectName: string) =>
          `Project ${projectName} not found.`,
      },
      options: {
        project: {
          describe: 'Project name',
        },
        limit: {
          describe: 'Limit the number of builds to output',
        },
      },
      examples: {
        default: 'List the builds for the current project',
      },
    },
    logs: {
      describe:
        'Get execution logs for a serverless function within a project.',
      errors: {
        noProjectConfig:
          'No project detected. Run this command again from a project directory.',
        failedToFetchProjectDetails:
          'There was an error fetching project details',
        noFunctionsLinkText: 'Visit developer docs',
        noFunctionsInProject: `There aren't any functions in this project\n\t- Run ${uiCommandReference('hs project logs --help')} to learn more about logs\n\t- ${uiLink(
          'Visit developer docs',
          'https://developers.hubspot.com/docs/platform/serverless-functions'
        )} to learn more about serverless functions`,
        noFunctionWithName: (name: string) => `No function with name "${name}"`,
        functionNotDeployed: (name: string) =>
          `The function with name "${name}" is not deployed`,
        projectLogsManagerNotInitialized:
          'Function called on ProjectLogsManager before initialization',
        generic: 'Error fetching logs',
      },
      logs: {
        showingLogs: 'Showing logs for:',
        hubspotLogsDirectLink: 'View function logs in HubSpot',
        noLogsFound: (name: string) => `No logs were found for "${name}"`,
      },
      table: {
        accountHeader: 'Account',
        functionHeader: 'Function',
        endpointHeader: 'Endpoint',
      },
      examples: {
        default:
          'Open the project logs prompt to get logs for a serverless function',
        withOptions:
          'Get logs for function named "my-function" within the app named "app" within the project named "my-project"',
      },
      options: {
        app: {
          describe: 'App name',
        },
        compact: {
          describe: 'Output compact logs',
        },
        tail: {
          describe: 'Tail logs',
        },
        latest: {
          describe: 'Retrieve most recent log only',
        },
        limit: {
          describe: 'Limit the number of logs to output',
        },
        function: {
          describe: 'App function name',
        },
      },
    },
    upload: {
      describe: 'Upload your project files and create a new build.',
      examples: {
        default: 'Upload a project into your HubSpot account',
      },
      logs: {
        buildSucceeded: (buildId: string) => `Build #${buildId} succeeded\n`,
        readyToGoLive: '🚀 Ready to take your project live?',
        runCommand: (command: string) => `Run \`${command}\``,
        autoDeployDisabled: (deployCommand: string) =>
          `Automatic deploys are disabled for this project. Run ${deployCommand} to deploy this build.`,
      },
      errors: {
        projectLockedError: () =>
          `Your project is locked. This may mean that another user is running the ${chalk.bold('`hs project dev`')} command for this project. If this is you, unlock the project in Projects UI.`,
      },
      options: {
        forceCreate: {
          describe: 'Automatically create project if it does not exist',
        },
        message: {
          describe:
            'Add a message when you upload your project and create a build',
        },
      },
    },
    watch: {
      describe:
        'Watch your local project for changes and automatically upload changed files to a new build in HubSpot.',
      examples: {
        default: 'Start watching the current project',
      },
      logs: {
        processExited: 'Stopping watcher...',
        watchCancelledFromUi: `The watch process has been cancelled from the UI. Any changes made since cancelling have not been uploaded. To resume watching, rerun ${uiCommandReference('hs project watch')}.`,
        resuming: 'Resuming watcher...',
        uploadSucceeded: (remotePath: string, filePath: string) =>
          `Uploaded file "${filePath}" to "${remotePath}"`,
        deleteFileSucceeded: (remotePath: string) =>
          `Deleted file "${remotePath}"`,
        deleteFolderSucceeded: (remotePath: string) =>
          `Deleted folder "${remotePath}"`,
        watching: (projectDir: string) =>
          `Watcher is ready and watching "${projectDir}". Any changes detected will be automatically uploaded.`,
        previousStagingBuildCancelled:
          'Killed the previous watch process. Please try running `hs project watch` again',
      },
      options: {
        initialUpload: {
          describe: 'Upload directory before watching for updates',
        },
      },
      debug: {
        pause: 'Pausing watcher, attempting to queue build',
        buildStarted: 'Build queued.',
        extensionNotAllowed: (filePath: string) =>
          `Skipping "${filePath}" due to unsupported extension`,
        ignored: (filePath: string) =>
          `Skipping "${filePath}" due to an ignore rule`,
        uploading: (filePath: string, remotePath: string) =>
          `Attempting to upload file "${filePath}" to "${remotePath}"`,
        attemptNewBuild: 'Attempting to create a new build',
        fileAlreadyQueued: (filePath: string) =>
          `File "${filePath}" is already queued for upload`,
      },
      errors: {
        projectConfigNotFound:
          'No project config found. Please ensure that you are in a project directory.',
        projectLockedError: `Your project is locked. This may mean that another user is running the ${chalk.bold(`hs project dev`)} command for this project. If this is you, unlock the project in Projects UI.`,
        uploadFailed: (remotePath: string, filePath: string) =>
          `Failed to upload file "${filePath}" to "${remotePath}"`,
        deleteFileFailed: (remotePath: string) =>
          `Failed to delete file "${remotePath}"`,
        deleteFolderFailed: (remotePath: string) =>
          `Failed to delete folder "${remotePath}"`,
      },
    },
    download: {
      describe: 'Download your project files from HubSpot.',
      examples: {
        default: 'Download the project myProject into myProjectFolder folder',
      },
      logs: {
        downloadCancelled: 'Cancelling project download',
        downloadSucceeded: (buildId: string, projectName: string) =>
          `Downloaded build "${buildId}" from project "${projectName}"`,
      },
      errors: {
        downloadFailed: 'Something went wrong downloading the project',
        projectNotFound: (projectName: string, accountId: string) =>
          `Your project ${chalk.bold(projectName)} could not be found in ${accountId}`,
      },
      warnings: {
        cannotDownloadWithinProject:
          'Cancelling project download. Please run the command again outside the context of an existing project.',
      },
      options: {
        build: {
          describe: 'The build to download',
        },
        project: {
          describe: 'The name of the project to download',
        },
        dest: {
          describe: 'Destination folder for the project',
        },
      },
    },
    open: {
      describe: "Open the project's details page in the browser.",
      options: {
        project: {
          describe: 'Name of project to open',
        },
      },
      examples: {
        default: 'Opens the projects page for the specified account',
      },
      success: (projectName: string) => `Successfully opened "${projectName}"`,
    },
    feedback: {
      describe: 'Leave feedback or file a bug report.',
      openPrompt: 'Open the feedback form in your browser?',
      success: (url: string) =>
        `We opened ${uiLink('the developer feedback form', url)} in your browser.`,
      error: (url: string) =>
        `Navigate to ${uiLink('the developer feedback form', url)} to leave feedback.`,
    },
    installDeps: {
      help: {
        describe:
          'Install the dependencies for your project, or add a dependency to a subcomponent of a project.',
        installAppDepsExample: 'Install the dependencies for the project',
        addDepToSubComponentExample:
          'Install the dependencies to one or more project subcomponents',
      },
      installLocationPrompt:
        'Choose the project components to install the dependencies:',
      installLocationPromptRequired:
        'You must choose at least one subcomponent',
      installingDependencies: (directory: string) =>
        `Installing dependencies in ${directory}`,
      installationSuccessful: (directory: string) =>
        `Installed dependencies in ${directory}`,
      addingDependenciesToLocation: (dependencies: string, directory: string) =>
        `Installing ${dependencies} in ${directory}`,
      installingDependenciesFailed: (directory: string) =>
        `Installing dependencies for ${directory} failed`,
      noProjectConfig:
        'No project detected. Run this command from a project directory.',
      noPackageJsonInProject: (projectName: string, link: string) =>
        `No dependencies to install. The project ${projectName} folder might be missing component or subcomponent files. ${link}`,
      packageManagerNotInstalled: (packageManager: string, link: string) =>
        `This command depends on ${packageManager}, install ${chalk.bold(link)}`,
    },
  },
  remove: {
    describe: 'Delete a file or folder from HubSpot.',
    deleted: (path: string, accountId: string) =>
      `Deleted "${path}" from account ${accountId}`,
    errors: {
      deleteFailed: (path: string, accountId: string) =>
        `Deleting "${path}" from account ${accountId} failed`,
    },
    positionals: {
      path: {
        describe: 'Remote hubspot path',
      },
    },
  },
  sandbox: {
    describe: 'Commands for managing sandboxes.',
    subcommands: {
      create: {
        developer: {
          loading: {
            add: (accountName: string) =>
              `Creating developer sandbox ${chalk.bold(accountName)}`,
            fail: (accountName: string) =>
              `Failed to create a developer sandbox ${chalk.bold(accountName)}.`,
            succeed: (accountName: string, accountId: string) =>
              `Successfully created a developer sandbox ${chalk.bold(accountName)} with portalId ${chalk.bold(accountId)}.`,
          },
          success: {
            configFileUpdated: (accountName: string, authType: string) =>
              `Account "${accountName}" updated using "${authType}"`,
          },
          failure: {
            invalidUser: (accountName: string, parentAccountName: string) =>
              `Couldn't create ${chalk.bold(accountName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to create the sandbox. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
            limit: (accountName: string, limit: string) =>
              `${chalk.bold(accountName)} reached the limit of ${limit} developer sandboxes. \n- To connect a developer sandbox to your HubSpot CLI, run ${chalk.bold('hs auth')} and follow the prompts.`,
            alreadyInConfig: (accountName: string, limit: string) =>
              `${chalk.bold(accountName)} reached the limit of ${limit} developer sandboxes. \n- To use an existing developer sandbox, run ${chalk.bold('hs accounts use')}.`,
            scopes: {
              message:
                "The personal access key you provided doesn't include developer sandbox permissions.",
              instructions: (accountName: string, url: string) =>
                `To update CLI permissions for "${accountName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes developer sandbox permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
            },
          },
        },
        standard: {
          loading: {
            add: (accountName: string) =>
              `Creating standard sandbox ${chalk.bold(accountName)}`,
            fail: (accountName: string) =>
              `Failed to create a standard sandbox ${chalk.bold(accountName)}.`,
            succeed: (accountName: string, accountId: string) =>
              `Successfully created a standard sandbox ${chalk.bold(accountName)} with portalId ${chalk.bold(accountId)}.`,
          },
          success: {
            configFileUpdated: (accountName: string, authType: string) =>
              `Account "${accountName}" updated using "${authType}"`,
          },
          failure: {
            invalidUser: (accountName: string, parentAccountName: string) =>
              `Couldn't create ${chalk.bold(accountName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to create the sandbox. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
            limit: (accountName: string, limit: string) =>
              `${chalk.bold(accountName)} reached the limit of ${limit} standard sandboxes. \n- To connect a standard sandbox to your HubSpot CLI, run ${chalk.bold('hs auth')} and follow the prompts.`,
            alreadyInConfig: (accountName: string, limit: string) =>
              `${chalk.bold(accountName)} reached the limit of ${limit} standard sandboxes. \n- To use an existing standard sandbox, run ${chalk.bold('hs accounts use')}.`,
            scopes: {
              message:
                "The personal access key you provided doesn't include standard sandbox permissions.",
              instructions: (accountName: string, url: string) =>
                `To update CLI permissions for "${accountName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes standard sandbox permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
            },
          },
        },
      },
      delete: {
        describe: 'Delete a sandbox account.',
        debug: {
          deleting: (account: string) =>
            `Deleting sandbox account "${account}"`,
          error: 'Error deleting sandbox account:',
        },
        examples: {
          default: 'Deletes the sandbox account named MySandboxAccount.',
        },
        confirm: (account: string) =>
          `Delete sandbox ${chalk.bold(account)}? All data for this sandbox will be permanently deleted.`,
        defaultAccountWarning: (account: string) =>
          `The sandbox ${chalk.bold(account)} is currently set as the default account.`,
        success: {
          delete: (account: string, sandboxHubId: string) =>
            `Sandbox "${account}" with portalId "${sandboxHubId}" was deleted successfully.`,
          deleteDefault: (account: string, sandboxHubId: string) =>
            `Sandbox "${account}" with portalId "${sandboxHubId}" was deleted successfully and removed as the default account.`,
          configFileUpdated: (account: string, configFilename: string) =>
            `Removed account ${account} from ${configFilename}.`,
        },
        failure: {
          invalidUser: (accountName: string, parentAccountName: string) =>
            `Couldn't delete ${accountName} because your account has been removed from ${parentAccountName} or your permission set doesn't allow you to delete the sandbox. To update your permissions, contact a super admin in ${parentAccountName}.`,
          noAccount:
            'No account specified. Specify an account by using the --account flag.',
          noSandboxAccounts: (authCommand: string) =>
            `There are no sandboxes connected to the CLI. To add a sandbox, run ${authCommand}.`,
          noSandboxAccountId:
            "This sandbox can't be deleted from the CLI because we could not find the associated sandbox account.",
          noParentAccount: (authCommand: string) =>
            `This sandbox can't be deleted from the CLI because you haven't given the CLI access to its parent account. To do this, run ${authCommand} and add the parent account.`,
          objectNotFound: (account: string) =>
            `Sandbox ${chalk.bold(account)} may have been deleted through the UI. The account has been removed from the config.`,
          noParentPortalAvailable: (command: string, url: string) =>
            `This sandbox can't be deleted from the CLI because you haven't given the CLI access to its parent account. To do this, run ${command}. You can also delete the sandbox from the HubSpot management tool: ${chalk.bold(url)}.`,
          invalidKey: (account: string, authCommand: string) =>
            `Your personal access key for account ${chalk.bold(account)} is inactive. To re-authenticate, please run ${authCommand}.`,
        },
        options: {
          force: {
            describe:
              'Skips all confirmation prompts when deleting a sandbox account.',
          },
          account: {
            describe: 'Account name or id to delete',
          },
        },
      },
    },
    sync: {
      loading: {
        add: (accountName: string) =>
          `Syncing sandbox ${chalk.bold(accountName)}`,
        fail: (accountName: string) =>
          `Failed to sync sandbox ${chalk.bold(accountName)}.`,
        succeed: (accountName: string) =>
          `Successfully synced sandbox ${chalk.bold(accountName)}.`,
      },
      success: {
        configFileUpdated: (accountName: string, authType: string) =>
          `Account "${accountName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (accountName: string, parentAccountName: string) =>
          `Couldn't sync ${chalk.bold(accountName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to sync the sandbox. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include sandbox sync permissions.",
          instructions: (accountName: string, url: string) =>
            `To update CLI permissions for "${accountName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes sandbox sync permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  secret: {
    describe: 'Commands for managing secrets.',
    subcommands: {
      add: {
        describe: 'Create a new secret.',
        errors: {
          add: (secretName: string) =>
            `The secret "${secretName}" was not added`,
          alreadyExists: (secretName: string, command: string) =>
            `The secret "${secretName}" already exists, it's value can be modified with ${command}`,
        },
        positionals: {
          name: {
            describe: 'Name of the secret',
          },
        },
        success: {
          add: (secretName: string, accountIdentifier: string) =>
            `The secret "${secretName}" was added to the HubSpot account: ${accountIdentifier}`,
        },
      },
      delete: {
        describe: 'Delete a secret.',
        selectSecret: 'Select the secret you want to delete',
        deleteCanceled: 'Delete canceled',
        confirmDelete: (secretName: string) =>
          `Are you sure you want to delete the secret "${secretName}"?`,
        errors: {
          delete: (secretName: string) =>
            `The secret "${secretName}" was not deleted`,
          noSecret: (secretName: string) =>
            `Unable to delete secret with name "${secretName}", it does not exist`,
        },
        positionals: {
          name: {
            describe: 'Name of the secret',
          },
        },
        success: {
          delete: (secretName: string, accountIdentifier: string) =>
            `The secret "${secretName}" was deleted from the HubSpot account: ${accountIdentifier}`,
        },
      },
      list: {
        describe: 'List all secrets.',
        errors: {
          list: 'The secrets could not be listed',
        },
        groupLabel: (accountIdentifier: string) =>
          `Secrets for account ${accountIdentifier}:`,
      },
      update: {
        describe: 'Update an existing secret.',
        selectSecret: 'Select the secret you want to update',
        errors: {
          update: (secretName: string) =>
            `The secret "${secretName}" was not updated`,
          noSecret: (secretName: string) =>
            `Unable to update secret with name "${secretName}", it does not exist`,
        },
        positionals: {
          name: {
            describe: 'Name of the secret to be updated',
          },
        },
        success: {
          update: (secretName: string, accountIdentifier: string) =>
            `The secret "${secretName}" was updated in the HubSpot account: ${accountIdentifier}`,
          updateExplanation:
            'Existing serverless functions will start using this new value within 10 seconds.',
        },
      },
    },
  },
  theme: {
    describe: 'Commands for managing themes.',
    subcommands: {
      generateSelectors: {
        describe:
          'Automatically generates an editor-preview.json file for the given theme. The selectors this command generates are not perfect, so please edit editor-preview.json after running.',
        errors: {
          invalidPath: (themePath: string) =>
            `Could not find directory "${themePath}"`,
          fieldsNotFound: "Unable to find theme's fields.json.",
          noSelectorsFound: 'No selectors found.',
        },
        success: (themePath: string, selectorsPath: string) =>
          `Selectors generated for ${themePath}, please double check the selectors generated at ${selectorsPath} before uploading the theme.`,
        positionals: {
          path: {
            describe:
              "The path of the theme you'd like to generate an editor-preview.json for.",
          },
        },
      },
      marketplaceValidate: {
        describe: 'Validate a theme for the marketplace.',
        errors: {
          invalidPath: (path: string) =>
            `The path "${path}" is not a path to a folder in the Design Manager`,
        },
        logs: {
          validatingTheme: (path: string) => `Validating theme "${path}" \n`,
        },
        results: {
          required: 'Required validation results:',
          recommended: 'Recommended validation results:',
          warnings: {
            file: (file: string) => `File: ${file}`,
            lineNumber: (line: string) => `Line number: ${line}`,
          },
          noErrors: 'No errors',
        },
        positionals: {
          path: {
            describe: 'Path to the theme within the Design Manager.',
          },
        },
      },
      preview: {
        describe:
          'Upload and watch a theme directory on your computer for changes and start a local development server to preview theme changes on a site.',
        errors: {
          invalidPath: (path: string) =>
            `The path "${path}" is not a path to a directory`,
          noThemeComponents:
            'Your project has no theme components available to preview.',
        },
        positionals: {
          src: {
            describe:
              'Path to the local directory your theme is in, relative to your current working directory',
          },
          dest: {
            describe:
              'Path in HubSpot Design Tools. Can be a net new path. If you wish to preview a site page using your theme changes it must match the path of the theme used by the site.',
          },
        },
        options: {
          notify: {
            describe:
              'Log to specified file when a watch task is triggered and after workers have gone idle. Ex. --notify path/to/file',
          },
          noSsl: {
            describe: 'Disable HTTPS',
          },
          port: {
            describe: 'The port on which to start the local server',
          },
        },
        initialUploadProgressBar: {
          start: 'Starting...',
          uploading: 'Uploading...',
          finish: 'Complete!',
        },
        logs: {
          processExited: 'Stopping dev server...',
        },
      },
    },
  },
  module: {
    describe:
      'Commands for working with modules, including marketplace validation with the marketplace-validate subcommand.',
    subcommands: {
      marketplaceValidate: {
        describe:
          'Validate a module for the marketplace. Make sure to include the suffix .module in the path to the module within the Design Manager.',
        errors: {
          invalidPath: (path: string) =>
            `The path "${path}" is not a path to a module within the Design Manager.`,
        },
        logs: {
          validatingModule: (path: string) => `Validating module "${path}" \n`,
        },
        options: {
          json: {
            describe: 'Output raw json data',
          },
        },
        results: {
          required: 'Required validation results:',
          recommended: 'Recommended validation results:',
          warnings: {
            file: (file: string) => `File: ${file}`,
            lineNumber: (line: string) => `Line number: ${line}`,
          },
          noErrors: 'No errors',
        },
        positionals: {
          src: {
            describe: 'Path to the module within the Design Manager.',
          },
        },
      },
    },
  },
  upload: {
    describe: 'Upload a folder or file from your computer to the HubSpot CMS.',
    errors: {
      destinationRequired: 'A destination path needs to be passed',
      fileIgnored: (path: string) =>
        `The file "${path}" is being ignored via an .hsignore rule`,
      invalidPath: (path: string) =>
        `The path "${path}" is not a path to a file or folder`,
      uploadFailed: (src: string, dest: string) =>
        `Uploading file "${src}" to "${dest}" failed`,
      someFilesFailed: (dest: string) =>
        `One or more files failed to upload to "${dest}" in the Design Manager`,
      deleteFailed: (path: string, accountId: string) =>
        `Deleting "${path}" from account ${accountId} failed`,
    },
    options: {
      options: {
        describe: 'Options to pass to javascript fields files',
      },
      saveOutput: {
        describe:
          "If true, saves all output from javascript fields files as 'fields.output.json'.",
      },
      convertFields: {
        describe:
          'If true, converts any javascript fields files contained in module folder or project root.',
      },
      clean: {
        describe:
          'Will delete the destination directory and its contents before uploading. This will also clear the global content associated with any global partial templates and modules.',
      },
      force: {
        describe: 'Skips confirmation prompts when doing a clean upload.',
      },
    },
    previewUrl: (previewUrl: string) =>
      `To preview this theme, visit: ${previewUrl}`,
    positionals: {
      src: {
        describe:
          'Path to the local file, relative to your current working directory.',
      },
      dest: {
        describe: 'Path in HubSpot Design Tools, can be a net new path.',
      },
    },
    success: {
      fileUploaded: (src: string, dest: string, accountId: string) =>
        `Uploaded file from "${src}" to "${dest}" in the Design Manager of account ${accountId}`,
      uploadComplete: (dest: string) =>
        `Uploading files to "${dest}" in the Design Manager is complete`,
    },
    uploading: (src: string, dest: string, accountId: string) =>
      `Uploading files from "${src}" to "${dest}" in the Design Manager of account ${accountId}`,
    notUploaded: (src: string) =>
      `There was an error processing "${src}". The file has not been uploaded.`,
    cleaning: (filePath: string, accountId: string) =>
      `Removing "${filePath}" from account ${accountId} and uploading local...`,
    confirmCleanUpload: (filePath: string, accountId: string) =>
      `You are about to delete the directory "${filePath}" and its contents on HubSpot account ${accountId} before uploading. This will also clear the global content associated with any global partial templates and modules. Are you sure you want to do this?`,
  },
  watch: {
    describe:
      'Watch a directory on your computer for changes and upload the changed files to the HubSpot CMS.',
    errors: {
      folderFailed: (src: string, dest: string, accountId: string) =>
        `Initial uploading of folder "${src}" to "${dest}" in account ${accountId} had failures`,
      fileFailed: (file: string, dest: string, accountId: string) =>
        `Upload of file "${file}" to "${dest}" in account ${accountId} failed`,
      destinationRequired: 'A destination directory needs to be passed',
      invalidPath: (path: string) =>
        `The "${path}" is not a path to a directory`,
    },
    options: {
      disableInitial: {
        describe:
          'Disable the initial upload when watching a directory (default)',
      },
      initialUpload: {
        describe: 'Upload directory before watching for updates',
      },
      notify: {
        describe:
          'Log to specified file when a watch task is triggered and after workers have gone idle. Ex. --notify path/to/file',
      },
      remove: {
        describe:
          'Will cause watch to delete files in your HubSpot account that are not found locally.',
      },
      convertFields: {
        describe:
          'If true, converts any javascript fields files contained in module folder or project root.',
      },
      saveOutput: {
        describe:
          "If true, saves all output from javascript fields files as 'fields.output.json'.",
      },
      options: {
        describe: 'Options to pass to javascript fields files',
      },
    },
    positionals: {
      src: {
        describe:
          'Path to the local directory your files are in, relative to your current working directory',
      },
      dest: {
        describe: 'Path in HubSpot Design Tools. Can be a net new path',
      },
    },
    warnings: {
      disableInitial: () =>
        `Passing the "${chalk.bold('--disable-initial')}" option is no longer necessary. Running "${chalk.bold('hs watch')}" no longer uploads the watched directory by default.`,
      initialUpload: () =>
        `To upload the directory run "${chalk.bold('hs upload')}" beforehand or add the "${chalk.bold('--initial-upload')}" option when running "${chalk.bold('hs watch')}".`,
      notUploaded: (path: string) =>
        `The "${chalk.bold('hs watch')}" command no longer uploads the watched directory when started. The directory "${path}" was not uploaded.`,
    },
  },
  convertFields: {
    describe:
      'Converts a specific JavaScript fields file of a module or theme to JSON.',
    positionals: {
      src: {
        describe:
          'Path to JS Fields file or directory containing javascript fields files.',
      },
    },
    options: {
      options: {
        describe: 'Options to pass to javascript fields files',
      },
    },
    errors: {
      invalidPath: (path: string) =>
        `The path "${path}" specified in the "--src" flag is not a path to a file or directory`,
      missingSrc:
        'Please specify the path to your javascript fields file or directory with the --src flag.',
    },
  },
  secrets: {
    add: {
      loading: {
        add: (secretName: string) => `Adding secret ${chalk.bold(secretName)}`,
        fail: (secretName: string) =>
          `Failed to add secret ${chalk.bold(secretName)}.`,
        succeed: (secretName: string) =>
          `Successfully added secret ${chalk.bold(secretName)}.`,
      },
      success: {
        configFileUpdated: (secretName: string, authType: string) =>
          `Secret "${secretName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (secretName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(secretName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add secrets. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include secrets permissions.",
          instructions: (secretName: string, url: string) =>
            `To update CLI permissions for "${secretName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes secrets permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (secretName: string) =>
          `Deleting secret ${chalk.bold(secretName)}`,
        fail: (secretName: string) =>
          `Failed to delete secret ${chalk.bold(secretName)}.`,
        succeed: (secretName: string) =>
          `Successfully deleted secret ${chalk.bold(secretName)}.`,
      },
      success: {
        configFileUpdated: (secretName: string, authType: string) =>
          `Secret "${secretName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (secretName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(secretName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete secrets. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include secrets permissions.",
          instructions: (secretName: string, url: string) =>
            `To update CLI permissions for "${secretName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes secrets permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing secrets`,
        fail: () => `Failed to list secrets.`,
        succeed: () => `Successfully listed secrets.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Secrets updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list secrets because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list secrets. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include secrets permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes secrets permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverless: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless functions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless functions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing serverless functions`,
        fail: () => `Failed to list serverless functions.`,
        succeed: () => `Successfully listed serverless functions.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless functions updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless functions because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless functions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionLogs: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function logs ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function logs ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function logs ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function logs "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function logs. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function log permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function log permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function logs ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function logs ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function logs ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function logs "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function logs. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function log permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function log permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing serverless function logs`,
        fail: () => `Failed to list serverless function logs.`,
        succeed: () => `Successfully listed serverless function logs.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function logs updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function logs because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function logs. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function log permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function log permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionMetrics: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function metrics ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function metrics ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function metrics ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function metrics "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function metrics. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function metric permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function metric permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function metrics ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function metrics ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function metrics ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function metrics "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function metrics. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function metric permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function metric permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing serverless function metrics`,
        fail: () => `Failed to list serverless function metrics.`,
        succeed: () => `Successfully listed serverless function metrics.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function metrics updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function metrics because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function metrics. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function metric permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function metric permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionSettings: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function settings ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function settings ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function settings ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function settings "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function settings. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function setting permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function setting permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function settings ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function settings ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function settings ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function settings "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function settings. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function setting permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function setting permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing serverless function settings`,
        fail: () => `Failed to list serverless function settings.`,
        succeed: () => `Successfully listed serverless function settings.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function settings updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function settings because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function settings. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function setting permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function setting permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionVersions: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function versions ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function versions ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function versions ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function versions "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function versions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function version permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function version permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function versions ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function versions ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function versions ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function versions "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function versions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function version permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function version permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing serverless function versions`,
        fail: () => `Failed to list serverless function versions.`,
        succeed: () => `Successfully listed serverless function versions.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function versions updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function versions because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function versions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function version permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function version permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionWebhooks: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function webhooks ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function webhooks ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function webhooks ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhooks "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function webhooks. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function webhooks ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function webhooks ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function webhooks ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhooks "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function webhooks. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing serverless function webhooks`,
        fail: () => `Failed to list serverless function webhooks.`,
        succeed: () => `Successfully listed serverless function webhooks.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function webhooks updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function webhooks because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function webhooks. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionWebhookSubscriptions: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function webhook subscriptions ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function webhook subscriptions ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function webhook subscriptions ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhook subscriptions "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function webhook subscriptions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function webhook subscriptions ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function webhook subscriptions ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function webhook subscriptions ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhook subscriptions "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function webhook subscriptions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing serverless function webhook subscriptions`,
        fail: () => `Failed to list serverless function webhook subscriptions.`,
        succeed: () =>
          `Successfully listed serverless function webhook subscriptions.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function webhook subscriptions updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function webhook subscriptions because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function webhook subscriptions. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionWebhookSubscriptionEvents: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function webhook subscription events ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function webhook subscription events ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function webhook subscription events ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhook subscription events "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function webhook subscription events. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function webhook subscription events ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function webhook subscription events ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function webhook subscription events ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhook subscription events "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function webhook subscription events. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () => `Listing serverless function webhook subscription events`,
        fail: () =>
          `Failed to list serverless function webhook subscription events.`,
        succeed: () =>
          `Successfully listed serverless function webhook subscription events.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function webhook subscription events updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function webhook subscription events because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function webhook subscription events. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionWebhookSubscriptionEventTypes: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function webhook subscription event types ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function webhook subscription event types ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function webhook subscription event types ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhook subscription event types "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function webhook subscription event types. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event type permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event type permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function webhook subscription event types ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function webhook subscription event types ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function webhook subscription event types ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhook subscription event types "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function webhook subscription event types. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event type permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event type permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () =>
          `Listing serverless function webhook subscription event types`,
        fail: () =>
          `Failed to list serverless function webhook subscription event types.`,
        succeed: () =>
          `Successfully listed serverless function webhook subscription event types.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function webhook subscription event types updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function webhook subscription event types because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function webhook subscription event types. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event type permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event type permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  serverlessFunctionWebhookSubscriptionEventTypeOptions: {
    add: {
      loading: {
        add: (functionName: string) =>
          `Adding serverless function webhook subscription event type options ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to add serverless function webhook subscription event type options ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully added serverless function webhook subscription event type options ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhook subscription event type options "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't add ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to add serverless function webhook subscription event type options. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event type option permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event type option permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    delete: {
      loading: {
        add: (functionName: string) =>
          `Deleting serverless function webhook subscription event type options ${chalk.bold(functionName)}`,
        fail: (functionName: string) =>
          `Failed to delete serverless function webhook subscription event type options ${chalk.bold(functionName)}.`,
        succeed: (functionName: string) =>
          `Successfully deleted serverless function webhook subscription event type options ${chalk.bold(functionName)}.`,
      },
      success: {
        configFileUpdated: (functionName: string, authType: string) =>
          `Serverless function webhook subscription event type options "${functionName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (functionName: string, parentAccountName: string) =>
          `Couldn't delete ${chalk.bold(functionName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to delete serverless function webhook subscription event type options. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event type option permissions.",
          instructions: (functionName: string, url: string) =>
            `To update CLI permissions for "${functionName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event type option permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
    list: {
      loading: {
        add: () =>
          `Listing serverless function webhook subscription event type options`,
        fail: () =>
          `Failed to list serverless function webhook subscription event type options.`,
        succeed: () =>
          `Successfully listed serverless function webhook subscription event type options.`,
      },
      success: {
        configFileUpdated: (authType: string) =>
          `Serverless function webhook subscription event type options updated using "${authType}"`,
      },
      failure: {
        invalidUser: (parentAccountName: string) =>
          `Couldn't list serverless function webhook subscription event type options because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to list serverless function webhook subscription event type options. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include serverless function webhook subscription event type option permissions.",
          instructions: (url: string) =>
            `To update CLI permissions: \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes serverless function webhook subscription event type option permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
} as const satisfies LangObject;

export const lib = {
  process: {
    exitDebug: (signal: string) =>
      `Attempting to gracefully exit. Triggered by ${signal}`,
  },
  DevServerManager: {
    portConflict: (port: string) => `The port ${port} is already in use.`,
    notInitialized:
      'The Dev Server Manager must be initialized before it is started.',
    noCompatibleComponents: (serverKey: string) =>
      `Skipping call to ${serverKey} because there are no compatible components in the project.`,
  },
  LocalDevManager: {
    staticAuthAccountsMustMatch:
      'You must test static auth apps in the account the project exists in',
    appNotFound: (accountId: number, appUid: string | undefined) =>
      `Unable to find app with uid ${appUid} in account ${uiAccountDescription(accountId)}`,
    failedToInitialize: 'Missing required arguments to initialize Local Dev',
    noDeployedBuild: (
      projectName: string,
      accountIdentifier: string,
      uploadCommand: string
    ) =>
      `Your project ${chalk.bold(projectName)} exists in ${accountIdentifier}, but has no deployed build. Projects must be successfully deployed to be developed locally. Address any build and deploy errors your project may have, then run ${uploadCommand} to upload and deploy your project.`,
    noComponents: 'There are no components in this project.',
    betaMessage: 'HubSpot projects local development',
    learnMoreLocalDevServer: uiLink(
      'Learn more about the projects local dev server',
      'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
    ),
    running: (projectName: string, accountIdentifier: string) =>
      chalk.hex(UI_COLORS.SORBET)(
        `Running ${chalk.bold(projectName)} locally on ${accountIdentifier}, waiting for changes ...`
      ),
    quitHelper: `Press ${chalk.bold('q')} to stop the local dev server`,
    viewProjectLink: (name: string, accountId: number) =>
      uiLink(
        'View project in HubSpot',
        getProjectDetailUrl(name, accountId) || ''
      ),
    viewTestAccountLink: 'View developer test account in HubSpot',
    exitingStart: 'Stopping local dev server ...',
    exitingSucceed: 'Successfully exited',
    exitingFail: 'Failed to cleanup before exiting',
    missingUid: `Could not find a uid for the selected app. Confirm that the app config file contains the uid field and re-run ${uiCommandReference('hs project dev')}.`,
    uploadWarning: {
      appLabel: '[App]',
      uiExtensionLabel: '[UI Extension]',
      missingComponents: (missingComponents: string) =>
        `Couldn't find the following components in the deployed build for this project: ${chalk.bold(missingComponents)}. This may cause issues in local development.`,
      defaultWarning: chalk.bold(
        'Changing project configuration requires a new project build.'
      ),
      defaultPublicAppWarning: (installCount: number, installText: string) =>
        `${chalk.bold('Changing project configuration requires a new project build.')}\n\nThis will affect your public app's ${chalk.bold(`${installCount} existing ${installText}`)}. If your app has users in production, we strongly recommend creating a copy of this app to test your changes before proceding.`,
      header: (warning: string) =>
        `${warning} To reflect these changes and continue testing:`,
      instructionsHeader: 'To reflect these changes and continue testing:',
      stopDev: `  * Stop ${uiCommandReference('hs project dev')}`,
      runUpload: (command: string) => `  * Run ${command}`,
      restartDev: `  * Re-run ${uiCommandReference('hs project dev')}`,
      pushToGithub: '  * Commit and push your changes to GitHub',
      defaultMarketplaceAppWarning: (
        installCount: number,
        accountText: string
      ) =>
        `${chalk.bold('Changing project configuration requires creating a new project build.')}\n\nYour marketplace app is currently installed in ${chalk.bold(`${installCount} ${accountText}`)}. Any uploaded changes will impact your app's users. We strongly recommend creating a copy of this app to test your changes before proceding.`,
    },
    activeInstallWarning: {
      installCount: (appName: string, installCount: number) =>
        `${chalk.bold(`The app ${appName} is installed in ${installCount} production ${installCount === 1 ? 'account' : 'accounts'}`)}`,
      explanation:
        'Some changes made during local development may need to be synced to HubSpot, which will impact those existing installs. We strongly recommend creating a copy of this app to use instead.',
      confirmation: `You will always be asked to confirm any permanent changes to your app's configuration before uploading them.`,
      confirmationPrompt: `Proceed with local development of this ${chalk.bold('production')} app?`,
    },
    devServer: {
      cleanupError: (message: string) =>
        `Failed to cleanup local dev server: ${message}`,
      setupError: (message: string) =>
        `Failed to setup local dev server: ${message}`,
      startError: (message: string) =>
        `Failed to start local dev server: ${message}`,
      fileChangeError: (message: string) =>
        `Failed to notify local dev server of file change: ${message}`,
    },
  },
  AppDevModeInterface: {
    defaultMarketplaceAppWarning: (installCount: number) =>
      `\n\nYour marketplace app is currently installed in ${chalk.bold(`${installCount} ${installCount === 1 ? 'account' : 'accounts'}`)}. Any uploaded changes will impact your app's users. We strongly recommend creating a copy of this app to test your changes before proceding.`,
  },
  LocalDevWebsocketServer: {
    errors: {
      notInitialized: (prefix: string) =>
        `${prefix}Error: Attempted to access websocket before initialization`,
      missingTypeField: (data: string) =>
        `Unsupported message received. Missing type field: ${data}`,
      unknownMessageType: (type: string) =>
        `Unsupported message received. Unknown message type: ${type}`,
      invalidJSON: (data: string) =>
        `Unsupported message received. Invalid JSON: ${data}`,
      portManagerNotRunning: (prefix: string) =>
        `${prefix}Error: PortManagerServing must be running before starting LocalDevWebsocketServer.`,
    },
    logs: {
      startup: (port: number) =>
        `LocalDevWebsocketServer running on port ${port}`,
    },
  },
  LocalDevProcess: {
    projectConfigMismatch: `Unable to upload project. The project config has been modified since starting ${uiCommandReference('hs project dev')}.`,
    uploadInitiated: 'Project upload initiated from Local Dev UI.',
    uploadFailed:
      'Project upload failed. To proceed with local development, fix any necessary errors, then re-upload your project.',
    uploadSuccess:
      'Project upload completed successfully. Resuming local dev...',
  },
  localDevHelpers: {
    confirmDefaultAccountIsTarget: {
      configError: `An error occurred while reading the default account from your config. Run ${uiCommandReference('hs auth')} to re-auth this account`,
      declineDefaultAccountExplanation: `To develop on a different account, run ${uiCommandReference('hs accounts use')} to change your default account, then re-run ${uiCommandReference('hs project dev')}.`,
    },
    checkIfDefaultAccountIsSupported: {
      publicApp: `This project contains a public app. Local development of public apps is only supported on developer accounts and developer test accounts. Change your default account using ${uiCommandReference('hs accounts use')}, or link a new account with ${uiCommandReference('hs auth')}.`,
      privateApp: `This project contains a private app. Local development of private apps is not supported in developer accounts. Change your default account using ${uiCommandReference('hs accounts use')}, or link a new account with ${uiCommandReference('hs auth')}.`,
    },
    validateAccountOption: {
      invalidPublicAppAccount: `This project contains a public app. The "--account" flag must point to a developer test account to develop this project locally. Alternatively, change your default account to an App Developer Account using ${uiCommandReference('hs accounts use')} and run ${uiCommandReference('hs project dev')} to set up a new Developer Test Account.`,
      invalidPrivateAppAccount: `This project contains a private app. The account specified with the "--account" flag points to a developer account, which do not support the local development of private apps. Update the "--account" flag to point to a standard, sandbox, or developer test account, or change your default account by running ${uiCommandReference('hs accounts use')}.`,
      nonSandboxWarning: `Testing in a sandbox is strongly recommended. To switch the target account, select an option below or run ${uiCommandReference('hs accounts use')} before running the command again.`,
      publicAppNonDeveloperTestAccountWarning: `Local development of public apps is only supported in ${chalk.bold('developer test accounts')}.`,
    },
    createNewProjectForLocalDev: {
      projectMustExistExplanation: (projectName: string, accountId: number) =>
        `The project ${projectName} does not exist in the target account ${uiAccountDescription(
          accountId
        )}. This command requires the project to exist in the target account.`,
      publicAppProjectMustExistExplanation: (
        projectName: string,
        accountId: number
      ) =>
        `The project ${projectName} does not exist in ${uiAccountDescription(
          accountId
        )}, the app developer account associated with your target account. This command requires the project to exist in this app developer account.`,
      createProject: (projectName: string, accountIdentifier: string) =>
        `Create new project ${projectName} in ${accountIdentifier}?`,
      choseNotToCreateProject:
        'Exiting because this command requires the project to exist in the target account.',
      creatingProject: (projectName: string, accountIdentifier: string) =>
        `Creating project ${projectName} in ${accountIdentifier}`,
      createdProject: (projectName: string, accountIdentifier: string) =>
        `Created project ${projectName} in ${accountIdentifier}`,
      failedToCreateProject: 'Failed to create project in the target account.',
    },
    createInitialBuildForNewProject: {
      initialUploadMessage: 'HubSpot Local Dev Server Startup',
      projectLockedError:
        'Your project is locked. This may mean that another user is running the `hs project watch` command for this project. If this is you, unlock the project in Projects UI.',
      genericError: `An error occurred while creating the initial build for this project. Run ${uiCommandReference('hs project upload')} to try again.`,
    },
    checkIfParentAccountIsAuthed: {
      notAuthedError: (
        parentAccountId: number | string,
        accountIdentifier: string
      ) =>
        `To develop this project locally, run ${uiCommandReference(
          `hs auth --account=${parentAccountId}`
        )} to authenticate the App Developer Account ${parentAccountId} associated with ${accountIdentifier}.`,
    },
    selectAccountTypePrompt: {
      message: '[--account] Choose the type of account to test on',
      developerTestAccountOption: 'Test on a developer test account',
      sandboxAccountOption: 'Test on a sandbox account',
      sandboxAccountOptionDisabled:
        'Disabled - requires access to sandbox accounts',
      productionAccountOption: `<${chalk.red('!')} Test on this account ${chalk.red('!')}>`,
    },
  },
  middleware: {
    updateNotification: {
      notifyTitle: chalk.bold('Update available'),
      cmsUpdateNotification: (packageName: string) =>
        `${chalk.bold('The CMS CLI is now the HubSpot CLI')}\n\nTo upgrade, uninstall ${chalk.bold(packageName)}\nand then run ${uiCommandReference('{updateCommand}')}`,
      cliUpdateNotification: `HubSpot CLI version ${chalk.cyan(chalk.bold('{currentVersion}'))} is outdated.\nRun ${uiCommandReference('{updateCommand}')} to upgrade to version ${chalk.cyan(chalk.bold('{latestVersion}'))}`,
    },
    autoUpdateCLI: {
      updateAvailable: (latestVersion: string) =>
        `There's a new HubSpot CLI version available! Updating to version ${chalk.bold(latestVersion)}`,
      updateSucceeded: (latestVersion: string) =>
        `Successfully updated HubSpot CLI to version ${chalk.bold(latestVersion)}`,
      notInstalledGlobally:
        'Cannot auto-update the HubSpot CLI because NPM is not installed globally',
      updateFailed: (latestVersion: string) =>
        `Failed to update HubSpot CLI to version ${chalk.bold(latestVersion)}`,
    },
  },
  projectProfiles: {
    logs: {
      usingProfile: (profileName: string) =>
        `Using profile from ${chalk.bold(profileName)}`,
      profileTargetAccount: (accountId: number) =>
        `Targeting ${uiAccountDescription(accountId)}`,
      profileVariables: 'Profile variables',
    },
    exitIfUsingProfiles: {
      errors: {
        noProfileSpecified: `This project is configured to use profiles, but no profile was specified. Target a profile using the ${uiCommandReference('--profile')} flag.`,
      },
    },
    loadProfile: {
      errors: {
        noProjectConfig:
          'No project config found. Please run this command from a project directory.',
        profileNotFound: (profileName: string) =>
          `Profile ${chalk.bold(profileName)} not found.`,
        missingAccountId: (profileName: string) =>
          `Profile ${chalk.bold(profileName)} is missing an account id.`,
        failedToLoadProfile: (profileName: string) =>
          `Failed to load profile ${chalk.bold(profileName)}.`,
      },
    },
  },
  projects: {
    create: {
      errors: {
        noProjectsInConfig:
          'Unable to find any projects in the target repository\'s config.json file. Please ensure that there is a "projects" array in the config file.',
        missingConfigFileTemplateSource:
          'Failed to fetch the config.json file from the target repository. Please ensure that there is a valid config.json file at the root of the repository and try again.',
        missingPropertiesInConfig:
          'Found misconfigured projects in the target repository\'s config.json file. Please ensure that each project in the target repository\'s config.json file contains the following properties: ["name", "label", "path", "insertPath"].',
      },
    },
    validateProjectConfig: {
      configNotFound: `Unable to locate a project configuration file. Try running again from a project directory, or run ${uiCommandReference('hs project create')} to create a new project.`,
      configMissingFields:
        'The project configuration file is missing required fields.',
      srcDirNotFound: (srcDir: string, projectDir: string) =>
        `Project source directory ${chalk.bold(srcDir)} could not be found in ${chalk.bold(projectDir)}.`,
      srcOutsideProjectDir: (projectConfig: string, srcDir: string) =>
        `Invalid value for 'srcDir' in ${projectConfig}: ${chalk.bold(`srcDir: "${srcDir}"`)}\n\t'srcDir' must be a relative path to a folder under the project root, such as "." or "./src"`,
    },
    getProjectConfig: {
      error: 'Could not read from project config',
    },
    ensureProjectExists: {
      createPrompt: (projectName: string, accountIdentifier: string) =>
        `The project ${projectName} does not exist in ${accountIdentifier}. Would you like to create it?`,
      createPromptUpload: (projectName: string, accountIdentifier: string) =>
        `[--forceCreate] The project ${projectName} does not exist in ${accountIdentifier}. Would you like to create it?`,
      createSuccess: (projectName: string, accountIdentifier: string) =>
        `New project ${chalk.bold(projectName)} successfully created in ${chalk.bold(accountIdentifier)}.`,
      notFound: (projectName: string, accountIdentifier: string) =>
        `Your project ${chalk.bold(projectName)} could not be found in ${chalk.bold(accountIdentifier)}.`,
    },
    pollFetchProject: {
      checkingProject: (accountIdentifier: string) =>
        `Checking if project exists in ${accountIdentifier}`,
    },
    logFeedbackMessage: {
      feedbackHeader: "We'd love to hear your feedback!",
      feedbackMessage: `How are you liking the new projects and developer tools? \n > Run ${uiCommandReference('hs feedback')} to let us know what you think!\n`,
    },
  },
  projectBuildAndDeploy: {
    makePollTaskStatusFunc: {
      errorSummary: 'See below for a summary of errors.',
      componentCountSingular: 'Found 1 component in this project\n',
      componentCount: (numComponents: number) =>
        `Found ${numComponents} components in this project\n`,
      successStatusText: 'DONE',
      failedStatusText: 'FAILED',
      errorFetchingTaskStatus: (taskType: string) =>
        `Error fetching ${taskType} status`,
    },
    pollBuildAutodeployStatusError: (buildId: number) =>
      `Error fetching autodeploy status for build #${buildId}`,
    pollProjectBuildAndDeploy: {
      buildSucceededAutomaticallyDeploying: (
        buildId: number,
        accountIdentifier: string
      ) =>
        `Build #${buildId} succeeded. ${chalk.bold('Automatically deploying')} to ${accountIdentifier}\n`,
      cleanedUpTempFile: (path: string) => `Cleaned up temporary file ${path}`,
      viewDeploys: 'View all deploys for this project in HubSpot',
      unableToFindAutodeployStatus: (
        buildId: number,
        viewDeploysLink: string
      ) =>
        `Unable to find the auto deploy for build #${buildId}. This deploy may have been skipped. ${viewDeploysLink}.`,
    },
  },
  projectUpload: {
    uploadProjectFiles: {
      add: (projectName: string, accountIdentifier: string) =>
        `Uploading ${chalk.bold(projectName)} project files to ${accountIdentifier}`,
      fail: (projectName: string, accountIdentifier: string) =>
        `Failed to upload ${chalk.bold(projectName)} project files to ${accountIdentifier}`,
      succeed: (projectName: string, accountIdentifier: string) =>
        `Uploaded ${chalk.bold(projectName)} project files to ${accountIdentifier}`,
      buildCreated: (projectName: string, buildId: number) =>
        `Project "${projectName}" uploaded and build #${buildId} created`,
    },
    handleProjectUpload: {
      emptySource: (srcDir: string) =>
        `Source directory "${srcDir}" is empty. Add files to your project and rerun ${uiCommandReference('hs project upload')} to upload them to HubSpot.`,
      compressed: (byteCount: number) =>
        `Project files compressed: ${byteCount} bytes`,
      compressing: (path: string) => `Compressing build files to "${path}"`,
      fileFiltered: (filename: string) =>
        `Ignore rule triggered for "${filename}"`,
    },
  },
  boxen: {
    failedToLoad: 'Failed to load boxen util.',
  },
  ui: {
    betaTag: chalk.bold('[BETA]'),
    betaWarning: {
      header: chalk.yellow(
        '***************************** WARNING ****************************'
      ),
      footer: chalk.yellow(
        '******************************************************************'
      ),
    },
    infoTag: chalk.bold('[INFO]'),
    deprecatedTag: chalk.bold('[DEPRECATED]'),
    errorTag: chalk.bold('[ERROR]'),
    deprecatedMessage: (command: string, url: string) =>
      `The ${command} command is deprecated and will be disabled soon. ${url}`,
    deprecatedDescription: (message: string, command: string, url: string) =>
      `${message}. The ${command} command is deprecated and will be disabled soon. ${url}`,
    deprecatedUrlText: 'Learn more.',
    disabledMessage: (command: string, npmCommand: string, url: string) =>
      `The ${command} command is disabled. Run ${npmCommand} to update to the latest HubSpot CLI version. ${url}`,
    disabledUrlText: 'See all HubSpot CLI commands here.',
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
            `Run ${command} to see a list of configured HubSpot accounts`,
        },
        accountsUseCommand: {
          command: 'hs accounts use',
          message: (command: string) =>
            `Run ${command} to set the Hubspot account that the CLI will target by default`,
        },
        authCommand: {
          command: 'hs auth',
          message: (command: string) =>
            `Run ${command} to connect the CLI to additional HubSpot accounts`,
        },
        feedbackCommand: {
          command: 'hs feedback',
          message: (command: string) =>
            `Run ${command} to report a bug or leave feedback`,
        },
        helpCommand: {
          command: 'hs help',
          message: (command: string) =>
            `Run ${command} to see a list of available commands`,
        },
        projectCreateCommand: {
          command: 'hs project create',
          message: (command: string) =>
            `Run ${command} to create a new project`,
        },
        projectDeployCommand: {
          command: 'hs project deploy',
          message: (command: string) =>
            `Ready to take your project live? Run ${command}`,
        },
        projectHelpCommand: {
          command: 'hs project --help',
          message: (command: string) =>
            `Run ${command} to learn more about available project commands`,
        },
        projectUploadCommand: {
          command: 'hs project upload',
          message: (command: string) =>
            `Run ${command} to upload your project to HubSpot and trigger builds`,
        },
        projectDevCommand: {
          command: 'hs project dev',
          message: (command: string) =>
            `Run ${command} to set up your test environment and start local development`,
        },
        projectInstallDepsCommand: {
          command: 'hs project install-deps',
          message: (command: string) =>
            `Run ${command} to install dependencies for your project components`,
        },
        sampleProjects: {
          linkText: "HubSpot's sample projects",
          url: 'https://developers.hubspot.com/docs/platform/sample-projects?utm_source=cli&utm_content=project_create_whats_next',
          message: (link: string) => `See ${link}`,
        },
      },
    },
    git: {
      securityIssue: 'Security Issue Detected',
      configFileTracked: 'The HubSpot config file can be tracked by git.',
      fileName: (configPath: string) => `File: "${configPath}"`,
      remediate: 'To remediate:',
      moveConfig: (homeDir: string) =>
        `- Move the config file to your home directory: '${homeDir}'`,
      addGitignore: (configPath: string) =>
        `- Add gitignore pattern '${configPath}' to a .gitignore file in root of your repository.`,
      noRemote:
        '- Ensure that the config file has not already been pushed to a remote repository.',
      checkFailed:
        'Unable to determine if config file is properly ignored by git.',
    },
    serverlessFunctionLogs: {
      unableToProcessLog: (log: string) => `Unable to process log ${log}`,
      noLogsFound: 'No logs found.',
    },
  },
  configOptions: {
    enableOrDisableBooleanFieldPrompt: {
      message: (fieldName: string) =>
        `Choose to enable or disable ${fieldName}`,
      labels: {
        enabled: 'Enabled',
        disabled: 'Disabled',
      },
    },
    setAllowUsageTracking: {
      fieldName: 'usage tracking',
      success: (isEnabled: string) =>
        `Allow usage tracking set to: "${isEnabled}"`,
    },
    setAllowAutoUpdates: {
      fieldName: 'auto updates',
      success: (isEnabled: string) =>
        `Allow auto updates set to: "${isEnabled}"`,
    },
    setDefaultCmsPublishMode: {
      promptMessage: 'Select CMS publish mode to be used as the default',
      error: (validModes: string) =>
        `The provided CMS publish mode is invalid. Valid values are ${validModes}.`,
      success: (mode: string) => `Default mode updated to: ${mode}`,
    },
    setHttpTimeout: {
      promptMessage: 'Enter http timeout duration',
      success: (timeout: string) => `HTTP timeout set to: ${timeout}`,
    },
  },
  commonOpts: {
    options: {
      account: {
        describe: 'HubSpot account id or name from config',
      },
      config: {
        describe: 'Path to a config file',
      },
      overwrite: {
        describe: 'Overwrite existing files',
      },
      modes: {
        describe: {
          default: (modes: string) => `${modes}`,
          read: (modes: string) => `Read from ${modes}`,
          write: (modes: string) => `Write to ${modes}`,
        },
      },
      qa: {
        describe: 'Run command in QA mode',
      },
      useEnv: {
        describe: 'Use environment variable config',
      },
      debug: {
        describe: 'Set log level to debug',
      },
    },
  },
  prompts: {
    projectDevTargetAccountPrompt: {
      createNewSandboxOption: '<Test on a new development sandbox>',
      createNewDeveloperTestAccountOption:
        '<Test on a new developer test account>',
      chooseDefaultAccountOption: () =>
        `<${chalk.bold('❗')} Test on this production account ${chalk.bold('❗')}>`,
      promptMessage: (accountType: string, accountIdentifier: string) =>
        `[--account] Choose a ${accountType} under ${accountIdentifier} to test with:`,
      sandboxLimit: (limit: string) =>
        `Your account reached the limit of ${limit} development sandboxes`,
      sandboxLimitWithSuggestion: (limit: string, authCommand: string) =>
        `Your account reached the limit of ${limit} development sandboxes. Run ${authCommand} to add an existing one to the config.`,
      developerTestAccountLimit: (limit: string) =>
        `Your account reached the limit of ${limit} developer test accounts.`,
      confirmDefaultAccount: (accountName: string, accountType: string) =>
        `Continue testing on ${chalk.bold(`${accountName} (${accountType})`)}? (Y/n)`,
      confirmUseExistingDeveloperTestAccount: (accountName: string) =>
        `Continue with ${accountName}? This account isn't currently connected to the HubSpot CLI. By continuing, you'll be prompted to generate a personal access key and connect it.`,
      noAccountId:
        'No account ID found for the selected account. Please try again.',
    },
    projectLogsPrompt: {
      functionName: (projectName: string) =>
        `[--function] Select function in ${chalk.bold(projectName)} project`,
    },
    setAsDefaultAccountPrompt: {
      setAsDefaultAccountMessage: 'Set this account as the default?',
      setAsDefaultAccount: (accountName: string) =>
        `Account "${accountName}" set as the default account`,
      keepingCurrentDefault: (accountName: string) =>
        `Account "${accountName}" will continue to be the default account`,
    },
    accountNamePrompt: {
      enterAccountName:
        'Enter a unique name to reference this account in the CLI:',
      enterDeveloperTestAccountName: 'Name your developer test account:',
      enterStandardSandboxName: 'Name your standard sandbox:',
      enterDevelopmentSandboxName: 'Name your development sandbox:',
      sandboxDefaultName: (sandboxType: string) => `New ${sandboxType} sandbox`,
      developerTestAccountDefaultName: (count: string) =>
        `Developer test account ${count}`,
      errors: {
        invalidName: 'You entered an invalid name. Please try again.',
        nameRequired: 'The name may not be blank. Please try again.',
        spacesInName: 'The name may not contain spaces. Please try again.',
        accountNameExists: (name: string) =>
          `Account with name "${name}" already exists in the CLI config, please enter a different name.`,
      },
    },
    personalAccessKeyPrompt: {
      enterAccountId:
        'Enter the account ID for your account (the number under the DOMAIN column at https://app.hubspot.com/myaccounts-beta ): ',
      enterClientId: 'Enter your OAuth2 client ID: ',
      enterClientSecret: 'Enter your OAuth2 client secret: ',
      enterPersonalAccessKey: 'Enter your personal access key: ',
      selectScopes:
        'Select access scopes (see https://developers.hubspot.com/docs/methods/oauth2/initiate-oauth-integration#scopes)',
      personalAccessKeySetupTitle: 'HubSpot Personal Access Key Setup',
      personalAccessKeyBrowserOpenPrep:
        "A personal access key is required to authenticate the CLI to interact with your HubSpot account. We'll open a secure page in your default browser where you can view and copy your personal access key.",
      personalAccessKeyBrowserOpenPrompt:
        'Open HubSpot to copy your personal access key?',
      logs: {
        openingWebBrowser: (url: string) =>
          `Opening ${url} in your web browser`,
      },
      errors: {
        invalidAccountId:
          'You did not enter a valid account ID. Please try again.',
        invalidOauthClientId:
          'You entered an invalid OAuth2 client ID. Please try again.',
        invalidOauthClientIdLength:
          'The OAuth2 client ID must be 36 characters long. Please try again.',
        invalidOauthClientSecret:
          'You entered an invalid OAuth2 client secret. Please try again.',
        invalidOauthClientSecretLength:
          'The OAuth2 client secret must be 36 characters long. Please try again.',
        invalidOauthClientSecretCopy:
          'Please copy the actual OAuth2 client secret rather than the asterisks that mask it.',
        invalidPersonalAccessKey:
          'You did not enter a valid access key. Please try again.',
        invalidPersonalAccessKeyCopy:
          'Please copy the actual access key rather than the bullets that mask it.',
      },
    },
    createTemplatePrompt: {
      selectTemplate: 'Select the type of template to create',
    },
    createModulePrompt: {
      enterLabel: 'What should the module label be?',
      selectReactType: 'Is this a React module?',
      selectContentType: 'What types of content will this module be used in?',
      confirmGlobal: 'Is this a global module?',
      availableForNewContent: 'Make this module available for new content?',
      errors: {
        invalidLabel: 'You entered an invalid name. Please try again.',
        labelRequired: 'The name may not be blank. Please try again.',
        contentTypeRequired:
          'Please select at least one content type for this module.',
      },
    },
    createFunctionPrompt: {
      enterFolder: 'Name of the folder where your function will be created: ',
      enterFilename: 'Name of the JavaScript file for your function: ',
      enterEndpointPath: 'Path portion of the URL created for the function: ',
      selectEndpointMethod: 'Select the HTTP method for the endpoint',
      errors: {
        invalid: 'You entered an invalid name. Please try again.',
        blank: 'The name may not be blank. Please try again.',
        space: 'The name may not contain spaces. Please try again.',
      },
    },
    createApiSamplePrompt: {
      selectApiSampleApp: 'Please select API sample app',
      selectLanguage: "Please select sample app's language",
      errors: {
        apiSampleAppRequired: 'Please select API sample app',
        languageRequired: "Please select API sample app's language",
      },
    },
    createProjectPrompt: {
      enterName: '[--name] Give your project a name: ',
      enterDest: '[--dest] Enter the folder to create the project in:',
      selectTemplate: '[--template] Choose a project template: ',
      errors: {
        nameRequired: 'A project name is required',
        destRequired: 'A project dest is required',
        invalidDest:
          'There is an existing project at this destination. Please provide a new path for this project.',
        invalidCharacters:
          'The selected destination contains invalid characters. Please provide a new path and try again.',
        invalidTemplate: (template: string) =>
          `[--template] Could not find template "${template}". Please choose an available template:`,
        projectTemplateRequired:
          'Project template is required when projectTemplates is provided',
      },
    },
    selectPublicAppPrompt: {
      selectAppIdMigrate: (accountName: string) =>
        `[--appId] Choose an app under ${accountName} to migrate:`,
      selectAppIdClone: (accountName: string) =>
        `[--appId] Choose an app under ${accountName} to clone:`,
      errors: {
        noAccountId: 'An account ID is required to select an app.',
        noAppsMigration: () => `${chalk.bold('No apps to migrate')}`,
        noAppsClone: () => `${chalk.bold('No apps to clone')}`,
        noAppsMigrationMessage: (accountName: string) =>
          `The selected developer account ${chalk.bold(accountName)} doesn't have any apps that can be migrated to the projects framework.`,
        noAppsCloneMessage: (accountName: string) =>
          `The selected developer account ${chalk.bold(accountName)} doesn't have any apps that can be cloned to the projects framework.`,
        errorFetchingApps: 'There was an error fetching public apps.',
        cannotBeMigrated: 'Cannot be migrated',
      },
    },
    downloadProjectPrompt: {
      selectProject: 'Select a project to download:',
      errors: {
        projectNotFound: (projectName: string, accountId: string) =>
          `Your project ${projectName} could not be found in ${accountId}. Please select a valid project:`,
        accountIdRequired: 'An account ID is required to download a project.',
      },
    },
    projectAddPrompt: {
      selectType: '[--type] Select a component to add: ',
      enterName: '[--name] Give your component a name: ',
      errors: {
        nameRequired: 'A component name is required',
        invalidType: (type: string) =>
          `[--type] Could not find type "${type}". Please choose an available type:`,
      },
    },
    secretPrompt: {
      enterValue: 'Enter a value for your secret: ',
      enterName: 'Enter a name for your secret: ',
      selectSecretUpdate: 'Select the secret you want to update',
      selectSecretDelete: 'Select the secret you want to delete',
      errors: {
        invalidValue: 'You entered an invalid value. Please try again.',
      },
    },
    sandboxesPrompt: {
      selectAccountName: 'Select the sandbox account you want to delete',
      selectParentAccountName: 'Select the account that the sandbox belongs to',
      type: {
        message: 'Choose the type of sandbox you want to create',
        developer:
          "Development sandbox (Includes production's object definitions)",
        standard:
          "Standard sandbox (Includes partial copy of production's assets)",
      },
    },
    uploadPrompt: {
      enterDest: 'Enter the destination path: ',
      enterSrc: 'Enter the source path: ',
      errors: {
        srcRequired: 'You must specify a source directory.',
        destRequired: 'You must specify a destination directory.',
      },
      fieldsPrompt: (dir: string) =>
        `Multiple fields files located in "${dir}". Please choose which to upload: `,
    },
    projectNamePrompt: {
      enterName: '[--project] Enter project name:',
      errors: {
        invalidName: 'You entered an invalid name. Please try again.',
        projectDoesNotExist: (projectName: string, accountIdentifier: string) =>
          `Project ${chalk.bold(projectName)} could not be found in "${accountIdentifier}"`,
      },
    },
    previewPrompt: {
      enterSrc: '[--src] Enter a local theme directory to preview.',
      enterDest:
        '[--dest] Enter the destination path for the src theme in HubSpot Design Tools.',
      themeProjectSelect: '[--theme] Select which theme to preview.',
      errors: {
        srcRequired: 'You must specify a source directory.',
        destRequired: 'You must specify a destination directory.',
      },
    },
    installAppPrompt: {
      explanation:
        'Local development requires this app to be installed in the target test account',
      reinstallExplanation:
        "This app's required scopes have been updated since it was last installed on the target test account. To avoid issues with local development, we recommend reinstalling the app with the updated scopes.",
      prompt: 'Open HubSpot to install this app?',
      reinstallPrompt: 'Open HubSpot to reinstall this app?',
      decline: `To continue local development of this app, install it in your target test account and re-run ${chalk.bold('`hs project dev`')}`,
    },
    selectHubDBTablePrompt: {
      selectTable: 'Select a HubDB table:',
      enterDest: 'Enter the destination path:',
      errors: {
        noTables: (accountId: string) =>
          `No HubDB tables found in account ${accountId}`,
        errorFetchingTables: (accountId: string) =>
          `Unable to fetch HubDB tables in account ${accountId}`,
        destRequired: 'A destination is required',
        invalidDest:
          'The selected destination already exists. Please provide a new path.',
        invalidCharacters:
          'The selected destination contains invalid characters. Please provide a new path and try again.',
      },
    },
  },
  convertFields: {
    positionals: {
      src: {
        describe:
          'Path to JS Fields file or directory containing javascript fields files.',
      },
    },
    options: {
      options: {
        describe: 'Options to pass to javascript fields files',
      },
    },
  },
  developerTestAccount: {
    create: {
      loading: {
        add: (accountName: string) =>
          `Creating developer test account ${chalk.bold(accountName)}`,
        fail: (accountName: string) =>
          `Failed to create a developer test account ${chalk.bold(accountName)}.`,
        succeed: (accountName: string, accountId: string) =>
          `Successfully created a developer test account ${chalk.bold(accountName)} with portalId ${chalk.bold(accountId)}.`,
      },
      success: {
        configFileUpdated: (accountName: string, authType: string) =>
          `Account "${accountName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (accountName: string, parentAccountName: string) =>
          `Couldn't create ${chalk.bold(accountName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to create the sandbox. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        limit: (accountName: string, limit: string) =>
          `${chalk.bold(accountName)} reached the limit of ${limit} developer test accounts. \n- To connect a developer test account to your HubSpot CLI, run ${chalk.bold('hs auth')} and follow the prompts.`,
        alreadyInConfig: (accountName: string, limit: string) =>
          `${chalk.bold(accountName)} reached the limit of ${limit} developer test accounts. \n- To use an existing developer test account, run ${chalk.bold('hs accounts use')}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include developer test account permissions.",
          instructions: (accountName: string | number, url: string) =>
            `To update CLI permissions for "${accountName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes developer test account permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  sandbox: {
    create: {
      developer: {
        loading: {
          add: (accountName: string) =>
            `Creating developer sandbox ${chalk.bold(accountName)}`,
          fail: (accountName: string) =>
            `Failed to create a developer sandbox ${chalk.bold(accountName)}.`,
          succeed: (accountName: string, accountId: string) =>
            `Successfully created a developer sandbox ${chalk.bold(accountName)} with portalId ${chalk.bold(accountId)}.`,
        },
        success: {
          configFileUpdated: (accountName: string, authType: string) =>
            `Account "${accountName}" updated using "${authType}"`,
        },
        failure: {
          invalidUser: (accountName: string, parentAccountName: string) =>
            `Couldn't create ${chalk.bold(accountName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to create the sandbox. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
          limit: (accountName: string, limit: string) =>
            `${chalk.bold(accountName)} reached the limit of ${limit} developer sandboxes. \n- To connect a developer sandbox to your HubSpot CLI, run ${chalk.bold('hs auth')} and follow the prompts.`,
          alreadyInConfig: (accountName: string, limit: string) =>
            `${chalk.bold(accountName)} reached the limit of ${limit} developer sandboxes. \n- To use an existing developer sandbox, run ${chalk.bold('hs accounts use')}.`,
          scopes: {
            message:
              "The personal access key you provided doesn't include developer sandbox permissions.",
            instructions: (accountName: string | number, url: string) =>
              `To update CLI permissions for "${accountName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes developer sandbox permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
          },
          generic: 'An error occurred while creating a developer sandbox',
        },
      },
      standard: {
        loading: {
          add: (accountName: string) =>
            `Creating standard sandbox ${chalk.bold(accountName)}`,
          fail: (accountName: string) =>
            `Failed to create a standard sandbox ${chalk.bold(accountName)}.`,
          succeed: (accountName: string, accountId: string) =>
            `Successfully created a standard sandbox ${chalk.bold(accountName)} with portalId ${chalk.bold(accountId)}.`,
        },
        success: {
          configFileUpdated: (accountName: string, authType: string) =>
            `Account "${accountName}" updated using "${authType}"`,
        },
        failure: {
          invalidUser: (accountName: string, parentAccountName: string) =>
            `Couldn't create ${chalk.bold(accountName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to create the sandbox. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
          limit: (accountName: string, limit: string) =>
            `${chalk.bold(accountName)} reached the limit of ${limit} standard sandboxes. \n- To connect a standard sandbox to your HubSpot CLI, run ${chalk.bold('hs auth')} and follow the prompts.`,
          alreadyInConfig: (accountName: string, limit: string) =>
            `${chalk.bold(accountName)} reached the limit of ${limit} standard sandboxes. \n- To use an existing standard sandbox, run ${chalk.bold('hs accounts use')}.`,
          scopes: {
            message:
              "The personal access key you provided doesn't include standard sandbox permissions.",
            instructions: (accountName: string, url: string) =>
              `To update CLI permissions for "${accountName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes standard sandbox permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
          },
        },
      },
    },
    sync: {
      loading: {
        add: (accountName: string) =>
          `Syncing sandbox ${chalk.bold(accountName)}`,
        fail: (accountName: string) =>
          `Failed to sync sandbox ${chalk.bold(accountName)}.`,
        succeed: (accountName: string) =>
          `Successfully synced sandbox ${chalk.bold(accountName)}.`,
      },
      success: {
        configFileUpdated: (accountName: string, authType: string) =>
          `Account "${accountName}" updated using "${authType}"`,
      },
      failure: {
        invalidUser: (accountName: string, parentAccountName: string) =>
          `Couldn't sync ${chalk.bold(accountName)} because your account has been removed from ${chalk.bold(parentAccountName)} or your permission set doesn't allow you to sync the sandbox. To update your permissions, contact a super admin in ${chalk.bold(parentAccountName)}.`,
        scopes: {
          message:
            "The personal access key you provided doesn't include sandbox sync permissions.",
          instructions: (accountName: string, url: string) =>
            `To update CLI permissions for "${accountName}": \n- Go to ${url}, deactivate the existing personal access key, and create a new one that includes sandbox sync permissions. \n- Update the CLI config for this account by running ${chalk.bold('hs auth')} and entering the new key.\n`,
        },
      },
    },
  },
  errorHandlers: {
    index: {
      errorOccurred: (error: string) => `Error: ${error}`,
      errorContext: (context: string) => `Context: ${context}`,
      errorCause: (cause: string) => `Cause: ${cause}`,
      unknownErrorOccurred: 'An unknown error has occurred.',
    },
    suppressErrors: {
      platformVersionErrors: {
        header: 'Platform version update required',
        unspecifiedPlatformVersion: (platformVersion: string) =>
          `Projects with an ${chalk.bold(platformVersion)} are no longer supported.`,
        platformVersionRetired: (platformVersion: string) =>
          `Projects with ${chalk.bold(`platformVersion ${platformVersion}`)} are no longer supported.`,
        nonExistentPlatformVersion: (platformVersion: string) =>
          `Projects with ${chalk.bold(`platformVersion ${platformVersion}`)} are not supported.`,
        updateProject:
          'Please update your project to the latest version and try again.',
        docsLink: 'Projects platform versioning (BETA)',
        betaLink: (docsLink: string) => `For more info, see ${docsLink}.`,
      },
      missingScopeError: (
        request: string,
        accountName: string,
        authCommand: string
      ) =>
        `Couldn't execute the ${request} because the access key for ${accountName} is missing required scopes. To update scopes, run ${authCommand}. Then deactivate the existing key and generate a new one that includes the missing scopes.`,
    },
  },
  serverless: {
    verifyAccessKeyAndUserAccess: {
      fetchScopeDataError: (scopeGroup: string) =>
        `Error verifying access of scopeGroup ${scopeGroup}:`,
      portalMissingScope:
        'Your account does not have access to this action. Talk to an account admin to request it.',
      userMissingScope:
        "You don't have access to this action. Ask an account admin to change your permissions in Users & Teams settings.",
      genericMissingScope:
        'Your access key does not allow this action. Please generate a new access key by running `hs auth personalaccesskey`.',
    },
  },
  doctor: {
    runningDiagnostics: 'Running diagnostics...',
    diagnosticsComplete: 'Diagnostics complete',
    accountChecks: {
      active: 'Default account active',
      inactive: "Default account isn't active",
      inactiveSecondary: (command: string) =>
        `Run ${command} to remove inactive accounts from your CLI config`,
      unableToDetermine: 'Unable to determine if the portal is active',
      pak: {
        incomplete:
          'Personal access key is valid, but there are more scopes available to your user that are not included in your key.',
        incompleteSecondary: (command: string, link: string) =>
          `To add the available scopes, run ${command} and re-authenticate your account with a new key that has those scopes. Visit HubSpot to view selected and available scopes for your personal access key. ${link}`,
        invalid: 'Personal access key is invalid',
        invalidSecondary: (command: string) =>
          `To get a new key, run ${command}, deactivate your access key, and generate a new one. Then use that new key to authenticate your account.`,
        valid: (link: string) => `Personal Access Key is valid. ${link}`,
        viewScopes: 'View selected scopes',
      },
    },
    nodeChecks: {
      unableToDetermine:
        'Unable to determine what version of node is installed',
      minimumNotMet: (nodeVersion: string) =>
        `Minimum Node version is not met. Upgrade to ${nodeVersion} or higher`,
      success: (nodeVersion: string) => `node v${nodeVersion} is installed`,
    },
    npmChecks: {
      notInstalled: 'npm is not installed',
      installed: (npmVersion: string) => `npm v${npmVersion} is installed`,
      unableToDetermine: 'Unable to determine if npm is installed',
    },
    hsChecks: {
      notLatest: (hsVersion: string) => `Version ${hsVersion} outdated`,
      notLatestSecondary: (command: string, hsVersion: string) =>
        `Run ${command} to upgrade to the latest version ${hsVersion}`,
      latest: (hsVersion: string) => `HubSpot CLI v${hsVersion} up to date`,
      unableToDetermine: 'Unable to determine if HubSpot CLI is up to date.',
      unableToDetermineSecondary: (command: string, link: string) =>
        `Run ${command} to check your installed version; then visit the ${link} to validate whether you have the latest version`,
      unableToDetermineSecondaryLink: 'npm HubSpot CLI version history',
    },
    projectDependenciesChecks: {
      missingDependencies: (dir: string) =>
        `missing dependencies in ${chalk.bold(dir)}`,
      missingDependenciesSecondary: (command: string) =>
        `Run ${command} to install all project dependencies locally`,
      unableToDetermine: (dir: string) =>
        `Unable to determine if dependencies are installed ${dir}`,
      success: 'App dependencies are installed and up to date',
    },
    files: {
      invalidJson: (filename: string) =>
        `invalid JSON in ${chalk.bold(filename)}`,
      validJson: 'JSON files valid',
    },
    port: {
      inUse: (port: string) => `Port ${port} is in use`,
      inUseSecondary: (command: string) =>
        `Make sure it is available before running ${command}`,
      available: (port: string) =>
        `Port ${port} available for local development`,
    },
    diagnosis: {
      cli: {
        header: 'HubSpot CLI install',
      },
      cliConfig: {
        header: 'CLI configuration',
        configFileSubHeader: (filename: string) =>
          `Config File: ${chalk.bold(filename)}`,
        defaultAccountSubHeader: (accountDetails: string) =>
          `Default Account: ${accountDetails}`,
        noConfigFile: 'CLI configuration not found',
        noConfigFileSecondary: (command: string) =>
          `Run ${command} and follow the prompts to create your CLI configuration file and connect it to your HubSpot account`,
      },
      projectConfig: {
        header: 'Project configuration',
        projectDirSubHeader: (projectDir: string) =>
          `Project dir: ${chalk.bold(projectDir)}`,
        projectNameSubHeader: (projectName: string) =>
          `Project name: ${chalk.bold(projectName)}`,
      },
      counts: {
        errors: (count: string) => `${chalk.bold('Errors:')} ${count}`,
        warnings: (count: string) => `${chalk.bold('Warning:')} ${count}`,
      },
    },
  },
  oauth: {
    missingClientId: 'Error building oauth URL: missing client ID.',
  },
  migrate: {
    componentsToBeMigrated: (components: string) =>
      `The following features will be migrated: ${components}`,
    componentsThatWillNotBeMigrated: (components: string) =>
      `[NOTE] These features are not yet supported for migration but will be available later: ${components}`,
    sourceContentsMoved: (newLocation: string) =>
      `The contents of your old source directory have been moved to ${newLocation}, move any required files to the new source directory.`,
    projectMigrationWarningTitle:
      '⚠️ Important: Migrating to platformVersion 2025.2 is irreversible ⚠️',
    projectMigrationWarning: uiBetaTag(
      `Running the ${uiCommandReference('hs project migrate')} command will permanently upgrade your project to platformVersion 2025.2. This action cannot be undone. To ensure you have access to your original files, they will be copied to a new directory (archive) for safekeeping.\n\nThis command will guide you through the process, prompting you to enter the required fields and will download the new project source code into your project source directory.`,
      false
    ),
    errors: {
      project: {
        invalidConfig:
          'The project configuration file is invalid. Please check the config file and try again.',
        doesNotExist: (account: number) =>
          `Project does not exist in ${uiAccountDescription(account)}. Migrations are only supported for existing projects.`,
        multipleApps:
          'Multiple apps found in project, this is not allowed in 2025.2',
        alreadyExists: (projectName: string) =>
          `A project with name ${projectName} already exists. Please choose another name.`,
      },
      unmigratableReasons: {
        upToDate: 'App is already up to date',
        isPrivateApp: 'Private apps are not currently migratable',
        listedInMarketplace: 'Listed apps are not currently migratable',
        projectConnectedToGitHub: (
          projectName: string | undefined,
          accountId: number
        ) =>
          `The project is linked to a GitHub repository.  ${uiLink('Visit the project settings page to unlink it', getProjectSettingsUrl(projectName!, accountId)!)}`,
        partOfProjectAlready: `This app is part of a project, run ${uiCommandReference('hs project migrate')} from the project directory to migrate it`,
        generic: (reasonCode: string) => `Unable to migrate app: ${reasonCode}`,
      },
      noAppsEligible: (accountId: string, reasons: string[]) =>
        `No apps in account ${accountId} are currently migratable${reasons.length ? `\n  - ${reasons.join('\n  - ')}` : ''}`,

      invalidAccountTypeTitle: `${chalk.bold('Developer account not targeted')}`,
      invalidAccountTypeDescription: (
        useCommand: string,
        authCommand: string
      ) =>
        `Only public apps created in a developer account can be converted to a project component. Select a connected developer account with ${useCommand} or ${authCommand} and try again.`,
      appWithAppIdNotFound: (appId: number) =>
        `Could not find an app with the id ${appId} `,
      noAppsForProject: (projectName: string) =>
        `No apps associated with project ${projectName}`,
      migrationFailed: 'Migration Failed',
      notUngatedForUnifiedApps: (account: string) =>
        `Your account ${account} isn't enrolled in the required product beta to access this command.`,
    },
    prompt: {
      chooseApp: 'Which app would you like to migrate?',
      inputName: '[--name] What would you like to name the project?',
      inputDest: '[--dest] Where would you like to save the project?',
      uidForComponent: (componentName: string) =>
        `What UID would you like to use for ${componentName}?`,
      proceed: 'Would you like to proceed?',
    },
    spinners: {
      beginningMigration: 'Beginning migration',
      unableToStartMigration: 'Unable to begin migration',
      finishingMigration: 'Wrapping up migration',
      migrationComplete: 'Migration completed',
      migrationFailed: 'Migration failed',
      downloadingProjectContents: 'Downloading migrated project files',
      downloadingProjectContentsComplete: 'Migrated project files downloaded',
      downloadingProjectContentsFailed:
        'Unable to download migrated project files',
      copyingProjectFiles: 'Copying migrated project files',
      copyingProjectFilesComplete: 'Migrated project files copied',
      copyingProjectFilesFailed: 'Unable to copy migrated project files',
    },
  },
} as const satisfies LangObject;
