## Why?

HubSpot's cli-lib aims to provide useful functionality for interacting with HubSpot's public APIs.

## Framework-agnostic Integrations

HubSpot's cli-lib can integrate with various task runners and bundlers such as Gulp, Grunt, and Webpack.

Internally, the HubSpot cli-lib is consumed by the HubSpot CLI, the official HubSpot Webpack plugin, and the official HubSpot serverless development runtime.

## Functionality

The full scope of the cli-lib is quite large. It provides the ability to manage authentication, custom objects, the file manager, files within the Design Manager, serverless functions, HubDB, and more.

## Installation

- Install Node.js. The [LTS version](https://nodejs.org/en/) is recommended, however the HubSpot CLI supports any version from 10 and up. Installation details can be found at [nodejs.org](https://nodejs.org/en/)
- Install the following modules from NPM: `npm i --global @hubspot/cli` `npm i --save @hubspot/cli-lib`

## Usage

The easiest way to authenticate is through the use of a `hubspot.config.yml` file. This can be generated with the HubSpot CLI we installed above. Run `hs init` to generate this file. If you already have a `hubspot.config.yml` file, you can ensure you are authenticated by running the `hs auth` command. Upon doing this, the `hubspot.config.yml` file will be updated with the access token needed to make API calls.

It is possible to do this programmatically through APIs as well, however all of the functionality within cli-lib assumes the authentication credentials are within a `hubspot.config.yml` file.

## Hello World

Let's get started with a simple example. In this example, we are going to get the contents of the root directory in the Design Manager file system. One important note. For any of the cli-lib functionality to work, you must have your `hubspot.config.yml` configured and authenticated for whatever accountId you specify in the code below. See the usage section above for details.

```js
const {
  getDirectoryContentsByPath,
} = require('@hubspot/cli-lib/api/fileMapper');

const accountId = YOUR_ACCOUNT_ID;

getDirectoryContentsByPath(accountId, '/').then(response => {
  console.log(response);
});
```

## Contributing

### Requirements

- Installed Git
- Installed node.js >= 10

### Clone

`https://github.com/HubSpot/hubspot-cli`

### Install Dependencies

`npm i`

### Directory

`cd hubspot-cli/packages/cli-lib`

### Submitting Changes

1. Create a fork of `https://github.com/HubSpot/hubspot-cli`
2. Apply your changes to the fork
3. Open a Pull Request on the `https://github.com/HubSpot/hubspot-cli`

---

Licensed under [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
