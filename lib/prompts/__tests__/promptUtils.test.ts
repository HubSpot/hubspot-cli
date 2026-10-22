import {
  confirm,
  select,
  input,
  checkbox,
  password,
  number,
} from '@inquirer/prompts';
import {
  promptUser,
  confirmPrompt,
  listPrompt,
  inputPrompt,
  Separator,
  PROMPT_THEME,
} from '../promptUtils.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';

vi.mock('@inquirer/prompts', async importOriginal => {
  const actual = await importOriginal<typeof import('@inquirer/prompts')>();
  return {
    ...actual,
    confirm: vi.fn(),
    select: vi.fn(),
    input: vi.fn(),
    checkbox: vi.fn(),
    password: vi.fn(),
    number: vi.fn(),
  };
});

const mockedConfirm = vi.mocked(confirm);
const mockedSelect = vi.mocked(select);
const mockedInput = vi.mocked(input);
const mockedCheckbox = vi.mocked(checkbox);
const mockedPassword = vi.mocked(password);
const mockedNumber = vi.mocked(number);

describe('lib/prompts/promptUtils', () => {
  beforeEach(() => {
    mockedConfirm.mockResolvedValue(true);
    mockedSelect.mockResolvedValue('selected');
    mockedInput.mockResolvedValue('typed');
    mockedCheckbox.mockResolvedValue(['a', 'b']);
    mockedPassword.mockResolvedValue('secret');
    mockedNumber.mockResolvedValue(42);
  });

  describe('promptUser()', () => {
    describe('prompt types', () => {
      it('should use the select prompt for type list', async () => {
        const result = await promptUser({
          name: 'choice',
          type: 'list',
          message: 'Pick one',
          choices: ['a', 'b'],
          default: 'a',
          pageSize: 5,
          loop: false,
        });

        expect(result).toEqual({ choice: 'selected' });
        expect(mockedSelect).toHaveBeenCalledWith({
          message: 'Pick one',
          choices: [
            { value: 'a', name: 'a' },
            { value: 'b', name: 'b' },
          ],
          default: 'a',
          pageSize: 5,
          loop: false,
          theme: PROMPT_THEME,
        });
      });

      it('should use the input prompt for type input', async () => {
        const validate = vi.fn();
        const transformer = vi.fn();

        const result = await promptUser({
          name: 'text',
          type: 'input',
          message: 'Type something',
          default: 'default',
          validate,
          transformer,
        });

        expect(result).toEqual({ text: 'typed' });
        expect(mockedInput).toHaveBeenCalledWith({
          message: 'Type something',
          default: 'default',
          validate,
          transformer,
          theme: PROMPT_THEME,
        });
      });

      it('should use the input prompt when no type is provided', async () => {
        const result = await promptUser({
          name: 'text',
          message: 'Type something',
        });

        expect(result).toEqual({ text: 'typed' });
        expect(mockedInput).toHaveBeenCalled();
        expect(mockedSelect).not.toHaveBeenCalled();
      });

      it('should use the confirm prompt for type confirm', async () => {
        const result = await promptUser({
          name: 'ok',
          type: 'confirm',
          message: 'Sure?',
          default: false,
        });

        expect(result).toEqual({ ok: true });
        expect(mockedConfirm).toHaveBeenCalledWith({
          message: 'Sure?',
          default: false,
          theme: PROMPT_THEME,
        });
      });

      it('should use the checkbox prompt for type checkbox', async () => {
        const result = await promptUser({
          name: 'items',
          type: 'checkbox',
          message: 'Select items',
          choices: [{ name: 'A', value: 'a', checked: true }],
        });

        expect(result).toEqual({ items: ['a', 'b'] });
        expect(mockedCheckbox).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Select items',
            choices: [
              {
                value: 'a',
                name: 'A',
                short: undefined,
                disabled: undefined,
                checked: true,
              },
            ],
            shortcuts: { invert: null },
          })
        );
      });

      it('should use the password prompt with a mask for type password', async () => {
        const result = await promptUser({
          name: 'secret',
          type: 'password',
          message: 'Enter secret',
        });

        expect(result).toEqual({ secret: 'secret' });
        expect(mockedPassword).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Enter secret', mask: '*' })
        );
      });

      it('should use the number prompt for type number', async () => {
        const result = await promptUser({
          name: 'count',
          type: 'number',
          message: 'How many?',
          default: 1,
        });

        expect(result).toEqual({ count: 42 });
        expect(mockedNumber).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'How many?', default: 1 })
        );
      });

      it('should number the choices when using type rawlist', async () => {
        const result = await promptUser({
          name: 'choice',
          type: 'rawlist',
          message: 'Pick one',
          choices: ['first', 'second'],
        });

        expect(result).toEqual({ choice: 'selected' });
        expect(mockedSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            choices: [
              { value: 'first', name: '1) first' },
              { value: 'second', name: '2) second' },
            ],
          })
        );
      });

      it('should not number separators when using type rawlist', async () => {
        await promptUser({
          name: 'choice',
          type: 'rawlist',
          message: 'Pick one',
          choices: ['first', Separator, 'second'],
        });

        expect(mockedSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            choices: [
              { value: 'first', name: '1) first' },
              Separator,
              { value: 'second', name: '3) second' },
            ],
          })
        );
      });
    });

    describe('choices mapping', () => {
      it('should map object choices to inquirer choices', async () => {
        await promptUser({
          name: 'choice',
          type: 'list',
          message: 'Pick one',
          choices: [
            {
              name: 'Option',
              value: 1,
              short: 'opt',
              disabled: 'not available',
            },
          ],
        });

        expect(mockedSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            choices: [
              {
                value: 1,
                name: 'Option',
                short: 'opt',
                disabled: 'not available',
                checked: undefined,
              },
            ],
          })
        );
      });

      it('should pass separators through unchanged', async () => {
        await promptUser({
          name: 'choice',
          type: 'list',
          message: 'Pick one',
          choices: [Separator, 'a'],
        });

        expect(mockedSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            choices: [Separator, { value: 'a', name: 'a' }],
          })
        );
      });

      it('should pass an empty choices array when no choices are provided', async () => {
        await promptUser({ name: 'choice', type: 'list', message: 'Pick' });

        expect(mockedSelect).toHaveBeenCalledWith(
          expect.objectContaining({ choices: [] })
        );
      });
    });

    describe('when', () => {
      it('should skip a single prompt when `when` is false', async () => {
        const result = await promptUser({
          name: 'text',
          message: 'Type',
          when: false,
        });

        expect(result).toEqual({});
        expect(mockedInput).not.toHaveBeenCalled();
      });

      it('should skip a single prompt when `when` is a function returning false', async () => {
        const result = await promptUser({
          name: 'text',
          message: 'Type',
          when: () => false,
        });

        expect(result).toEqual({});
        expect(mockedInput).not.toHaveBeenCalled();
      });

      it('should show a single prompt when `when` is true', async () => {
        const result = await promptUser({
          name: 'text',
          message: 'Type',
          when: true,
        });

        expect(result).toEqual({ text: 'typed' });
        expect(mockedInput).toHaveBeenCalledTimes(1);
      });

      it('should show a single prompt when `when` is a function returning true', async () => {
        const result = await promptUser({
          name: 'text',
          message: 'Type',
          when: () => true,
        });

        expect(result).toEqual({ text: 'typed' });
        expect(mockedInput).toHaveBeenCalledTimes(1);
      });
    });

    describe('array config', () => {
      it('should merge the responses of every prompt', async () => {
        mockedInput.mockResolvedValueOnce('first').mockResolvedValueOnce('two');

        const result = await promptUser([
          { name: 'one', message: 'One' },
          { name: 'two', message: 'Two' },
        ]);

        expect(result).toEqual({ one: 'first', two: 'two' });
        expect(mockedInput).toHaveBeenCalledTimes(2);
      });

      it('should skip prompts when `when` is false', async () => {
        const result = await promptUser([
          { name: 'one', message: 'One', when: false },
          { name: 'two', message: 'Two' },
        ]);

        expect(result).toEqual({ two: 'typed' });
        expect(mockedInput).toHaveBeenCalledTimes(1);
      });

      it('should skip prompts when `when` is a function returning false', async () => {
        const result = await promptUser([
          { name: 'one', message: 'One', when: () => false },
          { name: 'two', message: 'Two' },
        ]);

        expect(result).toEqual({ two: 'typed' });
        expect(mockedInput).toHaveBeenCalledTimes(1);
      });

      it('should resolve function messages using previous answers', async () => {
        mockedInput.mockResolvedValueOnce('Joe');

        await promptUser<{ name: string; greeting: string }>([
          { name: 'name', message: 'Name' },
          {
            name: 'greeting',
            message: answers => `Hello ${answers.name}`,
          },
        ]);

        expect(mockedInput).toHaveBeenLastCalledWith(
          expect.objectContaining({ message: 'Hello Joe' })
        );
      });

      it('should merge previous answers into function defaults', async () => {
        mockedInput.mockResolvedValueOnce('Joe');
        const getDefault = vi.fn().mockReturnValue('Joe-default');

        await promptUser<{ name: string; dest: string }>([
          { name: 'name', message: 'Name' },
          { name: 'dest', message: 'Dest', default: getDefault },
        ]);

        const [, secondCall] = mockedInput.mock.calls;
        const defaultFn = secondCall[0].default as unknown as (
          answers: object
        ) => string;
        defaultFn({ other: 'value' });

        expect(getDefault).toHaveBeenCalledWith(
          expect.objectContaining({ other: 'value', name: 'Joe' })
        );
      });

      it('should pass static defaults through unchanged', async () => {
        await promptUser([{ name: 'one', message: 'One', default: 'static' }]);

        expect(mockedInput).toHaveBeenCalledWith(
          expect.objectContaining({ default: 'static' })
        );
      });
    });

    describe('error handling', () => {
      it('should throw a PromptExitError with a success code when the user cancels', async () => {
        const cancelError = new Error('cancelled');
        cancelError.name = 'ExitPromptError';
        mockedInput.mockRejectedValue(cancelError);

        const promise = promptUser({ name: 'text', message: 'Type' });

        await expect(promise).rejects.toThrow(PromptExitError);
        await expect(promise).rejects.toMatchObject({
          message: lib.prompts.promptUtils.errors.userCancelled,
          exitCode: EXIT_CODES.SUCCESS,
        });
      });

      it('should throw a PromptExitError with an error code when there are no selectable choices', async () => {
        mockedSelect.mockRejectedValue(new Error('No selectable choices.'));

        const promise = promptUser({
          name: 'choice',
          type: 'list',
          message: 'Pick',
        });

        await expect(promise).rejects.toThrow(PromptExitError);
        await expect(promise).rejects.toMatchObject({
          message: lib.prompts.promptUtils.errors.noSelectableChoices,
          exitCode: EXIT_CODES.ERROR,
        });
      });

      it('should log the prompt message when there are no selectable choices for a single prompt', async () => {
        mockedSelect.mockRejectedValue(new Error('No selectable choices.'));

        await expect(
          promptUser({ name: 'choice', type: 'list', message: 'Pick' })
        ).rejects.toThrow(PromptExitError);

        expect(uiLogger.log).toHaveBeenCalledWith('Pick');
        expect(uiLogger.error).toHaveBeenCalledWith(
          lib.prompts.promptUtils.errors.noSelectableChoices
        );
      });

      it('should log the prompt message when a prompt in an array config has no selectable choices', async () => {
        mockedSelect.mockRejectedValue(new Error('No selectable choices.'));

        await expect(
          promptUser([{ name: 'choice', type: 'list', message: 'Pick' }])
        ).rejects.toThrow(PromptExitError);

        expect(uiLogger.log).toHaveBeenCalledWith('Pick');
        expect(uiLogger.error).toHaveBeenCalledWith(
          lib.prompts.promptUtils.errors.noSelectableChoices
        );
      });

      it('should rethrow unknown errors', async () => {
        mockedInput.mockRejectedValue(new Error('boom'));

        await expect(
          promptUser({ name: 'text', message: 'Type' })
        ).rejects.toThrow('boom');
      });
    });
  });

  describe('confirmPrompt()', () => {
    it('should return the confirm response', async () => {
      mockedConfirm.mockResolvedValue(false);

      const result = await confirmPrompt('Continue?');

      expect(result).toBe(false);
    });

    it('should default to true when no default answer is provided', async () => {
      await confirmPrompt('Continue?');

      expect(mockedConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Continue?', default: true })
      );
    });

    it('should use the provided default answer', async () => {
      await confirmPrompt('Continue?', { defaultAnswer: false });

      expect(mockedConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ default: false })
      );
    });
  });

  describe('listPrompt()', () => {
    it('should return the selected choice', async () => {
      mockedSelect.mockResolvedValue('b');

      const result = await listPrompt('Pick one', { choices: ['a', 'b'] });

      expect(result).toBe('b');
    });

    it('should pass the options to the select prompt', async () => {
      await listPrompt('Pick one', {
        choices: ['a', 'b'],
        defaultAnswer: 'b',
        loop: false,
      });

      expect(mockedSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Pick one',
          default: 'b',
          loop: false,
        })
      );
    });

    it('should not prompt when `when` is false', async () => {
      await listPrompt('Pick one', { choices: ['a'], when: false });

      expect(mockedSelect).not.toHaveBeenCalled();
    });
  });

  describe('inputPrompt()', () => {
    it('should return the typed value', async () => {
      mockedInput.mockResolvedValue('hello');

      const result = await inputPrompt('Say something');

      expect(result).toBe('hello');
    });

    it('should pass the options to the input prompt', async () => {
      const validate = vi.fn();

      await inputPrompt('Say something', {
        defaultAnswer: 'hi',
        validate,
      });

      expect(mockedInput).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Say something',
          default: 'hi',
          validate,
        })
      );
    });

    it('should not prompt when `when` is false', async () => {
      await inputPrompt('Say something', { when: false });

      expect(mockedInput).not.toHaveBeenCalled();
    });
  });
});
