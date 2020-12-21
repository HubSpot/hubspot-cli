# @hubspot/local-serverless-server

A server to test CMS serverless functions locally.

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

### Usage
To start the server, the `start` method can be imported from the `@hubspot/local-serverless-server` package and run with settings like so...

```bash
const { start } = require('@hubspot/local-serverless-server');

start({
  accountId: <portalId/accountId>,                                                  // default: 123456
  contact: <booleanValueToSpecifyIfContactDataShouldBePassedToServerlessFunction>,  // default: true
  path: <pathToLocalDotFunctionsFolder>,                                            // required
  port: <customPortToRunServerOn>                                                   // default: 5432
});
```

### Mocked Data
Some of the data that is passed to the serverless function context is mocked. Specifically the `contact` and `limits` properties. It is possible
to modify the mocked data by setting values for specific variables within a `.env` file within the `.functions` folder.

The variables used to modify the data are:

```
HUBSPOT_LIMITS_TIME_REMAINING       // default: 600000
HUBSPOT_LIMITS_EXECUTIONS_REMAINING // default: 60
HUBSPOT_CONTACT_VID                 // default: 123
HUBSPOT_CONTACT_IS_LOGGED_IN        // default: false
HUBSPOT_CONTACT_LIST_MEMBERSHIPS    // default: []
```

Usage example `.env`:

```
HUBSPOT_CONTACT_VID=456
HUBSPOT_CONTACT_IS_LOGGED_IN=true
HUBSPOT_CONTACT_LIST_MEMBERSHIPS="some, memberships"
```
