# `walk(directory)`

[cli-lib/lib/walk.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/walk.js)

Walks down a directory, returning an array containing the paths of all files within that directory.

#### Parameters

1. `directory` (_String_): Local path to the directory to be walked

#### Returns

(_Promise<Array<String>>_): A promise containing the array of paths to all files within the directory. If an error is encountered during the processing, the whole promise will reject.

#### Tips

This is useful when wanting to retrieve all files within a folder to operate on, such as uploading.

#### Example

```js
const files = await walk(src);

console.log('Found the following files');
files.forEach(f => {
  console.log(f);
});
```
