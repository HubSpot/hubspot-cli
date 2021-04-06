const http = require('http');
const cmd = require('../helpers/cmd');
const rimraf = require('rimraf');
const { existsSync, readFileSync } = require('fs');
const yaml = require('js-yaml');

describe('hs init', () => {
  const { cli, config } = global;

  it('should print the correct output for personal access key init', async () => {
    rimraf.sync('hubspot.config.yml');
    expect(existsSync('hubspot.config.yml')).toBe(false);
    await cli.execute(
      ['init'],
      [cmd.ENTER, config.personalAccessKey, cmd.ENTER, 'QA', cmd.ENTER]
    );

    expect(existsSync('hubspot.config.yml')).toBe(true);

    expect(
      yaml.load(readFileSync('hubspot.config.yml', 'utf8')).portals[0]
        .personalAccessKey
    ).toEqual(config.personalAccessKey);
  });

  if (
    global.config.clientId &&
    global.config.clientSecret &&
    global.config.refreshToken
  ) {
    it('should print the correct output for oauth init', async () => {
      rimraf.sync('hubspot.config.yml');
      expect(existsSync('hubspot.config.yml')).toBe(false);
      await cli.execute(
        ['init', '--auth=oauth2'],
        [
          cmd.ENTER,
          'Foo',
          cmd.ENTER,
          config.portalId,
          cmd.ENTER,
          config.clientId,
          cmd.ENTER,
          config.clientSecret,
          cmd.ENTER,
          cmd.ENTER,
          () => {
            const req = http.request({
              hostname: 'localhost',
              port: 3000,
              path: `/oauth-callback?code=${config.refreshToken}`,
              method: 'GET',
            });
            req.on('error', () => {
              // Do nothing in case the browser opened and automatically ran the oauth callback and closed the server
              // If we don't catch this it results in an ECONNRESET socket hang up error
              if (global.config.debug) {
                console.log('Browser already executed oauth callback');
              }
            });

            return req;
          },
        ]
      );

      expect(existsSync('hubspot.config.yml')).toBe(true);

      const portalConfig = yaml.load(readFileSync('hubspot.config.yml', 'utf8'))
        .portals[0];
      expect(portalConfig.authType).toEqual('oauth2');
      expect(portalConfig.auth.clientId).toEqual(config.clientId);
      expect(portalConfig.auth.clientSecret).toEqual(config.clientSecret);
      expect(portalConfig.auth.tokenInfo.refreshToken).toEqual(
        config.refreshToken
      );
    }, 20000);
  }
});
