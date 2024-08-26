const { projectLogsPrompt } = require('../projectsLogsPrompt');

jest.mock('../promptUtils');
const { promptUser } = require('../promptUtils');

describe('prompts/projectsLogsPrompt', () => {
  it('should return undefined functionName when functionChoices is nullable', async () => {
    const actual = await projectLogsPrompt({ functionChoices: null });
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
    await projectLogsPrompt({
      functionChoices,
    });

    expect(promptUser).toHaveBeenCalledTimes(1);
    expect(promptUser).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'functionName',
          type: 'list',
          message: '[--function] Enter the app function name:',
          when: expect.any(Function),
          choices: functionChoices,
        }),
      ])
    );
  });
});
