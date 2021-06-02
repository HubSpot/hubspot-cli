# `validateConfig()`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

Validates the current configuration that is loaded in memory.

#### Parameters

None

#### Returns

(_Boolean_): True if the validation succeeded, false otherwise. Error messages will also be written to the logger with any validation issues.

#### Tips

It is always good when operating or loading on a config to use [validateConfig](./validateConfig.md) to ensure the config is ready to be used.

#### Example

```js
const config = getAndLoadConfigIfNeeded();

if (validateConfig()) {
  const configuredAccounts = config.portals.map(p => p.portalId).join(', ');
  console.log(
    `Found configurations for the following accounts: ${configuredAccounts}`
  );
}
```
