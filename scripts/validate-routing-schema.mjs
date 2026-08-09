#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";

const [schemaPath, instancePath] = process.argv.slice(2);
if (!schemaPath || !instancePath) {
  console.log(JSON.stringify({ valid: false, errors: [], fatal: "usage: validate-routing-schema.mjs <schema> <instance>" }));
  process.exit(2);
}

try {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const instance = JSON.parse(fs.readFileSync(instancePath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateSchema: true });
  if (!ajv.validateSchema(schema)) {
    const errors = (ajv.errors ?? []).map((error) => `schema${error.instancePath || "/"}: ${error.message}`);
    console.log(JSON.stringify({ valid: false, errors, fatal: "routing schema is invalid" }));
    process.exit(2);
  }
  const validate = ajv.compile(schema);
  const valid = validate(instance);
  const errors = (validate.errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    const detail = error.params?.additionalProperty ? ` (${error.params.additionalProperty})` : "";
    return `${location}: ${error.message}${detail}`;
  });
  console.log(JSON.stringify({ valid, errors }));
  process.exit(valid ? 0 : 1);
} catch (error) {
  console.log(JSON.stringify({ valid: false, errors: [], fatal: error instanceof Error ? error.message : "schema validation failed" }));
  process.exit(2);
}
