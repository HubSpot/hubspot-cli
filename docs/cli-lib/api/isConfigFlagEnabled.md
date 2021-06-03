# `isConfigFlagEnabled(flag)`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

Check if a top level boolean flag within the hubspot.config.yml file is enabled

#### Parameters

1. `flag` (_String_): Name of the flag you want to check for

#### Returns

(_Boolean_): True if the flag is set to true, false otherwise

#### Example

```js
console.log(isConfigFlagEnabled('useCustomObjectHubfile'));
```
