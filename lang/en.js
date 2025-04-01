export const commands = {
  generalErrors: {
    updateNotify: {
      notifyTitle: 'Update available',
      cmsUpdateNotification:
        '{{#bold}}The CMS CLI is now the HubSpot CLI{{/bold}}\n\nTo upgrade, uninstall {{#bold}}{{ packageName }}{{/bold}}\nand then run {{ updateCommand }}',
      cliUpdateNotification:
        'HubSpot CLI version {{#cyan}}{{#bold}}{currentVersion}{{/bold}}{{/cyan}} is outdated.\nRun {{ updateCommand }} to upgrade to version {{#cyan}}{{#bold}}{latestVersion}{{/bold}}{{/cyan}}',
    },
    srcIsProject:
      '"{{ src }}" is in a project folder. Did you mean "hs project {{command}}"?',
    setDefaultAccountMoved:
      'This command has moved. Try `hs accounts use` instead',
    handleDeprecatedEnvVariables: {
      portalEnvVarDeprecated:
        'The HUBSPOT_PORTAL_ID environment variable is deprecated. Please use HUBSPOT_ACCOUNT_ID instead.',
    },
    loadConfigMiddleware: {
      configFileExists:
        'A configuration file already exists at {{ configPath }}. To specify a new configuration file, delete the existing one and try again.',
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
        accounts: '{{#bold}}Accounts{{/bold}}:',
        defaultAccount: '{{#bold}}Default account{{/bold}}: {{ account }}',
        describe: 'List names of accounts defined in config.',
        configPath: '{{#bold}}Config path{{/bold}}: {{ configPath }}',
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
          renamed: 'Account "{{ name }}" renamed to "{{ newName }}"',
        },
      },
      use: {
        describe:
          'Set the Hubspot account to use as the default account. The default account can be overridden with the "--account" option.',
        errors: {
          accountNotFound:
            'The account "{{ specifiedAccount }}" could not be found in {{ configPath }}',
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
          defaultAccountUpdated:
            'Default account updated to "{{ accountName }}"',
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
          accountNotFound:
            'The account "{{ specifiedAccount }}" could not be found in {{ configPath }}',
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
          accountRemoved: 'Account "{{ accountName }}" removed from the config',
        },
      },
      info: {
        accountId: '{{#bold}}Account ID{{/bold}}: {{ accountId }}',
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
        name: '{{#bold}}Account name{{/bold}}: {{ name }}',
        scopeGroups: '{{#bold}}Scopes available{{/bold}}:',
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
          other: '{{ count }} inactive accounts found:',
        },
        confirm: {
          one: 'Remove 1 inactive account from the CLI config?',
          other: 'Remove {{ count }} inactive accounts from the CLI config?',
        },
        removeSuccess: 'Removed {{ accountName }} from the CLI config.',
      },
    },
  },
  auth: {
    describe:
      'Configure authentication for your HubSpot account. This will update the {{ configName }} file that stores your account information.',
    errors: {
      noConfigFileFound:
        'No config file was found. To create a new config file, use the "hs init" command.',
      unsupportedAuthType:
        'Unsupported auth type: {{ type }}. The only supported authentication protocols are {{ supportedProtocols }}.',
    },
    options: {
      authType: {
        describe: 'Authentication mechanism',
        defaultDescription:
          '"{{ authMethod }}": An access token tied to a specific user account. This is the recommended way of authenticating with local development tools.',
      },
      account: {
        describe: 'HubSpot account to authenticate',
      },
    },
    success: {
      configFileUpdated:
        'Account "{{ accountName }}" updated in {{ configFilename }} using "{{ authType }}"',
    },
  },
  config: {
    describe: 'Commands for managing the CLI config file.',
    subcommands: {
      set: {
        describe:
          'Set various configuration options within the hubspot.config.yml file.',
        promptMessage: 'Select a config option to update',
        examples: {
          default: 'Opens a prompt to select a config item to modify',
        },
        options: {
          defaultMode: {
            describe: 'Set the default CMS publish mode',
            promptMessage: 'Select CMS publish mode to be used as the default',
            error:
              'The provided CMS publish mode is invalid. Valid values are {{ validModes }}.',
            success: 'Default mode updated to: {{ mode }}',
          },
          allowUsageTracking: {
            describe: 'Enable or disable usage tracking',
            promptMessage: 'Choose to enable or disable usage tracking',
            success: 'Allow usage tracking set to: "{{ isEnabled }}"',
            labels: {
              enabled: 'Enabled',
              disabled: 'Disabled',
            },
          },
          httpTimeout: {
            describe: 'Set the http timeout duration',
            promptMessage: 'Enter http timeout duration',
            success: 'The http timeout has been set to: {{ timeout }}',
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
          generatingScore: 'Generating Google Lighthouse score for {{ theme }}',
          targetDeviceNote: 'Scores are being shown for {{ target }} only.',
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
          themeNotFound:
            'Theme "{{ theme }}" not found. Please rerun using a valid theme path.',
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
          moduleDownloaded:
            '"{{ moduleName }}" succesfully downloaded to "{{ path }}"',
        },
        errors: {
          pathExists: 'Folder already exists at "{{ path }}"',
          invalidName:
            'Module not found with that name, please check the spelling of the module you are trying to download.',
        },
      },
    },
  },
  create: {
    describe:
      'Create HubSpot sample apps and CMS assets. Supported assets are {{ supportedAssetTypes }}.',
    errors: {
      deprecatedAssetType:
        'The CLI command for asset type {{ assetType }} has been deprecated in an effort to make it easier to know what asset types can be created. Run the "{{ newCommand }}" command instead. Then when prompted select "{{ type }}".',
      unsupportedAssetType:
        'The asset type {{ assetType }} is not supported. Supported asset types are {{ supportedAssetTypes }}.',
      unusablePath: 'The "{{ path }}" is not a usable path to a directory.',
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
        folderOverwritePrompt:
          'The folder with name "{{ folderName }}" already exists. Overwrite?',
        errors: {
          nameRequired:
            'The "name" argument is required when creating an API Sample.',
          noSamples:
            'Currently there are no samples available. Please try again later.',
        },
        info: {
          sampleChosen:
            "You've chosen {{ sampleType }} sample written on {{ sampleLanguage }} language",
        },
        success: {
          sampleCreated:
            'Please follow {{ filePath }}/README.md to find out how to run the sample',
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
    betaMessage:
      'The Custom Object CLI is currently in beta and is subject to change.',
    describe: 'Commands for managing custom objects.',
    seeMoreLink: 'View our docs to find out more.',
    subcommands: {
      create: {
        describe: 'Create custom object instances.',
        errors: {
          invalidObjectDefinition:
            'The object definition is invalid. Please check the schema and try again.',
          creationFailed: 'Object creation from {{ definition }} failed',
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
              creationFailed: 'Schema creation from {{ definition }} failed',
            },
            options: {
              definition: {
                describe:
                  'Local path to the JSON file containing the schema definition',
              },
            },
            success: {
              schemaCreated:
                'Your schema has been created in account "{{ accountId }}"',
              schemaViewable: 'Schema can be viewed at {{ url }}',
            },
          },
          delete: {
            describe: 'Delete a custom object schema.',
            errors: {
              delete: 'Unable to delete {{ name }}',
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
              delete: 'Successfully initiated deletion of {{ name }}',
            },
            confirmDelete:
              'Are you sure you want to delete the schema "{{ name }}"?',
            deleteCancelled: 'Deletion of schema "{{ name }}" cancelled.',
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
              fetch: 'Saved schemas to {{ path }}',
            },
            inputDest: 'Where would you like to save the schemas?',
          },
          fetch: {
            describe: 'Fetch a custom object schema.',
            errors: {
              fetch: 'Unable to fetch {{ name }}',
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
              save: 'The schema "{{ name }}" has been saved to "{{ path }}"',
              savedToPath: 'Saved schema to {{ path }}',
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
              update: 'Schema update from {{ definition }} failed',
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
              update:
                'Your schema has been updated in account "{{ accountId }}"',
              viewAtUrl: 'Schema can be viewed at {{ url }}',
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
      unableToWriteOutputFile:
        'Unable to write output to {{#bold}}{{ file }}{{/bold}}, {{ errorMessage }}',
    },
    outputWritten: 'Output written to {{#bold}}{{ filename }}{{/bold}}',
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
          fileIgnored:
            'The file "{{ path }}" is being ignored via an .hsignore rule',
          invalidPath:
            'The path "{{ path }}" is not a path to a file or folder',
          upload: 'Uploading file "{{ src }}" to "{{ dest }}" failed',
          uploadingFailed: 'Uploading failed',
        },
        logs: {
          uploading:
            'Uploading files from "{{ src }}" to "{{ dest }}" in the File Manager of account {{ accountId }}',
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
          upload:
            'Uploaded file from "{{ src }}" to "{{ dest }}" in the File Manager of account {{ accountId }}',
          uploadComplete:
            'Uploading files to "{{ dest }}" in the File Manager is complete',
        },
      },
    },
  },
  function: {
    describe: 'Commands for managing CMS serverless functions.',
    subcommands: {
      deploy: {
        debug: {
          startingBuildAndDeploy:
            'Starting build and deploy for .functions folder with path: {{ functionPath }}',
        },
        errors: {
          buildError: 'Build error: {{ details }}',
          noPackageJson:
            'Unable to find package.json for function {{ functionPath }}.',
          notFunctionsFolder:
            'Specified path {{ functionPath }} is not a .functions folder.',
        },
        examples: {
          default:
            'Build and deploy a new bundle for all functions within the myFunctionFolder.functions folder',
        },
        loading:
          'Building and deploying bundle for "{{ functionPath }}" on {{ account }}',
        loadingFailed:
          'Failed to build and deploy bundle for "{{ functionPath }}" on {{ account }}',
        positionals: {
          path: {
            describe: 'Path to the ".functions" folder',
          },
        },
        success: {
          deployed:
            'Built and deployed bundle from package.json for {{ functionPath }} on account {{ accountId }} in {{ buildTimeSeconds }}s.',
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
          startingServer:
            'Starting local test server for .functions folder with path: {{ functionPath }}',
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
          removedRows:
            'Removed {{ deletedRowCount }} rows from HubDB table {{ tableId }}',
          rowCount:
            'HubDB table {{ tableId }} now contains {{ rowCount }} rows',
          tableEmpty: 'HubDB table {{ tableId }} is already empty',
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
          create: 'Creating the table at "{{ filePath }}" failed',
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
          create:
            'The table {{ tableId }} was created in {{ accountId }} with {{ rowCount }} rows',
        },
      },
      delete: {
        describe: 'Delete a HubDB table.',
        shouldDeleteTable: 'Proceed with deleting HubDB table {{ tableId }}?',
        errors: {
          delete: 'Deleting the table {{ tableId }} failed',
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
          delete: 'The table {{ tableId }} was deleted from {{ accountId }}',
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
          fetch: 'Downloaded HubDB table {{ tableId }} to {{ path }}',
        },
      },
    },
  },
  init: {
    describe:
      'Configure authentication for your HubSpot account. This will create a {{ configName }} file to store your account information.',
    options: {
      authType: {
        describe: 'Authentication mechanism',
        defaultDescription:
          '"{{ authMethod }}":  An access token tied to a specific user account. This is the recommended way of authenticating with local development tools.',
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
      configFileCreated: 'Created config file "{{ configPath }}"',
      configFileUpdated:
        'Connected account "{{ account }}" using "{{ authType }}" and set it as the default account',
    },
    logs: {
      updateConfig:
        'To update an existing config file, use the "hs auth" command.',
    },
    errors: {
      configFileExists: 'The config file {{ configPath }} already exists.',
      bothConfigFilesNotAllowed:
        'Unable to create config file, because there is an existing one at "{{ path }}". To create a new config file, delete the existing one and try again.',
    },
  },
  lint: {
    issuesFound: '{{ count }} issues found.',
    groupName: 'Linting {{ path }}',
    positionals: {
      path: {
        describe: 'Local folder to lint',
      },
    },
  },
  list: {
    describe: 'List remote contents of a directory.',
    gettingPathContents: 'Getting contents of {{ path }}.',
    noFilesFoundAtPath: 'No files found in {{ path }}.',
    positionals: {
      path: {
        describe: 'Remote directory to list contents',
      },
    },
  },
  logs: {
    describe: 'View logs for a CMS serverless function.',
    errors: {
      noLogsFound:
        'No logs were found for the function path "{{ functionPath }}" in account "{{ accountId }}".',
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
    gettingLogs:
      'Getting {{#if latest}}latest {{/if}}logs for function with path: {{ functionPath }}.',
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
    tailLogs:
      'Waiting for log entries for "{{ functionPath }}" on account "{{ accountId }}".\n',
  },
  mv: {
    describe:
      'Move a remote file or folder in HubSpot. This feature is currently in beta and the CLI contract is subject to change.',
    errors: {
      sourcePathExists:
        'The folder "{{ srcPath }}" already exists in "{{ destPath }}".',
      moveFailed:
        'Moving "{{ srcPath }}" to "{{ destPath }}" in account {{ accountId }} failed',
    },
    move: 'Moved "{{ srcPath }}" to "{{ destPath }}" in account {{ accountId }}',
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
    describe:
      'Commands for managing projects. For more information, visit our documentation: https://developers.hubspot.com/docs/platform/build-and-deploy-using-hubspot-projects',
    subcommands: {
      dev: {
        describe: 'Start local dev for the current project.',
        logs: {
          betaMessage: 'HubSpot projects local development',
          placeholderAccountSelection:
            'Using default account as target account (for now)',
          learnMoreLocalDevServer:
            'Learn more about the projects local dev server',
        },
        errors: {
          noProjectConfig:
            'No project detected. Please run this command again from a project directory.',
          noAccount:
            'An error occurred while reading account {{ accountId }} from your config. Run {{ authCommand }} to re-auth this account.',
          noAccountsInConfig:
            'No accounts found in your config. Run {{ authCommand }} to configure a HubSpot account with the CLI.',
          invalidProjectComponents:
            'Projects cannot contain both private and public apps. Move your apps to separate projects before attempting local development.',
          noRunnableComponents:
            'No supported components were found in this project. Run {{ command }} to see a list of available components and add one to your project.',
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
          failedToFetchProjectList:
            'Failed to fetch the list of available project templates. Please try again later.',
          cannotNestProjects:
            'A project already exists at {{ projectDir }}. Projects cannot be nested within other projects. Please choose a different destination and try again.',
        },
        logs: {
          success:
            'Project {{#bold}}{{ projectName }}{{/bold}} was successfully created in {{ projectDest }}',
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
          text: 'Migrate an app to the projects framework',
          link: 'Learn more about migrating apps to the projects framework',
        },
        deprecationWarning:
          'The {{ oldCommand }} command is deprecated and will be removed. Use {{ newCommand }} going forward.',
        migrationStatus: {
          inProgress:
            'Converting app configuration to {{#bold}}public-app.json{{/bold}} component definition ...',
          success:
            '{{#bold}}Your app was converted and build #1 is deployed{{/bold}}',
          done: 'Converting app configuration to public-app.json component definition ... DONE',
          failure:
            'Converting app configuration to public-app.json component definition ... FAILED',
        },
        warning: {
          title:
            '{{#bold}}You are about to migrate an app to the projects framework{{/bold}}',
          projectConversion:
            '{{#bold}}The selected app will be converted to a project component.{{/bold}}',
          appConfig:
            'All supported app configuration will be moved to the {{#bold}}public-app.json{{/bold}} component definition file. Future updates to those features must be made through the project build and deploy pipeline, not the developer account UI.',
          buildAndDeploy:
            'This will create a new project with a single app component and immediately build and deploy it to your developer account (build #1).',
          existingApps:
            '{{#bold}}This will not affect existing app users or installs.{{/bold}}',
          copyApp:
            'We strongly recommend making a copy of your app to test this process in a development app before replacing production.',
        },
        migrationInterrupted:
          '\nThe command is terminated, but app migration is still in progress. Please check your account to ensure that the project and associated app have been created successfully.',
        createAppPrompt:
          "Proceed with migrating this app to a project component (this process can't be aborted)?",
        projectDetailsLink: 'View project details in your developer account',
        componentsToBeMigrated:
          'The following component types will be migrated: {{ components }}',
        componentsThatWillNotBeMigrated:
          '[NOTE] These component types are not yet supported for migration but will be available later: {{ components }}',
        errors: {
          noApps: 'No apps found in account {{ accountId }}',
          noAppsEligible:
            'No apps in account {{ accountId }} are currently migratable',
          invalidAccountTypeTitle:
            '{{#bold}}Developer account not targeted{{/bold}}',
          invalidAccountTypeDescription:
            'Only public apps created in a developer account can be converted to a project component. Select a connected developer account with {{useCommand}} or {{authCommand}} and try again.',
          projectAlreadyExists:
            'A project with name {{ projectName }} already exists. Please choose another name.',
          invalidApp:
            'Could not migrate appId {{ appId }}. This app cannot be migrated at this time. Please choose another public app.',
          appWithAppIdNotFound:
            'Could not find an app with the id {{ appId }} ',
        },
        prompt: {
          chooseApp: 'Which app would you like to migrate?',
          inputName: '[--name] What would you like to name the project?',
          inputDest: '[--dest] Where would you like to save the project?',
          uidForComponent:
            'What UID would you like to use for {{ componentName }}?',
          proceed: 'Would you like to proceed?',
        },
        spinners: {
          beginningMigration: 'Beginning migration',
          migrationStarted: 'Migration started',
          unableToStartMigration: 'Unable to begin migration',
          finishingMigration: 'Wrapping up migration',
          migrationComplete: 'Migration completed',
          migrationFailed: 'Migration failed',
          downloadingProjectContents: 'Downloading migrated project files',
          downloadingProjectContentsComplete:
            'Migrated project files downloaded',
          downloadingProjectContentsFailed:
            'Unable to download migrated project files',
          copyingProjectFiles: 'Copying migrated project files',
          copyingProjectFilesComplete: 'Migrated project files copied',
          copyingProjectFilesFailed: 'Unable to copy migrated project files',
        },
        migrationNotAllowedReasons: {
          upToDate: 'App is already up to date',
          isPrivateApp: 'Private apps are not currently migratable',
          listedInMarketplace: 'Listed apps are not currently migratable',
          generic: 'Unable to migrate app: {{ reasonCode }}',
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
          inProgress:
            'Cloning app configuration to {{#bold}}public-app.json{{/bold}} component definition ...',
          done: 'Cloning app configuration to public-app.json component definition ... DONE',
          success: 'Your cloned project was created in {{ dest }}',
          failure:
            'Cloning app configuration to public-app.json component definition ... FAILED',
        },
        errors: {
          invalidAccountTypeTitle:
            '{{#bold}}Developer account not targeted{{/bold}}',
          invalidAccountTypeDescription:
            'Only public apps created in a developer account can be converted to a project component. Select a connected developer account with {{useCommand}} or {{authCommand}} and try again.',
          couldNotWriteConfigPath:
            'Failed to write project config at {{ configPath }}',
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
        creatingComponent:
          'Adding a new component to {{#bold}}{{ projectName }}{{/bold}}',
        success: '{{ componentName }} was successfully added to your project.',
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
          deploying: 'Deploying project at path: {{ path }}',
        },
        errors: {
          deploy: 'Deploy error: {{ details }}',
          noBuilds: 'Deploy error: no builds for this project were found.',
          noBuildId: 'You must specify a build to deploy',
          projectNotFound:
            'The project {{ projectName }} does not exist in account {{ accountIdentifier }}. Run {{ command }} to upload your project files to HubSpot.',
          buildIdDoesNotExist:
            'Build {{ buildId }} does not exist for project {{ projectName }}. {{ linkToProject }}',
          buildAlreadyDeployed:
            'Build {{ buildId }} is already deployed. {{ linkToProject}}',
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
        showingNextBuilds:
          'Showing the next {{ count }} builds for {{ projectName }}',
        showingRecentBuilds:
          'Showing the most {{ count }} recent builds for {{ projectName }}. {{ viewAllBuildsLink }}.',
        errors: {
          noBuilds: 'No builds for this project were found.',
          projectNotFound: 'Project {{ projectName}} not found.',
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
          noFunctionsInProject:
            "There aren't any functions in this project\n\t- Run `{{#orange}}hs project logs --help{{/orange}}` to learn more about logs\n\t- {{link}} to learn more about serverless functions",
          noFunctionWithName: 'No function with name "{{ name }}"',
          functionNotDeployed:
            'The function with name "{{ name }}" is not deployed',
          projectLogsManagerNotInitialized:
            'Function called on ProjectLogsManager before initialization',
          generic: 'Error fetching logs',
        },
        logs: {
          showingLogs: 'Showing logs for:',
          hubspotLogsDirectLink: 'View function logs in HubSpot',
          noLogsFound: 'No logs were found for "{{ name }}"',
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
          buildSucceeded: 'Build #{{ buildId }} succeeded\n',
          readyToGoLive: '🚀 Ready to take your project live?',
          runCommand: 'Run `{{ command }}`',
          autoDeployDisabled:
            'Automatic deploys are disabled for this project. Run {{ deployCommand }} to deploy this build.',
        },
        errors: {
          projectLockedError:
            'Your project is locked. This may mean that another user is running the {{#bold}}`hs project dev`{{/bold}} command for this project. If this is you, unlock the project in Projects UI.',
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
          watchCancelledFromUi:
            'The watch process has been cancelled from the UI. Any changes made since cancelling have not been uploaded. To resume watching, rerun {{#yellow}}`hs project watch`{{/yellow}}.',
          resuming: 'Resuming watcher...',
          uploadSucceeded:
            'Uploaded file "{{ filePath }}" to "{{ remotePath }}"',
          deleteFileSucceeded: 'Deleted file "{{ remotePath }}"',
          deleteFolderSucceeded: 'Deleted folder "{{ remotePath }}"',
          watching:
            'Watcher is ready and watching "{{ projectDir }}". Any changes detected will be automatically uploaded.',
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
          extensionNotAllowed:
            'Skipping "{{ filePath }}" due to unsupported extension',
          ignored: 'Skipping "{{ filePath }}" due to an ignore rule',
          uploading:
            'Attempting to upload file "{{ filePath }}" to "{{ remotePath }}"',
          attemptNewBuild: 'Attempting to create a new build',
          fileAlreadyQueued:
            'File "{{ filePath }}" is already queued for upload',
        },
        errors: {
          uploadFailed:
            'Failed to upload file "{{ filePath }}" to "{{ remotePath }}"',
          deleteFileFailed: 'Failed to delete file "{{ remotePath }}"',
          deleteFolderFailed: 'Failed to delete folder "{{ remotePath }}"',
        },
      },
      download: {
        describe: 'Download your project files from HubSpot.',
        examples: {
          default: 'Download the project myProject into myProjectFolder folder',
        },
        logs: {
          downloadCancelled: 'Cancelling project download',
          downloadSucceeded:
            'Downloaded build "{{ buildId }}" from project "{{ projectName }}"',
        },
        errors: {
          downloadFailed: 'Something went wrong downloading the project',
          projectNotFound:
            'Your project {{ projectName }} could not be found in {{ accountId }}',
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
        success: 'Successfully opened "{{ projectName }}"',
      },
      feedback: {
        describe: 'Leave feedback on HubSpot projects or file a bug report.',
        feedbackType: {
          prompt: 'What type of feedback would you like to leave?',
          bug: '[--bug] Report a bug',
          general:
            "[--general] Tell us about your experience with HubSpot's developer tools",
        },
        openPrompt: 'Create a Github issue in your browser?',
        success: 'We opened {{ url }} in your browser.',
        options: {
          bug: {
            describe: 'Open Github issues in your browser to report a bug.',
          },
          general: {
            describe: 'Open Github issues in your browser to give feedback.',
          },
        },
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
        installingDependencies: 'Installing dependencies in {{directory}}',
        installationSuccessful: 'Installed dependencies in {{directory}}',
        addingDependenciesToLocation:
          'Installing {{dependencies}} in {{directory}}',
        installingDependenciesFailed:
          'Installing dependencies for {{directory}} failed',
        noProjectConfig:
          'No project detected. Run this command from a project directory.',
        noPackageJsonInProject:
          'No dependencies to install. The project {{ projectName }} folder might be missing component or subcomponent files. {{ link }}',
        packageManagerNotInstalled:
          'This command depends on {{ packageManager }}, install {{#bold}}{{ link }}{{/bold}}',
      },
    },
  },
  remove: {
    describe: 'Delete a file or folder from HubSpot.',
    deleted: 'Deleted "{{ path }}" from account {{ accountId }}',
    errors: {
      deleteFailed: 'Deleting "{{ path }}" from account {{ accountId }} failed',
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
        describe: 'Create a sandbox account.',
        examples: {
          default: 'Creates a standard sandbox account named MySandboxAccount.',
        },
        debug: {
          error: 'Error creating sandbox:',
        },
        info: {
          auth: 'Run `hs auth` to authenticate with the new sandbox account.',
        },
        options: {
          force: {
            describe:
              'Skips all confirmation prompts when creating a sandbox account.',
          },
          name: {
            describe: 'Name to use for created sandbox',
          },
          type: {
            describe: 'Type of sandbox to create (standard | development)',
          },
        },
        failure: {
          optionMissing: {
            type: 'Invalid or missing sandbox --type option in command. Please try again.',
            name: 'Invalid or missing sandbox --name option in command. Please try again.',
          },
          invalidAccountType:
            'Sandboxes must be created from a production account. Your current default account {{#bold}}{{ accountName }}{{/bold}} is a {{ accountType }}. \n- Run {{#bold}}hs accounts use{{/bold}} to switch to your default account to your production account. \n- Run {{#bold}}hs auth{{/bold}} to connect a production account to the HubSpot CLI.\n',
          noAccountConfig:
            'There is no account associated with {{ accountId }} in the config file. Please choose another account and try again, or authenticate {{ accountId }} using {{ authCommand }}.',
          noSandboxAccountConfig:
            'There is no sandbox account associated with {{ accountId }} in the config file. Please try to re-authenticate your sandbox account using {{ authCommand}}.',
        },
      },
      delete: {
        describe: 'Delete a sandbox account.',
        debug: {
          deleting: 'Deleting sandbox account "{{ account }}"',
          error: 'Error deleting sandbox account:',
        },
        examples: {
          default: 'Deletes the sandbox account named MySandboxAccount.',
        },
        confirm:
          'Delete sandbox {{#bold}}{{ account }}{{/bold}}? All data for this sandbox will be permanently deleted.',
        defaultAccountWarning:
          'The sandbox {{#bold}}{{ account }}{{/bold}} is currently set as the default account.',
        success: {
          delete:
            'Sandbox "{{ account }}" with portalId "{{ sandboxHubId }}" was deleted successfully.',
          deleteDefault:
            'Sandbox "{{ account }}" with portalId "{{ sandboxHubId }}" was deleted successfully and removed as the default account.',
          configFileUpdated:
            'Removed account {{ account }} from {{ configFilename }}.',
        },
        failure: {
          invalidUser:
            "Couldn't delete {{ accountName }} because your account has been removed from {{ parentAccountName }} or your permission set doesn't allow you to delete the sandbox. To update your permissions, contact a super admin in {{ parentAccountName }}.",
          noAccount:
            'No account specified. Specify an account by using the --account flag.',
          noSandboxAccounts:
            'There are no sandboxes connected to the CLI. To add a sandbox, run {{ authCommand }}.',
          noSandboxAccountId:
            "This sandbox can't be deleted from the CLI because we could not find the associated sandbox account.",
          noParentAccount:
            "This sandbox can't be deleted from the CLI because you haven't given the CLI access to its parent account. To do this, run {{ authCommand }} and add the parent account.",
          objectNotFound:
            'Sandbox {{#bold}}{{ account }}{{/bold}} may have been deleted through the UI. The account has been removed from the config.',
          noParentPortalAvailable:
            "This sandbox can't be deleted from the CLI because you haven't given the CLI access to its parent account. To do this, run {{ command }}. You can also delete the sandbox from the HubSpot management tool: {{#bold}}{{ url }}{{/bold}}.",
          invalidKey:
            'Your personal access key for account {{#bold}}{{ account }}{{/bold}} is inactive. To re-authenticate, please run {{ authCommand }}.',
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
  },
  secret: {
    describe: 'Commands for managing secrets.',
    subcommands: {
      add: {
        describe: 'Create a new secret.',
        errors: {
          add: 'The secret "{{ secretName }}" was not added',
          alreadyExists:
            'The secret "{{ secretName }}" already exists, it\'s value can be modified with {{ command }}',
        },
        positionals: {
          name: {
            describe: 'Name of the secret',
          },
        },
        success: {
          add: 'The secret "{{ secretName }}" was added to the HubSpot account: {{ accountIdentifier }}',
        },
      },
      delete: {
        describe: 'Delete a secret.',
        selectSecret: 'Select the secret you want to delete',
        deleteCanceled: 'Delete canceled',
        confirmDelete:
          'Are you sure you want to delete the secret "{{ secretName }}"?',
        errors: {
          delete: 'The secret "{{ secretName }}" was not deleted',
          noSecret:
            'Unable to delete secret with name "{{ secretName }}", it does not exist',
        },
        positionals: {
          name: {
            describe: 'Name of the secret',
          },
        },
        success: {
          delete:
            'The secret "{{ secretName }}" was deleted from the HubSpot account: {{ accountIdentifier }}',
        },
      },
      list: {
        describe: 'List all secrets.',
        errors: {
          list: 'The secrets could not be listed',
        },
        groupLabel: 'Secrets for account {{ accountIdentifier }}:',
      },
      update: {
        describe: 'Update an existing secret.',
        selectSecret: 'Select the secret you want to update',
        errors: {
          update: 'The secret "{{ secretName }}" was not updated',
          noSecret:
            'Unable to update secret with name "{{ secretName }}", it does not exist',
        },
        positionals: {
          name: {
            describe: 'Name of the secret to be updated',
          },
        },
        success: {
          update:
            'The secret "{{ secretName }}" was updated in the HubSpot account: {{ accountIdentifier }}',
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
          invalidPath: 'Could not find directory "{{ themePath }}"',
          fieldsNotFound: "Unable to find theme's fields.json.",
          noSelectorsFound: 'No selectors found.',
        },
        success:
          'Selectors generated for {{ themePath }}, please double check the selectors generated at {{ selectorsPath }} before uploading the theme.',
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
          invalidPath:
            'The path "{{ path }}" is not a path to a folder in the Design Manager',
        },
        logs: {
          validatingTheme: 'Validating theme "{{ path }}" \n',
        },
        results: {
          required: 'Required validation results:',
          recommended: 'Recommended validation results:',
          warnings: {
            file: 'File: {{ file }}',
            lineNumber: 'Line number: {{ line }}',
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
          invalidPath: 'The path "{{ path }}" is not a path to a directory',
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
          invalidPath:
            'The path "{{ path }}" is not a path to a module within the Design Manager.',
        },
        logs: {
          validatingModule: 'Validating module "{{ path }}" \n',
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
            file: 'File: {{ file }}',
            lineNumber: 'Line number: {{ line }}',
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
      fileIgnored:
        'The file "{{ path }}" is being ignored via an .hsignore rule',
      invalidPath: 'The path "{{ path }}" is not a path to a file or folder',
      uploadFailed: 'Uploading file "{{ src }}" to "{{ dest }}" failed',
      someFilesFailed:
        'One or more files failed to upload to "{{ dest }}" in the Design Manager',
      deleteFailed: 'Deleting "{{ path }}" from account {{ accountId }} failed',
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
    previewUrl: 'To preview this theme, visit: {{ previewUrl }}',
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
      fileUploaded:
        'Uploaded file from "{{ src }}" to "{{ dest }}" in the Design Manager of account {{ accountId }}',
      uploadComplete:
        'Uploading files to "{{ dest }}" in the Design Manager is complete',
    },
    uploading:
      'Uploading files from "{{ src }}" to "{{ dest }}" in the Design Manager of account {{ accountId }}',
    notUploaded:
      'There was an error processing "{{ src }}". The file has not been uploaded.',
    cleaning:
      'Removing "{{ filePath }}" from account {{ accountId }} and uploading local...',
    confirmCleanUpload:
      'You are about to delete the directory "{{ filePath }}" and its contents on HubSpot account {{ accountId }} before uploading. This will also clear the global content associated with any global partial templates and modules. Are you sure you want to do this?',
  },
  watch: {
    describe:
      'Watch a directory on your computer for changes and upload the changed files to the HubSpot CMS.',
    errors: {
      folderFailed:
        'Initial uploading of folder "{{ src }}" to "{{ dest }}" in account {{ accountId }} had failures',
      fileFailed:
        'Upload of file "{{ file }}" to "{{ dest }}" in account {{ accountId }} failed',
      destinationRequired: 'A destination directory needs to be passed',
      invalidPath: 'The "{{ path }}" is not a path to a directory',
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
      disableInitial:
        'Passing the "--disable-initial" option is no longer necessary. Running "hs watch" no longer uploads the watched directory by default.',
      initialUpload:
        'To upload the directory run "hs upload" beforehand or add the "--initial-upload" option when running "hs watch".',
      notUploaded:
        'The "hs watch" command no longer uploads the watched directory when started. The directory "{{ path }}" was not uploaded.',
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
      invalidPath:
        'The path "{{ path }}" specified in the "--src" flag is not a path to a file or directory',
      missingSrc:
        'Please specify the path to your javascript fields file or directory with the --src flag.',
    },
  },
};
export const lib = {
  process: {
    exitDebug: 'Attempting to gracefully exit. Triggered by {{ signal }}',
  },
  DevServerManager: {
    portConflict: 'The port {{ port }} is already in use.',
    notInitialized:
      'The Dev Server Manager must be initialized before it is started.',
    noCompatibleComponents:
      'Skipping call to {{ serverKey }} because there are no compatible components in the project.',
  },
  LocalDevManager: {
    failedToInitialize: 'Missing required arguments to initialize Local Dev',
    noDeployedBuild:
      'Your project {{#bold}}{{ projectName }}{{/bold}} exists in {{ accountIdentifier }}, but has no deployed build. Projects must be successfully deployed to be developed locally. Address any build and deploy errors your project may have, then run {{ uploadCommand }} to upload and deploy your project.',
    noComponents: 'There are no components in this project.',
    betaMessage: 'HubSpot projects local development',
    learnMoreLocalDevServer: 'Learn more about the projects local dev server',
    running:
      'Running {{#bold}}{{ projectName }}{{/bold}} locally on {{ accountIdentifier }}, waiting for changes ...',
    quitHelper: "Press {{#bold}}'q'{{/bold}} to stop the local dev server",
    viewProjectLink: 'View project in HubSpot',
    viewTestAccountLink: 'View developer test account in HubSpot',
    exitingStart: 'Stopping local dev server ...',
    exitingSucceed: 'Successfully exited',
    exitingFail: 'Failed to cleanup before exiting',
    missingUid:
      'Could not find a uid for the selected app. Confirm that the app config file contains the uid field and re-run {{ devCommand }}.',
    uploadWarning: {
      appLabel: '[App]',
      uiExtensionLabel: '[UI Extension]',
      missingComponents:
        "Couldn't find the following components in the deployed build for this project: {{#bold}}'{{ missingComponents }}'{{/bold}}. This may cause issues in local development.",
      defaultWarning:
        '{{#bold}}Changing project configuration requires a new project build.{{/bold}}',
      defaultPublicAppWarning:
        "{{#bold}}Changing project configuration requires a new project build.{{/bold}}\n\nThis will affect your public app's {{#bold}}{{ installCount }} existing {{ installText }}{{/bold}}. If your app has users in production, we strongly recommend creating a copy of this app to test your changes before proceding.",
      header: '{{ warning }} To reflect these changes and continue testing:',
      stopDev: '  * Stop {{ command }}',
      runUpload: '  * Run {{ command }}',
      restartDev: '  * Re-run {{ command }}',
      pushToGithub: '  * Commit and push your changes to GitHub',
    },
    activeInstallWarning: {
      installCount:
        '{{#bold}}The app {{ appName }} has {{ installCount }} production {{ installText }}{{/bold}}',
      explanation:
        'Some changes made during local development may need to be synced to HubSpot, which will impact those existing installs. We strongly recommend creating a copy of this app to use instead.',
      confirmation:
        'You will always be asked to confirm any permanent changes to your app’s configuration before uploading them.',
      confirmationPrompt:
        'Proceed with local development of this {{#bold}}production{{/bold}} app?',
    },
    devServer: {
      cleanupError: 'Failed to cleanup local dev server: {{ message }}',
      setupError: 'Failed to setup local dev server: {{ message }}',
      startError: 'Failed to start local dev server: {{ message }}',
      fileChangeError:
        'Failed to notify local dev server of file change: {{ message }}',
    },
  },
  localDev: {
    confirmDefaultAccountIsTarget: {
      configError:
        'An error occurred while reading the default account from your config. Run {{ authCommand }} to re-auth this account',
      declineDefaultAccountExplanation:
        'To develop on a different account, run {{ useCommand }} to change your default account, then re-run {{ devCommand }}.',
    },
    checkIfDefaultAccountIsSupported: {
      publicApp:
        'This project contains a public app. Local development of public apps is only supported on developer accounts and developer test accounts. Change your default account using {{ useCommand }}, or link a new account with {{ authCommand }}.',
      privateApp:
        'This project contains a private app. Local development of private apps is not supported in developer accounts. Change your default account using {{ useCommand }}, or link a new account with {{ authCommand }}.',
    },
    validateAccountOption: {
      invalidPublicAppAccount:
        'This project contains a public app. The "--account" flag must point to a developer test account to develop this project locally. Alternatively, change your default account to an App Developer Account using {{ useCommand }} and run {{ devCommand }} to set up a new Developer Test Account.',
      invalidPrivateAppAccount:
        'This project contains a private app. The account specified with the "--account" flag points to a developer account, which do not support the local development of private apps. Update the "--account" flag to point to a standard, sandbox, or developer test account, or change your default account by running {{ useCommand }}.',
      nonSandboxWarning:
        'Testing in a sandbox is strongly recommended. To switch the target account, select an option below or run {{#bold}}`hs accounts use`{{/bold}} before running the command again.',
      publicAppNonDeveloperTestAccountWarning:
        'Local development of public apps is only supported in {{#bold}}developer test accounts{{/bold}}.',
    },
    createNewProjectForLocalDev: {
      projectMustExistExplanation:
        'The project {{ projectName }} does not exist in the target account {{ accountIdentifier}}. This command requires the project to exist in the target account.',
      publicAppProjectMustExistExplanation:
        'The project {{ projectName }} does not exist in {{ accountIdentifier}}, the app developer account associated with your target account. This command requires the project to exist in this app developer account.',
      createProject:
        'Create new project {{ projectName}} in {{ accountIdentifier }}?',
      choseNotToCreateProject:
        'Exiting because this command requires the project to exist in the target account.',
      creatingProject:
        'Creating project {{ projectName }} in {{ accountIdentifier }}',
      createdProject:
        'Created project {{ projectName }} in {{ accountIdentifier }}',
      failedToCreateProject: 'Failed to create project in the target account.',
    },
    createInitialBuildForNewProject: {
      initialUploadMessage: 'HubSpot Local Dev Server Startup',
      projectLockedError:
        'Your project is locked. This may mean that another user is running the {{#bold}}`hs project watch`{{/bold}} command for this project. If this is you, unlock the project in Projects UI.',
      genericError:
        'An error occurred while creating the initial build for this project. Run {{ uploadCommand }} to try again.',
    },
    checkIfParentAccountIsAuthed: {
      notAuthedError:
        'To develop this project locally, run {{ authCommand }} to authenticate the App Developer Account {{ accountId }} associated with {{ accountIdentifier }}.',
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
      configNotFound:
        'Unable to locate a project configuration file. Try running again from a project directory, or run {{ createCommand }} to create a new project.',
      configMissingFields:
        'The project configuruation file is missing required fields.',
      srcDirNotFound:
        'Project source directory {{#bold}}{{ srcDir }}{{/bold}} could not be found in {{#bold}}{{ projectDir }}{{/bold}}.',
      srcOutsideProjectDir:
        'Invalid value for \'srcDir\' in {{ projectConfig }}: {{#bold}}srcDir: "{{ srcDir }}"{{/bold}}\n\t\'srcDir\' must be a relative path to a folder under the project root, such as "." or "./src"',
    },
    ensureProjectExists: {
      createPrompt:
        'The project {{ projectName }} does not exist in {{ accountIdentifier }}. Would you like to create it?',
      createPromptUpload:
        '[--forceCreate] The project {{ projectName }} does not exist in {{ accountIdentifier }}. Would you like to create it?',
      createSuccess:
        'New project {{#bold}}{{ projectName }}{{/bold}} successfully created in {{#bold}}{{ accountIdentifier }}{{/bold}}.',
      notFound:
        'Your project {{#bold}}{{ projectName }}{{/bold}} could not be found in {{#bold}}{{ accountIdentifier }}{{/bold}}.',
    },
    pollFetchProject: {
      checkingProject: 'Checking if project exists in {{ accountIdentifier }}',
    },
    logFeedbackMessage: {
      feedbackHeader: "We'd love to hear your feedback!",
      feedbackMessage:
        'How are you liking the new projects and developer tools? \n > Run `{{#yellow}}hs feedback{{/yellow}}` to let us know what you think!\n',
    },
  },
  projectBuildAndDeploy: {
    makePollTaskStatusFunc: {
      componentCountSingular: 'Found 1 component in this project',
      componentCount: 'Found {{ numComponents }} components in this project',
      successStatusText: 'DONE',
      failedStatusText: 'FAILED',
      errorFetchingTaskStatus: 'Error fetching {{ taskType }} status',
    },
    pollBuildAutodeployStatusError:
      'Error fetching autodeploy status for build #{{ buildId }}',
    pollProjectBuildAndDeploy: {
      buildSucceededAutomaticallyDeploying:
        'Build #{{ buildId }} succeeded. {{#bold}}Automatically deploying{{/bold}} to {{ accountIdentifier }}\n',
      cleanedUpTempFile: 'Cleaned up temporary file {{ path }}',
      viewDeploys: 'View all deploys for this project in HubSpot',
      unableToFindAutodeployStatus:
        'Unable to find the auto deploy for build #{{ buildId }}. This deploy may have been skipped. {{ viewDeploysLink }}.',
    },
  },
  projectUpload: {
    uploadProjectFiles: {
      add: 'Uploading {{#bold}}{{ projectName }}{{/bold}} project files to {{ accountIdentifier }}',
      fail: 'Failed to upload {{#bold}}{{ projectName }}{{/bold}} project files to {{ accountIdentifier }}',
      succeed:
        'Uploaded {{#bold}}{{ projectName }}{{/bold}} project files to {{ accountIdentifier }}',
      buildCreated:
        'Project "{{ projectName }}" uploaded and build #{{ buildId }} created',
    },
    handleProjectUpload: {
      emptySource:
        'Source directory "{{ srcDir }}" is empty. Add files to your project and rerun `{{#yellow}}hs project upload{{/yellow}}` to upload them to HubSpot.',
      compressed: 'Project files compressed: {{ byteCount }} bytes',
      compressing: 'Compressing build files to "{{ path }}"',
      fileFiltered: 'Ignore rule triggered for "{{ filename }}"',
    },
  },
  ui: {
    betaTag: '{{#bold}}[BETA]{{/bold}}',
    betaWarning: {
      header:
        '{{#yellow}}***************************** WARNING ****************************{{/yellow}}',
      footer:
        '{{#yellow}}******************************************************************{{/yellow}}',
    },
    infoTag: '{{#bold}}[INFO]{{/bold}}',
    deprecatedTag: '{{#bold}}[DEPRECATED]{{/bold}}',
    errorTag: '{{#bold}}[ERROR]{{/bold}}',
    deprecatedMessage:
      'The {{ command }} command is deprecated and will be disabled soon. {{ url }}',
    deprecatedDescription:
      '{{ message }}. The {{ command }} command is deprecated and will be disabled soon. {{ url }}',
    deprecatedUrlText: 'Learn more.',
    disabledMessage:
      'The {{ command }} command is disabled. Run {{ npmCommand }} to update to the latest HubSpot CLI version. {{ url }}',
    disabledUrlText: 'See all HubSpot CLI commands here.',
    featureHighlight: {
      defaultTitle: "What's next?",
      commandKeys: {
        accountOption: {
          command: '--account',
          message:
            'Use the {{ command }} option with any command to override the default account',
        },
        accountsListCommand: {
          command: 'hs accounts list',
          message:
            'Run {{ command }} to see a list of configured HubSpot accounts',
        },
        accountsUseCommand: {
          command: 'hs accounts use',
          message:
            'Run {{ command }} to set the Hubspot account that the CLI will target by default',
        },
        authCommand: {
          command: 'hs auth',
          message:
            'Run {{ command }} to connect the CLI to additional HubSpot accounts',
        },
        feedbackCommand: {
          command: 'hs feedback',
          message: 'Run {{ command }} to report a bug or leave feedback',
        },
        helpCommand: {
          command: 'hs help',
          message: 'Run {{ command }} to see a list of available commands',
        },
        projectCreateCommand: {
          command: 'hs project create',
          message: 'Run {{ command }} to create a new project',
        },
        projectDeployCommand: {
          command: 'hs project deploy',
          message: 'Ready to take your project live? Run {{ command }}',
        },
        projectHelpCommand: {
          command: 'hs project --help',
          message:
            'Run {{ command }} to learn more about available project commands',
        },
        projectUploadCommand: {
          command: 'hs project upload',
          message:
            'Run {{ command }} to upload your project to HubSpot and trigger builds',
        },
        projectDevCommand: {
          command: 'hs project dev',
          message:
            'Run {{ command }} to set up your test environment and start local development',
        },
        sampleProjects: {
          linkText: "HubSpot's sample projects",
          url: 'https://developers.hubspot.com/docs/platform/sample-projects?utm_source=cli&utm_content=project_create_whats_next',
          message: 'See {{ link }}',
        },
      },
    },
    git: {
      securityIssue: 'Security Issue Detected',
      configFileTracked: 'The HubSpot config file can be tracked by git.',
      fileName: 'File: "{{ configPath }}"',
      remediate: 'To remediate:',
      moveConfig:
        "- Move the config file to your home directory: '{{ homeDir }}'",
      addGitignore:
        "- Add gitignore pattern '{{ configPath }}' to a .gitignore file in root of your repository.",
      noRemote:
        '- Ensure that the config file has not already been pushed to a remote repository.',
      checkFailed:
        'Unable to determine if config file is properly ignored by git.',
    },
    serverlessFunctionLogs: {
      unableToProcessLog: 'Unable to process log {{ log }}',
      noLogsFound: 'No logs found.',
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
          default: '{{ modes }}',
          read: 'Read from {{ modes }}',
          write: 'Write to {{ modes }}',
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
      chooseDefaultAccountOption:
        '<{{#bold}}❗{{/bold}} Test on this production account {{#bold}}❗{{/bold}}>',
      promptMessage:
        '[--account] Choose a {{ accountType }} under {{ accountIdentifier }} to test with:',
      sandboxLimit:
        'Your account reached the limit of {{ limit }} development sandboxes',
      sandboxLimitWithSuggestion:
        'Your account reached the limit of {{ limit }} development sandboxes. Run {{ authCommand }} to add an existing one to the config.',
      developerTestAccountLimit:
        'Your account reached the limit of {{ limit }} developer test accounts.',
      confirmDefaultAccount:
        'Continue testing on {{#bold}}{{ accountName }} ({{ accountType }}){{/bold}}? (Y/n)',
      confirmUseExistingDeveloperTestAccount:
        "Continue with {{ accountName }}? This account isn't currently connected to the HubSpot CLI. By continuing, you'll be prompted to generate a personal access key and connect it.",
      noAccountId:
        'No account ID found for the selected account. Please try again.',
    },
    projectLogsPrompt: {
      functionName:
        '[--function] Select function in {{#bold}}{{projectName}}{{/bold}} project',
    },
    setAsDefaultAccountPrompt: {
      setAsDefaultAccountMessage: 'Set this account as the default?',
      setAsDefaultAccount:
        'Account "{{ accountName }}" set as the default account',
      keepingCurrentDefault:
        'Account "{{ accountName }}" will continue to be the default account',
    },
    accountNamePrompt: {
      enterAccountName:
        'Enter a unique name to reference this account in the CLI:',
      enterDeveloperTestAccountName: 'Name your developer test account:',
      enterStandardSandboxName: 'Name your standard sandbox:',
      enterDevelopmentSandboxName: 'Name your development sandbox:',
      sandboxDefaultName: 'New {{ sandboxType }} sandbox',
      developerTestAccountDefaultName: 'Developer test account {{ count }}',
      errors: {
        invalidName: 'You entered an invalid name. Please try again.',
        nameRequired: 'The name may not be blank. Please try again.',
        spacesInName: 'The name may not contain spaces. Please try again.',
        accountNameExists:
          'Account with name "{{ name }}" already exists in the CLI config, please enter a different name.',
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
        openingWebBrowser: 'Opening {{ url }} in your web browser',
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
        invalidTemplate:
          '[--template] Could not find template "{{ template }}". Please choose an available template:',
      },
    },
    selectPublicAppPrompt: {
      selectAppIdMigrate:
        '[--appId] Choose an app under {{ accountName }} to migrate:',
      selectAppIdClone:
        '[--appId] Choose an app under {{ accountName }} to clone:',
      errors: {
        noAccountId: 'An account ID is required to select an app.',
        noAppsMigration: '{{#bold}}No apps to migrate{{/bold}}',
        noAppsClone: '{{#bold}}No apps to clone{{/bold}}',
        noAppsMigrationMessage:
          "The selected developer account {{#bold}}{{ accountName }}{{/bold}} doesn't have any apps that can be migrated to the projects framework.",
        noAppsCloneMessage:
          "The selected developer account {{#bold}}{{ accountName }}{{/bold}} doesn't have any apps that can be cloned to the projects framework.",
        errorFetchingApps: 'There was an error fetching public apps.',
        cannotBeMigrated: 'Cannot be migrated',
      },
    },
    downloadProjectPrompt: {
      selectProject: 'Select a project to download:',
      errors: {
        projectNotFound:
          'Your project {{ projectName }} could not be found in {{ accountId }}. Please select a valid project:',
        accountIdRequired: 'An account ID is required to download a project.',
      },
    },
    projectAddPrompt: {
      selectType: '[--type] Select a component to add: ',
      enterName: '[--name] Give your component a name: ',
      errors: {
        nameRequired: 'A component name is required',
        invalidType:
          '[--type] Could not find type "{{ type }}". Please choose an available type:',
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
      fieldsPrompt:
        'Multiple fields files located in "{{ dir }}". Please choose which to upload: ',
    },
    projectNamePrompt: {
      enterName: '[--project] Enter project name:',
      errors: {
        invalidName: 'You entered an invalid name. Please try again.',
        projectDoesNotExist:
          'Project {{#bold}}{{ projectName }}{{/bold}} could not be found in "{{ accountIdentifier }}"',
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
    installPublicAppPrompt: {
      explanation:
        'Local development requires this app to be installed in the target test account',
      reinstallExplanation:
        "This app's required scopes have been updated since it was last installed on the target test account. To avoid issues with local development, we recommend reinstalling the app with the updated scopes.",
      prompt: 'Open HubSpot to install this app?',
      reinstallPrompt: 'Open HubSpot to reinstall this app?',
      decline:
        'To continue local development of this app, install it in your target test account and re-run {{#bold}}`hs project dev`{{/bold}}',
    },
    selectHubDBTablePrompt: {
      selectTable: 'Select a HubDB table:',
      enterDest: 'Enter the destination path:',
      errors: {
        noTables: 'No HubDB tables found in account {{ accountId }}',
        errorFetchingTables:
          'Unable to fetch HubDB tables in account {{ accountId }}',
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
        add: 'Creating developer test account {{#bold}}{{ accountName }}{{/bold}}',
        fail: 'Failed to create a developer test account {{#bold}}{{ accountName }}{{/bold}}.',
        succeed:
          'Successfully created a developer test account {{#bold}}{{ accountName }}{{/bold}} with portalId {{#bold}}{{ accountId }}{{/bold}}.',
      },
      success: {
        configFileUpdated:
          'Account "{{ accountName }}" updated using "{{ authType }}"',
      },
      failure: {
        invalidUser:
          "Couldn't create {{#bold}}{{ accountName }}{{/bold}} because your account has been removed from {{#bold}}{{ parentAccountName }}{{/bold}} or your permission set doesn't allow you to create the sandbox. To update your permissions, contact a super admin in {{#bold}}{{ parentAccountName }}{{/bold}}.",
        limit:
          '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} developer test accounts. \n- To connect a developer test account to your HubSpot CLI, run {{#bold}}hs auth{{/bold}} and follow the prompts.',
        alreadyInConfig:
          '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} developer test accounts. \n- To use an existing developer test account, run {{#bold}}hs accounts use{{/bold}}.',
        scopes: {
          message:
            "The personal access key you provided doesn't include developer test account permissions.",
          instructions:
            'To update CLI permissions for "{{ accountName }}": \n- Go to {{ url }}, deactivate the existing personal access key, and create a new one that includes developer test account permissions. \n- Update the CLI config for this account by running {{#bold}}hs auth{{/bold}} and entering the new key.\n',
        },
      },
    },
  },
  sandbox: {
    create: {
      loading: {
        developer: {
          add: 'Creating development sandbox {{#bold}}{{ accountName }}{{/bold}}',
          fail: 'Failed to create a development sandbox {{#bold}}{{ accountName }}{{/bold}}.',
          succeed:
            'Created {{#bold}}{{ accountName }} [dev sandbox] ({{ accountId }}){{/bold}}.',
        },
        standard: {
          add: 'Creating standard sandbox {{#bold}}{{ accountName }}{{/bold}}',
          fail: 'Failed to create a standard sandbox {{#bold}}{{ accountName }}{{/bold}}.',
          succeed:
            'Created {{#bold}}{{ accountName }} [standard sandbox] ({{ accountId }}){{/bold}}.',
        },
      },
      failure: {
        invalidUser:
          "Couldn't create {{#bold}}{{ accountName }}{{/bold}} because your account has been removed from {{#bold}}{{ parentAccountName }}{{/bold}} or your permission set doesn't allow you to create the sandbox. To update your permissions, contact a super admin in {{#bold}}{{ parentAccountName }}{{/bold}}.",
        '403Gating':
          "Couldn't create {{#bold}}{{ accountName }}{{/bold}} because {{#bold}}{{ parentAccountName }}{{/bold}} does not have access to development sandboxes. To opt in to the CRM Development Beta and use development sandboxes, visit https://app.hubspot.com/l/product-updates/in-beta?update=13899236.",
        usageLimitsFetch:
          'Unable to fetch sandbox usage limits. Please try again.',
        generic:
          'An error occurred while creating a new sandbox. Please try again.',
        limit: {
          developer: {
            one: '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} development sandbox. \n- View sandbox details at {{ link }} \n- To connect a sandbox to your HubSpot CLI, run {{#bold}}hs auth{{/bold}} and follow the prompts.',
            other:
              '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} development sandboxes. \n- View sandbox details at {{ link }} \n- To connect a sandbox to your HubSpot CLI, run {{#bold}}hs auth{{/bold}} and follow the prompts.',
          },
          standard: {
            one: '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} standard sandbox. \n- View sandbox details at {{ link }} \n- To connect a sandbox to your HubSpot CLI, run {{#bold}}hs auth{{/bold}} and follow the prompts.',
            other:
              '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} standard sandboxes. \n- View sandbox details at {{ link }} \n- To connect a sandbox to your HubSpot CLI, run {{#bold}}hs auth{{/bold}} and follow the prompts.',
          },
        },
        alreadyInConfig: {
          developer: {
            one: '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} development sandbox per account. \n- To use an existing development sandbox, run {{#bold}}hs accounts use{{/bold}}. \n- To delete an existing sandbox, run {{#bold}}hs sandbox delete{{/bold}}.',
            other:
              '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} development sandboxes per account. \n- To use an existing development sandbox, run {{#bold}}hs accounts use{{/bold}}. \n- To delete an existing sandbox, run {{#bold}}hs sandbox delete{{/bold}}.',
          },
          standard: {
            one: '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} standard sandbox per account. \n- To use an existing standard sandbox, run {{#bold}}hs accounts use{{/bold}}. \n- To delete an existing sandbox, run {{#bold}}hs sandbox delete{{/bold}}.',
            other:
              '{{#bold}}{{ accountName }}{{/bold}} reached the limit of {{ limit }} standard sandboxes per account. \n- To use an existing standard sandbox, run {{#bold}}hs accounts use{{/bold}}. \n- To delete an existing sandbox, run {{#bold}}hs sandbox delete{{/bold}}.',
          },
        },
        scopes: {
          message:
            "The personal access key you provided doesn't include sandbox permissions.",
          instructions:
            'To update CLI permissions for "{{ accountName }}": \n- Go to {{ url }}, deactivate the existing personal access key, and create a new one that includes Sandboxes permissions. \n- Update the CLI config for this account by running {{#bold}}hs auth{{/bold}} and entering the new key.\n',
        },
      },
    },
    sync: {
      info: {
        syncStatus:
          'View the sync status details at: {{#bold}}{{ url }}{{/bold}}',
        syncMessage:
          'Asset sync from production to the sandbox is in progress and is running in the background. It may take some time. {{ url }}',
        syncMessageDevSb:
          'Sync of object definitions from production to the sandbox is in progress and is running in the background. It may take some time. {{ url }}',
        syncStatusDetailsLinkText: 'View sync status details here',
      },
      confirm: {
        createFlow: {
          standard:
            'Sync all supported assets to {{#cyan}}{{#bold}}{{ sandboxName }}{{/bold}}{{/cyan}} from {{#bold}}{{ parentAccountName }}{{/bold}}?',
          developer:
            'Sync CRM object definitions to {{#cyan}}{{#bold}}{{ sandboxName }}{{/bold}}{{/cyan}} from {{#bold}}{{ parentAccountName }}{{/bold}}?',
        },
        syncContactRecords: {
          standard:
            'Copy up to 5000 most recently updated contacts? This includes up to 100 of each of the following: associated deals, tickets, and companies.',
          developer:
            'Include up to 100 most recently updated contacts? This includes up to 100 of each of the following: associated deals, tickets, and companies. This can be done once per sandbox.',
        },
      },
      loading: {
        startSync: 'Initiating sync...',
        fail: 'Failed to sync sandbox.',
        succeed: 'Initiated asset sync from production to {{ accountName }}',
        succeedDevSb:
          'Initiated sync of object definitions from production to {{ accountName }}',
        successDevSbInfo:
          'Initiated sync of object definitions from production to {{ accountName }}. It may take some time. {{ url }}',
      },
      failure: {
        invalidUser:
          "Couldn't sync {{ accountName }} because your account has been removed from {{ parentAccountName }} or your permission set doesn't allow you to sync the sandbox. To update your permissions, contact a super admin in {{ parentAccountName }}.",
        syncInProgress:
          "Couldn't run the sync because there's another sync in progress. Wait for the current sync to finish and then try again. To check the sync status, visit the sync activity log: {{ url }}.",
        notSuperAdmin:
          "Couldn't run the sync because you are not a super admin in {{ account }}. Ask the account owner for super admin access to the sandbox.",
        objectNotFound:
          "Couldn't sync the sandbox because {{#bold}}{{ account }}{{/bold}} may have been deleted through the UI. Run {{#bold}}hs sandbox delete{{/bold}} to remove this account from the config. ",
        syncTypeFetch:
          'Unable to fetch available sandbox sync types. Please try again.',
      },
    },
  },
  errorHandlers: {
    index: {
      errorOccurred: 'Error: {{ error }}',
      errorContext: 'Context: {{ context }}',
      errorCause: 'Cause: {{ cause }}',
      unknownErrorOccurred: 'An unknown error has occurred.',
    },
    suppressErrors: {
      platformVersionErrors: {
        header: 'Platform version update required',
        unspecifiedPlatformVersion:
          'Projects with an {{#bold}}{{platformVersion}}{{/bold}} are no longer supported.',
        platformVersionRetired:
          'Projects with {{#bold}}platformVersion {{ platformVersion }}{{/bold}} are no longer supported.',
        nonExistentPlatformVersion:
          'Projects with {{#bold}}platformVersion {{ platformVersion }}{{/bold}} are not supported.',
        updateProject:
          'Please update your project to the latest version and try again.',
        docsLink: 'Projects platform versioning (BETA)',
        betaLink: 'For more info, see {{ docsLink }}.',
      },
      missingScopeError:
        "Couldn't execute the {{ request }} because the access key for {{ accountName }} is missing required scopes. To update scopes, run {{ authCommand }}. Then deactivate the existing key and generate a new one that includes the missing scopes.",
    },
  },
  serverless: {
    verifyAccessKeyAndUserAccess: {
      fetchScopeDataError:
        'Error verifying access of scopeGroup {{ scopeGroup }}:',
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
      inactiveSecondary:
        'Run {{ command }} to remove inactive accounts from your CLI config',
      unableToDetermine: 'Unable to determine if the portal is active',
      pak: {
        incomplete:
          'Personal access key is valid, but there are more scopes available to your user that are not included in your key.',
        incompleteSecondary:
          'To add the available scopes, run {{ command }} and re-authenticate your account with a new key that has those scopes. Visit HubSpot to view selected and available scopes for your personal access key. {{ link }}',
        invalid: 'Personal access key is invalid',
        invalidSecondary:
          'To get a new key, run {{ command }}, deactivate your access key, and generate a new one. Then use that new key to authenticate your account.',
        valid: 'Personal Access Key is valid. {{ link }}',
        viewScopes: 'View selected scopes',
      },
    },
    nodeChecks: {
      unableToDetermine:
        'Unable to determine what version of node is installed',
      minimumNotMet:
        'Minimum Node version is not met. Upgrade to {{ nodeVersion }} or higher',
      success: 'node v{{ nodeVersion }} is installed',
    },
    npmChecks: {
      notInstalled: 'npm is not installed',
      installed: 'npm v{{ npmVersion }} is installed',
      unableToDetermine: 'Unable to determine if npm is installed',
    },
    hsChecks: {
      notLatest: 'Version {{ hsVersion }} outdated',
      notLatestSecondary:
        'Run {{ command }} to upgrade to the latest version {{ hsVersion }}',
      latest: 'HubSpot CLI v{{ hsVersion }} up to date',
      unableToDetermine: 'Unable to determine if HubSpot CLI is up to date.',
      unableToDetermineSecondary:
        'Run {{ command }} to check your installed version; then visit the {{ link }} to validate whether you have the latest version',
      unableToDetermineSecondaryLink: 'npm HubSpot CLI version history',
    },
    projectDependenciesChecks: {
      missingDependencies:
        'missing dependencies in {{#bold}}{{ dir }}{{/bold}}',
      missingDependenciesSecondary:
        'Run {{ command }} to install all project dependencies locally',
      unableToDetermine:
        'Unable to determine if dependencies are installed {{ dir }}',
      success: 'App dependencies are installed and up to date',
    },
    files: {
      invalidJson: 'invalid JSON in {{#bold}}{{ filename }}{{/bold}}',
      validJson: 'JSON files valid',
    },
    port: {
      inUse: 'Port {{ port }} is in use',
      inUseSecondary:
        'Make sure it is available if before running {{ command }}',
      available: 'Port {{ port }} available for local development',
    },
    diagnosis: {
      cli: {
        header: 'HubSpot CLI install',
      },
      cliConfig: {
        header: 'CLI configuration',
        configFileSubHeader: 'Config File: {{#bold}}{{ filename }}{{/bold}}',
        defaultAccountSubHeader: 'Default Account: {{accountDetails}}',
        noConfigFile: 'CLI configuration not found',
        noConfigFileSecondary:
          'Run {{command}} and follow the prompts to create your CLI configuration file and connect it to your HubSpot account',
      },
      projectConfig: {
        header: 'Project configuration',
        projectDirSubHeader: 'Project dir: {{#bold}}{{ projectDir }}{{/bold}}',
        projectNameSubHeader:
          'Project name: {{#bold}}{{ projectName }}{{/bold}}',
      },
      counts: {
        errors: '{{#bold}}Errors:{{/bold}} {{ count }}',
        warnings: '{{#bold}}Warning:{{/bold}} {{ count }}',
      },
    },
  },
  oauth: {
    missingClientId: 'Error building oauth URL: missing client ID.',
  },
};
