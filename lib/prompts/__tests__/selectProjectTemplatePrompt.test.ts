import { Separator } from '@inquirer/prompts';
import { selectProjectTemplatePrompt } from '../selectProjectTemplatePrompt.js';
import { promptUser } from '../promptUtils.js';
import {
  ComponentTemplate,
  ComponentTemplateChoice,
} from '../../../types/Projects.js';

vi.mock('../promptUtils');

const mockedPromptUser = vi.mocked(promptUser);

describe('lib/prompts/selectProjectTemplatePrompt', () => {
  const mockComponentTemplate: ComponentTemplate = {
    label: 'Test Module',
    path: 'test-module',
    type: 'module',
    supportedAuthTypes: ['oauth'],
    supportedDistributions: ['private'],
  };

  const mockComponentTemplateWithCliSelector: ComponentTemplate = {
    label: 'Workflow Action Tool',
    path: 'workflow-action-tool',
    type: 'workflow-action',
    cliSelector: 'workflow-action-tool',
    supportedAuthTypes: ['oauth'],
    supportedDistributions: ['private'],
  };

  beforeEach(() => {
    mockedPromptUser.mockResolvedValue({});
  });

  describe('selectProjectTemplatePrompt with component templates', () => {
    it('should select component based on cliSelector when provided', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Workflow Action Tool',
        value: mockComponentTemplateWithCliSelector,
      };

      const componentTemplates = [templateChoice];
      const promptOptions = {
        features: ['workflow-action-tool'],
      };

      const result = await selectProjectTemplatePrompt(
        promptOptions,
        undefined,
        componentTemplates
      );

      expect(result.componentTemplates).toEqual([
        mockComponentTemplateWithCliSelector,
      ]);
      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'projectTemplate' }),
        expect.objectContaining({ name: 'componentTemplates' }),
      ]);
    });

    it('should select component based on type when cliSelector not provided', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const componentTemplates = [templateChoice];
      const promptOptions = {
        features: ['module'],
      };

      const result = await selectProjectTemplatePrompt(
        promptOptions,
        undefined,
        componentTemplates
      );

      expect(result.componentTemplates).toEqual([mockComponentTemplate]);
    });

    it('should prefer cliSelector over type when both are available', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Workflow Action Tool',
        value: mockComponentTemplateWithCliSelector,
      };

      const componentTemplates = [templateChoice];
      const promptOptions = {
        features: ['workflow-action-tool'], // matches cliSelector, not type
      };

      const result = await selectProjectTemplatePrompt(
        promptOptions,
        undefined,
        componentTemplates
      );

      expect(result.componentTemplates).toEqual([
        mockComponentTemplateWithCliSelector,
      ]);
    });

    it('should not select component when neither cliSelector nor type matches', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const componentTemplates = [templateChoice];
      const promptOptions = {
        features: ['non-matching-feature'],
      };

      const result = await selectProjectTemplatePrompt(
        promptOptions,
        undefined,
        componentTemplates
      );

      expect(result.componentTemplates).toEqual([]);
    });

    it('should throw error when selected feature component is disabled', async () => {
      const disabledTemplateChoice: ComponentTemplateChoice = {
        name: 'Disabled Component',
        value: mockComponentTemplateWithCliSelector,
        disabled: 'Component is disabled for testing',
      };

      const componentTemplates = [disabledTemplateChoice];
      const promptOptions = {
        features: ['workflow-action-tool'],
      };

      await expect(
        selectProjectTemplatePrompt(
          promptOptions,
          undefined,
          componentTemplates
        )
      ).rejects.toThrow(/Cannot create project with template.*workflow-action/);
    });

    it('should handle multiple components with mixed cliSelector availability', async () => {
      const choice1: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const choice2: ComponentTemplateChoice = {
        name: 'Workflow Action Tool',
        value: mockComponentTemplateWithCliSelector,
      };

      const componentTemplates = [choice1, choice2];
      const promptOptions = {
        features: ['module', 'workflow-action-tool'],
      };

      const result = await selectProjectTemplatePrompt(
        promptOptions,
        undefined,
        componentTemplates
      );

      expect(result.componentTemplates).toEqual([
        mockComponentTemplate,
        mockComponentTemplateWithCliSelector,
      ]);
    });

    it('should skip Separator instances when processing components', async () => {
      const separator = new Separator();
      const templateChoice: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const componentTemplates = [separator, templateChoice];
      const promptOptions = {
        features: ['module'],
      };

      const result = await selectProjectTemplatePrompt(
        promptOptions,
        undefined,
        componentTemplates
      );

      expect(result.componentTemplates).toEqual([mockComponentTemplate]);
    });

    it('should prompt user when no features provided', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const componentTemplates = [templateChoice];
      const promptOptions = {};

      mockedPromptUser.mockResolvedValue({
        componentTemplates: [mockComponentTemplate],
      });

      const result = await selectProjectTemplatePrompt(
        promptOptions,
        undefined,
        componentTemplates
      );

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'projectTemplate' }),
        expect.objectContaining({
          name: 'componentTemplates',
          type: 'checkbox',
          choices: componentTemplates,
        }),
      ]);
      expect(result.componentTemplates).toEqual([mockComponentTemplate]);
    });

    it('should handle empty componentTemplates selection', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const componentTemplates = [templateChoice];
      const promptOptions = {
        features: ['non-matching-feature'],
      };

      const result = await selectProjectTemplatePrompt(
        promptOptions,
        undefined,
        componentTemplates
      );

      expect(result.componentTemplates).toEqual([]);
    });
  });
});
