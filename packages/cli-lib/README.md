## Table of Contents

- [Overview](#what-is-cli-lib-for)
- [Scope](#scope)
- [Installation](#installation)
- [Usage](#usage)
- [Hello World](#hello-world)
- [Examples](https://github.com/HubSpot/hubspot-cli/tree/master/examples/cli-lib)
- [Contributing](#contributing)

## What is CLI-lib for?

HubSpot's cli-lib aims to provide useful ways of interacting with HubSpot's public APIs.

## Why use it?

HubSpot's cli-lib can integrate with various task runners and bundlers such as Gulp, Grunt, and Webpack.

Internally, the HubSpot cli-lib is consumed by the HubSpot CLI, the official HubSpot Webpack plugin, and the official HubSpot serverless development runtime.

## Scope

The full scope of the cli-lib is quite large. It provides the ability to manage authentication, custom objects, the file manager, files within the Design Manager, serverless functions, HubDB, and more.

## API

See [Api Documentation](../../docs/cli-lib/api) for details.

## Installation

- Install Node.js. The [LTS version](https://nodejs.org) is recommended, however the HubSpot CLI supports any version from 10 and up. Installation details can be found at [nodejs.org](https://nodejs.org)
- Install the following modules from NPM:
  - `npm i --global @hubspot/cli`
  - `npm i --save @hubspot/cli-lib`

## Usage

The easiest way to authenticate is through the use of a `hubspot.config.yml` file. This can be generated with the HubSpot CLI we installed above. Run `hs init` to generate this file. If you already have a `hubspot.config.yml` file, you can ensure you are authenticated by running the `hs auth` command. Upon doing this, the `hubspot.config.yml` file will be updated with the access token needed to make API calls.

It is possible to do this programmatically through APIs as well, however all of the functionality within cli-lib assumes the authentication credentials are within a `hubspot.config.yml` file.

## Hello World

Let's get started with a simple example. In this example, we are going to get the contents of the root directory in the Design Manager file system. One important note. For any of the cli-lib functionality to work, you must have your `hubspot.config.yml` configured and authenticated for whatever account name you specify in the code below. See the usage section above for details.

```js
const {
  getDirectoryContentsByPath,
  getAccountId,
  loadConfig,
} = require('@hubspot/cli-lib/api/fileMapper');

// Loads the hubspot.config.yml file into memory for cli-lib usage
loadConfig();

/**
 *  getAccountId will get the default accountId specified in your hubspot.config.yml file
 *  You can alternatively pass in an account name if you don't want the default account
 *  to be used.
 */
const accountId = getAccountId();
getDirectoryContentsByPath(accountId, '/').then(response => {
  console.log(response);
});
```

## Contributing

### Requirements

- Installed [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- Installed [node.js](https://nodejs.org) >= 10

### Clone

`git clone https://github.com/HubSpot/hubspot-cli.git`

### Install Dependencies

`npm i`

### Directory

`cd hubspot-cli/packages/cli-lib`

### Submitting Changes

1. Create a [fork](https://github.com/HubSpot/hubspot-cli/fork)
2. Apply your changes to the fork
3. Open a [Pull Request](https://github.com/HubSpot/hubspot-cli/pulls)

---

Licensed under [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
