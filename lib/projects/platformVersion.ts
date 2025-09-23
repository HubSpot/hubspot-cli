export function isV2Project(platformVersion?: string | null) {
  if (!platformVersion || typeof platformVersion !== 'string') {
    return false;
  }
  if (platformVersion.toLowerCase() === 'unstable') {
    return true;
  }
  const [year, minor] = platformVersion.split('.');
  return Number(year) >= 2025 && Number(minor) >= 2;
}
