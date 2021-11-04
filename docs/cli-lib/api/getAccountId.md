# `getAccountId(nameOrId)`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

description

#### Parameters

1. `nameOrId` (_string_ or _number_ or _undefined_): The account name you want to retrieve. If no name or id is passed in, the default account id will be used instead.

#### Returns

(_Number_ or _Null_): If an account is found, the account id will be returned. Otherwise null is returned.

#### Tips

Passing in an account id to the `getAccountId` function is essentially checking to see if the account exists in the [hubspot.config.yml](../../HubspotConfigFile.md) file.

#### Example

```js
/**
 * {
 *  defaultAccount: 'account2',
 *  accounts: [{
 *    name: 'account1',
 *    id: 12345678
 *  }, {
 *    name: 'account2',
 *    id: 00000000
 *  }, {
 *    name: 'myAccount',
 *    id: 11111111,
 *  }]
 * }

 *
 *

const accountIdById = getAccountId(12345678);
const accountIdByName = getAccountId('myAccount');
const defaultAccountId = getAccountId();
const unknownAccountId = getAccountId('nonExistent');

if (account) {
  console.log(accountIdById);     // 12345678
  console.log(accountIdByName);   // 11111111
  console.log(defaultAccountId);  // 00000000
  console.log(unknownAccountId);  // null
}
```
