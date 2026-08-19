import { CapabilityRegistry, FilesystemSkillProvider, MssrFirstPartySkillProvider } from "./registry.js";
import { MssrAdapter, type MssrAdapterOptions } from "./mssr-adapter.js";

/** OpenCode-local specialization of the shared portable MSSR host adapter. */
export class OpenCodeMssrAdapter extends MssrAdapter {
  constructor(
    registry = new CapabilityRegistry([new MssrFirstPartySkillProvider(), new FilesystemSkillProvider()]),
    options: MssrAdapterOptions = {},
  ) {
    super(registry, {
      caller: "opencode-local",
      source: "opencode-cli",
      tracePrefix: "mssr-opencode",
      defaultSelectionMode: "host-gated",
      ...options,
    });
  }
}
