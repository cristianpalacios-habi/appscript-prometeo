---
name: promover-prod
description: Promueve el milestone validado en DEV a PROD. Verifica que las propiedades de Script en PROD esten configuradas, despliega via npm run promote, hace un smoke test minimo en PROD, crea un tag de git y cierra el milestone en el estado del proyecto.
---

# /promover-prod

Ejecuta la fase de **promocion** del loop. Mueve a PROD el codigo validado en DEV, sin modificarlo. Cierra el milestone activo y deja trazabilidad para auditoria.

## Cuando usar

- Despues de `/verificar-dev` con todos los items del checklist pasando.
- El usuario dice: "promueve a prod", "vamos a produccion", "saquemoslo a prod", "subelo a prod".

## Pre-checks (aborta si falla)

```bash
test -f .planning/state.json
test -f environments.json
```

Lee `.planning/state.json`. Casos:

- **`activeMilestone` vacio** → "No hay milestone activo."
- **`status` ≠ `verified`** → segun valor:
  - `planning` / `planned` / `executing` → "El milestone no esta validado. Corre `/ejecutar-milestone` y luego `/verificar-dev`."
  - `verifying` → "La verificacion no termino. Termina el checklist con `/verificar-dev` primero."
  - `promoted` o `closed` → "Este milestone ya esta en prod. ¿Quieres re-promover (raro) o avanzar al siguiente con `/nuevo-milestone`?"
- **`failedChecks` no vacio** → "Hay items del checklist que no pasaron: <lista>. No promuevo hasta resolver. Corre `/debug-error`."

Lee `environments.json`:

- `dev.deploymentId` debe existir (señal de DEV validado).
- `prod.scriptId` debe estar configurado.

Si falta algo → diagnostica y dirige a la skill correspondiente.

Verifica repo limpio:

```bash
git status --porcelain
```

Si hay cambios → "Hay cambios sin commitear. PROD debe reflejar exactamente lo validado en DEV. Commitea o descarta antes de promover."

Verifica que el ultimo commit corresponda al milestone:

```bash
git log -1 --format=%s
```

Idealmente arranca con `feat(<milestone>):`. Si no, alerta pero no bloquea — pregunta al usuario si esta seguro.

## Plan que anuncias al usuario

> Voy a promover **`<milestone>`** de DEV a PROD. El flujo es:
> 1. Configurar las propiedades de Script en PROD (probablemente con valores DISTINTOS a DEV — destinatarios reales, API keys de produccion).
> 2. Desplegar el codigo a PROD con `npm run promote`.
> 3. Smoke test minimo en PROD: ejecutar la funcion principal y confirmar que arranca sin errores.
> 4. Crear un tag de git para trazabilidad: `<milestone>-prod-<YYYYMMDD>`.
> 5. Cerrar el milestone en el estado del proyecto.
>
> ⚠️ **Lo que pase en PROD tiene consecuencias reales** (correos reales, hojas reales, datos del negocio). Una vez promovido, modificar PROD solo se hace replicando el cambio en DEV → verificando → promoviendo de nuevo.
>
> ¿Procedo?

Solo continua si aprueba.

## Pasos detallados

### 1. Configurar propiedades de Script en PROD

Lee la seccion `## Property Service (claves a configurar)` del plan (`docs/milestones/<milestone>-plan.md`).

Si hay claves:

> Estas son las propiedades que el codigo usa. Tu las configuraste en DEV con valores de prueba. En PROD necesitas valores **reales**:
>
> | Clave | Que tipicamente cambia entre DEV y PROD |
> | --- | --- |
> | `RECIPIENT_EMAIL` | Destinatario real vs tu correo de prueba |
> | `SHEET_ID` | Hoja real de operacion vs hoja de prueba |
> | `API_KEY_*` | Key de produccion vs key de desarrollo |
>
> Voy a abrir la pantalla de Script Properties en PROD. Por favor:
> 1. Verifica/configura cada clave con su valor de produccion.
> 2. No edites codigo — solo Settings.
> 3. Vuelve a Cursor y confirma "listo".

Abre Settings de PROD:

```bash
PROD_SCRIPT_ID=$(node -e "console.log(require('./environments.json').prod.scriptId)")
open "https://script.google.com/home/projects/$PROD_SCRIPT_ID/settings" 2>/dev/null || \
  xdg-open "https://script.google.com/home/projects/$PROD_SCRIPT_ID/settings" 2>/dev/null || \
  echo "Abre manualmente: https://script.google.com/home/projects/$PROD_SCRIPT_ID/settings"
```

**Espera la confirmacion del usuario. No avances hasta que confirme.**

Si no hay claves en el plan, salta este paso.

### 2. Marcar inicio de promocion

Actualiza `.planning/state.json`:

```json
{
  "status": "promoting",
  "lastUpdated": "<ISO now>"
}
```

### 3. Construir descripcion del deployment de PROD

Lee:

- `## Objetivo` del plan.
- `activeMilestone` de state.json.
- `dev.deploymentDescription` de environments.json (para referencia).

Sugiere:

```
<milestone> - PROD - <objetivo, max 60 caracteres> - <YYYY-MM-DD HH:MM>
```

Pregunta:

> Voy a desplegar a PROD con esta descripcion:
> > `<descripcion sugerida>`
>
> ¿La uso?

### 4. Promover a PROD

```bash
npm run promote -- --desc "<descripcion final>"
```

Captura output. Verifica que `environments.json` quedo con nuevo `prod.deploymentId`.

Si falla:
- **Apps Script API not enabled en prod** → guia al usuario a `script.google.com/home/usersettings`.
- **Otro error** → diagnostica antes de avanzar. **No marques como promovido si fallo.**

### 5. Smoke test minimo en PROD

⚠️ **Pregunta antes de ejecutar:** la funcion principal puede tener efectos reales (correos a destinatarios reales, modificacion de hojas de operacion).

> Smoke test en PROD: dos opciones.
>
> **Opcion A — solo verificar deployment** (sin ejecutar funciones):
>   Confirmo que el deployment existe en PROD via `clasp deployments`. No ejecuto nada. Rapido y sin efectos.
>
> **Opcion B — ejecutar funcion principal en PROD** (efectos reales):
>   Abro el editor de PROD, ejecutas `<funcion>`, validamos que arranca sin errores. **Esto va a mandar correos / modificar hojas reales.** Solo recomendable si:
>   - Es la primera vez que algo del proyecto llega a PROD (smoke test inicial).
>   - El milestone es seguro de ejecutar (no destructivo, no masivo).
>   - Quieres validacion end-to-end inmediata, no esperar al trigger natural.
>
> ¿Cual prefieres?

#### Si elige A

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

Confirma con el usuario que ve el nuevo deploymentId listado.

#### Si elige B

```bash
npm run open:prod
```

Guia al usuario igual que en `/verificar-dev` paso 6:

> 1. Selecciona `<funcion>` en el dropdown.
> 2. Pulsa Ejecutar.
> 3. Confirma si arranca sin error o pega el error.

**Si arranca sin error**: smoke test pasa.

**Si falla**: marca el milestone como roto en prod:

```json
{
  "status": "promoted-but-broken",
  "lastUpdated": "<ISO now>"
}
```

Y dirige al usuario:

> El smoke test en PROD fallo. Esto es serio porque PROD ya tiene el codigo desplegado pero no esta funcionando. Acciones:
>
> 1. Si el error es por propiedad faltante, configurala (paso 1 de esta skill) y reintenta el smoke test.
> 2. Si el error es por bug en codigo, hay que tratarlo como bug en prod: vuelve a DEV (`/debug-error`), arregla, valida, promueve.
> 3. Mientras tanto, **no desinstales triggers ni asumas que prod esta operando** — esta desplegado pero no validado.

### 6. Crear tag de git

```bash
TAG="<milestone>-prod-$(date +%Y%m%d)"
git tag -a "$TAG" -m "Promocion a PROD: <milestone> - <objetivo del plan>"
```

Pregunta al usuario:

> Hice el tag `<TAG>` localmente. ¿Lo subo a GitHub para que quede registro?

Si si:

```bash
git push origin "$TAG"
```

### 7. Cerrar el milestone en el estado

Lee `.planning/state.json`. Actualiza:

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
      "tag": "<TAG>"
    }
  ]
}
```

### 8. Sincronizar docs/IDS.md

Igual que en `/verificar-dev`: lee `environments.json` y reescribe `docs/IDS.md` con los nuevos valores de PROD.

### 9. Cierre

> `<milestone>` promovido a PROD ✓
>
> **Deployment PROD**: `<deploymentId>` — `<descripcion>`
> **Tag git**: `<TAG>` (subido a GitHub: si/no)
> **Smoke test**: <opcion A o B, resultado>
> **Historico**: registrado en `.planning/state.json`
>
> **Acciones manuales que puedes querer hacer ahora**:
> - Instalar triggers en PROD si el milestone los requiere (ejecuta `installTriggers()` desde el editor de PROD una sola vez).
> - Avisar al equipo / stakeholders.
> - Si era el ultimo milestone del proyecto: **medir el KPI definido en el PRD** y comparar con la meta.
>
> Si hay mas milestones pendientes, corre `/nuevo-milestone` para arrancar el siguiente.

## Errores comunes y como manejarlos

- **Propiedades de PROD con valores de DEV** → el usuario olvido cambiarlos. Los efectos pueden ser graves (correos al destinatario de prueba en lugar del real, escritura en hoja equivocada). Si lo detectas en el smoke test, alerta inmediatamente.
- **Tag de git ya existe** → `<milestone>-prod-<fecha>` puede chocar si re-promueves el mismo dia. Agrega sufijo `-v2` o pregunta al usuario.
- **Push de tag falla** → el usuario no tiene permisos de push tags. Notifica pero no bloquea — el tag local sigue siendo util.
- **`clasp deployments` no muestra el nuevo deploymentId** → el deploy fallo silencioso. Revisa logs de `promote.js`.

## Que NO hacer

- No promuevas sin `status: "verified"` previo.
- No edites codigo (ni en local ni en prod) dentro de esta skill. Si necesitas cambiar algo, vuelves a `/ejecutar-milestone` o `/debug-error`.
- No ejecutes funciones destructivas o masivas como "smoke test" en PROD sin advertir al usuario.
- No hagas `git push --force` ni `--delete` de tags. Si algo sale mal, dejalo y diagnostica.
- No marques `status: "promoted"` si el smoke test fallo.
- No ofrezcas rollback automatico. Rollback en Apps Script es complejo (deploymentId previo en PROD existe pero los triggers ya estan en HEAD); para usuario no-tecnico, el flujo seguro es: fix en dev → verificar → promover de nuevo.
- No instales triggers automaticamente al promover. Que el usuario los instale conscientemente (es accion con efectos reales).
