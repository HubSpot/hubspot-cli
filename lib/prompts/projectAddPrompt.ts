import { promptUser } from './promptUtils';
import { ProjectAddComponentData } from '../../types/Projects';
import { i18n } from '../lang';

const i18nKey = 'lib.prompts.projectAddPrompt';

type ProjectAddPromptResponse = {
  componentData: ProjectAddComponentData;
  name: string;
};

export async function projectAddPrompt(
  components: ProjectAddComponentData[],
  promptOptions: { name?: string; type?: string } = {}
): Promise<ProjectAddPromptResponse> {
  const providedTypeIsValid =
    promptOptions.type && components.find(t => t.path === promptOptions.type);

  const result = await promptUser<ProjectAddPromptResponse>([
    {
      name: 'componentData',
      message: () => {
        return promptOptions.type && !providedTypeIsValid
          ? i18n(`${i18nKey}.errors.invalidType`, {
              type: promptOptions.type,
            })
          : i18n(`${i18nKey}.selectType`);
      },
      when: !providedTypeIsValid,
      type: 'list',
      choices: components.map(type => {
        return {
          name: type.label,
          value: type,
        };
      }),
    },
    {
      name: 'name',
      message: i18n(`${i18nKey}.enterName`),
      when: !promptOptions.name,
      validate: (input?: string) => {
        if (!input) {
          return i18n(`${i18nKey}.errors.nameRequired`);
        }
        return true;
      },
    },
  ]);

  if (providedTypeIsValid) {
    result.componentData = components.find(t => t.path === promptOptions.type)!;
  }

  return result;
}
