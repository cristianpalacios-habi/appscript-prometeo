---
name: promover-prod
description: Cierra el milestone verificado. Hace UN solo commit con todos los cambios acumulados, lo sube a las ramas dev y main en GitHub en ese orden, y por ultimo despliega a Apps Script PROD via npm run promote. Crea tag de git, smoke test minimo y cierra el milestone en el estado del proyecto.
---

# /promover-prod

Cierra el milestone validado. Es la unica skill del loop que **commitea**, **sube a GitHub** y **toca PROD**. Lo hace en este orden exacto:

```
1. Commit del milestone (un solo commit, todos los cambios)
2. Push a rama `dev` en GitHub      ← checkpoint pre-prod
3. Push a rama `main` en GitHub     ← canonical
4. Apps Script PROD (npm run promote)
5. Tag git + smoke test + cierre del milestone
```

## Cuando usar

- Despues de `/verificar-dev` con `status: "verified"`.
- El usuario dice: "promueve a prod", "vamos a produccion", "saquemoslo a prod".

## Pre-checks (aborta si falla)

```bash
test -f .planning/state.json
test -f environments.json
```

Lee `.planning/state.json`. Casos:

- **`status` ≠ `verified`** → segun valor:
  - `planning` / `planned` / `executing` → "El milestone no esta validado. Corre `/ejecutar-milestone` y luego `/verificar-dev`."
  - `verifying` → "La verificacion no termino. Termina con `/verificar-dev`."
  - `promoted` / `closed` → "Este milestone ya esta en prod. ¿Re-promover o avanzar con `/nuevo-milestone`?"
- **`failedChecks` no vacio** → "Hay items del checklist sin pasar: <lista>. No promuevo hasta resolver. Vuelve a `/verificar-dev`."

Lee `environments.json`:

- `dev.deploymentId` debe existir (señal de DEV validado con deployment versionado).
- `prod.scriptId` debe estar configurado.

Si falta algo → diagnostica y dirige a la skill correspondiente.

Verifica que hay cambios pendientes para commitear (es lo esperado):

```bash
git status --porcelain
```

- Si vacio → "No hay cambios para promover. ¿Olvidaste `/ejecutar-milestone` o ya promoviste este milestone?"
- Si hay cambios → ok, sigue.

Verifica que estamos en la rama `main` local:

```bash
git branch --show-current
```

- Si no es `main` → "Estas en `<rama>`. El flujo Prometeo trabaja sobre `main` local. ¿Cambio a main o tienes contexto que justifique trabajar en otra rama?"

Verifica que las ramas remotas `dev` y `main` existen:

```bash
git ls-remote --heads origin dev main
```

- Si falta `dev` remota → la skill la crea en el paso 3 (no es error).
- Si falta `main` remota → "El repo no tiene rama `main` en GitHub. Revisa `/config-appsscript` o crea manualmente con `git push -u origin main`."

## Plan que anuncias al usuario

> Voy a promover **`<milestone>`** a PROD. El flujo es:
>
> 1. Configurar las propiedades de Script en PROD (probablemente con valores distintos a DEV — destinatarios reales, API keys de produccion).
> 2. Hacer **un solo commit** con todos los cambios del milestone.
> 3. Subir el commit a la rama `dev` en GitHub (checkpoint pre-produccion).
> 4. Subir a la rama `main` en GitHub (canonical).
> 5. Desplegar a Apps Script PROD con `npm run promote`.
> 6. Smoke test minimo opcional en PROD.
> 7. Crear tag de git `<milestone>-prod-<YYYYMMDD>` y cerrar el milestone.
>
> ⚠️ **Lo que pase en PROD tiene consecuencias reales** (correos reales, hojas reales, datos del negocio). Una vez promovido, modificar PROD solo se hace replicando el cambio en DEV → verificando → promoviendo de nuevo.
>
> ¿Procedo?

Solo continua si aprueba.

## Pasos detallados

### 1. Configurar propiedades de Script en PROD

Lee la seccion `## Property Service (claves a configurar)` del plan.

Si hay claves:

> Estas son las propiedades que el codigo usa. Tu las configuraste en DEV con valores de prueba. En PROD necesitas valores **reales**:
>
> | Clave | Que tipicamente cambia entre DEV y PROD |
> | --- | --- |
> | `RECIPIENT_EMAIL` | Destinatario real vs tu correo de prueba |
> | `SHEET_ID` | Hoja real de operacion vs hoja de prueba |
> | `API_KEY_*` | Key de produccion vs key de desarrollo |
>
> Voy a abrir Settings de PROD. Verifica/configura cada clave con su valor de PRODUCCION. No edites codigo — solo Settings. Vuelve a Cursor y confirma.

Abre Settings de PROD:

```bash
PROD_SCRIPT_ID=$(node -e "console.log(require('./environments.json').prod.scriptId)")
open "https://script.google.com/home/projects/$PROD_SCRIPT_ID/settings" 2>/dev/null || \
  xdg-open "https://script.google.com/home/projects/$PROD_SCRIPT_ID/settings" 2>/dev/null || \
  echo "Abre manualmente: https://script.google.com/home/projects/$PROD_SCRIPT_ID/settings"
```

**Espera confirmacion del usuario. No avances hasta que confirme.**

Si no hay claves en el plan, salta este paso.

### 2. Hacer el commit unico

Muestra al usuario el resumen de cambios:

```bash
git status --short
git diff --stat
```

> Resumen de cambios del milestone:
> - `Main.js` (modificado, +12)
> - `Sheets.js` (nuevo, 45 lineas)
> - `appsscript.json` (modificado, +1 scope)
> - `docs/milestones/<milestone>-plan.md` (con desviaciones y fixes documentados)
> - `.planning/state.json`
>
> Voy a commitear todo esto como **un solo commit**. Mensaje sugerido:
> > `feat(<milestone>): <objetivo del plan>`
>
> ¿Apruebas o quieres ajustar el mensaje?

Espera respuesta.

Lee del plan el `## Objetivo` (1 frase). Construye:

```
feat(<milestone>): <objetivo>

- archivo1: cambio principal
- archivo2: cambio principal
- ...

Plan: docs/milestones/<milestone>-plan.md
```

Stage todo lo no-gitignored:

```bash
git add -A
```

Commit:

```bash
git commit -m "$(cat <<'EOF'
feat(<milestone>): <objetivo>

- <archivo1>: <cambio>
- <archivo2>: <cambio>

Plan: docs/milestones/<milestone>-plan.md
EOF
)"
```

Marca status:

```json
{ "status": "promoting", "lastUpdated": "<ISO now>" }
```

### 3. Push a rama `dev` en GitHub

```bash
if git ls-remote --heads origin dev | grep -q dev; then
  # dev existe en remoto
  git push origin main:dev
else
  # primera vez: crea la rama remota dev a partir del estado local actual
  git push origin main:refs/heads/dev
fi
```

Si falla por divergencia (raro pero posible si alguien mas escribio en `dev` remoto):

> La rama `dev` remota tiene commits que tu local no tiene. Necesitamos resolver antes de promover.
>
> Opciones:
> - Si confias en que tu version es la correcta: `git push --force origin main:dev` (sobrescribe). Te aviso porque es destructivo.
> - Si necesitas integrar los cambios remotos: paramos aqui y diagnosticamos.

**No hagas force push sin aprobacion explicita del usuario.**

### 4. Push a rama `main` en GitHub

```bash
git push origin main:main
```

Mismo manejo de divergencia con aprobacion explicita si falla.

### 5. Desplegar a Apps Script PROD

Construye descripcion del deployment:

```
<milestone> - PROD - <objetivo, max 60 char> - <YYYY-MM-DD HH:MM>
```

Pregunta:

> Voy a desplegar a PROD con esta descripcion:
> > `<descripcion sugerida>`
>
> ¿La uso?

Ejecuta:

```bash
npm run promote -- --desc "<descripcion final>"
```

Verifica que `environments.json` quedo con nuevo `prod.deploymentId`.

Si falla:
- **Apps Script API not enabled en prod** → guia a `script.google.com/home/usersettings`.
- **Otro error** → diagnostica antes de avanzar. **No marques como promovido si fallo.**

### 6. Smoke test minimo en PROD

⚠️ Pregunta antes de ejecutar — la funcion principal puede tener efectos reales.

> Smoke test en PROD: dos opciones.
>
> **A — Solo verificar deployment**: confirmo via `clasp deployments` que el nuevo deploymentId esta listado. Sin efectos.
>
> **B — Ejecutar funcion principal**: abro el editor de PROD, ejecutas `<funcion>`, validamos que arranca sin errores. **Efectos reales** (correos, hojas).
>
> ¿Cual prefieres?

#### Si elige A

Verifica deployments en PROD sin alterar `.clasp.json` permanentemente:

```bash
PROD_SCRIPT_ID=$(node -e "console.log(require('./environments.json').prod.scriptId)")
node -e "
  const { execSync } = require('child_process');
  const fs = require('fs');
  const clasp = JSON.parse(fs.readFileSync('.clasp.json', 'utf8'));
  const prev = clasp.scriptId;
  clasp.scriptId = '$PROD_SCRIPT_ID';
  fs.writeFileSync('.clasp.json', JSON.stringify(clasp, null, 2));
  try {
    execSync('clasp deployments', { stdio: 'inherit' });
  } finally {
    clasp.scriptId = prev;
    fs.writeFileSync('.clasp.json', JSON.stringify(clasp, null, 2));
  }
"
```

Confirma con el usuario que ve el nuevo deploymentId.

#### Si elige B

```bash
npm run open:prod
```

Guia al usuario igual que `/verificar-dev` Fase D. Si arranca sin error: pasa. Si falla:

```json
{ "status": "promoted-but-broken", "lastUpdated": "<ISO now>" }
```

Aviso:

> Smoke test en PROD fallo. Esto es serio: PROD ya tiene el codigo desplegado pero no funciona. Acciones:
> 1. Si es propiedad faltante, configurala (paso 1) y reintenta.
> 2. Si es bug en codigo, vuelve a `/debug-error` — el fix arranca un nuevo mini-milestone.
> 3. No desinstales triggers ni asumas que prod esta operando.

### 7. Crear tag de git

```bash
TAG="<milestone>-prod-$(date +%Y%m%d)"
git tag -a "$TAG" -m "Promocion a PROD: <milestone> - <objetivo>"
```

Pregunta al usuario si sube el tag:

> Tag local `<TAG>` creado. ¿Lo subo a GitHub?

Si si:

```bash
git push origin "$TAG"
```

### 8. Cerrar el milestone en el estado

Actualiza `.planning/state.json`:

```json
{
  "activeMilestone": "<milestone>",
  "status": "promoted",
  "promotedAt": "<ISO now>",
  "lastUpdated": "<ISO now>",
  "history": [
    ...entradas previas,
    {
      "milestone": "<milestone>",
      "closedAt": "<YYYY-MM-DD>",
      "deploymentIdDev": "<dev.deploymentId>",
      "deploymentIdProd": "<prod.deploymentId>",
      "tag": "<TAG>",
      "commit": "<git rev-parse HEAD>"
    }
  ]
}
```

### 9. Sincronizar docs/IDS.md

Lee `environments.json` y reescribe `docs/IDS.md` con los nuevos valores de PROD.

### 10. Commit de cierre (estado + IDS)

`.planning/state.json` quedo modificado tras paso 8. Hacer un mini-commit de cierre:

```bash
git add .planning/state.json
git commit -m "chore(<milestone>): registrar promocion a PROD"
git push origin main:main
git push origin main:dev
```

### 11. Cierre

> `<milestone>` promovido a PROD ✓
>
> **Commit del milestone**: `<hash corto>` — `feat(<milestone>): <objetivo>`
> **GitHub**:
>   - rama `dev`: actualizada ✓
>   - rama `main`: actualizada ✓
> **Apps Script PROD**: deployment `<deploymentId>` — `<descripcion>` ✓
> **Smoke test**: <A o B, resultado>
> **Tag git**: `<TAG>` (subido a GitHub: si/no)
>
> **Acciones manuales pendientes**:
> - Instalar triggers en PROD si el milestone los requiere (ejecuta `installTriggers()` una vez desde el editor de PROD).
> - Avisar al equipo / stakeholders.
> - Si era el ultimo milestone: medir el KPI definido en el PRD y comparar con la meta.
>
> Si hay mas milestones pendientes, corre `/nuevo-milestone` para arrancar el siguiente.

## Errores comunes y como manejarlos

- **Propiedades de PROD con valores de DEV** → el usuario olvido cambiarlos. Si el smoke test B lo expone, alerta inmediatamente.
- **Tag de git ya existe** → agrega sufijo `-v2` o pregunta.
- **Push de tag falla por permisos** → notifica pero no bloquea; el tag local sigue util.
- **`dev` o `main` remoto divergen** → no fuerces, pregunta al usuario.
- **`clasp deployments` no muestra el nuevo deploymentId** → revisa logs de `promote.js`.

## Que NO hacer

- No promuevas sin `status: "verified"` previo.
- No edites codigo en esta skill. Si hay que cambiar algo, vuelves a `/debug-error` o `/ejecutar-milestone`.
- No ejecutes funciones destructivas o masivas como "smoke test" en PROD sin advertir.
- No hagas `git push --force` sin aprobacion explicita del usuario.
- No hagas `git push --delete` de tags.
- No marques `status: "promoted"` si el smoke test fallo.
- No ofrezcas rollback automatico — para usuario no-tecnico, el flujo seguro es fix en dev → verificar → promover de nuevo.
- No instales triggers automaticamente al promover. Que el usuario los instale conscientemente.
- **No saltes el orden**: primero commit, despues `dev`, despues `main`, despues PROD. No al reves, no en paralelo.
