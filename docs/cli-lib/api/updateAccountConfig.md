# `updateAccountConfig(config)`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

Updates the configuration for a specific account and returns the result. Does not write it to the hubspot.config.yml file. That must be done manually.

#### Parameters

1. `config` (_AccountConfig_): Object containing properties you want to update. Config must contain a `portalId` property. This should be equivalent to the `accountId` property.

#### Returns

(_Config_): The full updated Config. The updated data passed in will be reflected in the specific account updated.

#### Tips

After updating the account config, you must write it manually using the [writeConfig](./writeConfig.md) function.

#### Example

```js
const updatedAccount = updateAccountConfig({
  portalId: 123456789,
  name: 'newName',
});

writeConfig();
```
