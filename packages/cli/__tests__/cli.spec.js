const path = require('path');
const cmd = require('../lib/cmd');
const rimraf = require('rimraf');
const { existsSync, readFileSync } = require('fs');
const yaml = require('js-yaml');

describe('my cli program', () => {
  const cliPath = path.join(__dirname, '../bin/cli.js');
  const cliProcess = cmd.create(cliPath, '.');

  it('should print the correct output', async () => {
    rimraf.sync('./hubspot.config.yml');

    await cliProcess.execute(
      ['init', '--qa'], // args
      [
        cmd.ENTER,
        'CiRjYTYyMmY0YS0xODQyLTQyMmYtOTc3OC1hMDEzMDExZTRjMjMQ8tW5MRin-NoBKhkABeaRgpKG4ptdbYYuc5IuNjUG7DE4CE0F',
        cmd.ENTER,
        'QA',
        cmd.ENTER,
      ],
      { env: { DEBUG: false }, timeout: 500 }
    );

    expect(existsSync('./hubspot.config.yml')).toBe(true);

    expect(
      yaml.safeLoad(readFileSync('./hubspot.config.yml', 'utf8'))
    ).toMatchSnapshot({
      portals: [{ auth: { tokenInfo: expect.any(Object) } }],
    });
  });
});
