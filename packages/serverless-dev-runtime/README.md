# @hubspot/serverless-dev-runtime

A serverless function development runtime that can be used to test CMS serverless functions. This is intended for use with the [CMS CLI](https://developers.hubspot.com/docs/cms/developer-reference/local-development-cms-cli).

⚠️ **This is a BETA release that uses some HubSpot features that are not available to all customer accounts. Please refer to the HubSpot [Developer Beta Terms](https://legal.hubspot.com/developerbetaterms)** ⚠️

## Getting started

For more information on using these tools, see [Local Development Tooling: Getting Started](https://designers.hubspot.com/tutorials/getting-started-with-local-development).

### Usage

#### CLI Command (recommended)
Using the CLI to run serverless functions locally, requires installing [@hubspot/cli](https://www.npmjs.com/package/@hubspot/cms-cli). Once installed, to test your functions run…

```bash
hs functions test <folder.functions>
```

#### Importing

It also is possible to use the runtime inside your own tooling. To start the server, the `start` method can be imported from the `@hubspot/serverless-dev-runtime` package and run with settings like so...

```bash
const { start } = require('@hubspot/serverless-dev-runtime');

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
HUBSPOT_LIMITS_TIME_REMAINING=1000
HUBSPOT_LIMITS_EXECUTIONS_REMAINING=2
HUBSPOT_CONTACT_VID=456
HUBSPOT_CONTACT_IS_LOGGED_IN=true
HUBSPOT_CONTACT_LIST_MEMBERSHIPS="some, memberships"
```
