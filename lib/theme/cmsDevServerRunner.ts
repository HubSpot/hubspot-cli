// @ts-nocheck
/**
 * This script runs in an isolated cache directory with cms-dev-server installed.
 * It is spawned as a separate process to avoid React version conflicts with the CLI.
 *
 * Arguments are passed via environment variables:
 * - CMS_DEV_SERVER_SRC: Source directory path
 * - CMS_DEV_SERVER_DEST: Destination path
 * - CMS_DEV_SERVER_CONFIG: Config file path (optional)
 * - CMS_DEV_SERVER_ACCOUNT: Account name (optional)
 * - CMS_DEV_SERVER_SSL: 'true' or 'false'
 * - CMS_DEV_SERVER_FIELD_GEN: 'true' or 'false'
 * - CMS_DEV_SERVER_RESET_SESSION: 'true' or 'false'
 */

// Suppress library deprecation warnings (e.g., body-parser)
process.noDeprecation = true;

// Dynamic imports to use the isolated cms-dev-server installation
const { createDevServer } = await import('@hubspot/cms-dev-server');
const { walk } = await import('@hubspot/local-dev-lib/fs');
const { createIgnoreFilter } =
  await import('@hubspot/local-dev-lib/ignoreRules');
const { isAllowedExtension } = await import('@hubspot/local-dev-lib/path');
const { FILE_UPLOAD_RESULT_TYPES } =
  await import('@hubspot/local-dev-lib/constants/files');
const cliProgress = (await import('cli-progress')).default;

// Read configuration from environment variables
const src = process.env.CMS_DEV_SERVER_SRC!;
const dest = process.env.CMS_DEV_SERVER_DEST!;
const configPath = process.env.CMS_DEV_SERVER_CONFIG || '';
const accountName = process.env.CMS_DEV_SERVER_ACCOUNT || '';
const sslEnabled = process.env.CMS_DEV_SERVER_SSL === 'true';
const fieldGenEnabled = process.env.CMS_DEV_SERVER_FIELD_GEN === 'true';
const resetSession = process.env.CMS_DEV_SERVER_RESET_SESSION === 'true';

// Get uploadable files for preview
let filePaths: string[] = [];
try {
  filePaths = await walk(src);
} catch (e) {
  console.error('Error walking directory:', e);
}
filePaths = filePaths
  .filter(file => isAllowedExtension(file))
  .filter(createIgnoreFilter(false));

// Create progress bar for initial upload
function startProgressBar(numFiles: number) {
  const initialUploadProgressBar = new cliProgress.SingleBar(
    {
      gracefulExit: true,
      format: '[{bar}] {percentage}% | {value}/{total} | {label}',
      hideCursor: true,
    },
    cliProgress.Presets.rect
  );
  initialUploadProgressBar.start(numFiles, 0, {
    label: 'Preparing upload...',
  });
  let uploadsHaveStarted = false;
  return {
    onAttemptCallback: () => {},
    onSuccessCallback: () => {
      initialUploadProgressBar.increment();
      if (!uploadsHaveStarted) {
        uploadsHaveStarted = true;
        initialUploadProgressBar.update(0, {
          label: 'Uploading files...',
        });
      }
    },
    onFirstErrorCallback: () => {},
    onRetryCallback: () => {},
    onFinalErrorCallback: () => initialUploadProgressBar.increment(),
    // eslint-disable-next-line
    onFinishCallback: (results: any[]) => {
      initialUploadProgressBar.update(numFiles, {
        label: 'Upload complete',
      });
      initialUploadProgressBar.stop();
      results.forEach(result => {
        if (result.resultType === FILE_UPLOAD_RESULT_TYPES.FAILURE) {
          console.error(`Failed to upload ${result.file}`);
        }
      });
    },
  };
}

const themePreviewOptions = {
  filePaths,
  startProgressBar,
  resetSession,
  dest,
};

createDevServer(
  src,
  false, // storybook
  configPath,
  accountName,
  sslEnabled,
  fieldGenEnabled,
  themePreviewOptions
);
