export const REPO = "https://github.com/florianlauer/prosed";

export type Target = "macos" | "windows" | "extension";
export const TARGETS: readonly Target[] = ["macos", "windows", "extension"];

// The desktop builds ship in their own "desktop-v*" releases, which GitHub never marks latest.
// ponytail: a release search, not a file link, so it never goes stale; link the .dmg/.exe once their names stop carrying the version.
export const DOWNLOADS: Record<Target, string> = {
  macos: `${REPO}/releases?q=desktop&expanded=true`,
  windows: `${REPO}/releases?q=desktop&expanded=true`,
  extension: `${REPO}/releases/latest`,
};

// The prerendered page offers macOS; the browser swaps in its own target after hydration.
export function targetFrom(userAgent: string): Target {
  if (/iPhone|iPad|Android/.test(userAgent)) return "macos";
  if (/Windows/.test(userAgent)) return "windows";
  if (/Linux|CrOS/.test(userAgent)) return "extension";
  return "macos";
}
