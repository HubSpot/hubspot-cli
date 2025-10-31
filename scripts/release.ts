import { buildReleaseScript } from '@hubspot/npm-scripts/src/release';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { syncToPublicRepo } from './sync-to-public.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageJsonLocation = path.resolve(
  path.join(__dirname, '..', 'package.json')
);

buildReleaseScript({
  packageJsonLocation,
  buildHandlerOptions: {
    repositoryUrl: 'https://git.hubteam.com/HubSpot/hubspot-cli-private',
    postLatestRelease: ({ newVersion, dryRun }) => {
      return syncToPublicRepo({ version: newVersion, dryRun });
    },
  },
});
