Change Log
==========

## Next

### CMS CLI

 * Added *modes* to specify if read/write commands should use either the `draft` or `publish` mode.
 * Added the `--mode` option for use with commands `upload`, `watch`, and `fetch`.
 * Added the `defaultMode` field for use in `hubspot.config.yml` files.
 * Set the fallback mode to `publish`.
 * Removed the `--portalId` option. The `--portal` option accepts both portal ids and config names.
 * Consolidated uploading of files and folders into the `upload` command. The `sync` command is no longer supported, use `upload` instead.

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
