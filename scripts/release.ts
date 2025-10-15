import { buildReleaseScript } from '@hubspot/npm-scripts/src/release';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageJsonLocation = path.resolve(
  path.join(__dirname, '..', 'package.json')
);

buildReleaseScript({
  packageJsonLocation,
  buildHandlerOptions: {
    repositoryUrl: 'https://git.hubteam.com/HubSpot/Dev-Experience-Fe-Scripts',
  },
});
