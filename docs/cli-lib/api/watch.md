# `watch(accountId, src, dest, options)`

[cli-lib/lib/watch.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/watch.js)

Watch the given directory or file for changes, and upload them to the `dest` folder within HubSpot when changes are detected. Uses the [chokidar](https://github.com/paulmillr/chokidar) library for watching.

#### Parameters

1. [`accountId`](_Number_): The id of the account you want to watch
2. [`src`](_String_): Path to the directory or file you want to watch
3. [`dest`](_String_): Path to the remote directory you want to upload to when changes are detected.
4. [`options`](_Object_): Object containing a list of options for the watch

   - [`mode`](_Mode_): `draft` or `publish`. If `publish` is used, changes will be immediately published to the live site.
   - [`remove`](_Boolean_): If set to true, when a file is removed from a local machine, the corresponding file will be removed from HubSpot's file system.
   - [`disableInitial`](_Boolean_): If set to true, the watch command will not upload the directory specified by `src` upon invocation.
   - [`notify`](_Boolean_): Log to specified file when a watch task is triggered and after workers have gone idle. Ex. --notify path/to/file

#### Returns

([FSWatcher](https://github.com/paulmillr/chokidar/blob/master/types/index.d.ts#L8)): A reference to the watcher instance

#### Tips

Be careful when using the `remove` flag, as this will delete files from HubSpot's DesignManager when deleting files locally. For more information on how the `FSWatcher` works, check out [chokidar](https://github.com/paulmillr/chokidar#api)

#### Example

```js
const watcher = watch(
  1234567,
  './path/to/directory',
  './remote/path/to/directory',
  {
    mode: 'draft',
    remove: false,
    disableInitial: true,
    notify: './path/to/logFile.log',
  }
);

watcher
  .on('add', path => console.log(`File ${path} has been added`))
  .on('change', path => console.log(`File ${path} has been changed`))
  .on('unlink', path => console.log(`File ${path} has been removed`));
```
