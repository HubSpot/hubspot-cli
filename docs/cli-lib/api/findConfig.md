# `findConfig(directory)`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

From a given directory, `findConfig` will walk up the directory looking for a [hubspot.config.yml](../../HubspotConfigFile.md) file. If found, the absolute path to the file will be returned, otherwise `undefined` will be returned

#### Parameters

1. [`directory`](_String_): A directory that you want to start the search for. Usually this should be set to the current working directory. See [process.cwd()](https://nodejs.org/api/process.html#process_process_cwd) for details on retrieving the current working directory.

#### Returns

(_String_ or _undefined_): If found, the path to the [hubspot.config.yml](../../HubspotConfigFile.md) file will be returned. If not, `undefined` will be returned.

#### Tips

In most scenarios, you shouldn't need to know the path of the config file. Instead, you can get the config directly with the [getAndLoadConfigIfNeeded](./getAndLoadConfigIfNeeded.md) or [getConfig](./getConfig.md) functions.

#### Example

```js
const configPath = findConfig(process.cwd());

if (config) {
  console.log(`Config file was found at ${configPath}`);
} else {
  console.error('Config file could not be found');
}
```
