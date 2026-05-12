const { execSync } = require("child_process");
const {
  ROOT,
  loadEnvironments,
  assertEnv,
  assertScriptId,
  withClaspScriptId,
} = require("./_lib");

const env = process.argv[2];
assertEnv(env);

const envConfig = loadEnvironments();
const scriptId = assertScriptId(envConfig, env);

console.log(`Abriendo proyecto ${env.toUpperCase()} en el navegador...`);
console.log("Nota: el editor de Apps Script se abre solo para revisar logs o ejecutar funciones.");
console.log("Toda edicion de codigo sigue siendo desde Cursor + clasp.\n");

withClaspScriptId(scriptId, () => {
  try {
    execSync("clasp open", { cwd: ROOT, stdio: "inherit" });
  } catch (err) {
    console.error("Error al abrir el proyecto.");
    process.exit(1);
  }
});
