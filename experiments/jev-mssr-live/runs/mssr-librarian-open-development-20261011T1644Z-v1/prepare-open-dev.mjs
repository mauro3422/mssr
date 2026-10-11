import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(runDir, "../../../..");
const sourceRefs = [
  ".mssr/knowledge/decision/canonical-project-context-cutover.md",
  ".mssr/knowledge/decision/human-task-identity.md",
  ".mssr/knowledge/decision/mssr-first-party-skill-direction.md",
  ".mssr/knowledge/decision/mssr-learning-activation-decision.md",
  ".mssr/knowledge/operations/mssr-project-knowledge-drift-review.md",
  ".mssr/knowledge/pattern/mssr-change-history-contract.md",
  ".mssr/knowledge/state/mssr-learning-dataset-state.md",
];

const cases = [
  { caseId: "cutover-01", query: "¿Qué cambió MSSR 0.2.18 respecto al fallback de .bridge y cómo trató el inbox anterior a esa versión?" },
  { caseId: "identity-01", query: "¿De dónde debe venir taskKey y qué señales del texto o del flujo están prohibidas para derivarlo?" },
  { caseId: "identity-02", query: "¿Qué pueden y qué no pueden hacer parentTraceId y supersedesTraceId con otro trace?" },
  { caseId: "skills-01", query: "¿Qué precedencia tienen los nombres de skills first-party y qué implica el bundle acerca de cargarlos en cada tarea?" },
  { caseId: "skills-02", query: "¿Qué cambió MSSR 0.2.55 para evitar que señales genéricas carguen referencias procedimentales monolíticas?" },
  { caseId: "learning-01", query: "¿En qué modo corre el aprendizaje operativo y qué condiciones mantienen la influencia histórica fuera del routing?" },
  { caseId: "learning-02", query: "¿Qué requisitos distintos se exigen para generar una regla shadow y para preferir un fallback en un holdout?" },
  { caseId: "drift-01", query: "¿Qué evidencia puede elevar el mantenimiento de WATCH a REVIEW o REQUIRED, y qué significan esos niveles?" },
  { caseId: "drift-02", query: "¿Qué comprueba el sistema para distinguir una capacidad realmente integrada de código exportado o una casilla de roadmap?" },
  { caseId: "drift-03", query: "¿Cuándo una revisión de freshness obliga a revisar una guía y qué no demuestra sobre su contenido?" },
  { caseId: "history-01", query: "¿Qué debe declarar cada changelog de release y qué estado impide persistir el cambio?" },
  { caseId: "dataset-01", query: "¿Cuál es el último readback local del store de Semantic Experience y cuántos registros tenían verdad verificada o reglas generadas?" },
  { caseId: "dataset-02", query: "¿Qué diferencia hay entre el snapshot histórico de Bridge y el readback local más reciente?" },
  { caseId: "no-evidence-01", query: "¿Qué precisión calibrada obtuvo Jev en un holdout owner-gold con 100 proyectos independientes?" },
  { caseId: "no-evidence-02", query: "¿Cuántos fallos de producción confirmó un verificador independiente durante octubre de 2026?" },
];

const documents = [];
for (const sourceRef of sourceRefs) {
  const bytes = await readFile(path.join(repoRoot, sourceRef));
  const markdown = bytes.toString("utf8");
  documents.push({
    owner: "D:/Dev/mssr",
    sourceRef,
    markdown,
    privacyClass: "project-metadata",
    sourceBytesSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

await mkdir(path.join(runDir, "inputs"), { recursive: true });
await mkdir(path.join(runDir, "adjudication"), { recursive: true });
const input = {
  schemaVersion: 1,
  cohort: "open-development",
  queryCases: cases,
  documents,
  freezePolicy: {
    labelsSentToJev: false,
    oneSplitUnit: "sourceRef + exact sourceBytesSha256",
    useForThresholdTuning: "development-only",
    status: "frozen-before-live-Jev-calls",
  },
};
const inputText = JSON.stringify(input, null, 2) + "\n";
const inputHash = createHash("sha256").update(inputText).digest("hex");
const manifest = {
  schemaVersion: 1,
  runId: path.basename(runDir),
  createdAt: "2026-10-11T16:44:00Z",
  repositoryRoot: "D:/Dev/mssr",
  branch: "codex/mssr-librarian-query-variants-0.2.112",
  sourceCommit: "fc91bc8563d71036663648334c1bbcea7f06b41b",
  packageVersion: "0.2.125",
  runtime: { bridgeVersion: "0.6.169", mssrVersion: "0.2.121", productionMutation: false },
  cohort: "open-development",
  sourceClusterCount: documents.length,
  caseCount: cases.length,
  sourceRefs: documents.map(({ sourceRef, sourceBytesSha256 }) => ({ sourceRef, sourceBytesSha256 })),
  frozenInputs: [{ path: "inputs/cases.json", sha256: inputHash }],
  labelAuthority: "pending-blind-independent-review",
  providerCalls: 0,
  confidenceCalibrationClaim: false,
};
await writeFile(path.join(runDir, "inputs", "cases.json"), inputText, "utf8");
await writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
await writeFile(path.join(runDir, "PRECALL-SHA256SUMS"), inputHash + "  inputs/cases.json\n", "utf8");
console.log(JSON.stringify({ runDir, caseCount: cases.length, sourceClusterCount: documents.length, inputHash, sourceRefs: manifest.sourceRefs }, null, 2));
