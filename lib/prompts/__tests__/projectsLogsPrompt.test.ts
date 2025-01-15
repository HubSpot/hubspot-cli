import { projectLogsPrompt } from '../projectsLogsPrompt';
import { promptUser } from '../promptUtils';
import chalk from 'chalk';

jest.mock('../promptUtils');

describe('lib/prompts/projectsLogsPrompt', () => {
  it('should return undefined functionName when functionChoices is undefined', async () => {
    const actual = await projectLogsPrompt({ functionChoices: undefined });
    expect(actual).toEqual({});
    expect(promptUser).not.toHaveBeenCalled();
  });

  it('should return the functionName without prompting when there is only one functionChoice', async () => {
    const functionChoice = 'this-is-the-only-function';
    const { functionName } = await projectLogsPrompt({
      functionChoices: [functionChoice],
    });
    expect(functionName).toEqual(functionChoice);
    expect(promptUser).not.toHaveBeenCalled();
  });

  it('should prompt the user if there is more than one choice', async () => {
    const functionChoices = ['choice 1', 'choice 2'];
    const projectName = 'my cool project';
    await projectLogsPrompt({
      functionChoices,
      projectName,
    });

    expect(promptUser).toHaveBeenCalledTimes(1);
    expect(promptUser).toHaveBeenLastCalledWith(
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
