# `hubspot.config.yml`

The `hubspot.config.yml` file controls how the HubSpot CLI interacts with your environment as well as the HubSpot environment.

## Getting Started

The easiest way to get started with a config is running the `hs init` command. This will prompt you for some questions, and at the end it will generate the file in the current working directory. If you'd like to add another account (formerly known as portal), you can use the `hs auth` command. This will have you follow a similar flow as `hs init`, and will add it to the list of `portals` within the config.

## Setting a default account

By default, the first account added to the config file is the default account. This means that when running any `hs` command, it will use the `defaultPortal` account within the config. This can be overridden in most commands with the `--account` flag.

If you would like to update your default account, you can do so by manually changing the `defaultPortal` property to whatever `accountId` you'd like to be the new default

## Priority

It is possible to have multiple `hubspot.config.yml` files. Let's imagine a scenario where you are working on three different projects for your company. The structure will be as follows

```
-- Project1
   --> hubspot.config.yml
-- Project2
-- Project3
```

Notice Project2 and Project3 don't have a `hubspot.config.yml` file. The CLI will search from your current working directory all the way to the root directory of your computer looking for a `hubspot.config.yml` file. This means, in our example, let's say that Project2 and Project3 don't need any special settings, so we decide to create a global `hubspot.config.yml` file at your root user folder `~/hubspot.config.yml`.

Doing so will result in Project1 using its local config, and Project2 and Project3 will use your global config specified at `~/hubspot.config.yml`.

Below is an exhaustive list of all properties available in the config file, along with the types or options the property accepts.

## Properties

### defaultPortal

type: _Number_

description: Specifies the default portal(account) to use with the `hs` commands

default: Whatever the first accountId added to the config is

### defaultMode

type: `draft` or `publish` or _Undefined_

description: Controls whether the commands that interact with your HubSpot design file system will be performed in draft mode, or immediately published to production.

default: `draft`

### httpTimeout

type: _Number_ or _Undefined_

description: Controls how long, in milliseconds, HTTP requests will wait until giving up.

default: `15000`

### allowUsageTracking

type: _Boolean_ or _Undefined_

description: Whether HubSpot will collect information on your CLI usage for the purposes of analytics, feature tracking, and bug tracking.

default: `true`

### useCustomObjectHubfile (BETA)

type: _Boolean_ or _Undefined_

description: Whether to use the new HubFile method to interact with the `hs custom-object` command.

default: `false`

### portals

type: _Array_

description: A list of configurations for each portal(account) added to the configuration file. The properties within each config should, most of the time, be automatically handled through the `hs auth` or `hs init` commands.

default: `[]`

## Full Configuration

```yml
defaultPortal: Number
defaultMode: `draft` or `publish` or Undefined
httpTimeout: Number or Undefined
allowUsageTracking: Boolean or Undefined
useCustomObjectHubfile: Boolean or Undefined
portals:
  - name: String
    portalId: Number
    authType: `personalaccesskey` or `oauth2` or `apikey`
    auth:
      clientId: String or Undefined
      clientSecret: String or Undefined
      scopes: Array<`content` or `hubdb` or `files`> or Undefined
      tokenInfo:
        accessToken: String or Undefined
        expiresAt: String or Undefined
        refreshToken: String or Undefined
    personalAccessKey: String or Undefined
```
