import { describe, expect, it, vi } from 'vitest';
import { parseYargsOrExit } from '../parseYargsOrExit.js';

vi.unmock('yargs');

describe('parseYargsOrExit', () => {
  it('handles yargs validation rejections from async middleware', async () => {
    const { default: yargs } = await import('yargs');
    const handleFailure = vi.fn((_message: string | null, error: unknown) => {
      throw error;
    });

    const parser = yargs(['watch', '--notify'])
      .exitProcess(false)
      .middleware([async () => undefined])
      .command({
        command: 'watch',
        builder: async yargs =>
          yargs.option('notify', {
            requiresArg: true,
            type: 'string',
          }),
        handler: vi.fn(),
      })
      .strict();

    await expect(parseYargsOrExit(parser, handleFailure)).rejects.toThrow(
      'Not enough arguments following: notify'
    );
    expect(handleFailure).toHaveBeenCalledWith(
      'Not enough arguments following: notify',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('preserves the yargs message for synchronous parse failures', async () => {
    const { default: yargs } = await import('yargs');
    const handleFailure = vi.fn((message: string | null) => {
      throw new Error(message || 'Yargs failed');
    });

    const parser = yargs(['watch', '--notify'])
      .exitProcess(false)
      .command({
        command: 'watch',
        builder: yargs =>
          yargs.option('notify', {
            requiresArg: true,
            type: 'string',
          }),
        handler: vi.fn(),
      })
      .strict();

    await expect(parseYargsOrExit(parser, handleFailure)).rejects.toThrow(
      'Not enough arguments following: notify'
    );
    expect(handleFailure).toHaveBeenCalledWith(
      'Not enough arguments following: notify',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('preserves null yargs messages for help-only failures', async () => {
    const { default: yargs } = await import('yargs');
    const handleFailure = vi.fn(() => {
      throw new Error('Yargs failed');
    });

    const parser = yargs([])
      .exitProcess(false)
      .command({
        command: 'watch',
        builder: yargs => yargs,
        handler: vi.fn(),
      })
      .demandCommand(1, '');

    await expect(parseYargsOrExit(parser, handleFailure)).rejects.toThrow(
      'Yargs failed'
    );
    expect(handleFailure).toHaveBeenCalledWith(
      null,
      undefined,
      expect.any(Object)
    );
  });
});
