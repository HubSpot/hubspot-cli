import apiSampleAssetType from './api-sample.js';
import appAssetType from './app.js';
import functionAssetType from './function.js';
import moduleAssetType from './module.js';
import reactAppAssetType from './react-app.js';
import templateAssetType from './template.js';
import vueAppAssetType from './vue-app.js';
import webpackServerlessAssetType from './webpack-serverless.js';
import websiteThemeAssetType from './website-theme.js';

import { CreatableCmsAsset } from '../../types/Cms.js';

const assets: { [key: string]: CreatableCmsAsset } = {
  'api-sample': apiSampleAssetType,
  app: appAssetType,
  function: functionAssetType,
  module: moduleAssetType,
  'react-app': reactAppAssetType,
  template: templateAssetType,
  'vue-app': vueAppAssetType,
  'webpack-serverless': webpackServerlessAssetType,
  'website-theme': websiteThemeAssetType,
};

export default assets;
