import { Separator } from '@inquirer/prompts';
import { promptUser } from './promptUtils.js';
import {
  ComponentTemplate,
  ComponentTemplateChoice,
} from '../../types/Projects.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

type ProjectAddPromptResponse = {
  componentTemplate: ComponentTemplate;
  name: string;
};

type ProjectAddPromptResponseV3 = {
  componentTemplate: ComponentTemplate[];
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
          ? lib.prompts.projectAddPrompt.errors.invalidType(promptOptions.type)
          : lib.prompts.projectAddPrompt.selectType;
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
      message: lib.prompts.projectAddPrompt.enterName,
      when: !promptOptions.name,
      validate: (input?: string) => {
        if (!input) {
          return lib.prompts.projectAddPrompt.errors.nameRequired;
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

export async function projectAddPromptV3(
  components: (ComponentTemplateChoice | Separator)[],
  selectedFeatures: string[] | undefined
): Promise<ProjectAddPromptResponseV3> {
  const selectedComponents: ComponentTemplate[] = [];

  if (selectedFeatures) {
    components.forEach(template => {
      if (template instanceof Separator || !template.value) {
        return;
      }

      if (
        selectedFeatures?.includes(
          template.value.cliSelector || template.value.type
        )
      ) {
        if (template.disabled) {
          throw new Error(
            lib.prompts.projectAddPrompt.errors.cannotAddFeature(
              template.value.type,
              template.disabled
            )
          );
        }
        selectedComponents.push(template.value);
      }
    });
  }

  if (!components?.length) {
    uiLogger.error(lib.prompts.projectAddPrompt.errors.noSelectableChoices);
    uiLogger.log('');
    return { componentTemplate: [] };
  }

  const result = await promptUser<ProjectAddPromptResponseV3>([
    {
      name: 'componentTemplate',
      message: lib.prompts.projectAddPrompt.selectFeatures,
      when: !selectedFeatures && selectedComponents.length === 0,
      type: 'checkbox',
      choices: components,
      pageSize: components.length,
    },
  ]);

  if (!result.componentTemplate) {
    result.componentTemplate = selectedComponents;
  }

  return result;
}
