# Change Log

## Changelog has moved to releases
- As of v3.0.10 new changes will be added as [new releases](https://github.com/HubSpot/hubspot-cli/releases)

## 3.0.9

- Fixed issue in theme marketplace-validate ([#556](https://github.com/HubSpot/hubspot-cli/pull/556))
- Encode project name in request URLs ([#566](https://github.com/HubSpot/hubspot-cli/pull/566))
- Bump tmpl from 1.0.4 to 1.0.5 ([#560](https://github.com/HubSpot/hubspot-cli/pull/560))
- Support section validation in theme marketplace-validate ([#546](https://github.com/HubSpot/hubspot-cli/pull/546))
- Fix project build status bug on build failure ([#562](https://github.com/HubSpot/hubspot-cli/pull/562))
- Update project upload command to handle initialization ([#564](https://github.com/HubSpot/hubspot-cli/pull/564))
- Fix template util bug ([#556](https://github.com/HubSpot/hubspot-cli/pull/556))
- Update project deploy command ([#561](https://github.com/HubSpot/hubspot-cli/pull/561))

## 3.0.8

- Marketplace theme validation has been moved out of beta ([#553](https://github.com/HubSpot/hubspot-cli/pull/553))

## 3.0.7

- Added commands to manage hubspot.config.yml ([#464](https://github.com/HubSpot/hubspot-cli/pull/464))
- Removed redundant messaging when passing `--initial-upload` to watch command ([#512](https://github.com/HubSpot/hubspot-cli/pull/512))
- Improvements to marketplace validation command ([#510](https://github.com/HubSpot/hubspot-cli/pull/510), [#518](https://github.com/HubSpot/hubspot-cli/pull/518), ([#521](https://github.com/HubSpot/hubspot-cli/pull/521)), [#527](https://github.com/HubSpot/hubspot-cli/pull/527))
- Bump ws from 7.4.5 to 7.4.6 ([#519](https://github.com/HubSpot/hubspot-cli/pull/519))
- Refactor `create` command ([#514](https://github.com/HubSpot/hubspot-cli/pull/514))
- Fixed issue serverless log polling ([#528](https://github.com/HubSpot/hubspot-cli/pull/528))
- Fixed issue when no serverless logs are available ([#524](https://github.com/HubSpot/hubspot-cli/pull/524))
- Updated API endpoint for HubDB Publish ([#539](https://github.com/HubSpot/hubspot-cli/pull/539))
- Updated Autoupload plugin README to support Webpack 5 ([#525](https://github.com/HubSpot/hubspot-cli/pull/525))
- Bump tar from 4.4.13 to 4.4.15 ([#532](https://github.com/HubSpot/hubspot-cli/pull/532))
- Bump path-parse from 1.0.6 to 1.0.7 ([#535](https://github.com/HubSpot/hubspot-cli/pull/535))
- Add new template utilities ([#534](https://github.com/HubSpot/hubspot-cli/pull/534))
- Add project related commands ([#537](https://github.com/HubSpot/hubspot-cli/pull/537), [#542](https://github.com/HubSpot/hubspot-cli/pull/542), [#548](https://github.com/HubSpot/hubspot-cli/pull/548))
- Add `hs sandbox create` ([#536](https://github.com/HubSpot/hubspot-cli/pull/536))

## 3.0.6

- Init success message now outputs correct authType ([#461](https://github.com/HubSpot/hubspot-cli/pull/461))
- Moving hubspot-cli-tests repo into hubspot-cli repo ([#466](https://github.com/HubSpot/hubspot-cli/pull/466))
- Adding initial support for project deploys ([#454](https://github.com/HubSpot/hubspot-cli/pull/454))
- Ignore package-lock.json to simplify custom package function uploads ([#477](https://github.com/HubSpot/hubspot-cli/pull/477))
- Added endpoint and method to function context to match production context ([#478](https://github.com/HubSpot/hubspot-cli/pull/478))
- Added badges for official release and current version ([#480](https://github.com/HubSpot/hubspot-cli/pull/480))
- Implement new approach for custom object schemas behind a flag ([#475](https://github.com/HubSpot/hubspot-cli/pull/475))
- Add error messaging for if a file fails to download ([#481](https://github.com/HubSpot/hubspot-cli/pull/481))
- Alert user of Theme Preview path after they’ve updated a file within a theme ([#483](https://github.com/HubSpot/hubspot-cli/pull/483))
- Added validation error for non-lowercased authType values ([#482](https://github.com/HubSpot/hubspot-cli/pull/482))
- Fixed prettier scripts on Windows ([#485](https://github.com/HubSpot/hubspot-cli/pull/485))
- Improved error messaging when running hs auth with no config ([#486](https://github.com/HubSpot/hubspot-cli/pull/486))
- Increased accepted body size for serverless dev runtime POSTs ([#487](https://github.com/HubSpot/hubspot-cli/pull/487))
- Allow .EOT files ([#484](https://github.com/HubSpot/hubspot-cli/pull/484))
- Fix typos ([#489](https://github.com/HubSpot/hubspot-cli/pull/489))
- Change console error message to reflect correct property “defaultAccount” to “defaultPortal” ([#488](https://github.com/HubSpot/hubspot-cli/pull/488))
- Fix typo in check ([#492](https://github.com/HubSpot/hubspot-cli/pull/492))
- Upload .JSON files last ([#479](https://github.com/HubSpot/hubspot-cli/pull/479))
- Clarify the purpose of 123 in the README ([#496](https://github.com/HubSpot/hubspot-cli/pull/496))
- Bump the app deploy timeout since the build is synchronous ([#493](https://github.com/HubSpot/hubspot-cli/pull/493))
- Bump lodash from 4.17.20 to 4.17.21 ([#498](https://github.com/HubSpot/hubspot-cli/pull/498))
- Add marketplace asset validation ([#449](https://github.com/HubSpot/hubspot-cli/pull/449))
- Add ability to retrieve and tail app function logs ([#490](https://github.com/HubSpot/hubspot-cli/pull/490))
- Updated endpoint for deploying serverless functions ([#494](https://github.com/HubSpot/hubspot-cli/pull/494))
- Provide more context when an app deploy fails ([#501](https://github.com/HubSpot/hubspot-cli/pull/501))
- resolves #502 by providing better error messaging. ([#503](https://github.com/HubSpot/hubspot-cli/pull/503))
- Fail jasmine ontest fail ([#505](https://github.com/HubSpot/hubspot-cli/pull/505))
- add module icon theme validator ([#506](https://github.com/HubSpot/hubspot-cli/pull/506))
- Initial README ([#500](https://github.com/HubSpot/hubspot-cli/pull/500))
- Move wiki back into the repo ([#508](https://github.com/HubSpot/hubspot-cli/pull/508))
- Adding module count, module label, and theme screenshot marketplace validators ([#504](https://github.com/HubSpot/hubspot-cli/pull/504))

## 3.0.5

- Add undocumented commands for prototyping apps
- Add `.graphql` as an allowed extension ([#470](https://github.com/HubSpot/hubspot-cli/pull/470))
- Improve output when using the `hs create` command to create a project ([#457](https://github.com/HubSpot/hubspot-cli/pull/457))
- Improve handling of `.env.template` when creating a project using `hs create` ([#458](https://github.com/HubSpot/hubspot-cli/pull/458))
- Add messaging that outputs URL to personal access key screen ([#465](https://github.com/HubSpot/hubspot-cli/pull/465))

## 3.0.4

- Fixed issue with oauth flow not working ([#460](https://github.com/HubSpot/hubspot-cli/pull/460))

## 3.0.3

- Updated help text for hs logs ([#448](https://github.com/HubSpot/hubspot-cli/pull/448))
- Updated watch text to be more explicit about what it does ([#446](https://github.com/HubSpot/hubspot-cli/pull/446))
- Added endpoint for VSCode usage tracking ([#443](https://github.com/HubSpot/hubspot-cli/pull/443))
- International characters are handled in remote HS paths ([#442](https://github.com/HubSpot/hubspot-cli/pull/442))
- Misc local serverless testing bugfixes ([#435](https://github.com/HubSpot/hubspot-cli/pull/435) [#436](https://github.com/HubSpot/hubspot-cli/pull/436) [#437](https://github.com/HubSpot/hubspot-cli/pull/437) [#438](https://github.com/HubSpot/hubspot-cli/pull/438) [#439](https://github.com/HubSpot/hubspot-cli/pull/439) [#440](https://github.com/HubSpot/hubspot-cli/pull/440) [#441](https://github.com/HubSpot/hubspot-cli/pull/441))
- Webpack autoupload plugin is now compatible with webpack 5 ([#434](https://github.com/HubSpot/hubspot-cli/pull/434))
- Fixed bug with uploading files to root ([#433](https://github.com/HubSpot/hubspot-cli/pull/433))

## 3.0.2

- Adjust `hs create` so that the beta `api-sample` asset type works. ([#431](https://github.com/HubSpot/hubspot-cli/pull/431))

## 3.0.1

- Fix runtime issue due to missing dependencies. ([#428](https://github.com/HubSpot/hubspot-cli/pull/428))

## 3.0.0

The HubSpot CMS CLI is now the HubSpot CLI!

- Bump minimum Node.js version to 10.x. ([#427](https://github.com/HubSpot/hubspot-cli/pull/427))
- Rename `@hubspot/cms-cli` to `@hubspot/cli` and `@hubspot/cms-lib` to `@hubspot/cli-lib`.
- **New command**: Add beta `hs functions test` command to make it easier to develop serverless API endpoints locally. ([#389](https://github.com/HubSpot/hubspot-cli/pull/389))
- Add ability to create API sample apps to `hs create`. ([#421](https://github.com/HubSpot/hubspot-cli/pull/421))
- Fix issue with `undefined` lines in `hs logs` output. ([#419](https://github.com/HubSpot/hubspot-cli/pull/419))
- Endpoints for serverless deploys have been updated and polling for status added. ([#411](https://github.com/HubSpot/hubspot-cli/pull/411))
- Log output for serverless deploy is now displayed for errors and success. ([#417](https://github.com/HubSpot/hubspot-cli/pull/417))

## 2.2.3

- Notify of new `@hubspot/cli` package. ([#420](https://github.com/HubSpot/hubspot-cli/pull/420))
- Add new blog template types to `hs create template` flow. ([#414](https://github.com/HubSpot/hubspot-cli/pull/414))
- Fix module label when running `hs create module`. ([#413](https://github.com/HubSpot/hubspot-cli/pull/413))
- Updated hs functions deploy command to use the new API endpoints and poll for status

## 2.2.1

- To align with preferred terminology, we replaced instances of the word `portal` with the word `account`. This was done in a non-breaking way, and any flag that currently accepts `account` will still accept `portal`. The one exception to this migration is the `hubspot.config.yml` file. We excluded this from the migration since it could potentially break backwards compatibility. The `portals`, `portal`, and `defaultPortal` nomenclature will remain for `hubspot.config.yml` (https://github.com/HubSpot/hubspot-cms-tools/pull/394 and https://github.com/HubSpot/hubspot-cms-tools/pull/397)
- Fixed an issue preventing serverless function log tailing from displaying properly (https://github.com/HubSpot/hubspot-cms-tools/pull/379)
- Fixed a bug where large HubDB tables would not download correctly (https://github.com/HubSpot/hubspot-cms-tools/pull/384)
- Fixed a bug where fetching filemanager files failed (https://github.com/HubSpot/hubspot-cms-tools/pull/387)
- Fixed to prevent fetching filemanager files to `.` from failing (https://github.com/HubSpot/hubspot-cms-tools/pull/392)
- Fixed a bug that prevented accounts using APIKEY auth from fetching filemanager files (https://github.com/HubSpot/hubspot-cms-tools/pull/390)
- Adjust output of Webpack Auto Upload Plugin to include account ID (https://github.com/HubSpot/hubspot-cms-tools/pull/383)
- Added command to build and deploy custom `package.json` dependencies (https://github.com/HubSpot/hubspot-cms-tools/pull/377)

## 2.2.0

- **New Command**: `hs completion`. Generate a `bash` or `zsh` completion script and be able to install it for command completion capabilities (https://github.com/HubSpot/hubspot-cms-tools/pull/342)
- **New Command**: `hs open`. Open a shortcut specific to your HubSpot account. Try `hs open --list` to see all available shortcuts (https://github.com/HubSpot/hubspot-cms-tools/pull/344)
- **New Command**: `hs functions list`. Output information about currently deployed serverless functions (https://github.com/HubSpot/hubspot-cms-tools/pull/352)
- **New Command**: `hs list`. List contents of a remote path (https://github.com/HubSpot/hubspot-cms-tools/pull/354)
- **New command**: `hs mv`. Move a remote file or folder (https://github.com/HubSpot/hubspot-cms-tools/pull/363)
- Fully migrated to `yargs` from `commander`, removed old `commander` code (https://github.com/HubSpot/hubspot-cms-tools/pull/320)
- Prompt for values when adding or updating a secret (https://github.com/HubSpot/hubspot-cms-tools/pull/345)
- Fix to prevent `hs fetch` failures from writing to disk (https://github.com/HubSpot/hubspot-cms-tools/pull/339)
- Support loading the `hubspot.config.yml` file relative to a specified directory (https://github.com/HubSpot/hubspot-cms-tools/pull/362)
- `hs logs` now has `--limit=<num>` option to limit the amount of logs displayed in output (https://github.com/HubSpot/hubspot-cms-tools/pull/323)
- Fixed bug where certain hubdb command used the wrong endpoint

## 2.1.0

- Initial version for custom object CLI functionality. Check out [CRM Custom Objects](https://developers.hubspot.com/docs/api/crm/crm-custom-objects) and type `hs custom-object` to get started
- Improve scope error handling and messaging ([#257](https://github.com/HubSpot/hubspot-cms-tools/issues/314))
- Make using environment variable based config explicit when running commands `--use-env` ([#257](https://github.com/HubSpot/hubspot-cms-tools/issues/257))
- Fix for `hs function create` ([#329](https://github.com/HubSpot/hubspot-cms-tools/issues/329))
- Circular dependency fixes

## 2.0.0

- `hs watch` no longer does an initial upload when the command first runs. You can opt into the old behavior by passing the `--enable-initial=true` flag. ([#273](https://github.com/HubSpot/hubspot-cms-tools/pull/273))
- Changed underlying option parser from commander.js to yargs ([#308](https://github.com/HubSpot/hubspot-cms-tools/pull/308))
- Added `hs create vue-app` for creating boilerplate vue app via CLI ([#286](https://github.com/HubSpot/hubspot-cms-tools/pull/286))

## 1.1.10

- Expand `hs create template` to support more options ([#253](https://github.com/HubSpot/hubspot-cms-tools/pull/274))
- Allow create of functions in the current directory ([#256](https://github.com/HubSpot/hubspot-cms-tools/pull/256))
- Add `hs secrets update` ([#258](https://github.com/HubSpot/hubspot-cms-tools/pull/258))
- Add usage tracking for `hs secrets` subcommands ([#276](https://github.com/HubSpot/hubspot-cms-tools/pull/276))
- Begin process of migrating from `commander.js` to `yargs`
- Fix default `host_template_types` in `hs create module` ([#274](https://github.com/HubSpot/hubspot-cms-tools/pull/274))
- Fix handling of `--debug` option when running commands with subcommands ([#284](https://github.com/HubSpot/hubspot-cms-tools/pull/284))

## 1.1.9

- Fix to allow `hs filemanager fetch` to fetch all files
- Release `hs hubdb` commands into BETA and [add them to CLI documentation](https://developers.hubspot.com/docs/cms/developer-reference/local-development-cms-cli#hubdb-commands)
- `hs hubdb` now supports referencing tables by name or ID
- Add `hs create webpack-serverless`
- Improve how CWD is determined when running `hs watch`

## 1.1.8

- Add `hs filemanager fetch`

## 1.1.7

- Fix for `hs auth personalaccesskey`

## 1.1.6

- Add `hs create react-app`
- Add `hs hubdb clear` and `hs hubdb delete`
- Add `madge` to check for circular dependencies

## 1.1.5

- Fix issues with `hs init` and `hs auth` caused by hiding `--qa` option

## 1.1.4

- Option `--qa` is hidden from help text

## 1.1.3

- Prompt for name only if not set when running hs auth and hs init
- Constants to replace PROD and QA environment strings and helper methods for getting environment specific data
- Addition of `--qa` flag for creating a portal for use with QA environment when running `hs init` or `hs auth`
- Improved logging for serverless functions, adding `--compact` flag for less output

## 1.1.2

- Fix uploading a folder of files to the file manager root

## 1.1.1

- Add utility functions to manage HubDB tables in other scripts
- Improve `hs fetch` help and parsing of arguments
- Improve tracking of `hs create`
- Fix uploading a file to file manager root
- Adjust messaging to make it clear where files are uploaded

## 1.1.0

- Address `minimist` security advisory
- Add `hs create function`
- Improve help for `hs create`
- Improve error handling in `hs init` flow
- Fix `--debug` flag

## 1.0.13

- Fix issues with the config file in git security warning
- Document `hs secrets` and `hs logs`
- Improve `hs auth` help

## 1.0.12

- Improve feedback when subcommand arguments are missing
- Improve usage tracking when authenticating the CLI with a portal
- Switch back to using `$CWD` as the default location for config file
- Improve when security warning about risk of commit a config file to git
- Add support for using environment variables for configuration
- Fix fetching of files in `@hubspot`

## 1.0.11

- Add `hs secrets list` command
- Add `logger.info` and `logger.success`
- Add ability to tail logs
- Add `portalId` to refresh

## 1.0.10

- Improve error messaging when a personal access key is invalid
- Warn when there is a risk of committing the config file to a git repos
- Guard against empty paths when fetching v1 modules
- Improve usage tracking
- Remove sortable property from fields in the skeleton module
- Fix refreshing of access tokens when using personal access key

## 1.0.9

- Remove project BETA designation
- Add default config file names to ignore rules to prevent accidental uploads
- Add ability to create global partials to `hs create`
- Renamed user tokens to personal access keys
- Updated `hs init` to use personal access keys
- Added support for `hs auth personalaccesskey`
- Added `--notify` support to `hs watch`
- Updated `hs watch --remove` to also remove folders
- Track major node version

## 1.0.8

## 1.0.7 (pulled back due to code accidentally being committed)

### CMS CLI

- Fixed issue with duplicated folders when uploading to the Design Manager
- Added support for authentication using a user token
- Added `hs create website-theme` to support creating a new project using the HubSpot [CMS Theme Boilerplate](https://github.com/HubSpot/cms-theme-boilerplate)
- Improved error messaging
- Improved reliability when uploading a folder of files through making sure that templates and css/js files are uploaded after modules and other files

## 1.0.6

## 1.0.5

## 1.0.4

## 1.0.3

## 1.0.2

## 1.0.1

## 1.0.0

## 0.0.26

### CMS CLI

- Added better error messaging when the config file is malformed or unable to be read
- Added _modes_ to specify if read/write commands should use either the `draft` or `publish` mode
- Added the `--mode` option for use with commands `upload`, `watch`, and `fetch`
- Added the `defaultMode` field for use in `hubspot.config.yml` files
- Set the fallback mode to `publish`
- Removed the `--portalId` option. The `--portal` option accepts both portal ids and config names
- Consolidated uploading of files and folders into the `upload` command. The `sync` command is no longer supported, use `upload` instead
- Limit number of concurrent requests when uploading and downloading files

### Webpack CMS Plugins

- Added a `HubSpotAutoUploadPlugin` to make using [Webpack](https://https://webpack.js.org/) straightforward

## 0.0.21

### CMS CLI

- Adjust `create` command and add ability to create templates
- Improve fetching of files
- Refine built-in help
- Fix path handling in older versions of `node`

## 0.0.13

### CMS CLI

- Fix OAuth2 authentication flow when the config file is empty
- Better handle paths when running `sync` and `upload` sub-commands

## 0.0.12

### CMS CLI

- Fix issues with using the tools on Windows when uploading files
- Add `fetch` command to download assets from HubSpot
- Add Apache 2.0 license

## 0.0.11

### CMS CLI

- Add ability to name portals in config and set a default portal

## 0.0.10

Initial version
