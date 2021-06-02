# `updateFolder(accountId, src, dest, options)`

[cli-lib/lib/uploadFolder.js](https://github.com/HubSpot/hubspot-cli/blob/master/packages/cli-lib/lib/uploadFolder.js)

description

#### Parameters

1. [`accountId`](_Number_): The id of the account you want to update.
2. [`src`](_String_): Local path to the folder you are uploading
3. [`dest`](_String_): Remote path to the folder within HubSpot's Design Manager
4. [`options`](_Object_=): Optional list of options to pass to the function. Not currently used publicly.

#### Returns

(_Promise<void>_): A promise that resolves once the upload is fully complete. If the promise is rejected, an Error object will be returned.

#### Example

```js
const result = await uploadFolder(12346789, './my/folder/path', '/folder');
console.log(`Upload ${result ? 'succeeded' : 'failed'}!`);
```
