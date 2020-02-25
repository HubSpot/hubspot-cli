# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

**Note:** Version bump only for package hubspot-cms-tools

Change Log
==========

## 1.0.9

 * Remove project BETA designation
 * Add default config file names to ignore rules to prevent accidental uploads
 * Add ability to create global partials to `hs create`
 * Renamed user tokens to personal access keys
 * Updated `hs init` to use personal access keys
 * Added support for `hs auth personalaccesskey`
 * Added `--notify` support to `hs watch`
 * Updated `hs watch --remove` to also remove folders
 * Track major node version

## 1.0.8
## 1.0.7 (pulled back due to code accidentally being committed)

### CMS CLI

 * Fixed issue with duplicated folders when uploading to the Design Manager
 * Added support for authentication using a user token
 * Added `hs create website-theme` to support creating a new project using the HubSpot [CMS Theme Boilerplate](https://github.com/HubSpot/cms-theme-boilerplate)
 * Improved error messaging
 * Improved reliability when uploading a folder of files through making sure that templates and css/js files are uploaded
   after modules and other files

## 1.0.6

## 1.0.5

## 1.0.4

## 1.0.3

## 1.0.2

## 1.0.1

## 1.0.0

## 0.0.26

### CMS CLI

 * Added better error messaging when the config file is malformed or unable to be read
 * Added *modes* to specify if read/write commands should use either the `draft` or `publish` mode
 * Added the `--mode` option for use with commands `upload`, `watch`, and `fetch`
 * Added the `defaultMode` field for use in `hubspot.config.yml` files
 * Set the fallback mode to `publish`
 * Removed the `--portalId` option. The `--portal` option accepts both portal ids and config names
 * Consolidated uploading of files and folders into the `upload` command. The `sync` command is no longer supported, use `upload` instead
 * Limit number of concurrent requests when uploading and downloading files

### Webpack CMS Plugins

 * Added a `HubSpotAutoUploadPlugin` to make using [Webpack](https://https://webpack.js.org/) straightforward

## 0.0.21

### CMS CLI

 * Adjust `create` command and add ability to create templates
 * Improve fetching of files
 * Refine built-in help
 * Fix path handling in older versions of `node`

## 0.0.13

### CMS CLI

 * Fix OAuth2 authentication flow when the config file is empty
 * Better handle paths when running `sync` and `upload` sub-commands

## 0.0.12

### CMS CLI

 * Fix issues with using the tools on Windows when uploading files
 * Add `fetch` command to download assets from HubSpot
 * Add Apache 2.0 license

## 0.0.11

### CMS CLI

 * Add ability to name portals in config and set a default portal

## 0.0.10

Initial version
