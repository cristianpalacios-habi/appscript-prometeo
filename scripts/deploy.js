const { execSync } = require("child_process");
const {
  ROOT,
  loadEnvironments,
  saveEnvironments,
  assertEnv,
  assertScriptId,
  withClaspScriptId,
  timestamp,
  parseDescriptionFromArgs,
  parseDeploymentIdFromOutput,
} = require("./_lib");

const args = process.argv.slice(2);
const env = args[0];
assertEnv(env);

const envConfig = loadEnvironments();
const scriptId = assertScriptId(envConfig, env);

const description =
  parseDescriptionFromArgs(args) || `${env.toUpperCase()} deploy ${timestamp()}`;

console.log(`-> Ambiente: ${env.toUpperCase()}`);
console.log(`-> Script ID: ${scriptId.slice(0, 15)}...`);
console.log(`-> Descripcion: ${description}`);
console.log("");

withClaspScriptId(scriptId, () => {
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
      envConfig[env].deploymentId = deploymentId;
      envConfig[env].deploymentDescription = description;
      envConfig[env].deployedAt = timestamp();
      saveEnvironments(envConfig);
      console.log(`\nDeploy a ${env.toUpperCase()} completado.`);
      console.log(`Deployment ID guardado en environments.json: ${deploymentId}`);
    } else {
      console.warn(
        "\nNo se pudo extraer el deploymentId del output de clasp. Revisa manualmente."
      );
    }
  } catch (err) {
    console.error(`\nError en deploy a ${env.toUpperCase()}.`);
    process.exit(1);
  }
});
