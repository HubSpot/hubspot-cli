import { promptUser } from './promptUtils';
import { ComponentTemplate } from '../../types/Projects';
import { i18n } from '../lang';

type ProjectAddPromptResponse = {
  componentTemplate: ComponentTemplate;
  name: string;
};

function findComponentByPathOrLabel(
  components: ComponentTemplate[],
  componentPathOrLabel: string
): ComponentTemplate | undefined {
  return components.find(
    c => c.path === componentPathOrLabel || c.label === componentPathOrLabel
  );
}

export async function projectAddPrompt(
  components: ComponentTemplate[],
  promptOptions: { name?: string; type?: string } = {}
): Promise<ProjectAddPromptResponse> {
  const providedTypeIsValid =
    !!promptOptions.type &&
    !!findComponentByPathOrLabel(components, promptOptions.type);

  const result = await promptUser<ProjectAddPromptResponse>([
    {
      name: 'componentTemplate',
      message: () => {
        return promptOptions.type && !providedTypeIsValid
          ? i18n('lib.prompts.projectAddPrompt.errors.invalidType', {
              type: promptOptions.type,
            })
          : i18n('lib.prompts.projectAddPrompt.selectType');
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
      message: i18n('lib.prompts.projectAddPrompt.enterName'),
      when: !promptOptions.name,
      validate: (input?: string) => {
        if (!input) {
          return i18n('lib.prompts.projectAddPrompt.errors.nameRequired');
        }
        return true;
      },
    },
  ]);

  if (!result.name) {
    result.name = promptOptions.name!;
  }

  if (providedTypeIsValid) {
    result.componentTemplate = findComponentByPathOrLabel(
      components,
      promptOptions.type!
    )!;
  }

  return result;
}
