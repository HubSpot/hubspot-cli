import semver from 'semver';
import moment from 'moment';
import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { STATE_FLAGS } from '@hubspot/local-dev-lib/constants/config';
import { pkg } from '../jsonLoader.js';
import { lib } from '../../lang/en.js';
import { debugError } from '../errorHandlers/index.js';
import { renderInline } from '../../ui/render.js';
import {
  getWarningBox,
  getAlertBox,
} from '../../ui/components/StatusMessageBoxes.js';
import {
  CLI_DEPRECATED_MAJOR_VERSION,
  CLI_DEPRECATED_MAJOR_VERSION_DEPRECATION_DATE,
  CLI_DEPRECATED_MAJOR_VERSION_EOL_DATE,
  ONE_DAY_IN_MILLISECONDS,
} from '../constants.js';

type DeprecationStatus = 'deprecated' | 'endOfLife';

const LAST_SHOWN_STATE_FLAGS: Record<
  DeprecationStatus,
  (typeof STATE_FLAGS)[
    | 'CLI_VERSION_DEPRECATION_WARNING_LAST_SHOWN_AT'
    | 'CLI_VERSION_END_OF_LIFE_WARNING_LAST_SHOWN_AT']
> = {
  deprecated: STATE_FLAGS.CLI_VERSION_DEPRECATION_WARNING_LAST_SHOWN_AT,
  endOfLife: STATE_FLAGS.CLI_VERSION_END_OF_LIFE_WARNING_LAST_SHOWN_AT,
};

function getDeprecationStatusForCurrentMajorVersion(): DeprecationStatus | null {
  if (semver.major(pkg.version) !== CLI_DEPRECATED_MAJOR_VERSION) {
    return null;
  }

  const now = moment();

  if (now.isSameOrAfter(moment(CLI_DEPRECATED_MAJOR_VERSION_EOL_DATE))) {
    return 'endOfLife';
  }

  if (
    now.isSameOrAfter(moment(CLI_DEPRECATED_MAJOR_VERSION_DEPRECATION_DATE))
  ) {
    return 'deprecated';
  }

  return null;
}

function hasShownWarningToday(status: DeprecationStatus): boolean {
  const lastShown = getStateValue(LAST_SHOWN_STATE_FLAGS[status]);
  const lastShownTime =
    typeof lastShown === 'string' ? Date.parse(lastShown) : NaN;

  return (
    !Number.isNaN(lastShownTime) &&
    Date.now() - lastShownTime < ONE_DAY_IN_MILLISECONDS
  );
}

async function logDeprecationStatusWarning(
  status: DeprecationStatus
): Promise<void> {
  const eolDate = moment(CLI_DEPRECATED_MAJOR_VERSION_EOL_DATE).format(
    'MMMM D, YYYY'
  );

  const getBox = status === 'endOfLife' ? getAlertBox : getWarningBox;
  const title =
    status === 'endOfLife'
      ? lib.middleware.deprecationWarning.endOfLifeTitle
      : lib.middleware.deprecationWarning.deprecatedTitle;
  const message =
    status === 'endOfLife'
      ? lib.middleware.deprecationWarning.endOfLifeMessage(pkg.version, eolDate)
      : lib.middleware.deprecationWarning.deprecatedMessage(
          pkg.version,
          eolDate
        );

  await renderInline(getBox({ title, message }));
  setStateValue(LAST_SHOWN_STATE_FLAGS[status], new Date().toISOString());
}

export async function checkDeprecationWarning(): Promise<void> {
  try {
    const status = getDeprecationStatusForCurrentMajorVersion();

    if (!status || hasShownWarningToday(status)) {
      return;
    }

    await logDeprecationStatusWarning(status);
  } catch (error) {
    debugError(error);
  }
}
