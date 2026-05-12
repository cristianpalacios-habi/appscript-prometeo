const { execSync } = require("child_process");
const {
  ROOT,
  loadEnvironments,
  saveEnvironments,
  assertScriptId,
  withClaspScriptId,
  timestamp,
  parseDescriptionFromArgs,
  parseDeploymentIdFromOutput,
} = require("./_lib");

const args = process.argv.slice(2);

const envConfig = loadEnvironments();
assertScriptId(envConfig, "dev");
const prodScriptId = assertScriptId(envConfig, "prod");

if (!envConfig.dev?.deploymentId) {
  console.warn(
    "Aviso: dev no tiene deploymentId registrado. Promueves el codigo local actual."
  );
  console.warn("Si querias promover una version validada de dev, primero corre: npm run deploy:dev\n");
}

const description =
  parseDescriptionFromArgs(args) ||
  `PROD promote ${timestamp()}${envConfig.dev?.deploymentDescription ? ` (desde dev: ${envConfig.dev.deploymentDescription})` : ""}`;

console.log("-> Promoviendo a PROD");
console.log(`-> Script ID prod: ${prodScriptId.slice(0, 15)}...`);
console.log(`-> Descripcion: ${description}`);
console.log("");

withClaspScriptId(prodScriptId, () => {
  try {
    execSync("clasp push --force", { cwd: ROOT, stdio: "inherit" });
    console.log("");

    const out = execSync(`clasp deploy --description ${JSON.stringify(description)}`, {
      cwd: ROOT,
      encoding: "utf8",
    });
    process.stdout.write(out);

    const deploymentId = parseDeploymentIdFromOutput(out);
    if (deploymentId) {
      envConfig.prod.deploymentId = deploymentId;
      envConfig.prod.deploymentDescription = description;
      envConfig.prod.deployedAt = timestamp();
      saveEnvironments(envConfig);
      console.log(`\nPromocion a PROD completada.`);
      console.log(`Deployment ID guardado en environments.json: ${deploymentId}`);
    } else {
      console.warn("\nNo se pudo extraer el deploymentId del output de clasp. Revisa manualmente.");
    }
  } catch (err) {
    console.error("\nError en promocion a PROD.");
    process.exit(1);
  }
});
