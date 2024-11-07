// @ts-nocheck
import inquirer from 'inquirer';
const { projectLogsPrompt } = require('../projectsLogsPrompt');

jest.mock('inquirer');
const chalk = require('chalk');

describe('prompts/projectsLogsPrompt', () => {
  it('should return undefined functionName when functionChoices is nullable', async () => {
    const actual = await projectLogsPrompt({ functionChoices: null });
    expect(actual).toEqual({});
    expect(inquirer.prompt).not.toHaveBeenCalled();
  });

  it('should return the functionName without prompting when there is only one functionChoice', async () => {
    const functionChoice = 'this-is-the-only-function';
    const { functionName } = await projectLogsPrompt({
      functionChoices: [functionChoice],
    });
    expect(functionName).toEqual(functionChoice);
    expect(inquirer.prompt).not.toHaveBeenCalled();
  });

  it('should prompt the user if there is more than one choice', async () => {
    const functionChoices = ['choice 1', 'choice 2'];
    const projectName = 'my cool project';
    await projectLogsPrompt({
      functionChoices,
      projectName,
    });

    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    expect(inquirer.prompt).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'functionName',
          type: 'list',
          message: `[--function] Select function in ${chalk.bold(
            projectName
          )} project`,
          when: expect.any(Function),
          choices: functionChoices,
        }),
      ])
    );
  });
});
