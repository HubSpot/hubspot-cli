import apiSampleAssetType from './api-sample';
import appAssetType from './app';
import functionAssetType from './function';
import moduleAssetType from './module';
import reactAppAssetType from './react-app';
import templateAssetType from './template';
import vueAppAssetType from './vue-app';
import webpackServerlessAssetType from './webpack-serverless';
import websiteThemeAssetType from './website-theme';

import { CreatableCmsAsset } from '../../types/Cms';

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
