// @ts-expect-error I'm not entirely sure why this upsets VScode but it doesn't break builds
import inquirer, { Answers, QuestionCollection } from 'inquirer';

export async function promptUser<T extends Answers>(
  promptConfig: QuestionCollection<T>
): Promise<T> {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
}

export async function confirmPrompt(
  message: string,
  defaultAnswer = true
): Promise<boolean> {
  const { choice } = await promptUser<Record<string, boolean>>([
    {
      name: 'choice',
      type: 'confirm',
      default: defaultAnswer,
      message,
    },
  ]);
  return choice;
}
