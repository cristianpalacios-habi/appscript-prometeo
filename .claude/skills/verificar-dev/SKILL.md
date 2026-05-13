---
name: verificar-dev
description: Valida el milestone implementado en 5 fases — revision de codigo, autoverificacion con el browser de Cursor, fix loop si encuentra problemas, checklist guiado al usuario, y marca como verificado. Itera con push a Apps Script DEV sin commits intermedios (los cambios se acumulan para que /promover-prod los commitee juntos).
---

# /verificar-dev

Ejecuta la fase de **verificacion** del loop. **No commitea ni promueve** — solo valida y itera. Si todo pasa, marca el milestone como verificado y queda listo para `/promover-prod`. Si algo falla, planea un fix mini-ciclo, lo implementa, lo sube a DEV y reanuda la verificacion.

## Cuando usar

- Despues de `/ejecutar-milestone` (codigo en Apps Script DEV, cambios sin commitear).
- El usuario dice: "validemos en dev", "verifica que funcione", "probemoslo", "revisemos".

## Las 5 fases

```
A. Revision estatica   →   B. Autoverificacion   →   C. Fix loop si falla
       (codigo)              (browser de Cursor)        (plan + ejecutar + deploy:dev)
                                                                  │
                                                                  ▼
                                                          D. Checklist guiado
                                                              al usuario
                                                                  │
                                                          E. Marcar verificado
                                                              (deploy:dev "VALIDADO")
```

## Pre-checks (aborta si falla)

```bash
test -f .planning/state.json
test -f environments.json
```

Lee `.planning/state.json`. Casos:

- **`status` ≠ `executed` y ≠ `verifying`** → segun valor:
  - `planning` / `planned` → "El milestone no esta implementado. Corre `/ejecutar-milestone` primero."
  - `executing` → "La implementacion no termino. Termina `/ejecutar-milestone`."
  - `promoted` / `closed` → "Milestone cerrado. Para re-validar, replanea o trata como debug."
- **`status` = `verifying`** → estamos retomando o iterando, eso es normal con esta skill.

Verifica `dev.scriptId` y el plan: `docs/milestones/<activeMilestone>-plan.md`.

**Nota sobre cambios sin commitear**: es ESPERADO que haya cambios pendientes (es como ejecutar-milestone deja el estado). NO obligues a commitear.

## Plan que anuncias al usuario

> Voy a verificar el milestone **`<milestone>`** en 5 fases:
>
> 1. **Revision estatica** — leo el codigo recien escrito y lo contrasto contra el plan, el PRD y las reglas de CLAUDE.md.
> 2. **Autoverificacion** — abro el editor de Apps Script DEV (y URLs relevantes — Sheet de salida, Web App si aplica) en el browser integrado de Cursor; ejecuto la funcion principal, leo logs, inspecciono outputs.
> 3. **Fix loop** — si la revision estatica o la autoverificacion encuentra problemas, planeo el fix, lo implemento, lo subo a DEV y vuelvo a verificar.
> 4. **Checklist contigo** — te guio paso a paso por el checklist del plan; tu confirmas cada item. Si algo falla, vamos al fix loop.
> 5. **Marcar como verificado** — registro un deployment versionado en DEV (`deploy:dev`), sincronizo `docs/IDS.md`, dejo el milestone listo para `/promover-prod`.
>
> **No commiteo nada en esta skill** — los cambios se acumulan y el commit se hace en `/promover-prod`.
>
> ¿Procedo?

Solo continua si aprueba.

## Fase A — Revision estatica del codigo

### A.1 Marcar inicio

```json
{ "status": "verifying", "lastUpdated": "<ISO now>" }
```

### A.2 Leer cambios pendientes

```bash
git status --short
git diff
```

Para cada archivo modificado o nuevo, revisa contra:

**1. Reglas de CLAUDE.md:**
- ¿Hay API keys / tokens hardcodeados? (deben venir de `PropertiesService`)
- ¿Hay archivo gigante con responsabilidades mezcladas?
- ¿Hay funciones que se nombran o organizan distinto a lo que dice el plan?

**2. Plan del milestone:**
- ¿Estan todos los archivos del plan implementados?
- ¿Falta algo de la lista de pasos?
- ¿Los nombres de funciones / parametros corresponden?

**3. PRD:**
- ¿La logica refleja el alcance del milestone?
- ¿Hay algo que se salio del scope?

**4. Buenas practicas Apps Script:**
- Triggers en funcion `installTriggers()` separada (no instalados en `main()`).
- Manejo de errores minimo en limites externos (`UrlFetchApp`, `SpreadsheetApp.openById`, etc.).
- Logs en `Logger.log()` con info util para debugging futuro.
- Sin `console.log` (en Apps Script V8 funciona, pero la convencion es `Logger.log`).
- Sin loops con llamadas a `SpreadsheetApp` repetidas (`getRange().getValue()` adentro del loop) — preferir batch.

**5. Sintaxis y manifest:**

```bash
for f in $(git diff --name-only -- '*.js' '*.gs'); do node --check "$f"; done
```

Verifica `appsscript.json` valido:

```bash
node -e "JSON.parse(require('fs').readFileSync('appsscript.json','utf8'))"
```

### A.3 Decision

- **Sin problemas**: pasa a Fase B.
- **Problemas encontrados**: ve a Fase C (Fix loop) con la lista de problemas. Indica al usuario que problemas encontraste y propon el plan del fix.

## Fase B — Autoverificacion con el browser de Cursor

El asistente ejecuta una validacion funcional propia antes de involucrar al usuario. Usa las herramientas de browser/preview disponibles en Cursor (Claude in Chrome, Claude Preview, o el browser nativo).

### B.1 Abrir editor de Apps Script DEV

Obten el URL del editor de DEV:

```bash
node -e "console.log('https://script.google.com/d/' + require('./environments.json').dev.scriptId + '/edit')"
```

Abre esa URL en el browser de Cursor (usa la herramienta de browser disponible). Espera a que cargue. Si requiere autenticacion, dirige al usuario:

> El browser pide autenticar con Google. Hazlo con tu cuenta Habi y dime cuando termine.

### B.2 Ejecutar la funcion principal

Identifica la funcion principal del milestone (la del entrypoint del plan; por default `main()`).

Si el browser permite interaccion programatica:
1. Selecciona la funcion en el dropdown del editor.
2. Pulsa Ejecutar.
3. Si pide autorizar permisos OAuth, autoriza con la cuenta del usuario (puede requerir interaccion humana — pausa y pide).
4. Espera a que termine.
5. Lee el panel de Registro de ejecuciones (logs).

Si el browser no permite interaccion programatica, guia al usuario a hacerlo manualmente, mientras tu te mantienes en autoverificacion con los outputs.

### B.3 Inspeccionar artefactos

Lee la seccion `## Artefactos a verificar` del plan (URLs de Sheets, Web App, recipientes de correo, etc.). Para cada uno:

- **Google Sheet**: abre el URL en el browser. Verifica que las hojas/columnas/filas esperadas existan y tengan los valores correctos.
- **Web App URL**: navega y verifica respuesta esperada.
- **Correos**: el asistente no puede leer la bandeja del usuario; pide al usuario que confirme la llegada en Fase D.
- **Logs**: ya leidos en B.2.

Captura screenshots si la herramienta lo permite, para registro.

### B.4 Decision

- **Todo se ve correcto**: pasa a Fase D (checklist con el usuario). No saltes D — la validacion final la hace siempre el usuario.
- **Algo no se ve correcto**: ve a Fase C con descripcion del problema observado.

## Fase C — Fix loop

Cuando A o B detectan un problema, ejecutas un mini-ciclo de fix sin salir de la skill.

### C.1 Reportar problema y proponer fix

> 🔧 Encontre un problema:
>
> **Sintoma**: <que vi>
> **Causa probable**: <hipotesis>
> **Plan del fix**:
> 1. ...
> 2. ...
> **Archivos a modificar**: <lista>
>
> ¿Apruebas el fix o ajustamos?

Espera aprobacion. Si pide ajustar, itera.

### C.2 Implementar el fix

Aplica los cambios. Misma logica que `/ejecutar-milestone`:
- Edit/Write sobre los archivos.
- `node --check` por archivo modificado.
- Sin commits, sin push a GitHub.

### C.3 Subir a Apps Script DEV (mismo deployment)

```bash
npm run deploy:dev -- --desc "<milestone> - <objetivo> (fix verificacion)"
```

Reutiliza el mismo `deploymentId` que se uso en `/ejecutar-milestone`. El URL del deployment de DEV no cambia — el humano refresca su pestana y ve el codigo actualizado.

### C.4 Documentar el fix en el plan

Agrega entrada en `docs/milestones/<milestone>-plan.md` al final, bajo `## Fixes durante verificacion`:

```markdown
## Fixes durante verificacion

- **<YYYY-MM-DD HH:MM>**: <sintoma>. Causa: <causa>. Fix: <descripcion> en `<archivo>`.
```

### C.5 Reanudar

Vuelve a la fase donde se detecto el problema (A o B). Repite hasta que la fase pase.

**Si despues de 3 ciclos de fix la misma fase sigue fallando**, pausa y replantea con el usuario:

> Llevo 3 intentos en este problema. Probablemente mi modelo del bug esta mal. ¿Hablamos del sintoma con mas detalle antes de seguir intentando?

## Fase D — Checklist guiado al usuario

Lee `## Checklist de verificacion (para /verificar-dev)` del plan. Para cada item, guia al usuario.

### D.1 Tipos de item

#### Ejecucion manual de funcion

> **Item**: <texto>
>
> 1. En el editor de DEV (ya abierto en el browser), selecciona `<funcion>` en el dropdown.
> 2. Pulsa Ejecutar.
> 3. Confirma si pasa lo esperado: `<criterio>`.
> 4. Dime "ok", "no ok", o pega el error.

#### Trigger time-driven

> **Item**: <texto>
>
> Dos opciones:
>
> **A — Inmediata** (recomendada): ejecuta la funcion subyacente `<nombre>` directamente para simular lo que el trigger hara.
>
> **B — Realista**: ejecuta `installTriggers()` para instalar el trigger en DEV, espera al horario natural, vuelve cuando se ejecute.
>
> ¿Cual? Para validacion del primer milestone, recomiendo A.

#### Side-effect observable

> **Item**: <texto>
>
> Despues de ejecutar la funcion:
> 1. Revisa <correo destino / hoja Y>.
> 2. Confirma que el efecto esperado ocurrio.

### D.2 Si el usuario reporta falla

Ve a Fase C (Fix loop) con la info del usuario. Tras el fix, retoma el item del checklist.

### D.3 Cuando el usuario confirme todos los items

Pasa a Fase E.

## Fase E — Marcar como verificado

### E.1 Actualizar el deployment de DEV con descripcion "VALIDADO"

A lo largo de `/ejecutar-milestone` y de los fixes de Fase C, el `deploymentId` de DEV se ha venido actualizando (mismo ID, codigo nuevo). Ahora que el milestone esta validado, hacemos un ultimo `deploy:dev` para que la descripcion en la consola de Apps Script refleje el estado "VALIDADO":

Construye descripcion sugerida:

```
<milestone> - VALIDADO - <objetivo del plan, max 60 char>
```

Pregunta:

> Voy a actualizar la descripcion del deployment de DEV para marcarlo como validado:
> > `<descripcion sugerida>`
>
> ¿La uso?

Ejecuta:

```bash
npm run deploy:dev -- --desc "<descripcion final>"
```

**El `deploymentId` y URL no cambian** — sigue siendo el mismo deployment estable de DEV. Lo unico que cambia en `environments.json` son `deploymentDescription` y `deployedAt`.

### E.2 Sincronizar docs/IDS.md

Lee `environments.json` y reescribe `docs/IDS.md` (gitignored) con la tabla de IDs actualizada.

### E.3 Actualizar estado

```json
{
  "status": "verified",
  "verifiedAt": "<ISO now>",
  "lastUpdated": "<ISO now>"
}
```

### E.4 Cierre

> Verificacion de `<milestone>` completa ✓
>
> **Fase A — Revision estatica**: paso ✓
> **Fase B — Autoverificacion**: paso ✓
> **Fixes durante verificacion**: <n> (registrados en el plan)
> **Fase D — Checklist del usuario**: paso ✓
> **Deployment DEV**: `<deploymentId>` — `<descripcion>`
> **docs/IDS.md**: sincronizado
>
> **Cambios sin commitear**: visibles en el panel Source Control de Cursor.
>
> Siguiente paso: `/promover-prod` cuando estes listo para mover este milestone a produccion. Esa skill hace el commit unico, lo sube a GitHub (`dev` y `main`) y despliega a Apps Script PROD.

## Errores comunes y como manejarlos

- **Autorizacion OAuth pendiente** en la primera ejecucion → el usuario debe aprobar en el dialogo del editor. Es normal, no es error.
- **Trigger no se ejecuta en horario esperado** → revisar `timeZone` en `appsscript.json` (`"America/Bogota"`).
- **`PropertiesService` retorna null** → propiedad no configurada en DEV. Pausa, recuerda al usuario configurarla en Settings, retoma.
- **Logs vacios despues de ejecutar** → panel de Registro de ejecuciones cerrado o el usuario ejecuto otra funcion. Reabre.
- **Fix loop entra en circulo** (mismo sintoma despues de 3 intentos) → replantear con el usuario.

## Que NO hacer

- **No commitees**. Esto es responsabilidad de `/promover-prod`.
- **No hagas `git push` a GitHub.** Tambien de `/promover-prod`.
- **No despliegues a PROD ni corras `npm run promote`.** Esta skill solo toca DEV.
- No edites codigo en el editor web. Si el usuario reporta que edito ahi, reorientalo: el cambio se hace en local y vuelve a `npm run deploy:dev`.
- No marques `status: "verified"` si algun item del checklist no paso.
- No saltes Fase D — la validacion final con el usuario es obligatoria. Tu autoverificacion (B) es complemento, no reemplazo.
- No instales triggers automaticamente. `installTriggers()` se ejecuta manualmente.
- No corras `clasp deploy` directo; usa `npm run deploy:dev` para que registre el `deploymentId` en `environments.json`.
