import { Separator } from '@inquirer/prompts';
import { projectAddPromptV3 } from '../projectAddPrompt.js';
import { promptUser } from '../promptUtils.js';
import {
  ComponentTemplate,
  ComponentTemplateChoice,
} from '../../../types/Projects.js';

vi.mock('../promptUtils');

const mockedPromptUser = vi.mocked(promptUser);

describe('lib/prompts/projectAddPrompt', () => {
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

  describe('projectAddPromptV3()', () => {
    beforeEach(() => {
      // Mock returns empty result, logic will use selectedComponents when selectedFeatures provided
      mockedPromptUser.mockResolvedValue({});
    });

    it('should select component based on cliSelector when provided', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Workflow Action Tool',
        value: mockComponentTemplateWithCliSelector,
      };

      const components = [templateChoice];
      const selectedFeatures = ['workflow-action-tool'];

      const result = await projectAddPromptV3(components, selectedFeatures);

      expect(result.componentTemplate).toEqual([
        mockComponentTemplateWithCliSelector,
      ]);
      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'componentTemplate',
          when: false, // selectedFeatures provided, so skip prompt
        }),
      ]);
    });

    it('should select component based on type when cliSelector not provided', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const components = [templateChoice];
      const selectedFeatures = ['module'];

      const result = await projectAddPromptV3(components, selectedFeatures);

      expect(result.componentTemplate).toEqual([mockComponentTemplate]);
      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'componentTemplate',
          when: false, // selectedFeatures provided and selectedComponents found
        }),
      ]);
    });

    it('should prefer cliSelector over type when both are available', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Workflow Action Tool',
        value: mockComponentTemplateWithCliSelector,
      };

      const components = [templateChoice];
      const selectedFeatures = ['workflow-action-tool']; // matches cliSelector

      const result = await projectAddPromptV3(components, selectedFeatures);

      expect(result.componentTemplate).toEqual([
        mockComponentTemplateWithCliSelector,
      ]);
    });

    it('should not select component when neither cliSelector nor type matches', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const components = [templateChoice];
      const selectedFeatures = ['non-matching-feature'];

      mockedPromptUser.mockResolvedValue({ componentTemplate: [] });

      const result = await projectAddPromptV3(components, selectedFeatures);

      expect(result.componentTemplate).toEqual([]);
    });

    it('should throw error when selected feature component is disabled', async () => {
      const disabledTemplateChoice: ComponentTemplateChoice = {
        name: 'Disabled Component',
        value: mockComponentTemplateWithCliSelector,
        disabled: 'Component is disabled for testing',
      };

      const components = [disabledTemplateChoice];
      const selectedFeatures = ['workflow-action-tool'];

      await expect(
        projectAddPromptV3(components, selectedFeatures)
      ).rejects.toThrow(/Cannot.*feature.*workflow-action/);
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

      const components = [choice1, choice2];
      const selectedFeatures = ['module', 'workflow-action-tool'];

      const result = await projectAddPromptV3(components, selectedFeatures);

      expect(result.componentTemplate).toEqual([
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

      const components = [separator, templateChoice];
      const selectedFeatures = ['module'];

      const result = await projectAddPromptV3(components, selectedFeatures);

      expect(result.componentTemplate).toEqual([mockComponentTemplate]);
    });

    it('should prompt user when no selectedFeatures provided', async () => {
      const templateChoice: ComponentTemplateChoice = {
        name: 'Test Module',
        value: mockComponentTemplate,
      };

      const components = [templateChoice];
      const selectedFeatures = undefined;

      mockedPromptUser.mockResolvedValue({
        componentTemplate: [mockComponentTemplate],
      });

      const result = await projectAddPromptV3(components, selectedFeatures);

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'componentTemplate',
          type: 'checkbox',
          choices: components,
        }),
      ]);
      expect(result.componentTemplate).toEqual([mockComponentTemplate]);
    });
  });
});
