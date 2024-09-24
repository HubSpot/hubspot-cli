## Using NPM dependencies

To add your own dependencies, you can list the package in dependencies within the package.json file. When the app is built, dependencies will be bundled with your function code. All dependencies must be published to NPM and be public.
For example, if you wanted to add the `lodash` library in a serverless function, you could add lodash in the `package.json`'s dependencies and then in the serverless function `require` the package.

In this example we actually add overrides for two [preloaded packages](https://developers.hubspot.com/docs/cms/data/serverless-functions/reference#preloaded-packages) to demonstrate the ability to override versions of the preloaded packages.

```
{
  "name": "demo.functions",
  "version": "1.0.0",
  "description": "",
  "dependencies": {
    "@hubspot/api-client": "^7.0.1",
    "axios": "^0.27.2",
    "lodash": "^4.17.21",
  }
}
```
