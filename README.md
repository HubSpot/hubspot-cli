# @hubspot/cli

[![Official Release](https://img.shields.io/npm/v/@hubspot/cli/latest?label=Official%20Release)](https://www.npmjs.com/package/@hubspot/cli) [![Latest Version](https://img.shields.io/github/v/tag/hubspot/hubspot-cli?label=Latest%20Version)](https://www.npmjs.com/package/@hubspot/cli?activeTab=versions)

A CLI for HubSpot developers to enable local development and automation. [Learn more about building on HubSpot](https://developers.hubspot.com).

## Contributing

For more information on developing, see the [Contributing Guide](CONTRIBUTING.md).

## Getting started

For more information on using these tools, see [Local Development Tooling: Getting Started](https://developers.hubspot.com/docs/cms/guides/getting-started-with-local-development)

### Installation

```bash
npm install -g @hubspot/cli
```

### Configuring

Once the `@hubspot/cli` has been added to a project, a config file named [hubspot.config.yml](../../docs/HubspotConfigFile.md) will also be needed. It is recommended that the config file is kept in your `$HOME` directory.

```bash
cd ~
hs init
```

#### Auto Completion

You can set up command autocompletion by running

```bash
hs completion
```

and copying the output to either your `.bashrc` or `.zshrc`, and then sourcing that file `source ~/.bashrc` `source ~/.zshrc` or restarting your terminal.

## Commands

A full breakdown of the commands can be found on the [local development tools reference page](https://developers.hubspot.com/docs/cms/developer-reference/local-development-cli).

**Note:** When `@hubspot/cli` is installed local to a project, the commands need to be prefixed with either `yarn` if using `yarn` or `npx` if using `npm`.

## Authentication

There are two ways that the tools can authenticate with HubSpot.

### Personal Access Key (recommended)

1. Run `hs init` or `hs auth personalaccesskey` and follow the instructions

### OAuth2

1. [Create a developer app](https://developers.hubspot.com/docs/faq/how-do-i-create-an-app-in-hubspot)
2. Run `hs auth oauth2`
3. Select `OAuth2` and follow the steps

_**Note:** The Account ID used should be the Test Account ID (not the developer app ID). Client ID and Client Secret are from the developer app._
### Exit Codes

The CLI will exit with one of the following exit codes:
- `0`: A successful run
- `1`: There was a config problem or an internal error
- `2`: There are warnings or validation issues


## Changelog

The best way to stay up to date is to check out the [Github Releases](https://github.com/HubSpot/hubspot-cli/releases) and also follow our [developer changelog posts](https://developers.hubspot.com/changelog) for an easier to read breakdown of major changes.
