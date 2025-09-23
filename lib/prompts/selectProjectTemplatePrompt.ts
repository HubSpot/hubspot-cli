import { Separator } from '@inquirer/prompts';
import { promptUser } from './promptUtils.js';
import {
  ComponentTemplate,
  ComponentTemplateChoice,
  ProjectTemplate,
} from '../../types/Projects.js';
import { lib } from '../../lang/en.js';

function findTemplateByNameOrLabel(
  projectTemplates: ProjectTemplate[],
  templateNameOrLabel: string
): ProjectTemplate | undefined {
  return projectTemplates.find(
    t => t.name === templateNameOrLabel || t.label === templateNameOrLabel
  );
}

export type SelectProjectTemplatePromptResponse = {
  projectTemplate?: ProjectTemplate;
  componentTemplates?: ComponentTemplate[];
};

type SelectProjectTemplatePromptResponseProjectTemplate = {
  projectTemplate: ProjectTemplate;
  componentTemplates: undefined;
};

type SelectProjectTemplatePromptResponseComponentTemplates = {
  projectTemplate?: undefined;
  componentTemplates?: ComponentTemplate[];
};

export type ProjectNameAndDestPromptResponse = {
  name: string;
  dest: string;
};

export type PromptOptionsArg = {
  name?: string;
  dest?: string;
  template?: string;
  features?: string[];
};

// Includes `projectTemplate` in the return value if `projectTemplates` is provided
export async function selectProjectTemplatePrompt(
  promptOptions: PromptOptionsArg,
  projectTemplates?: ProjectTemplate[],
  componentTemplates?: undefined
): Promise<SelectProjectTemplatePromptResponseProjectTemplate>;
export async function selectProjectTemplatePrompt(
  promptOptions: PromptOptionsArg,
  projectTemplates?: undefined,
  componentTemplates?: (ComponentTemplateChoice | Separator)[]
): Promise<SelectProjectTemplatePromptResponseComponentTemplates>;
export async function selectProjectTemplatePrompt(
  promptOptions: PromptOptionsArg,
  projectTemplates?: ProjectTemplate[],
  componentTemplates?: (ComponentTemplateChoice | Separator)[]
) {
  const createProjectFromTemplate =
    !!projectTemplates && projectTemplates.length > 0;
  const createProjectFromComponents =
    Array.isArray(componentTemplates) && componentTemplates?.length > 0;

  const selectedComponents: ComponentTemplate[] = [];

  if (createProjectFromComponents && promptOptions.features) {
    componentTemplates.forEach(template => {
      if (template instanceof Separator || !template.value) {
        return;
      }

      if (
        promptOptions.features?.includes(
          template.value.cliSelector || template.value.type
        )
      ) {
        if (template.disabled) {
          throw new Error(
            `Cannot create project with template '${template.value.type}'. Reasons: ${template.disabled}`
          );
        }
        selectedComponents.push(template.value);
      }
    });
  }

  const providedTemplateIsValid =
    createProjectFromTemplate &&
    !!promptOptions.template &&
    !!findTemplateByNameOrLabel(projectTemplates, promptOptions.template);

  const result = await promptUser<SelectProjectTemplatePromptResponse>([
    {
      name: 'projectTemplate',
      message: () => {
        return promptOptions.template && !providedTemplateIsValid
          ? lib.prompts.selectProjectTemplatePrompt.errors.invalidTemplate(
              promptOptions.template
            )
          : lib.prompts.selectProjectTemplatePrompt.selectTemplate;
      },
      when: createProjectFromTemplate && !providedTemplateIsValid,
      type: 'list',
      choices: createProjectFromTemplate
        ? projectTemplates.map(template => {
            return {
              name: template.label,
              value: template,
            };
          })
        : undefined,
    },
    {
      name: 'componentTemplates',
      message: lib.prompts.selectProjectTemplatePrompt.features,
      when:
        !promptOptions.features &&
        createProjectFromComponents &&
        selectedComponents.length === 0,
      type: 'checkbox',
      choices: componentTemplates,
      loop: false,
      pageSize: componentTemplates?.length,
    },
  ]);

  if (!result.componentTemplates) {
    result.componentTemplates = selectedComponents;
  }

  if (providedTemplateIsValid) {
    result.projectTemplate = findTemplateByNameOrLabel(
      projectTemplates!,
      promptOptions.template!
    );
  }

  if (projectTemplates && projectTemplates.length > 0) {
    if (!result.projectTemplate) {
      throw new Error(
        lib.prompts.selectProjectTemplatePrompt.errors.projectTemplateRequired
      );
    }
    return result;
  }

  return result;
}
