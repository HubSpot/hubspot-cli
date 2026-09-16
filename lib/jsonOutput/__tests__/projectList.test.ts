import { Project } from '@hubspot/local-dev-lib/types/Project';
import { mapProjectToListItem, ProjectListSchema } from '../projectList.js';

describe('lib/jsonOutput/projectList', () => {
  describe('mapProjectToListItem()', () => {
    it('should map a project with a latest build', () => {
      const project = {
        id: 1,
        name: 'my-project',
        isLocked: false,
        createdAt: 1700000000000,
        updatedAt: 1700000001000,
        deployedBuildId: 4,
        latestBuild: { buildId: 5, platformVersion: '2025.2' },
      } as unknown as Project;

      expect(mapProjectToListItem(project)).toEqual({
        name: 'my-project',
        id: 1,
        createdAt: 1700000000000,
        updatedAt: 1700000001000,
        platformVersion: '2025.2',
        latestBuildId: 5,
        deployedBuildId: 4,
        isLocked: false,
      });
    });

    it('should leave build fields undefined when there is no latest build', () => {
      const project = {
        id: 2,
        name: 'empty-project',
        isLocked: true,
        createdAt: 1700000002000,
        updatedAt: 1700000003000,
      } as unknown as Project;

      expect(mapProjectToListItem(project)).toEqual({
        name: 'empty-project',
        id: 2,
        createdAt: 1700000002000,
        updatedAt: 1700000003000,
        platformVersion: undefined,
        latestBuildId: undefined,
        deployedBuildId: undefined,
        isLocked: true,
      });
    });

    it('should not include extra fields from the project object', () => {
      const project = {
        id: 3,
        name: 'p',
        isLocked: false,
        portalId: 99,
        createdAt: 1,
        updatedAt: 2,
      } as unknown as Project;

      const result = mapProjectToListItem(project);

      expect(result).not.toHaveProperty('portalId');
      expect(Object.keys(result)).toEqual([
        'name',
        'id',
        'createdAt',
        'updatedAt',
        'platformVersion',
        'latestBuildId',
        'deployedBuildId',
        'isLocked',
      ]);
    });

    it('should produce output that satisfies ProjectListSchema', () => {
      const project = {
        id: 1,
        name: 'my-project',
        isLocked: false,
        createdAt: 1700000000000,
        updatedAt: 1700000001000,
        latestBuild: { buildId: 5, platformVersion: '2025.2' },
      } as unknown as Project;

      const results = [mapProjectToListItem(project)];

      expect(
        ProjectListSchema.safeParse({ accountId: 100, results }).success
      ).toBe(true);
    });
  });

  describe('ProjectListSchema', () => {
    it('should accept an empty results list', () => {
      expect(
        ProjectListSchema.safeParse({ accountId: 100, results: [] }).success
      ).toBe(true);
    });

    it('should reject a list item without a name', () => {
      expect(
        ProjectListSchema.safeParse({
          accountId: 100,
          results: [{ id: 1, isLocked: false, createdAt: 1, updatedAt: 2 }],
        }).success
      ).toBe(false);
    });
  });
});
