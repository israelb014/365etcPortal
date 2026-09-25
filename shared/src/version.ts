/** Compares dotted versions ("1.2.10" > "1.2.9"). Returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function isUpdateRequired(appVersion: string, minAppVersion: string): boolean {
  return compareVersions(appVersion, minAppVersion) < 0;
}
