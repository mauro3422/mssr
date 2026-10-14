export const MSSR_JEV_PROVIDER_INPUT_PRIVACY_CATEGORIES = [
  "private-ipv4",
  "local-path",
  "credential-like",
] as const;

export type MssrJevProviderInputPrivacyCategory = typeof MSSR_JEV_PROVIDER_INPUT_PRIVACY_CATEGORIES[number];

export type MssrJevProviderInputPrivacyScan = {
  blocked: boolean;
  categories: MssrJevProviderInputPrivacyCategory[];
  matchCount: number;
};

export type MssrJevProviderLocalIdentityKind = "owner" | "source" | "project" | "corpus";

const ipv4Pattern = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?!\d)(?!\.\d)/g;
const drivePathPattern = /(?<![A-Za-z0-9])[A-Za-z]:(?:\\|\/)[^\r\n"'<>|]{1,240}/g;
const uncPathPattern = /(?:\\\\|(?<![:\w])\/\/)[^\\/\s"'<>|]+[\\/][^\r\n"'<>|]{1,240}/g;
const credentialAssignmentPattern = /\b[a-z0-9_-]*(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|authorization|auth[_-]?token|secret)\b\s*[:=]\s*(?:"[^"\r\n]{8,}"|'[^'\r\n]{8,}'|[^\s,;`"'<>]{8,})/gi;
const bearerPattern = /\bbearer\s+[A-Za-z0-9._~+/-]{12,}={0,2}/gi;
const commonTokenPattern = /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/g;

function collectStrings(value: unknown, output: string[], seen: Set<object>): void {
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output, seen);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    output.push(key);
    collectStrings(item, output, seen);
  }
}

function isNonPublicIpv4(value: string): boolean {
  const octets = value.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second, third, fourth] = octets;
  return first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 0 && second === 0 && third === 0 && fourth === 0)
    || (first === 100 && second >= 64 && second <= 127);
}

function matches(pattern: RegExp, value: string, include?: (match: string) => boolean): number {
  pattern.lastIndex = 0;
  let count = 0;
  for (const match of value.matchAll(pattern)) {
    if (!include || include(match[0])) count += 1;
  }
  return count;
}

/**
 * Screen the actual provider-bound object for common accidental disclosures.
 * This is a narrow deterministic guard, not comprehensive DLP or authorization.
 * Returned diagnostics contain categories/counts only; matched text is never returned.
 */
export function scanMssrJevProviderInputPrivacy(value: unknown): MssrJevProviderInputPrivacyScan {
  const strings: string[] = [];
  collectStrings(value, strings, new Set());
  const counts = new Map<MssrJevProviderInputPrivacyCategory, number>();
  let privateIpCount = 0;
  for (const item of strings) privateIpCount += matches(ipv4Pattern, item, isNonPublicIpv4);
  if (privateIpCount) counts.set("private-ipv4", privateIpCount);

  let pathCount = 0;
  for (const item of strings) pathCount += matches(drivePathPattern, item) + matches(uncPathPattern, item);
  if (pathCount) counts.set("local-path", pathCount);

  let credentialCount = 0;
  for (const item of strings) {
    credentialCount += matches(credentialAssignmentPattern, item);
    credentialCount += matches(bearerPattern, item);
    credentialCount += matches(commonTokenPattern, item);
  }
  if (credentialCount) counts.set("credential-like", credentialCount);

  const categories = MSSR_JEV_PROVIDER_INPUT_PRIVACY_CATEGORIES.filter((category) => counts.has(category));
  return {
    blocked: categories.length > 0,
    categories: [...categories],
    matchCount: categories.reduce((sum, category) => sum + (counts.get(category) ?? 0), 0),
  };
}

/** Replace filesystem-path identifiers with request-local labels before transport. */
export function createMssrJevProviderLocalPathLabeler(): (value: string, kind: MssrJevProviderLocalIdentityKind) => string {
  const labels = new Map<string, string>();
  const counters = new Map<MssrJevProviderLocalIdentityKind, number>();
  return (value, kind) => {
    if (!scanMssrJevProviderInputPrivacy(value).categories.includes("local-path")) return value;
    const key = `${kind}\u0000${value}`;
    const existing = labels.get(key);
    if (existing) return existing;
    const next = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, next);
    const label = `local-${kind}-${next}`;
    labels.set(key, label);
    return label;
  };
}

export function assertMssrJevProviderInputPrivacy(value: unknown): void {
  const scan = scanMssrJevProviderInputPrivacy(value);
  if (!scan.blocked) return;
  throw new Error(`Jev provider input blocked by local privacy preflight (${scan.categories.join(", ")}; ${scan.matchCount} match${scan.matchCount === 1 ? "" : "es"}).`);
}
