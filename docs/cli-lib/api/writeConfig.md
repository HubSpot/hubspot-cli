# `writeConfig(options)`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

Writes the config currently in memory to the [hubspot.config.yml](../../HubspotConfigFile.md) file.

#### Parameters

1. `options` (_Object_): Optional object containing options

   - `path` (_String_): Location you want the [hubspot.config.yml](../../HubspotConfigFile.md) file to be written to. If excluded, the default, or currently found location will be used.
   - `source` (_String_): Optional full config written as a string. If used, this value will be written to the `path` instead of using the current config in memory.

#### Returns

None

#### Tips

If there is an error encountered while writing the config, the error will surface as an error in the console output.

#### Example

```js
const updatedAccount = updateAccountConfig({
  portalId: 123456789,
  name: 'newName',
});

writeConfig();
```
