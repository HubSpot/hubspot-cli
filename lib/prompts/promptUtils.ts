import inquirer from 'inquirer';

export async function confirmPrompt(
  message: string,
  {
    defaultAnswer = true,
    when,
  }: { defaultAnswer: boolean; when?: boolean | (() => boolean) }
): Promise<boolean> {
  const { choice } = await inquirer.prompt([
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
): Promise<boolean> {
  const { choice } = await inquirer.prompt([
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
