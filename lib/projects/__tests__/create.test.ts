import { logger } from '@hubspot/local-dev-lib/logger';
import * as github from '@hubspot/local-dev-lib/api/github';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import { EXIT_CODES } from '../../enums/exitCodes';
import {
  getProjectComponentListFromRepo,
  getProjectTemplateListFromRepo,
} from '../../projects/create';
import { ProjectTemplateRepoConfig } from '../../../types/Projects';
import {
  PROJECT_COMPONENT_TYPES,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} from '../../constants';

jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/api/github');

const mockedFetchRepoFile = jest.mocked(github.fetchRepoFile);

const repoConfig: ProjectTemplateRepoConfig = {
  [PROJECT_COMPONENT_TYPES.COMPONENTS]: [
    {
      label: 'Component 1',
      path: 'component1',
      insertPath: 'component1',
    },
  ],
  [PROJECT_COMPONENT_TYPES.PROJECTS]: [
    {
      name: 'project1',
      label: 'Project 1',
      path: 'project1',
      insertPath: 'project1',
    },
  ],
};

describe('lib/projects/create', () => {
  describe('getProjectComponentListFromRepo()', () => {
    it('returns a list of components', async () => {
      mockedFetchRepoFile.mockResolvedValue({
        data: repoConfig,
      } as unknown as HubSpotPromise);
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
    let exitMock: jest.SpyInstance;

    beforeEach(() => {
      exitMock = jest
        .spyOn(process, 'exit')
        .mockImplementation((): never => undefined as never);
    });

    afterEach(() => {
      exitMock.mockRestore();
    });

    it('returns a list of project templates', async () => {
      mockedFetchRepoFile.mockResolvedValue({
        data: repoConfig,
      } as unknown as HubSpotPromise);
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
      mockedFetchRepoFile.mockResolvedValue({} as unknown as HubSpotPromise);
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
      } as unknown as HubSpotPromise);
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
