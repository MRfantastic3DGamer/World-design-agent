/** Return the latest version id from a sorted version list (e.g. v1, v2, v10). */
export function latestVersion(versions: string[]): string {
  if (versions.length === 0) return 'v1'
  return versions[versions.length - 1]
}

export function formatVersionLabel(version: string, latest: string): string {
  return version === latest ? `${version} (latest)` : version
}
