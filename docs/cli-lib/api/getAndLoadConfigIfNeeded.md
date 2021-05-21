## `getAndLoadConfigIfNeeded(options)`

[cli-lib/lib/config.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/config.js)

Retrieves a user's `hubspot.config.yml` file, and returns it. If the file has not yet been loaded into memory for system usage, it will also do that as a side effect. If no config is found, an empty object will be returned.

#### Parameters

1. [`options`](*Object*): An object containing a list of options to pass to the `loadConfig` function. You may specify it to override certain settings. Options include

   - [`silenceErrors`](*Boolean*): If set to true, if a config file cannot be found, the error message will be downgraded from an error message to a debug message.
   - [`useEnv`](*Boolean*): If set to true, and environment variables for the HubSpot configuration are set, it will load the settings from those rather than loading them from a `hubspot.config.yml` file.

#### Returns

(_Config_ or _Object_): If a configuration was found, it will be returned as a JS Object. If no config is found, an empty object will be returned instead

#### Example

```js
const config = getAndLoadConfigIfNeeded();

// Ensure we actually have a valid config.  This function should only be called after we have
// attempted to load the config
if (validateConfig()) {
  const configuredAccounts = config.portals.map(p => p.portalId).join(', ');
  console.log(
    `Found configurations for the following accounts: ${configuredAccounts}`
  );
}
```

#### Tips

After loading the config, ensure it is valid by using the `validateConfig` function. If it doesn't return true, you don't have a valid config, and should handle it accordingly.
