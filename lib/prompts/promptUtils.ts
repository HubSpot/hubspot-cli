const inquirer = require('inquirer');

// NOTE: we can eventually delete this and use inquirer.prompt when we bump up to v12 of inquirer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const promptUser = async (promptConfig: any) => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

export async function confirmPrompt(
  message: string,
  {
    defaultAnswer = true,
    when,
  }: { defaultAnswer: boolean; when?: boolean | (() => boolean) }
): Promise<boolean> {
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
}

export async function listPrompt(
  message: string,
  {
    choices,
    when,
  }: {
    choices: Array<{ name: string; value: string }>;
    when?: boolean | (() => boolean);
  }
): Promise<string> {
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
}
