# `getAccountConfig(accountId)`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

Gets the configuration for a specific account

#### Parameters

1. [`accountId`](_Number_): The id of the account you want to access.

#### Returns

(_AccountConfig_ or _Undefined_): If an account exists for the specified account id, the configuration for that account will be returned. Otherwise, undefined is returned.

#### Tips

This command is used to get a config for a specific account from the hubspot.config.yml file. If you want to get the full config file, look into [getConfig](./getConfig.md) instead.

#### Example

```js
const account = getAccountConfig(123456789);

if (account) {
  console.log(account.name);
}
```
