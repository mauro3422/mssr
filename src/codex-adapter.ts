import { CapabilityRegistry, FilesystemSkillProvider, MssrFirstPartySkillProvider } from "./registry.js";
import { MssrAdapter, type MssrAdapterOptions, type MssrRouteInput } from "./mssr-adapter.js";

export type CodexMssrRouteInput = MssrRouteInput;
export type HostMssrAdapterOptions = MssrAdapterOptions;

/** Codex-local specialization of the shared portable MSSR host adapter. */
export class CodexMssrAdapter extends MssrAdapter {
  constructor(
    registry = new CapabilityRegistry([new MssrFirstPartySkillProvider(), new FilesystemSkillProvider()]),
    options: MssrAdapterOptions = {},
  ) {
    super(registry, {
      caller: "codex-local",
      source: "codex-local",
      tracePrefix: "mssr-codex",
      defaultSelectionMode: "host-gated",
      ...options,
    });
  }
}
