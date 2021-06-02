# `getConfig()`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

Retrieves a user's `hubspot.config.yml` file, and returns it. If no config is found, `undefined` will be returned

#### Parameters

No parameters

#### Returns

(_Config_ or _undefined_): If a configuration was found, it will be returned as a JS Object. If no config is found, undefined will be returned instead

#### Tips

At some point in your application's lifecycle, ensure the config is valid via the [validateConfig](./validateConfig.md) function. If it doesn't return true, you don't have a valid config, and should handle it accordingly.

#### Example

```js
const config = getConfig();

if (config && validateConfig()) {
  const configuredAccounts = config.portals.map(p => p.portalId).join(', ');
  console.log(
    `Found configurations for the following accounts: ${configuredAccounts}`
  );
}
```
