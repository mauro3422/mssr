import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  type StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  Capability,
  CapabilityProvider,
  ProviderResult,
} from "../registry.js";

export type McpClientHandle = {
  client: Client;
  close(): Promise<void>;
};

export type McpClientFactory = (
  onToolsChanged: (error?: Error) => void,
) => Promise<McpClientHandle>;

export type McpToolsProviderOptions = {
  id: string;
  clientFactory: McpClientFactory;

  /** Metadata only; it does not authorize a tool invocation. */
  source?: string;
  location?: string;

  /** Optional operator-defined maximum age for tools/list metadata. */
  catalogTtlMs?: number;
};

const MAX_TOOLS_LIST_PAGES = 100;

function validCatalogTtlMs(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 86_400_000
    ? value
    : undefined;
}

function toolCapabilities(
  providerId: string,
  source: string,
  location: string | undefined,
  tools: readonly unknown[],
): Capability[] {
  return tools.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const tool = value as Record<string, unknown>;
    if (typeof tool.name !== "string") return [];
    return [{
      id: `${providerId}:tool:${tool.name}`,
      name: tool.name,
      description: typeof tool.description === "string" ? tool.description : "",
      kind: "tool" as const,
      providerId,
      source,
      location,
      schema: tool.inputSchema,
    }];
  });
}

/**
 * Discovers MCP tool metadata through tools/list.
 *
 * This class deliberately has no callTool API: MSSR uses catalog metadata for
 * planning only, while execution remains the responsibility of the host that
 * already has authority to invoke a selected tool.
 */
export class McpToolsProvider implements CapabilityProvider {
  readonly id: string;
  private readonly options: McpToolsProviderOptions;
  private handle: McpClientHandle | null = null;
  private connecting: Promise<McpClientHandle> | null = null;
  private readonly listeners = new Set<() => void>();
  private notificationWarning: string | undefined;

  constructor(options: McpToolsProviderOptions) {
    this.id = options.id;
    this.options = options;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyChanged(error?: Error): void {
    this.notificationWarning = error?.message;
    for (const listener of this.listeners) {
      // One broken observer must not suppress another registry's refresh.
      try { listener(); } catch { /* observers are advisory */ }
    }
  }

  private async connect(): Promise<McpClientHandle> {
    if (this.handle) return this.handle;
    if (!this.connecting) {
      this.connecting = this.options.clientFactory((error) => this.notifyChanged(error))
        .then((handle) => {
          this.handle = handle;
          return handle;
        })
        .finally(() => {
          this.connecting = null;
        });
    }
    return await this.connecting;
  }

  private async reset(): Promise<void> {
    const current = this.handle;
    this.handle = null;
    this.connecting = null;
    if (current) await current.close().catch(() => undefined);
  }

  async refresh(): Promise<ProviderResult> {
    try {
      const handle = await this.connect();
      const tools: unknown[] = [];
      let cursor: string | undefined;
      const seenCursors = new Set<string>();
      let pages = 0;
      do {
        const result = await handle.client.listTools(cursor ? { cursor } : undefined);
        tools.push(...result.tools);
        cursor = result.nextCursor;
        pages += 1;
        if (pages > MAX_TOOLS_LIST_PAGES) throw new Error(`tools/list exceeded ${MAX_TOOLS_LIST_PAGES} pages`);
        if (cursor) {
          if (seenCursors.has(cursor)) throw new Error("tools/list returned a repeated pagination cursor");
          seenCursors.add(cursor);
        }
      } while (cursor);

      const warning = this.notificationWarning;
      this.notificationWarning = undefined;
      return {
        capabilities: toolCapabilities(
          this.id,
          this.options.source ?? `mcp:${this.id}`,
          this.options.location,
          tools,
        ),
        observedAt: new Date().toISOString(),
        warning,
        ttlMs: validCatalogTtlMs(this.options.catalogTtlMs),
      };
    } catch (error) {
      await this.reset();
      // CapabilityRegistry retains the last valid catalog and marks health.
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.reset();
  }
}

/**
 * Creates a stdio MCP client only from operator-provided configuration.
 * No remote MCP tool can supply a command or become a tool-execution proxy.
 */
export function createStdioMcpClientFactory(
  parameters: StdioServerParameters,
): McpClientFactory {
  return async (onToolsChanged) => {
    const transport = new StdioClientTransport(parameters);
    const client = new Client(
      { name: "mssr-capability-provider", version: "0.2.0" },
      {
        capabilities: {},
        listChanged: {
          tools: {
            onChanged: (error) => onToolsChanged(error ?? undefined),
          },
        },
      },
    );
    await client.connect(transport);
    return {
      client,
      async close() {
        await client.close();
      },
    };
  };
}
