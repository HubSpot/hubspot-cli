import { strictEnforceBoolean } from '../strictEnforceBoolean.js';

vi.mock('../../../lang/en.js', () => ({
  commands: {
    config: {
      subcommands: {
        set: {
          errors: {
            invalidBoolean: (option: string, value: string) =>
              `Invalid boolean value "${value}" for --${option}. Valid values are: true, false`,
          },
        },
      },
    },
  },
}));

describe('strictEnforceBoolean()', () => {
  it('should validate valid boolean values (true/false, case-insensitive)', () => {
    const validArgs = [
      ['hs', 'config', 'set', '--allow-usage-tracking=true'],
      ['hs', 'config', 'set', '--allow-usage-tracking=false'],
      ['hs', 'config', 'set', '--allow-usage-tracking=TRUE'],
      ['hs', 'config', 'set', '--allow-usage-tracking=False'],
    ];

    validArgs.forEach(args => {
      expect(() =>
        strictEnforceBoolean(args, ['allow-usage-tracking'])
      ).not.toThrow();
      expect(strictEnforceBoolean(args, ['allow-usage-tracking'])).toBe(true);
    });
  });

  it('should reject invalid boolean values with descriptive error messages', () => {
    const invalidCases = [
      {
        args: ['hs', 'config', 'set', '--allow-usage-tracking=yes'],
        value: 'yes',
      },
      {
        args: ['hs', 'config', 'set', '--allow-usage-tracking=1'],
        value: '1',
      },
      {
        args: ['hs', 'config', 'set', '--auto-open-browser=maybe'],
        value: 'maybe',
      },
    ];

    invalidCases.forEach(({ args, value }) => {
      const option = args[3].split('=')[0].replace('--', '');
      expect(() => strictEnforceBoolean(args, [option])).toThrow(
        `Invalid boolean value "${value}" for --${option}. Valid values are: true, false`
      );
    });
  });

  it('should support multiple config values in a single command', () => {
    const args = [
      'hs',
      'config',
      'set',
      '--allow-usage-tracking=true',
      '--auto-open-browser=false',
      '--allow-auto-updates=true',
      '--http-timeout=5000',
      '--default-cms-publish-mode=draft',
    ];
    const booleanOptions = [
      'allow-usage-tracking',
      'auto-open-browser',
      'allow-auto-updates',
    ];

    expect(() => strictEnforceBoolean(args, booleanOptions)).not.toThrow();
    expect(strictEnforceBoolean(args, booleanOptions)).toBe(true);
  });

  it('should error when one of multiple values is invalid', () => {
    const args = [
      'hs',
      'config',
      'set',
      '--allow-usage-tracking=true',
      '--auto-open-browser=invalid',
      '--http-timeout=5000',
    ];
    const booleanOptions = ['allow-usage-tracking', 'auto-open-browser'];

    expect(() => strictEnforceBoolean(args, booleanOptions)).toThrow(
      'Invalid boolean value "invalid" for --auto-open-browser. Valid values are: true, false'
    );
  });

  it('should maintain backwards compatability', () => {
    expect(() =>
      strictEnforceBoolean(
        ['hs', 'config', 'set', '--allow-usage-tracking=true'],
        ['allow-usage-tracking']
      )
    ).not.toThrow();

    // No values provided (interactive mode)
    expect(() =>
      strictEnforceBoolean(['hs', 'config', 'set'], ['allow-usage-tracking'])
    ).not.toThrow();

    // Flag without equals sign (succeed with true)
    expect(() =>
      strictEnforceBoolean(
        ['hs', 'config', 'set', '--allow-usage-tracking'],
        ['allow-usage-tracking']
      )
    ).not.toThrow();
  });
});
