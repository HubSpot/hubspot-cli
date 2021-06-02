# `loadConfigFromEnvironment()`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

Attempts to load the HubSpot configuration from environment variables. The following environment variables are used

- HUBSPOT_API_KEY
- HUBSPOT_CLIENT_ID
- HUBSPOT_CLIENT_SECRET
- HUBSPOT_PERSONAL_ACCESS_KEY
- HUBSPOT_PORTAL_ID
- HUBSPOT_REFRESH_TOKEN

#### Parameters

None

#### Returns

(_Config_ or _undefined_): If a configuration was found, it will be returned as a JS Object. If no config is found, undefined will be returned instead

#### Tips

[getAndLoadConfigIfNeeded](./getAndLoadConfigIfNeeded.md) should suffice for most use cases. It will attempt to look for config data through environment variables.

#### Example

```js
const config = loadConfigFromEnvironment();

if (config && validateConfig()) {
  const configuredAccounts = config.portals.map(p => p.portalId).join(', ');
  console.log(
    `Found configurations for the following accounts: ${configuredAccounts}`
  );
}
```
