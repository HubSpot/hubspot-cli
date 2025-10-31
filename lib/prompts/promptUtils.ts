import {
  confirm,
  Separator as _Separator,
  select,
  input,
  checkbox,
  password,
  number,
} from '@inquirer/prompts';
import {
  PromptConfig,
  GenericPromptResponse,
  PromptWhen,
  PromptChoices,
  PromptOperand,
} from '../../types/Prompts.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import chalk from 'chalk';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

export const Separator = new _Separator();
export const PROMPT_THEME = { prefix: { idle: chalk.green('?') } };
export const CHECKBOX_PROMPT_THEME = {
  prefix: { idle: chalk.green('?') },
  style: {
    disabledChoice: (text: string) => chalk.dim(` ◯ ${text}`),
  },
};

function isUserCancellationError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError';
}

function isNoSelectableChoicesError(error: unknown): boolean {
  return (
    error instanceof Error && error.message?.includes('No selectable choices')
  );
}

function handlePromptError<T extends GenericPromptResponse>(
  config: PromptConfig<T> | PromptConfig<T>[],
  error: unknown
): never {
  if (isUserCancellationError(error)) {
    process.exit(EXIT_CODES.SUCCESS);
  }
  if (isNoSelectableChoicesError(error)) {
    if (!Array.isArray(config)) {
      uiLogger.log(config.message as string);
    }
    uiLogger.error(lib.prompts.promptUtils.errors.noSelectableChoices);
    process.exit(EXIT_CODES.ERROR);
  }
  throw error;
}

type Choice<Value> = {
  value: Value;
  name?: string;
  description?: string;
  short?: string;
  disabled?: boolean | string;
};

function mapPromptChoicesToChoices<T extends GenericPromptResponse>(
  choices: PromptChoices<T> | undefined
): (Choice<T> | _Separator)[] {
  return (
    choices?.map(choice => {
      if (typeof choice === 'string') {
        return { value: choice, name: choice } as unknown as Choice<T>;
      } else if (choice instanceof _Separator) {
        return choice;
      }
      return {
        value: choice.value,
        name: choice.name,
        disabled: choice.disabled,
        checked: choice.checked,
      } as Choice<T>;
    }) || []
  );
}

async function handleArrayConfig<T extends GenericPromptResponse>(
  config: PromptConfig<T>[]
): Promise<T> {
  const result = {} as T;
  for (const prompt of config) {
    if (prompt.when !== undefined) {
      const shouldPrompt =
        typeof prompt.when === 'function'
          ? prompt.when()
          : (prompt.when ?? true);

      if (!shouldPrompt) {
        continue;
      }
    }

    if (typeof prompt.message === 'function') {
      prompt.message = prompt.message(result as T);
    }

    // Pass the accumulated results to each prompt
    const promptWithAnswers = {
      ...prompt,
      default:
        typeof prompt.default === 'function'
          ? (answers: T) => {
              const mergedAnswers = { ...answers, ...result } as T;
              return (prompt.default as (answers: T) => PromptOperand)(
                mergedAnswers
              );
            }
          : prompt.default,
    };
    const response = await promptUser(promptWithAnswers);
    Object.assign(result, response);
  }
  return result;
}

export async function promptUser<T extends GenericPromptResponse>(
  config: PromptConfig<T> | PromptConfig<T>[]
): Promise<T> {
  try {
    if (Array.isArray(config)) {
      return await handleArrayConfig(config);
    } else {
      if (config.when !== undefined) {
        const shouldPrompt =
          typeof config.when === 'function'
            ? config.when()
            : (config.when ?? true);
        if (!shouldPrompt) {
          return Promise.resolve({} as T);
        }
      }
    }

    switch (config.type) {
      case 'list':
        return await handleSelectPrompt(config);
      case 'input':
        return await handleInputPrompt(config);
      case 'confirm':
        return await handleConfirmPrompt(config);
      case 'checkbox':
        return await handleCheckboxPrompt(config);
      case 'password':
        return await handlePasswordPrompt(config);
      case 'number':
        return await handleNumberPrompt(config);
      case 'rawlist':
        return await handleRawListPrompt(config);
      default:
        return await handleInputPrompt(config);
    }
  } catch (error) {
    handlePromptError(config, error);
  }
}

function handleRawListPrompt<T extends GenericPromptResponse>(
  config: PromptConfig<T>
): Promise<T> {
  const choices = mapPromptChoicesToChoices(config.choices);
  choices.map((choice, index) => {
    if (!(choice instanceof _Separator)) {
      choice.name = `${index + 1}) ${choice.name}`;
    }
  });
  return select({
    message: config.message as string,
    choices: choices,
    pageSize: config.pageSize,
    default: config.default,
    loop: config.loop,
    theme: PROMPT_THEME,
  }).then(resp => ({ [config.name]: resp }) as T);
}

function handleNumberPrompt<T extends GenericPromptResponse>(
  config: PromptConfig<T>
): Promise<T> {
  return number({
    message: config.message as string,
    default: config.default as number | undefined,
    validate: config.validate as (
      value: number | undefined
    ) => boolean | string | Promise<boolean | string>,
    theme: PROMPT_THEME,
  }).then(resp => ({ [config.name]: resp }) as T);
}

function handlePasswordPrompt<T extends GenericPromptResponse>(
  config: PromptConfig<T>
): Promise<T> {
  return password({
    message: config.message as string,
    mask: '*',
    validate: config.validate as (
      input: string
    ) => boolean | string | Promise<boolean | string>,
    theme: PROMPT_THEME,
  }).then(resp => ({ [config.name]: resp }) as T);
}

function handleCheckboxPrompt<T extends GenericPromptResponse>(
  config: PromptConfig<T>
): Promise<T> {
  const choices = mapPromptChoicesToChoices(config.choices);
  return checkbox({
    message: config.message as string,
    choices: choices,
    pageSize: config.pageSize,
    validate: config.validate as (
      choices: readonly Choice<T>[]
    ) => boolean | string | Promise<boolean | string>,
    loop: config.loop,
    theme: CHECKBOX_PROMPT_THEME,
    shortcuts: {
      invert: null,
    },
  }).then(resp => ({ [config.name]: resp }) as T);
}

function handleConfirmPrompt<T extends GenericPromptResponse>(
  config: PromptConfig<T>
): Promise<T> {
  return confirm({
    message: config.message as string,
    default: config.default as boolean,
    theme: PROMPT_THEME,
  }).then(resp => ({ [config.name]: resp }) as T);
}

function handleInputPrompt<T extends GenericPromptResponse>(
  config: PromptConfig<T>
): Promise<T> {
  return input({
    message: config.message as string,
    default: config.default as string | undefined,
    validate: config.validate as (
      input: string
    ) => (boolean | string) | Promise<boolean | string>,
    transformer: config.transformer as (input: string) => string,
    theme: PROMPT_THEME,
  }).then(resp => ({ [config.name]: resp }) as T);
}

function handleSelectPrompt<T extends GenericPromptResponse>(
  config: PromptConfig<T>
): Promise<T> {
  const choices = mapPromptChoicesToChoices(config.choices);
  return select({
    message: config.message as string,
    choices: choices!,
    default: config.default,
    pageSize: config.pageSize,
    loop: config.loop,
    theme: PROMPT_THEME,
  }).then(resp => ({ [config.name]: resp }) as T);
}

export async function confirmPrompt(
  message: string,
  options: { defaultAnswer?: boolean } = {}
): Promise<boolean> {
  const { defaultAnswer = true } = options;
  const { confirm: result } = await promptUser({
    name: 'confirm',
    type: 'confirm',
    message,
    default: defaultAnswer,
  });
  return result;
}

type ListPromptResponse<T = string> = {
  choice: T;
};

export async function listPrompt<T = string>(
  message: string,
  {
    choices,
    when,
    defaultAnswer,
    validate,
    loop,
  }: {
    choices: PromptChoices<T>;
    when?: PromptWhen;
    defaultAnswer?: string | number | boolean;
    validate?: (input: T[]) => (boolean | string) | Promise<boolean | string>;
    loop?: boolean;
  }
): Promise<T> {
  const { choice } = await promptUser<ListPromptResponse<T>>({
    name: 'choice',
    type: 'list',
    message,
    choices,
    when,
    default: defaultAnswer,
    validate,
    loop,
  });
  return choice;
}

export async function inputPrompt(
  message: string,
  {
    when,
    validate,
    defaultAnswer,
  }: {
    when?: boolean | (() => boolean);
    validate?: (
      input: string
    ) => (boolean | string) | Promise<boolean | string>;
    defaultAnswer?: string;
  } = {}
): Promise<string> {
  const { input } = await promptUser({
    name: 'input',
    type: 'input',
    default: defaultAnswer,
    message,
    when,
    validate,
  });
  return input;
}
