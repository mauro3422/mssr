import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APIError, TypeSafeClient, choice, noul, score } from "@typesafe-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");
const port = Number(process.env.PORT || 8788);

if (!process.env.TYPESAFE_API_KEY) {
  console.error("Missing TYPESAFE_API_KEY. Run .\\start.ps1 and paste it when asked.");
  process.exit(1);
}

const client = new TypeSafeClient();

function sendJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}
function list(value, fallback) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  const clean = values.map((item) => String(item).trim()).filter(Boolean);
  return clean.length ? clean : fallback;
}

async function evaluate(body) {
  const state = String(body.state || "").trim();
  if (!state) throw new Error("State cannot be empty");

  const choiceOptions = list(body.choiceOptions, [
    "inspect_context", "run_tests", "ask_user", "stop",
  ]);
  const scoreLevels = list(body.scoreLevels, [
    "negligible", "low", "medium", "high", "critical",
  ]);
  if (choiceOptions.length < 2) throw new Error("Choice needs at least two options");
  if (scoreLevels.length < 2) throw new Error("Score needs at least two ordered levels");

  const criteria = Object.fromEntries(choiceOptions.map((item) => [item, null]));
  const started = performance.now();
  const result = await client.systemOne({
    state: { scenario: state },
    questions: {
      needsMoreContext: noul(String(body.noulQuestion || "Does the agent need more context before acting?")),
      nextAction: choice(String(body.choiceQuestion || "What should the agent do next?"), criteria),
      actionRisk: score(
        String(body.scoreQuestion || "How risky is it to perform the next action automatically?"),
        scoreLevels,
      ),
    },
  });

  return {
    elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    answers: result.answers,
    usage: result.usage,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/") {
      const html = await readFile(path.join(publicDir, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, apiKeyLoaded: true });
    }
    if (req.method === "POST" && url.pathname === "/api/evaluate") {
      return sendJson(res, 200, await evaluate(await readJson(req)));
    }
    res.writeHead(404);
    res.end("Not found");
  } catch (error) {
    if (error instanceof APIError) {
      return sendJson(res, error.status || 502, {
        error: "TypeSafe API error",
        status: error.status,
        requestId: error.requestId ?? null,
        body: error.body ?? null,
      });
    }
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TypeSafe Jev Lab: http://127.0.0.1:${port}`);
  console.log("The API key stays only in this server process.");
});
