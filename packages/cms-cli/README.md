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

1. Create a developer app
2. Run `yarn hs auth oauth2` or `npx hs auth oauth2` and follow the steps

#### HubSpot API Key

1. Set up an [API key](https://knowledge.hubspot.com/articles/kcs_article/integrations/how-do-i-get-my-hubspot-api-key) for the portal.
2. Add an entry in the config file

```yaml
defaultPortal: 'DEV'
portals:
  - name: 'DEV'
    portalId: 123
    authType: 'apikey'
    apiKey: 'd1234567-123e-7890-b123-aaa80164b4cb'
```

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
