const http = require('http');
const cmd = require('../helpers/cmd');
const { CONFIG_FILE_PATH } = require('../../constants');
const rimraf = require('rimraf');
const { existsSync, readFileSync } = require('fs');
const yaml = require('js-yaml');

describe('hs init using oauth2', () => {
  const { cli, config } = global;

  beforeAll(() => {
    rimraf.sync(CONFIG_FILE_PATH);
  });

  it('should begin with no config file present', async () => {
    expect(existsSync(CONFIG_FILE_PATH)).toBe(false);
  });

  it('should create a new config file', async () => {
    await cli.execute(
      ['init', '--auth=oauth2', `--c="${CONFIG_FILE_PATH}"`],
      [
        cmd.ENTER,
        'Oauth2',
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

    expect(existsSync(CONFIG_FILE_PATH)).toBe(true);
  }, 20000);

  it('should populate the config file with the correct name', async () => {
    const portalConfig = yaml.load(readFileSync(CONFIG_FILE_PATH, 'utf8'))
      .portals[0];
    expect(portalConfig.name).toEqual('Oauth2');
  });

  it('should populate the config file with the correct authType', async () => {
    const portalConfig = yaml.load(readFileSync(CONFIG_FILE_PATH, 'utf8'))
      .portals[0];
    expect(portalConfig.authType).toEqual('oauth2');
  });

  it('should populate the config file with the correct clientId', async () => {
    const portalConfig = yaml.load(readFileSync(CONFIG_FILE_PATH, 'utf8'))
      .portals[0];
    expect(portalConfig.auth.clientId).toEqual(config.clientId);
  });

  it('should populate the config file with the correct clientSecret', async () => {
    const portalConfig = yaml.load(readFileSync(CONFIG_FILE_PATH, 'utf8'))
      .portals[0];
    expect(portalConfig.auth.clientSecret).toEqual(config.clientSecret);
  });

  it('should populate the config file with the correct refreshToken', async () => {
    const portalConfig = yaml.load(readFileSync(CONFIG_FILE_PATH, 'utf8'))
      .portals[0];
    expect(portalConfig.auth.tokenInfo.refreshToken).toEqual(
      config.refreshToken
    );
  });

  it('should populate the config file with the correct defaultPortal', async () => {
    const config = yaml.load(readFileSync(CONFIG_FILE_PATH, 'utf8'));
    expect(config.defaultPortal).toEqual('Oauth2');
  });
});
