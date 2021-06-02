# `loadConfig(path, options=)`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

description

#### Parameters

1. [`path`](_String_): Path to the[hubspot.config.yml](../../HubspotConfigFile.md) file
2. [`options`](_Object_): An object containing a list of options to pass to the [loadConfig](./loadConfig.md) function. You may specify it to override certain settings. Options include

   - [`silenceErrors`](_Boolean_): If set to true, if a config file cannot be found, the error message will be downgraded from an error message to a debug message.
   - [`useEnv`](_Boolean_): If set to true, and environment variables for the HubSpot configuration are set, it will load the settings from those rather than loading them from a[hubspot.config.yml](../../HubspotConfigFile.md) file.

#### Returns

None

#### Tips

After loading the config, ensure it is valid by using the [validateConfig](./validateConfig.md) function. If it doesn't return true, you don't have a valid config, and should handle it accordingly.

#### Example

```js
loadConfig('path/to/hubspot.config.yml', {
  silenceErrors: true,
  useEnv: false,
});

// Ensure we actually have a valid config.  This function should only be called after we have
// attempted to load the config
if (validateConfig()) {
  console.log('Config has been successfully loaded');
}
```
