import { ComponentTemplate } from '../../../../types/Projects.js';
import { calculateComponentTemplateChoices } from '../v2.js';
import { hasFeature } from '../../../hasFeature.js';

vi.mock('../../ui/logger.js');
vi.mock('@hubspot/local-dev-lib/api/github');
vi.mock('../../../hasFeature.js');

const mockHasFeature = vi.mocked(hasFeature);

describe('lib/projects/create/v2', () => {
  beforeEach(() => {
    mockHasFeature.mockResolvedValue(true);
  });

  describe('calculateComponentTemplateChoices()', () => {
    beforeEach(() => {
      mockHasFeature.mockClear();
    });

    const mockComponents: ComponentTemplate[] = [
      {
        label: 'Module Component',
        path: 'module',
        type: 'module',
        supportedAuthTypes: ['oauth'],
        supportedDistributions: ['private'],
      },
      {
        label: 'Card Component',
        path: 'card',
        type: 'card',
        supportedAuthTypes: ['oauth', 'static'],
        supportedDistributions: ['private', 'marketplace'],
      },
    ];

    const mockProjectMetadataForChoices = {
      hsMetaFiles: [],
      components: {
        module: { count: 0, maxCount: 5, hsMetaFiles: [] },
        card: { count: 3, maxCount: 3, hsMetaFiles: [] },
      },
    };

    it('returns enabled components when they meet all requirements', async () => {
      const choices = await calculateComponentTemplateChoices(
        mockComponents,
        'oauth',
        'private',
        123,
        mockProjectMetadataForChoices
      );

      expect(choices).toHaveLength(4); // includes separator
      expect(choices[0]).toEqual({
        name: 'Module Component [module]',
        value: mockComponents[0],
      });
      expect(choices[2]).toEqual({
        name: expect.stringContaining('Card Component'),
        value: mockComponents[1],
        disabled: expect.stringContaining('maximum'),
      });
    });

    it('disables components when auth type is not supported', async () => {
      const choices = await calculateComponentTemplateChoices(
        mockComponents,
        'privatekey',
        'private',
        123,
        mockProjectMetadataForChoices
      );

      // All components should be disabled, so they come after the separator
      expect(choices[1]).toEqual({
        name: expect.stringContaining('Module Component'),
        value: mockComponents[0],
        disabled: expect.stringContaining('privatekey'),
      });
    });

    it('disables components when distribution is not supported', async () => {
      const choices = await calculateComponentTemplateChoices(
        mockComponents,
        'oauth',
        'enterprise',
        123,
        mockProjectMetadataForChoices
      );

      // All components should be disabled, so they come after the separator
      expect(choices[1]).toEqual({
        name: expect.stringContaining('Module Component'),
        value: mockComponents[0],
        disabled: expect.stringContaining('enterprise'),
      });
    });

    it('handles components without auth type or distribution restrictions', async () => {
      const componentsWithoutRestrictions: ComponentTemplate[] = [
        {
          label: 'Unrestricted Component',
          path: 'unrestricted',
          type: 'module',
        },
      ];

      const choices = await calculateComponentTemplateChoices(
        componentsWithoutRestrictions,
        'oauth',
        'private',
        123,
        {
          hsMetaFiles: [],
          components: { module: { count: 0, maxCount: 5, hsMetaFiles: [] } },
        }
      );

      expect(choices[0]).toEqual({
        name: 'Unrestricted Component [module]',
        value: componentsWithoutRestrictions[0],
      });
    });

    it('handles components with cliSelector field (metadata compatibility)', async () => {
      const componentWithCliSelector: ComponentTemplate[] = [
        {
          label: 'Workflow Action Tool',
          path: 'workflow-action-tool',
          type: 'workflow-action',
          cliSelector: 'workflow-action-tool',
          supportedAuthTypes: ['oauth'],
          supportedDistributions: ['private'],
        },
      ];

      const projectMetadataWithWorkflowAction = {
        hsMetaFiles: [],
        components: {
          'workflow-action': { count: 2, maxCount: 3, hsMetaFiles: [] },
        },
      };

      const choices = await calculateComponentTemplateChoices(
        componentWithCliSelector,
        'oauth',
        'private',
        213,
        projectMetadataWithWorkflowAction
      );

      expect(choices).toHaveLength(1); // no disabled components
      expect(choices[0]).toEqual({
        name: 'Workflow Action Tool [workflow-action-tool]',
        value: componentWithCliSelector[0],
      });
    });

    it('disables component when project metadata count exceeds maximum', async () => {
      const componentWithCliSelector: ComponentTemplate[] = [
        {
          label: 'Workflow Action Tool',
          path: 'workflow-action-tool',
          type: 'workflow-action',
          cliSelector: 'workflow-action-tool',
          supportedAuthTypes: ['oauth'],
          supportedDistributions: ['private'],
        },
      ];

      const projectMetadataAtMaxWorkflowAction = {
        hsMetaFiles: [],
        components: {
          'workflow-action': { count: 3, maxCount: 3, hsMetaFiles: [] },
        },
      };

      const choices = await calculateComponentTemplateChoices(
        componentWithCliSelector,
        'oauth',
        'private',
        123,
        projectMetadataAtMaxWorkflowAction
      );

      expect(choices).toHaveLength(3); // includes separators
      expect(choices[1]).toEqual({
        name: expect.stringContaining('Workflow Action Tool'),
        value: componentWithCliSelector[0],
        disabled: expect.stringContaining('maximum'),
      });
    });

    it('handles undefined projectMetadata without throwing errors', async () => {
      const componentWithCliSelector: ComponentTemplate[] = [
        {
          label: 'Workflow Action Tool',
          path: 'workflow-action-tool',
          type: 'workflow-action',
          cliSelector: 'workflow-action-tool',
          supportedAuthTypes: ['oauth'],
          supportedDistributions: ['private'],
        },
      ];

      const choices = await calculateComponentTemplateChoices(
        componentWithCliSelector,
        'oauth',
        'private',
        123,
        undefined
      );

      expect(choices).toHaveLength(1); // no disabled components
      expect(choices[0]).toEqual({
        name: 'Workflow Action Tool [workflow-action-tool]',
        value: componentWithCliSelector[0],
      });
    });

    it('handles projectMetadata with undefined components property (after fix)', async () => {
      const componentWithCliSelector: ComponentTemplate[] = [
        {
          label: 'Workflow Action Tool',
          path: 'workflow-action-tool',
          type: 'workflow-action',
          cliSelector: 'workflow-action-tool',
          supportedAuthTypes: ['oauth'],
          supportedDistributions: ['private'],
        },
      ];

      const projectMetadataWithoutComponents = {
        hsMetaFiles: [],
        components: undefined,
      };

      // This test verifies the null check fix works
      // Currently this will fail because the fix checks for projectMetadata.components
      await expect(async () =>
        calculateComponentTemplateChoices(
          componentWithCliSelector,
          'oauth',
          'private',
          123,
          // @ts-expect-error breaking stuff on purpose
          projectMetadataWithoutComponents
        )
      ).rejects.toThrow();
    });

    it('disables gated components when hasFeature returns false', async () => {
      mockHasFeature.mockResolvedValue(false);

      const gatedComponent: ComponentTemplate[] = [
        {
          label: 'Workflow Action Tool',
          path: 'workflow-action-tool',
          type: 'workflow-action',
          cliSelector: 'workflow-action-tool',
          supportedAuthTypes: ['oauth'],
          supportedDistributions: ['private'],
        },
      ];

      const choices = await calculateComponentTemplateChoices(
        gatedComponent,
        'oauth',
        'private',
        123,
        mockProjectMetadataForChoices
      );

      expect(choices).toHaveLength(3); // includes separators
      expect(choices[1]).toEqual({
        name: expect.stringContaining('Workflow Action Tool'),
        value: gatedComponent[0],
        disabled: expect.stringContaining(
          'does not have access to this feature'
        ),
      });
      expect(mockHasFeature).toHaveBeenCalledWith(123, expect.any(String));
    });

    it('enables gated components when hasFeature returns true', async () => {
      mockHasFeature.mockResolvedValue(true);

      const gatedComponent: ComponentTemplate[] = [
        {
          label: 'Workflow Action Tool',
          path: 'workflow-action-tool',
          type: 'workflow-action',
          cliSelector: 'workflow-action-tool',
          supportedAuthTypes: ['oauth'],
          supportedDistributions: ['private'],
        },
      ];

      const projectMetadataWithWorkflowAction = {
        hsMetaFiles: [],
        components: {
          'workflow-action': { count: 0, maxCount: 3, hsMetaFiles: [] },
        },
      };

      const choices = await calculateComponentTemplateChoices(
        gatedComponent,
        'oauth',
        'private',
        123,
        projectMetadataWithWorkflowAction
      );

      expect(choices).toHaveLength(1); // no disabled components
      expect(choices[0]).toEqual({
        name: 'Workflow Action Tool [workflow-action-tool]',
        value: gatedComponent[0],
      });
      expect(mockHasFeature).toHaveBeenCalledWith(123, expect.any(String));
    });

    it('handles non-gated components without calling hasFeature', async () => {
      const nonGatedComponent: ComponentTemplate[] = [
        {
          label: 'Regular Component',
          path: 'regular',
          type: 'module',
          supportedAuthTypes: ['oauth'],
          supportedDistributions: ['private'],
        },
      ];

      const choices = await calculateComponentTemplateChoices(
        nonGatedComponent,
        'oauth',
        'private',
        123,
        mockProjectMetadataForChoices
      );

      expect(choices).toHaveLength(1);
      expect(choices[0]).toEqual({
        name: 'Regular Component [module]',
        value: nonGatedComponent[0],
      });
      // hasFeature should not be called for non-gated components
      expect(mockHasFeature).not.toHaveBeenCalled();
    });
  });
});
