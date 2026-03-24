const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const env = process.argv[2];
if (!["dev", "prod"].includes(env)) {
  console.error("Uso: node scripts/push.js [dev|prod]");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const envConfig = JSON.parse(fs.readFileSync(path.join(root, "environments.json"), "utf8"));
const claspPath = path.join(root, ".clasp.json");
const claspConfig = JSON.parse(fs.readFileSync(claspPath, "utf8"));

const targetId = envConfig[env].scriptId;

if (targetId.startsWith("PEGA_AQUI")) {
  console.error(`El scriptId de "${env}" no esta configurado. Actualiza environments.json`);
  process.exit(1);
}

const previousId = claspConfig.scriptId;
claspConfig.scriptId = targetId;
fs.writeFileSync(claspPath, JSON.stringify(claspConfig, null, 2) + "\n");

console.log(`-> Ambiente: ${env.toUpperCase()}`);
console.log(`-> Script ID: ${targetId.slice(0, 15)}...`);
console.log("");

try {
  execSync("clasp push --force", { cwd: root, stdio: "inherit" });
  console.log(`\nPush a ${env.toUpperCase()} completado.`);
} catch (err) {
  console.error(`\nError en push a ${env.toUpperCase()}.`);
  process.exit(1);
} finally {
  claspConfig.scriptId = previousId;
  fs.writeFileSync(claspPath, JSON.stringify(claspConfig, null, 2) + "\n");
}
