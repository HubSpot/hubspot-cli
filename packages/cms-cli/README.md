# @hubspot/cms-cli

 **This is a beta release. Please refer to our [developer beta terms](https://legal.hubspot.com/developerbetaterms). For support, join the #local-dev-beta channel in the [HubSpot Designers and Developers Slack](https://designers.hubspot.com/slack).**


Provides an `hs` command for interacting with the HubSpot CMS. [Learn more about building on the HubSpot CMS](https://designers.hubspot.com/discoverykit).

## Getting started

For more information on using these tools, see [Local Development Tooling: Getting Started](https://designers.hubspot.com/docs/tools/local-development)

### Installation

#### Using `yarn`

```bash
yarn add @hubspot/cms-cli --dev
```

#### Using `npm`

```bash
npm install @hubspot/cms-cli --save-dev
```

### Configuration

Once the `@hubspot/cms-cli` has been added to a project, a config file named `hubspot.config.yml` will also be needed.  The config can be at the project level or higher up in the directory tree.


### Authentication

There are two ways that the tools can authenticate with HubSpot.

#### OAuth2 (recommended)

1. [Create a developer app](https://developers.hubspot.com/docs/faq/how-do-i-create-an-app-in-hubspot)
2. Run `yarn hs init` or `npx hs init`
3. Select `OAuth2` and follow the steps

_**Note:** The Portal ID used should be the CMS Portal ID(not the developer app ID). Client ID and Client Secret are from the developer app._

#### HubSpot API Key

1. [Set up an API Key for the CMS Portal](https://knowledge.hubspot.com/articles/kcs_article/integrations/how-do-i-get-my-hubspot-api-key)
2. Run `yarn hs init` or `npx hs init`
3. Select `API Key` and follow the steps entering the API Key from step 1


### Commands

**Note:** When `@hubspot/cms-cli` is installed local to a project, the commands need to be prefixed with either `yarn` if using `yarn` or `npx` if using `npm`.


Show all commands

```bash
hs help
```

Upload a file or directory to HubSpot

```bash
hs upload --portal=DEV [src] [dest]
```

Fetch a file or directory by path

```bash
hs fetch --portal=DEV [path] [dest]

# Overwrite existing files
hs fetch --portal=DEV --overwrite [path] [dest]
```

Watch a directory of files and automatically upload changes

```bash
hs watch --portal=DEV [src] [dest]
```

Create a new asset

```bash
hs create [type] [dest]
```

Delete a file or directory from HubSpot

```bash
hs remove --portal=DEV [path]
```

Authenticate against a portal using OAuth2

```bash
hs auth oauth2
```
