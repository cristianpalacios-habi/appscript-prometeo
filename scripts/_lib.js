const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, "environments.json");
const CLASP_PATH = path.join(ROOT, ".clasp.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function loadEnvironments() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error("No existe environments.json. Copia environments.example.json y configura tus IDs.");
    process.exit(1);
  }
  return readJson(ENV_PATH);
}

function saveEnvironments(data) {
  writeJson(ENV_PATH, data);
}

function assertEnv(env) {
  if (!["dev", "prod"].includes(env)) {
    console.error("Ambiente invalido. Usa: dev | prod");
    process.exit(1);
  }
}

function assertScriptId(envConfig, env) {
  const id = envConfig?.[env]?.scriptId;
  if (!id || id.startsWith("PEGA_AQUI")) {
    console.error(`El scriptId de "${env}" no esta configurado en environments.json`);
    process.exit(1);
  }
  return id;
}

function withClaspScriptId(scriptId, fn) {
  const clasp = readJson(CLASP_PATH);
  const previous = clasp.scriptId;
  clasp.scriptId = scriptId;
  writeJson(CLASP_PATH, clasp);
  try {
    return fn();
  } finally {
    clasp.scriptId = previous;
    writeJson(CLASP_PATH, clasp);
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDescriptionFromArgs(args) {
  const i = args.indexOf("--desc");
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return null;
}

function parseDeploymentIdFromOutput(stdout) {
  const match = stdout.match(/-\s*(AKfyc[\w-]+)/);
  return match ? match[1] : null;
}

module.exports = {
  ROOT,
  ENV_PATH,
  CLASP_PATH,
  readJson,
  writeJson,
  loadEnvironments,
  saveEnvironments,
  assertEnv,
  assertScriptId,
  withClaspScriptId,
  timestamp,
  parseDescriptionFromArgs,
  parseDeploymentIdFromOutput,
};
