import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  OpenCodeMssrAdapter,
  createOpenCodeMssrMcpServer,
  evaluateMssrServerBuildOperationalAttention,
  isMssrTransportClosedError,
  MssrNoticeDeliveryTracker,
  readMssrServerBuildId,
} from "../dist/index.js";

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text, "Expected text MCP response");
  return JSON.parse(item.text);
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-server-build-"));
try {
  const distOld = path.join(root, "dist-old");
  const distNew = path.join(root, "dist-new");
  const srcDecoy = path.join(root, "src-decoy");
  await fs.mkdir(distOld, { recursive: true });
  await fs.mkdir(distNew, { recursive: true });
  await fs.mkdir(srcDecoy, { recursive: true });
  await fs.writeFile(path.join(distOld, "a.js"), "export const build = 'old-a';\n", "utf8");
  await fs.writeFile(path.join(distOld, "b.js"), "export const build = 'old-b';\n", "utf8");
  await fs.writeFile(path.join(distNew, "a.js"), "export const build = 'new-a';\n", "utf8");
  await fs.writeFile(path.join(distNew, "b.js"), "export const build = 'new-b';\n", "utf8");
  await fs.writeFile(path.join(distNew, "..", "package.json"), JSON.stringify({ name: "probe", version: "9.9.9" }), "utf8");

  // Finished builds settle: backdate fixture mtimes so identity reads see
  // completed output, not writes in progress (fresh mtimes are T7's subject).
  async function settleDir(dir) {
    const old = new Date(Date.now() - 3_600_000);
    for (const file of await fs.readdir(dir)) {
      await fs.utimes(path.join(dir, file), old, old);
    }
  }
  await settleDir(distOld);
  await settleDir(distNew);

  const oldId = readMssrServerBuildId(distOld);
  const newId = readMssrServerBuildId(distNew);
  assert.equal(oldId.status, "known");
  assert.equal(newId.status, "known");
  assert.notEqual(oldId.id, newId.id, "fixture builds must differ");

  // Projection unit checks.
  assert.equal(evaluateMssrServerBuildOperationalAttention({ loadedBuildId: oldId.id, availableBuildId: oldId.id, availableKnown: true }).level, "ok");
  assert.equal(evaluateMssrServerBuildOperationalAttention({ loadedBuildId: oldId.id, availableBuildId: newId.id, availableKnown: true }).level, "review");
  assert.equal(evaluateMssrServerBuildOperationalAttention({ loadedBuildId: oldId.id, availableBuildId: null, availableKnown: false }).level, "watch");
  assert.ok(isMssrTransportClosedError(new Error("Transport closed")));
  assert.ok(isMssrTransportClosedError(new Error("MCP error -32000: Connection closed")));
  assert.equal(isMssrTransportClosedError(new Error("boom")), false);

  const skillDir = path.join(root, "probe-skill");
  await fs.mkdir(skillDir, { recursive: true });
  const skillPath = path.join(skillDir, "SKILL.md");
  await fs.writeFile(skillPath, "# Probe\n\nCore guidance.\n", "utf8");
  const registryFor = () => new CapabilityRegistry([{
    id: "fixture",
    async refresh() {
      return {
        capabilities: [{
          id: "fixture:skill:probe", name: "probe-skill", kind: "skill", providerId: "fixture",
          description: "Probe skill.", source: "fixture", location: skillPath,
          skill: { name: "probe-skill", description: "Probe skill.", source: "codex-local", path: skillPath },
        }],
      };
    },
  }]);

  const input = {
    task: "Probe build identity.",
    intent: {
      summary: "Probe.", domains: ["coding"], actions: ["review"], artifacts: ["code"],
      needs: ["unit-tests"], signals: ["nominal"], risk: "read-only", ambiguity: "low",
    },
    stage: "start",
  };

  async function servedRoute(adapter) {
    const { server } = createOpenCodeMssrMcpServer(adapter);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const client = new Client({ name: "build-probe", version: "1.0.0" });
    await client.connect(ct);
    const out = json(await client.callTool({ name: "mssr_route_plan", arguments: input }));
    await client.close();
    await server.close();
    return out;
  }

  // T1: old process + new build -> notice received (piggyback + boundary).
  const callsA = [];
  const adapterA = new OpenCodeMssrAdapter(registryFor(), {
    instanceId: "test-instance-a",
    build: { loaded: oldId, distDir: distNew },
    noticeDelivery: async (notice) => { callsA.push(notice); return { n: callsA.length }; },
  });
  const r1 = await servedRoute(adapterA);
  assert.equal(r1.serverBuild.status, "stale");
  assert.equal(r1.serverBuild.loaded, oldId.id);
  assert.equal(r1.serverBuild.available, newId.id);
  assert.equal(r1.notices.length, 1, "stale notice must be presented once");
  assert.equal(r1.notices[0].code, "mssr-server-build-stale");
  assert.equal(r1.notices[0].details.event, "opened");
  assert.equal(callsA.length, 1, "boundary must receive the notice once");
  assert.equal(callsA[0].dedupeKey, r1.notices[0].dedupeKey);
  assert.deepEqual(adapterA.describeServerBuild().pendingDedupeKeys, []);

  // T2: repeat same state -> quiet, no spam.
  const r2 = await adapterA.route(input);
  assert.deepEqual(r2.notices, [], "stable repeats stay quiet");
  assert.equal(callsA.length, 1, "no second delivery");

  // T3: transport closed -> pending, then silent re-attempt delivers.
  const flap = { mode: "closed", calls: [] };
  const adapterB = new OpenCodeMssrAdapter(registryFor(), {
    instanceId: "test-instance-b",
    build: { loaded: oldId, distDir: distNew },
    noticeDelivery: async (notice) => {
      if (flap.mode === "closed") throw new Error("Transport closed");
      flap.calls.push(notice);
      return { n: flap.calls.length };
    },
  });
  const r3 = await servedRoute(adapterB);
  assert.equal(r3.notices.length, 1, "first presentation still reaches the response");
  assert.deepEqual(adapterB.describeServerBuild().pendingDedupeKeys, [r3.notices[0].dedupeKey], "closed transport parks the notice as pending");
  flap.mode = "open";
  const r3b = await adapterB.route(input);
  assert.deepEqual(r3b.notices, [], "pending re-attempt does not re-present");
  assert.equal(flap.calls.length, 1, "pending re-attempt delivers once transport reopens");
  assert.deepEqual(adapterB.describeServerBuild().pendingDedupeKeys, [], "pending clears after delivery");

  // T4: reconnected consumer carrying memory + current build -> resolved.
  const adapterC = new OpenCodeMssrAdapter(registryFor(), {
    instanceId: "test-instance-a",
    build: { loaded: newId, distDir: distNew },
    noticeDelivery: async (notice) => { callsA.push(notice); return { n: callsA.length }; },
  });
  adapterC.restoreNoticeMemory(adapterA.snapshotNoticeMemory());
  const r4 = await servedRoute(adapterC);
  assert.equal(r4.serverBuild.status, "current");
  assert.equal(r4.notices.length, 1, "reconnect with current build resolves");
  assert.equal(r4.notices[0].code, "mssr-server-build-current");
  assert.equal(r4.notices[0].details.event, "resolved");

  // T5: per-instance/per-build dedupe; new pair re-notifies as changed.
  const callsD = [];
  const adapterD = new OpenCodeMssrAdapter(registryFor(), {
    instanceId: "test-instance-d",
    build: { loaded: oldId, distDir: distNew },
    noticeDelivery: async (notice) => { callsD.push(notice); return {}; },
  });
  const r5 = await adapterD.route(input);
  assert.equal(r5.notices.length, 1, "a second instance notifies independently");
  assert.equal(callsD.length, 1);
  await fs.writeFile(path.join(distNew, "b.js"), "export const build = 'newer-b';\n", "utf8");
  await settleDir(distNew);
  const newerId = readMssrServerBuildId(distNew);
  assert.notEqual(newerId.id, newId.id);
  const r5b = await adapterA.route(input);
  assert.equal(r5b.notices.length, 1, "a new available build re-notifies");
  assert.equal(r5b.notices[0].details.event, "changed");
  assert.equal(callsA.length, 3, "changed pair delivers again");

  // T6: non-dist file changes never move the available identity.
  await fs.writeFile(path.join(srcDecoy, "untracked-source.ts"), "export const x = 1;\n", "utf8");
  await fs.writeFile(path.join(distNew, "..", "unrelated.txt"), "noise\n", "utf8");
  assert.equal(readMssrServerBuildId(distNew).id, newerId.id, "source/decoy changes must not fake a build");
  const r6 = await adapterA.route(input);
  assert.deepEqual(r6.notices, [], "unchanged pair stays quiet after decoys");

  // T7: partial/failed compilation must not fabricate identities.
  const distSettling = path.join(root, "dist-settling");
  await fs.mkdir(distSettling, { recursive: true });
  await fs.writeFile(path.join(distSettling, "a.js"), "export const x = 1;\n", "utf8");
  assert.equal(readMssrServerBuildId(distSettling).status, "unknown", "freshly written dist must read as settling, not a new identity");
  await fs.writeFile(path.join(distSettling, "a.js"), "export const x = 2;\n", "utf8");
  assert.equal(readMssrServerBuildId(distSettling).status, "unknown", "mid-write reads must stay stable-unknown, never flap ids");

  // A finished-build receipt is authoritative; failed builds never rewrite it.
  const distReceipt = path.join(root, "dist-receipt");
  await fs.mkdir(distReceipt, { recursive: true });
  await fs.writeFile(path.join(distReceipt, "a.js"), "export const x = 1;\n", "utf8");
  await fs.writeFile(path.join(distReceipt, "b.js"), "export const y = 2;\n", "utf8");
  await settleDir(distReceipt);
  const genuineReceiptId = readMssrServerBuildId(distReceipt);
  assert.equal(genuineReceiptId.status, "known");
  const receiptBytes = (await fs.stat(path.join(distReceipt, "a.js"))).size
    + (await fs.stat(path.join(distReceipt, "b.js"))).size;
  await fs.writeFile(path.join(distReceipt, ".build-receipt.json"), JSON.stringify({
    schema: "mssr-build-receipt-v1",
    id: genuineReceiptId.id,
    version: "9.9.9",
    files: 2,
    bytes: receiptBytes,
  }), "utf8");
  assert.equal(
    readMssrServerBuildId(distReceipt).id,
    genuineReceiptId.id,
    "genuine finished-build receipt is honored",
  );

  // R1: same-size content modification under a matching receipt stays unknown.
  const distSameSize = path.join(root, "dist-samesize");
  await fs.mkdir(distSameSize, { recursive: true });
  await fs.writeFile(path.join(distSameSize, "a.js"), "export const x = 'aaaa';\n", "utf8");
  await fs.writeFile(path.join(distSameSize, "b.js"), "export const y = 'bbbb';\n", "utf8");
  await settleDir(distSameSize);
  const sameSizeBase = readMssrServerBuildId(distSameSize);
  assert.equal(sameSizeBase.status, "known");
  const sameSizeBytes = (await fs.stat(path.join(distSameSize, "a.js"))).size
    + (await fs.stat(path.join(distSameSize, "b.js"))).size;
  await fs.writeFile(path.join(distSameSize, ".build-receipt.json"), JSON.stringify({
    schema: "mssr-build-receipt-v1",
    id: sameSizeBase.id,
    version: "9.9.9",
    files: 2,
    bytes: sameSizeBytes,
  }), "utf8");
  await fs.writeFile(path.join(distSameSize, "a.js"), "export const x = 'cccc';\n", "utf8");
  assert.equal(
    (await fs.stat(path.join(distSameSize, "a.js"))).size + (await fs.stat(path.join(distSameSize, "b.js"))).size,
    sameSizeBytes,
    "fixture must keep byte totals identical",
  );
  await settleDir(distSameSize);
  assert.equal(
    readMssrServerBuildId(distSameSize).status,
    "unknown",
    "same-size modification under receipt must stay unknown, never promoted by age",
  );

  // R2: aged failed build (bytes differ, receipt stale) stays unknown.
  const distAgedFail = path.join(root, "dist-agedfail");
  await fs.mkdir(distAgedFail, { recursive: true });
  await fs.writeFile(path.join(distAgedFail, "a.js"), "export const x = 1;\n", "utf8");
  await fs.writeFile(path.join(distAgedFail, "b.js"), "export const y = 2;\n", "utf8");
  await settleDir(distAgedFail);
  const agedBase = readMssrServerBuildId(distAgedFail);
  assert.equal(agedBase.status, "known");
  const agedBytes = (await fs.stat(path.join(distAgedFail, "a.js"))).size
    + (await fs.stat(path.join(distAgedFail, "b.js"))).size;
  await fs.writeFile(path.join(distAgedFail, ".build-receipt.json"), JSON.stringify({
    schema: "mssr-build-receipt-v1",
    id: agedBase.id,
    version: "9.9.9",
    files: 2,
    bytes: agedBytes,
  }), "utf8");
  await fs.writeFile(path.join(distAgedFail, "b.js"), "export const y = 2;\n// failed-build tail\n", "utf8");
  await settleDir(distAgedFail);
  assert.equal(
    readMssrServerBuildId(distAgedFail).status,
    "unknown",
    "aged failed build must stay unknown, never promoted by age",
  );

  // T8: pending survives snapshot->restore (reconnect carry).
  const callsE = [];
  const flapE = { mode: "closed" };
  const adapterE = new OpenCodeMssrAdapter(registryFor(), {
    instanceId: "test-instance-e",
    build: { loaded: oldId, distDir: distNew },
    noticeDelivery: async (notice) => {
      if (flapE.mode === "closed") throw new Error("Transport closed");
      callsE.push(notice);
      return {};
    },
  });
  const r8 = await adapterE.route(input);
  assert.equal(r8.notices.length, 1);
  assert.deepEqual(adapterE.describeServerBuild().pendingDedupeKeys, [r8.notices[0].dedupeKey]);
  const snapE = adapterE.snapshotNoticeMemory();
  assert.equal(snapE["test-instance-e"]?.pendingDedupeKey, r8.notices[0].dedupeKey, "snapshot must carry pending");
  const adapterF = new OpenCodeMssrAdapter(registryFor(), {
    instanceId: "test-instance-e",
    build: { loaded: oldId, distDir: distNew },
    noticeDelivery: async (notice) => { callsE.push(notice); return {}; },
  });
  adapterF.restoreNoticeMemory(snapE);
  const r8b = await adapterF.route(input);
  assert.deepEqual(r8b.notices, [], "carried pending re-attempts silently");
  assert.equal(callsE.length, 1, "the SAME pending notice is delivered after reconnect");
  assert.equal(callsE[0].dedupeKey, r8.notices[0].dedupeKey);
  assert.deepEqual(adapterF.describeServerBuild().pendingDedupeKeys, []);

  // T9: honest delivery statuses; lost responses re-arm exactly once on evidence.
  const trackBase = {
    subject: "unit-subject", source: "unit", code: "unit-code",
    currentLevel: "review", currentFingerprint: "fp-1",
    message: "Unit stale.", recommendation: "Respawn.",
  };
  const trackOk = new MssrNoticeDeliveryTracker(async () => ({}));
  const o1 = await trackOk.observe(trackBase);
  assert.equal(o1.delivery, "delivered");
  assert.ok(o1.notice);
  const o2 = await trackOk.observe(trackBase);
  assert.equal(o2.delivery, "none", "quiet observations claim no delivery");
  assert.equal(o2.notice, null);
  const trackNull = new MssrNoticeDeliveryTracker(null);
  const n1 = await trackNull.observe(trackBase);
  assert.equal(n1.delivery, "boundary-unconfigured");
  assert.ok(n1.notice, "first presentation attaches without a boundary");
  const firstKey = n1.notice.dedupeKey;
  const n2 = await trackNull.observe(trackBase);
  assert.equal(n2.notice, null);
  assert.equal(trackNull.markResponseLost(firstKey), true, "lost presentation re-arms once");
  const n3 = await trackNull.observe(trackBase);
  assert.equal(n3.notice?.dedupeKey, firstKey, "re-armed notice re-presents identically");
  const n4 = await trackNull.observe(trackBase);
  assert.equal(n4.notice, null, "re-arm is single-use");
  assert.equal(trackNull.markResponseLost("missing"), false);

  console.log(JSON.stringify({ status: "PASS", old: oldId.id, new: newId.id, newer: newerId.id }, null, 2));
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
