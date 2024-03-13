# `@hubspot/webpack-cms-plugins`

The `@hubspot/webpack-cms-plugins` packages contains plugins designed to make using webpack to compile HubSpot CMS assets more straightforward. Instead of using `webpack-dev-server`, the idea is to generate assets locally and then upload them to the HubSpot CMS for previewing and testing. The plugin is designed to work together with [@hubspot/cli](https://www.npmjs.com/package/@hubspot/cli).

## Why is this needed?

This plugin makes it easy to use webpack-compiled assets in HubSpot CMS modules and templates. This makes it easy and seamlessly add a compilation step to the local development flow, and enables testing using real HubSpot content.

## Usage

1. Set up a `hubspot.config.yml` using the HubSpot CMS local development [instructions](https://designers.hubspot.com/docs/tools/local-development).
2. Add the plugin to your `webpack.config.js`. The `src` should be a path to the directory where the webpack compiled code is output and the `dest` property is the path where the assets should be uploaded in your HubSpot account.

Example `webpack.config.js`

```js
const HubSpotAutoUploadPlugin = require('@hubspot/webpack-cms-plugins/HubSpotAutoUploadPlugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = ({ account, autoupload }) => ({
  entry: './src/index.js',
  output: {
    filename: 'js/main.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { url: false } },
          'sass-loader',
        ],
      },
    ],
  },
  plugins: [
    new HubSpotAutoUploadPlugin({
      autoupload,
      account,
      src: 'dist',
      dest: 'my-project',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/images', to: 'images' },
        { from: 'src/templates', to: 'templates' },
      ]
    }),
  ],
});
```

3. Run `webpack --watch --env account 123 --env autoupload` to compile your project and automatically upload assets. Replace `123` with your unique Hub ID.

