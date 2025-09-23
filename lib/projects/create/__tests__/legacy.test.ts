import { logger } from '@hubspot/local-dev-lib/logger';
import * as github from '@hubspot/local-dev-lib/api/github';
import { EXIT_CODES } from '../../../enums/exitCodes.js';
import {
  getProjectComponentListFromRepo,
  getProjectTemplateListFromRepo,
} from '../legacy.js';
import { ProjectTemplateRepoConfig } from '../../../../types/Projects.js';
import {
  PROJECT_COMPONENT_TYPES,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} from '../../../constants.js';
import { AxiosResponse } from 'axios';
import { Mock } from 'vitest';

vi.mock('@hubspot/local-dev-lib/logger');
vi.mock('@hubspot/local-dev-lib/api/github');

const mockedFetchRepoFile = vi.mocked(github.fetchRepoFile);

const repoConfig: ProjectTemplateRepoConfig = {
  [PROJECT_COMPONENT_TYPES.COMPONENTS]: [
    {
      label: 'Component 1',
      path: 'component1',
      type: 'Component',
    },
  ],
  [PROJECT_COMPONENT_TYPES.PROJECTS]: [
    {
      name: 'project1',
      label: 'Project 1',
      path: 'project1',
    },
  ],
};

describe('lib/projects/create/legacy', () => {
  describe('getProjectComponentListFromRepo()', () => {
    it('returns a list of components', async () => {
      // @ts-expect-error - Mocking AxiosResponse
      mockedFetchRepoFile.mockResolvedValue({
        data: repoConfig,
      } as unknown as AxiosResponse);
      const components = await getProjectComponentListFromRepo('gh-ref');

      expect(components).toEqual(
        repoConfig[PROJECT_COMPONENT_TYPES.COMPONENTS]
      );
    });

    it('returns an empty list if no components are found', async () => {
      mockedFetchRepoFile.mockRejectedValue(new Error('Not found'));
      const components = await getProjectComponentListFromRepo('gh-ref');

      expect(components).toEqual([]);
    });
  });

  describe('getProjectTemplateListFromRepo()', () => {
    let exitMock: Mock<typeof process.exit>;

    beforeEach(() => {
      // @ts-expect-error - Mocking process.exit
      exitMock = vi
        .spyOn(process, 'exit')
        .mockImplementation((): never => undefined as never);
    });

    afterEach(() => {
      exitMock.mockRestore();
    });

    it('returns a list of project templates', async () => {
      // @ts-expect-error - Mocking AxiosResponse
      mockedFetchRepoFile.mockResolvedValue({
        data: repoConfig,
      } as unknown as AxiosResponse);
      const templates = await getProjectTemplateListFromRepo(
        HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
        'gh-ref'
      );

      expect(templates).toEqual(repoConfig[PROJECT_COMPONENT_TYPES.PROJECTS]);
    });

    it('Logs an error and exits the process if the request for the template list fails', async () => {
      mockedFetchRepoFile.mockRejectedValue(new Error('Not found'));
      await getProjectTemplateListFromRepo(
        HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
        'gh-ref'
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Failed to fetch the config.json file from the target repository/
        )
      );
      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('Logs an error and exits the process if there are no projects listed in the repo config', async () => {
      // @ts-expect-error - Mocking AxiosResponse
      mockedFetchRepoFile.mockResolvedValue({} as unknown as AxiosResponse);
      await getProjectTemplateListFromRepo(
        HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
        'gh-ref'
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Unable to find any projects in the target repository's config.json file/
        )
      );
      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('Logs an error and exits the process if any of the projects in the repo config are missing required properties', async () => {
      // @ts-expect-error - Mocking AxiosResponse
      mockedFetchRepoFile.mockResolvedValue({
        data: {
          ...repoConfig,
          [PROJECT_COMPONENT_TYPES.PROJECTS]: [
            {
              name: 'project1',
              label: 'Project 1',
            },
          ],
        },
      } as unknown as AxiosResponse);
      await getProjectTemplateListFromRepo(
        HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
        'gh-ref'
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Found misconfigured projects in the target repository's config.json file/
        )
      );
      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
