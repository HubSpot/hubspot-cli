const { notifyAboutUpdates } = require('../notificationsMiddleware');

describe('lib/middleware/notificationsMiddleware', () => {
  describe('notifyAboutUpdates()', () => {
    it('should safely execute without throwing an error', () => {
      expect(() => notifyAboutUpdates()).not.toThrow();
    });
  });
});
