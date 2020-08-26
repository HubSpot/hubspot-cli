/*global jest */
jest.mock('@hubspot/cms-lib/lib/config');

const { create } = require('./__tests__/utils/cmd');

const path = require('path');

const mockConfig = {
  defaultPortal: 'DEV',
  defaultMode: 'publish',
  httpTimeout: 30000,
  allowUsageTracking: false,
  portals: [
    {
      name: 'DEV',
      portalId: 123,
      defaultMode: 'draft',
      authType: 'apikey',
      apiKey: 'd1234567-123e-7890-b123-aaa80164b4cb',
    },
    {
      name: 'PROD',
      portalId: 456,
      authType: 'oauth2',
      auth: {
        clientId: 'd996372f-2b53-30d3-9c3b-4fdde4bce3a2',
        clientSecret: 'f90a6248-fbc0-3b03-b0db-ec58c95e791',
        scopes: ['content'],
        tokenInfo: {
          expiresAt: '2019-05-02T02:52:05.233Z',
          refreshToken: '84d22710-4cb7-5581-ba05-35f9945e5e8e',
          accessToken:
            'CJDVnLanLRICEQIYyLu8LyDh9E4opf1GMhkAxGuU5XN_O2O2QhX0khw7cwIkPkBRHye-OfIADgLBAAADAIADAAAAAAAAAAJCGQC8a5TlhtSU8T-2mVLxOBpxS18aM42oGKk',
        },
      },
    },
  ],
};
/**
 * Runs a yargs command.
 * @param {Array} args Arguments to the command
 * @param {Array} inputs (Optional) Array of inputs (user responses)
 * @param {Object} opts (optional) Environment variables
 */
global.banjo = create(path.join(__dirname, './bin/cli.js'), '.');
global.hubspotConfig = mockConfig;
