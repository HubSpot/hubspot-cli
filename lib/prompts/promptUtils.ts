const inquirer = require('inquirer');

// NOTE: we can eventually delete this and directly use inquirer.prompt when the files support imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any

import {
  PromptConfig,
  GenericPromptResponse,
  PromptWhen,
  PromptChoices,
} from '../../types/prompts';

const promptModule = inquirer.createPromptModule();

export function promptUser<T extends GenericPromptResponse>(
  config: PromptConfig<T> | PromptConfig<T>[]
): Promise<T> {
  return promptModule(config);
}

type ConfirmPromptResponse = {
  choice: boolean;
};

export async function confirmPrompt(
  message: string,
  options: { defaultAnswer?: boolean; when?: PromptWhen } = {}
): Promise<boolean> {
  const { defaultAnswer = true, when } = options;
  const { choice } = await promptUser<ConfirmPromptResponse>([
    {
      name: 'choice',
      type: 'confirm',
      message,
      default: defaultAnswer,
      when,
    },
  ]);
  return choice;
}

type ListPromptResponse = {
  choice: string;
};

export async function listPrompt(
  message: string,
  {
    choices,
    when,
  }: {
    choices: PromptChoices;
    when?: PromptWhen;
  }
): Promise<string> {
  const { choice } = await promptUser<ListPromptResponse>([
    {
      name: 'choice',
      type: 'list',
      message,
      choices,
      when,
    },
  ]);
  return choice;
}

export async function inputPrompt(
  message: string,
  {
    when,
  }: {
    when?: boolean | (() => boolean);
  } = {}
): Promise<string> {
  const { input } = await promptUser([
    {
      name: 'input',
      type: 'input',
      message,
      when,
    },
  ]);
  return input;
}
