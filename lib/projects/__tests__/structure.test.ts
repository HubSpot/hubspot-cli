import fs from 'fs';
import * as HSfs from '@hubspot/local-dev-lib/fs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getComponentTypeFromConfigFile,
  loadConfigFile,
  getAppCardConfigs,
  getIsLegacyApp,
  componentIsApp,
  findProjectComponents,
  getProjectComponentTypes,
  getComponentUid,
  componentIsPublicApp,
} from '../structure.js';
import { ComponentTypes, Component } from '../../../types/Projects.js';
import { Mock } from 'vitest';

vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/fs');
vi.mock('@hubspot/local-dev-lib/logger');

const mockedReadFileSync = fs.readFileSync as Mock;
const mockedWalk = HSfs.walk as Mock;

const getMockPrivateAppConfig = (cards: Array<{ file: string }> = []) => ({
  name: 'test-app',
  description: 'test-description',
  uid: 'test-uid',
  scopes: ['test-scope'],
  public: true,
  extensions: {
    crm: {
      cards,
    },
  },
});

describe('lib/projects/structure', () => {
  describe('getComponentTypeFromConfigFile()', () => {
    it('returns correct type for public app config', () => {
      expect(getComponentTypeFromConfigFile('public-app.json')).toBe(
        ComponentTypes.PublicApp
      );
    });

    it('returns correct type for private app config', () => {
      expect(getComponentTypeFromConfigFile('app.json')).toBe(
        ComponentTypes.PrivateApp
      );
    });

    it('returns correct type for theme config', () => {
      expect(getComponentTypeFromConfigFile('theme.json')).toBe(
        ComponentTypes.HublTheme
      );
    });

    it('returns null for unknown config file', () => {
      expect(getComponentTypeFromConfigFile('unknown.json')).toBeNull();
    });
  });

  describe('loadConfigFile()', () => {
    it('returns parsed JSON when file exists', () => {
      const mockConfig = { name: 'test-app' };
      mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      expect(loadConfigFile('test/path/app.json')).toEqual(mockConfig);
    });

    it('returns null when file read fails', () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(loadConfigFile('nonexistent/path/app.json')).toBeNull();
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('getAppCardConfigs()', () => {
    const mockAppPath = '/test/path';

    it('returns empty array when no cards exist', () => {
      const appConfig = getMockPrivateAppConfig();

      expect(getAppCardConfigs(appConfig, mockAppPath)).toEqual([]);
    });

    it('returns array of card configs when valid cards exist', () => {
      const mockCardConfig = { type: 'crm-card' };
      mockedReadFileSync.mockReturnValue(JSON.stringify(mockCardConfig));
      const appConfig = getMockPrivateAppConfig([{ file: 'card.json' }]);

      expect(getAppCardConfigs(appConfig, mockAppPath)).toEqual([
        mockCardConfig,
      ]);
    });
  });

  describe('getIsLegacyApp()', () => {
    const mockAppPath = '/test/path';

    it('returns true for a legacy app', () => {
      const cardConfig = { type: 'crm-card' };
      const appConfig = getMockPrivateAppConfig([{ file: 'card.json' }]);
      mockedReadFileSync.mockReturnValue(JSON.stringify(cardConfig));

      expect(getIsLegacyApp(appConfig, mockAppPath)).toBe(true);
    });

    it('returns false when the app has no cards', () => {
      const appConfig = getMockPrivateAppConfig();

      expect(getIsLegacyApp(appConfig, mockAppPath)).toBe(false);
    });

    it('returns false for non-legacy app', () => {
      const cardConfig = {
        data: { module: { file: 'ReactCard.jsx' } },
      };
      const appConfig = getMockPrivateAppConfig([{ file: 'card.json' }]);
      mockedReadFileSync.mockReturnValue(JSON.stringify(cardConfig));

      expect(getIsLegacyApp(appConfig, mockAppPath)).toBe(false);
    });
  });

  describe('findProjectComponents()', () => {
    it('returns an empty array of components when no components are found', async () => {
      mockedWalk.mockReturnValue([]);
      const components = await findProjectComponents('');

      expect(components).toEqual([]);
    });

    it('returns an array of components when components are found', async () => {
      const cardConfig = { type: 'crm-card' };
      const appConfig = getMockPrivateAppConfig();

      const component = {
        type: ComponentTypes.PrivateApp,
        config: appConfig,
        runnable: true,
        path: '',
      };

      mockedWalk.mockReturnValue(['app.json']);
      mockedReadFileSync
        .mockReturnValueOnce(JSON.stringify(appConfig))
        .mockReturnValueOnce(JSON.stringify(cardConfig));

      const components = await findProjectComponents('');

      expect(components).toEqual([component]);
    });
  });

  describe('getProjectComponentTypes()', () => {
    it('returns the correct component types', () => {
      const component = {
        type: ComponentTypes.PrivateApp,
        config: getMockPrivateAppConfig(),
        runnable: true,
        path: 'test/path',
      };
      const components = [component];

      expect(getProjectComponentTypes(components)).toEqual({
        [ComponentTypes.PrivateApp]: true,
      });
    });

    it('returns the correct component types for multiple components', () => {
      const component1 = {
        type: ComponentTypes.PrivateApp,
        config: getMockPrivateAppConfig(),
        runnable: true,
        path: 'test/path',
      };
      const component2 = {
        type: ComponentTypes.PublicApp,
        // Config doesn't matter for this test so we can use a private app config
        config: getMockPrivateAppConfig(),
        runnable: true,
        path: 'test/path',
      };
      const components = [component1, component2];

      expect(getProjectComponentTypes(components)).toEqual({
        [ComponentTypes.PrivateApp]: true,
        [ComponentTypes.PublicApp]: true,
      });
    });

    it('returns an empty object when no components are provided', () => {
      const components: Array<Component> = [];
      expect(getProjectComponentTypes(components)).toEqual({});
    });
  });

  describe('getComponentUid()', () => {
    it('returns uid from the component config', () => {
      const component = {
        type: ComponentTypes.PrivateApp,
        config: getMockPrivateAppConfig(),
        runnable: true,
        path: 'test/path',
      };
      expect(getComponentUid(component)).toBe(component.config.uid);
    });

    it('returns null for null input', () => {
      expect(getComponentUid(null)).toBeNull();
    });
  });

  describe('componentIsApp()', () => {
    it('returns true for public app component', () => {
      const component = {
        type: ComponentTypes.PublicApp,
        // Config doesn't matter for this test so we can use a private app config
        config: getMockPrivateAppConfig(),
        runnable: true,
        path: 'test/path',
      };
      expect(componentIsApp(component)).toBe(true);
    });

    it('returns true for private app component', () => {
      const component = {
        type: ComponentTypes.PrivateApp,
        config: getMockPrivateAppConfig(),
        runnable: true,
        path: 'test/path',
      };
      expect(componentIsApp(component)).toBe(true);
    });

    it('returns false for null input', () => {
      expect(componentIsApp(null)).toBe(false);
    });
  });

  describe('componentIsPublicApp()', () => {
    it('returns true for public app component', () => {
      const component = {
        type: ComponentTypes.PublicApp,
        // Config doesn't matter for this test so we can use a private app config
        config: getMockPrivateAppConfig(),
        runnable: true,
        path: 'test/path',
      };
      expect(componentIsPublicApp(component)).toBe(true);
    });

    it('returns false for private app component', () => {
      const component = {
        type: ComponentTypes.PrivateApp,
        config: getMockPrivateAppConfig(),
        runnable: true,
        path: 'test/path',
      };
      expect(componentIsPublicApp(component)).toBe(false);
    });

    it('returns false for null input', () => {
      expect(componentIsPublicApp(null)).toBe(false);
    });
  });
});
