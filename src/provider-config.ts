import fs from "node:fs/promises";
import { z } from "zod";
import {
  CapabilityRegistry,
  FilesystemSkillProvider,
  MssrFirstPartySkillProvider,
  type CapabilityProvider,
} from "./registry.js";
import {
  McpToolsProvider,
  createStdioMcpClientFactory,
} from "./providers/mcp-tools-provider.js";

const stdioProviderSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  transport: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).max(64).optional(),
  cwd: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
}).strict();

export const mssrProviderConfigSchema = z.object({
  schemaVersion: z.literal(1),
  providers: z.array(stdioProviderSchema).max(32),
}).strict();

export type MssrProviderConfig = z.infer<typeof mssrProviderConfigSchema>;

/**
 * Loads an operator-owned provider file. Catalog data can never supply these
 * commands, and the resulting providers expose tools/list metadata only.
 */
export async function loadMssrProviderConfig(configPath: string): Promise<MssrProviderConfig> {
  const text = await fs.readFile(configPath, "utf8");
  return mssrProviderConfigSchema.parse(JSON.parse(text));
}

export function createRegistryFromProviderConfig(config?: MssrProviderConfig): CapabilityRegistry {
  const providers: CapabilityProvider[] = [new MssrFirstPartySkillProvider(), new FilesystemSkillProvider()];
  for (const provider of config?.providers ?? []) {
    providers.push(new McpToolsProvider({
      id: provider.id,
      source: provider.source,
      location: provider.location ?? `${provider.transport}:${provider.command}`,
      clientFactory: createStdioMcpClientFactory({
        command: provider.command,
        args: provider.args,
        cwd: provider.cwd,
      }),
    }));
  }
  return new CapabilityRegistry(providers);
}

/** Builds the default registry and optionally extends it from an operator file. */
export async function createMssrRegistryFromEnvironment(
  configPath = process.env.MSSR_MCP_PROVIDERS_PATH?.trim(),
): Promise<CapabilityRegistry> {
  const config = configPath ? await loadMssrProviderConfig(configPath) : undefined;
  return createRegistryFromProviderConfig(config);
}
