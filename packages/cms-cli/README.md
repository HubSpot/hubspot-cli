# @hubspot/cms-cli

Provides an `hs` command for interacting with the HubSpot CMS. [Learn more about building on the HubSpot CMS](https://designers.hubspot.com/docs/key-concepts).

## Getting started

For more information on using these tools, see [Local Development Tooling: Getting Started](https://designers.hubspot.com/tutorials/getting-started-with-local-development)

### Installation

#### Using `yarn`

```bash
yarn add @hubspot/cms-cli --dev
```

#### Using `npm`

```bash
npm install @hubspot/cms-cli
```

### Configuring

Once the `@hubspot/cms-cli` has been added to a project, a config file named `hubspot.config.yml` will also be needed. It is recommended that the config file is kept in your `$HOME` directory.

```bash
cd ~
hs init
```

## Commands
A full breakdown of the commands can be found on the [local development tools reference page](https://designers.hubspot.com/docs/developer-reference/local-development-cms-cli).

**Note:** When `@hubspot/cms-cli` is installed local to a project, the commands need to be prefixed with either `yarn` if using `yarn` or `npx` if using `npm`.

Initialize the CLI and create a config file

```bash
hs init
```

Show all commands

```bash
hs help
```

Upload a file or directory to the Design Manager

```bash
hs upload --portal=DEV [src] [dest]
```

Fetch a file or directory by path from the Design Manager

```bash
hs fetch --portal=DEV [path] [dest]

# Overwrite existing files
hs fetch --portal=DEV --overwrite [path] [dest]
```

Watch a directory of files and automatically upload changes to the Design Manager

```bash
hs watch --portal=DEV [src] [dest]
```

Create a new asset locally

```bash
hs create [type] [dest]
```

Delete a file or directory from the Design Manager

```bash
hs remove --portal=DEV [path]
```

Authenticate against a portal using either `personalaccesskey` or `oauth2`

```bash
hs auth personalaccesskey
```

### File Manager Commands

Upload a file or directory to the File Manager

```bash
hs filemanager upload --portal=DEV [src] [dest]
```

Fetch a file or directory from the File Manager

```bash
hs filemanager fetch --portal=DEV [src] [dest]

# Overwrite existing files
hs filemanager fetch --portal=DEV --overwrite [path] [dest]
```

### HubDB Commands

Create a new HubDB table

```bash
hs hubdb create <src>
```

Fetch a HubDB table

```bash
hs hubdb fetch <id or name> <src>
```

Clear all rows in a HubDB table

```bash
hs hubdb clear <id or name>
```

Delete a HubDB table

```bash
hs hubdb delete <id or name>
```


## Authentication

There are three ways that the tools can authenticate with HubSpot.

### Personal CMS Access Key (recommended)

1. Run `hs init` or `hs auth personalaccesskey` and follow the instructions

### OAuth2

1. [Create a developer app](https://developers.hubspot.com/docs/faq/how-do-i-create-an-app-in-hubspot)
2. Run `hs auth oauth2`
3. Select `OAuth2` and follow the steps

_**Note:** The Portal ID used should be the CMS Portal ID (not the developer app ID). Client ID and Client Secret are from the developer app._

### HubSpot API Key

1. [Set up an API Key for the CMS Portal](https://knowledge.hubspot.com/articles/kcs_article/integrations/how-do-i-get-my-hubspot-api-key)
2. Edit the `hubspot.config.yml` file to set the `authType` for the portal to `apikey` and add `apiKey` as shown below:

```yaml
defaultPortal: DEV
portals:
  - name: DEV
    portalId: 123
    authType: apikey
    apiKey: d1234567-123e-7890-b123-aaa80164b4cb
```
