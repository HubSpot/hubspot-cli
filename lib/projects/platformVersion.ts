/**
 * Used to surface warnings when users attempt to interact with new platform versions
 * that were released after this version of the CLI was released.
 *
 * We are unable to reliably support versions of projects that are newer than any given CLI release
 * */
export const LATEST_SUPPORTED_PLATFORM_VERSION = '2026.03';

function parsePlatformVersion(platformVersion: string): {
  year: number;
  minor: number;
} {
  const [year, minor] = platformVersion.split(/[.-]/);

  return {
    year: Number(year),
    minor: Number(minor),
  };
}

export function isV2Project(platformVersion?: string | null) {
  if (!platformVersion || typeof platformVersion !== 'string') {
    return false;
  }
  if (platformVersion.toLowerCase() === 'unstable') {
    return true;
  }
  const { year, minor } = parsePlatformVersion(platformVersion);

  return (year === 2025 && minor >= 2) || year > 2025;
}

export function isUnsupportedPlatformVersion(
  platformVersion?: string | null
): boolean {
  if (!platformVersion || typeof platformVersion !== 'string') {
    return false;
  }
  if (platformVersion.toLowerCase() === 'unstable') {
    return false;
  }

  const { year, minor } = parsePlatformVersion(platformVersion);

  if (isNaN(year) || isNaN(minor)) {
    return false;
  }

  const { year: latestSupportedYear, minor: latestSupportedMinor } =
    parsePlatformVersion(LATEST_SUPPORTED_PLATFORM_VERSION);

  return (
    year > latestSupportedYear ||
    (year === latestSupportedYear && minor > latestSupportedMinor)
  );
}
