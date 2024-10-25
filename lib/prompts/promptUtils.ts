const inquirer = require('inquirer');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const promptUser = async (promptConfig: any) => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

export const confirmPrompt = async (
  message: string,
  {
    defaultAnswer = true,
    when,
  }: { defaultAnswer: boolean; when?: boolean | (() => boolean) }
): Promise<boolean> => {
  const { choice } = await promptUser([
    {
      name: 'choice',
      type: 'confirm',
      message,
      default: defaultAnswer,
      when,
    },
  ]);
  return choice;
};

export const listPrompt = async (
  message: string,
  {
    choices,
    when,
  }: { choices: { [key: string]: string }[]; when?: boolean | (() => boolean) }
): Promise<boolean> => {
  const { choice } = await promptUser([
    {
      name: 'choice',
      type: 'list',
      message,
      choices,
      when,
    },
  ]);
  return choice;
};
