import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { ProjectAddComponentData } from '../../types/projects';

const i18nKey = 'lib.prompts.projectAddPrompt';

type ProjectAddPromptResponse = {
  component: ProjectAddComponentData;
  name: string;
};

export async function projectAddPrompt(
  components: ProjectAddComponentData[],
  promptOptions: { name?: string; type?: string } = {}
): Promise<ProjectAddPromptResponse> {
  return promptUser<ProjectAddPromptResponse>([
    {
      name: 'component',
      message: () => {
        return promptOptions.type &&
          !components.find(t => t.path === promptOptions.type)
          ? i18n(`${i18nKey}.errors.invalidType`, {
              type: promptOptions.type,
            })
          : i18n(`${i18nKey}.selectType`);
      },
      when:
        !promptOptions.type ||
        !components.find(t => t.path === promptOptions.type),
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
}
