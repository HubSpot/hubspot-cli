# @hubspot/cli

Provides an `hs` command for interacting with HubSpot. [Learn more about building on HubSpot](https://developers.hubspot.com).

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
hs upload --account=DEV [src] [dest]
```

Fetch a file or directory by path from the Design Manager

```bash
hs fetch --account=DEV [path] [dest]

# Overwrite existing files
hs fetch --account=DEV --overwrite [path] [dest]
```

Watch a directory of files and automatically upload changes to the Design Manager

```bash
hs watch --account=DEV [src] [dest]
```

Create a new asset locally

```bash
hs create [type] [dest]
```

Delete a file or directory from the Design Manager

```bash
hs remove --account=DEV [path]
```

Authenticate against an account using either `personalaccesskey` or `oauth2`

```bash
hs auth personalaccesskey
```

### File Manager Commands

Upload a file or directory to the File Manager

```bash
hs filemanager upload --account=DEV [src] [dest]
```

Fetch a file or directory from the File Manager

```bash
hs filemanager fetch --account=DEV [src] [dest]

# Overwrite existing files
hs filemanager fetch --account=DEV --overwrite [path] [dest]
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
