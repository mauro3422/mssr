import os from "node:os";
import path from "node:path";

/**
 * Portable user-local MSSR state root shared by host adapters and background
 * infrastructure such as semantic-curation queues. Project authority remains
 * inside each project's .mssr directory; this root is operational state only.
 */
export function defaultMssrStateRoot(
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
  localAppData: string | null | undefined = process.env.LOCALAPPDATA,
  xdgStateHome: string | null | undefined = process.env.XDG_STATE_HOME,
  configuredRoot: string | null | undefined = process.env.MSSR_STATE_ROOT,
): string {
  if (configuredRoot?.trim()) return path.resolve(configuredRoot.trim());
  if (platform === "win32" && localAppData) return path.join(localAppData, "MauroPrime", "MSSR");
  if (platform === "darwin") return path.join(home, "Library", "Application Support", "MauroPrime", "MSSR");
  if (platform !== "win32" && xdgStateHome) return path.join(xdgStateHome, "mssr");
  return path.join(home, ".local", "state", "mssr");
}
