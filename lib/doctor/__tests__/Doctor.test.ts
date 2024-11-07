import { Doctor } from '../Doctor';
import { packagesNeedInstalled as _packagesNeedInstalled } from '../../dependencyManagement';
import { isPortManagerServerRunning as _isPortManagerServerRunning } from '@hubspot/local-dev-lib/portManager';

jest.mock('@hubspot/local-dev-lib/logger');

const packagesNeedInstalled = _packagesNeedInstalled as jest.MockedFunction<
  typeof _packagesNeedInstalled
>;
const isPortManagerServerRunning = _isPortManagerServerRunning as jest.MockedFunction<
  typeof _isPortManagerServerRunning
>;

describe('Doctor', () => {
  let doctor: Doctor;

  beforeEach(() => {
    doctor = new Doctor();
  });

  describe('checkIfNodeIsInstalled', () => {
    it('should add success section if node version is valid', async () => {
      // @ts-expect-error Testing private method
      doctor.diagnosticInfo = { versions: { node: '14.17.0' } };
      // @ts-expect-error Testing private method
      await doctor.checkIfNodeIsInstalled();
      // @ts-expect-error Testing private method
      expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
        type: 'success',
        message: expect.any(String),
      });
    });

    it('should add error section if node version is not available', async () => {
      // @ts-expect-error Testing private method
      doctor.diagnosticInfo = { versions: {} };
      // @ts-expect-error Testing private method
      await doctor.checkIfNodeIsInstalled();
      // @ts-expect-error Testing private method
      expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
        type: 'error',
        message: expect.any(String),
      });
    });
  });

  describe('checkIfNpmIsInstalled', () => {
    it('should add success section if npm is installed', async () => {
      // @ts-expect-error Testing private method
      doctor.diagnosticInfo = { versions: { npm: '6.14.13' } };
      // @ts-expect-error Testing private method
      await doctor.checkIfNpmIsInstalled();
      // @ts-expect-error Testing private method
      expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
        type: 'success',
        message: expect.any(String),
      });
    });

    it('should add error section if npm is not installed', async () => {
      // @ts-expect-error Testing private method
      doctor.diagnosticInfo = { versions: {} };
      // @ts-expect-error Testing private method
      await doctor.checkIfNpmIsInstalled();
      // @ts-expect-error Testing private method
      expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
        type: 'error',
        message: expect.any(String),
      });
    });
  });

  describe('checkIfNpmInstallRequired', () => {
    it('should add warning section if dependencies are missing', async () => {
      // @ts-expect-error Testing private method
      doctor.diagnosticInfo = { packageFiles: ['package.json'] };
      packagesNeedInstalled.mockResolvedValue(true);
      // @ts-expect-error Testing private method
      await doctor.checkIfNpmInstallRequired();
      // @ts-expect-error Testing private method
      expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
        type: 'warning',
        message: expect.any(String),
        secondaryMessaging: expect.any(String),
      });
    });

    it('should add success section if no dependencies are missing', async () => {
      // @ts-expect-error Testing private method
      doctor.diagnosticInfo = { packageFiles: ['package.json'] };
      packagesNeedInstalled.mockResolvedValue(false);
      // @ts-expect-error Testing private method
      await doctor.checkIfNpmInstallRequired();
      // @ts-expect-error Testing private method
      expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
        type: 'success',
        message: expect.any(String),
      });
    });
  });

  describe('checkIfPortsAreAvailable', () => {
    it('should add warning section if port is in use', async () => {
      isPortManagerServerRunning.mockResolvedValue(true);
      // @ts-expect-error Testing private method
      await doctor.checkIfPortsAreAvailable();
      // @ts-expect-error Testing private method
      expect(doctor.diagnosis?.addProjectSection).toHaveBeenCalledWith({
        type: 'warning',
        message: expect.any(String),
        secondaryMessaging: expect.any(String),
      });
    });

    it('should add success section if port is available', async () => {
      isPortManagerServerRunning.mockResolvedValue(false);
      // @ts-expect-error Testing private method
      await doctor.checkIfPortsAreAvailable();
      // @ts-expect-error Testing private method
      expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
        type: 'success',
        message: expect.any(String),
      });
    });
  });
});
