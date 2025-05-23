import { TestState } from '../../lib/TestState';
import { DOWN, ENTER } from '../../lib/prompt';

describe('hs config', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
  });

  afterAll(() => {
    testState.cleanup();
  });

  describe('hs config set', () => {
    it('should set the default CMS publish mode to draft', async () => {
      await testState.cli.executeWithTestConfig(
        ['config', 'set'],
        [ENTER, DOWN, ENTER]
      );

      const parsedConfig = testState.getParsedConfig();

      expect(parsedConfig.defaultCmsPublishMode).toEqual('draft');
    });
  });
});
