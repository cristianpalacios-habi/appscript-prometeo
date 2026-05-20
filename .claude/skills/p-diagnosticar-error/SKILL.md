---
name: p-diagnosticar-error
description: Diagnostica y arregla errores en codigo de Apps Script siguiendo metodo cientifico simple. Lee logs del ambiente correcto, propone hipotesis, aplica fix en local, re-despliega a DEV. Si el bug esta en PROD, lo trata como mini-milestone de emergencia (fix en dev primero, nunca editar prod directo).
---

# /p-diagnosticar-error

Diagnostica fallos y los arregla manteniendo el flujo correcto (local → dev → prod). **Nunca edita codigo en el editor web.** Nunca toca prod directamente, ni siquiera para "un fix rapidito".

## Cuando usar

- Una funcion fallo en DEV durante `/p-verificar-dev`.
- Un trigger en PROD se rompio o produjo resultados incorrectos.
- El usuario dice: "esto no funciona", "fallo", "me sale este error", "el resultado no es el que espero".

## Pre-checks

```bash
test -f .planning/state.json
test -f environments.json
```

Lee `.planning/state.json` para entender contexto:

- `activeMilestone` y `status` te dicen en que fase estaba el usuario.
- Si `status` = `verifying` → el bug salio en DEV. Fix normal.
- Si `status` = `promoted` o `closed` → el bug esta en PROD. Tratamiento especial (ver paso 5).

## Capturar el problema

Antes de diagnosticar, pide informacion al usuario:

> Para diagnosticar bien necesito 3 cosas:
>
> 1. **Que ambiente fallo**: DEV o PROD?
> 2. **Que intentaste hacer**: que funcion ejecutaste, o que trigger se disparo, o que esperabas que pasara.
> 3. **Que paso en cambio**: pega el error completo (texto, no screenshot si puedes), o describe el comportamiento incorrecto.
>
> Si no tienes el error a la mano, abro logs del ambiente con `npm run logs:dev` o `logs:prod`.

Si el usuario no tiene el error:

```bash
npm run logs:dev   # o logs:prod
```

Lee los logs y extrae el error mas reciente.

## Metodo de diagnostico

Sigue 4 pasos: **observar → hipotesis → fix → verificar**. No saltes de la observacion al fix.

### 1. Observar

Resume al usuario lo que ves:

> Lo que veo:
> - **Error**: `<mensaje>`
> - **Ubicacion**: `<archivo>:<linea>` (si el stacktrace lo indica)
> - **Contexto**: ejecucion de `<funcion>` a las `<timestamp>`
> - **Cambio reciente**: ultimo commit `<hash>` — `<mensaje>` (`git log -1 --format=%s` si vale)

Categoriza el error:

- **Sintactico** (`SyntaxError`, `Unexpected token`) → bug de codigo, fix directo.
- **Permisos** (`Authorization required`, `Access denied`) → falta scope OAuth o autorizacion no aceptada.
- **Datos** (`Cannot read property X of undefined`, `Cannot find sheet Y`) → la data no es como el codigo asume.
- **API externa** (`UrlFetchApp returned 401/500`) → credencial mala o servicio caido.
- **Configuracion** (`null` de `PropertiesService`) → propiedad faltante en Script Properties.
- **Logico** (corre sin error pero resultado incorrecto) → bug de logica.

### 2. Hipotesis

Propone 1-3 hipotesis ordenadas por probabilidad:

> Mis hipotesis (mas probable primero):
> 1. `<hipotesis 1>` — porque `<evidencia>`. Como verificar: `<test>`.
> 2. `<hipotesis 2>` — porque `<evidencia>`. Como verificar: `<test>`.
> 3. `<hipotesis 3>` — porque `<evidencia>`. Como verificar: `<test>`.
>
> Voy a investigar la 1 primero. ¿De acuerdo o ves algo que apunte a otra?

### 3. Investigar la hipotesis seleccionada

Segun categoria del error:

- **Sintactico**: lee el archivo, encuentra la linea, identifica el typo.
- **Permisos**: revisa `appsscript.json` — ¿esta el scope?  ¿el usuario autorizo en el editor?
- **Datos**: ejecuta un snippet de inspeccion en una funcion temporal (`Logger.log(SpreadsheetApp.getActive().getSheets().map(s => s.getName()))`).
- **API externa**: revisa la key (¿esta en Script Properties? ¿es la correcta?). Si es un servicio externo, revisa estado del servicio.
- **Configuracion**: lista las propiedades configuradas vs las que el codigo necesita.
- **Logico**: lee la funcion, sigue el flujo con la data real.

**No adivines.** Si una hipotesis no se confirma con evidencia, descartala y prueba la siguiente.

### 4. Fix

Una vez confirmada la causa raiz:

#### Si el bug esta en DEV (status = `executing` o `verifying`)

1. Edita el archivo local con el fix. **No commitees** — los cambios se quedan sin commitear (igual que en `/p-ejecutar-milestone` y `/p-verificar-dev`); todo se commitea junto en `/p-promover-prod`.
2. Valida sintaxis: `node --check <archivo>`.
3. Re-sube a DEV reutilizando el mismo deployment:

   ```bash
   npm run deploy:dev -- --desc "<milestone> - <objetivo> (fix debug)"
   ```

   Esto actualiza el deployment estable de DEV (mismo `deploymentId`, mismo URL) con el codigo del fix. El humano refresca su pestana de DEV y ve el codigo nuevo.

4. Pide al usuario re-ejecutar la funcion en el editor de DEV y confirmar.
5. Si pasa: dirige al usuario a retomar `/p-verificar-dev` para continuar el checklist. El fix queda como un cambio mas en el working directory; sera parte del commit unico que hace `/p-promover-prod`.

#### Si el bug esta en PROD (status = `promoted` o `closed`)

⚠️ **Tratamiento especial.** Trata el fix como un **mini-milestone de emergencia**.

> El bug esta en PROD. Esto se trata como un fix de emergencia, NO como un parche directo:
>
> 1. Reproduzco el error en DEV primero (push del codigo actual a DEV, ejecutar, confirmar mismo error).
> 2. Aplico el fix en local.
> 3. Despliego a DEV y verifico.
> 4. Promuevo a PROD con `/p-promover-prod`.
>
> **No edito PROD directamente bajo ninguna circunstancia.** Aunque el editor web te permita, hacerlo crea divergencia entre GitHub y PROD que se rompe en el siguiente deploy.

Crea entrada temporal en state.json:

```json
{
  "status": "debugging-prod",
  "debugFor": "<activeMilestone>",
  "lastUpdated": "<ISO now>"
}
```

Sigue el flujo: `deploy:dev` (mismo deploymentId) → re-ejecutar en DEV → fix iterativo → commit → instruir al usuario a correr `/p-verificar-dev` y luego `/p-promover-prod`.

### 5. Documentar

Despues de cada fix exitoso, agrega una linea al final de `docs/milestones/<milestone>-plan.md` bajo una seccion `## Bugs encontrados y resueltos`:

```markdown
## Bugs encontrados y resueltos

- **<YYYY-MM-DD>**: `<descripcion del bug>`. Causa: `<causa raiz>`. Fix: `<descripcion>` en `<archivo>`.
```

Esto deja trazabilidad sin requerir un sistema separado de tickets. La linea queda como parte del cambio sin commitear; viajara junto al commit del milestone en `/p-promover-prod`.

## Errores especificos y como atacarlos

| Sintoma | Categoria | Primera accion |
| --- | --- | --- |
| `SyntaxError: ...` | Sintactico | Leer linea exacta del stacktrace |
| `Authorization is required` | Permisos | Pedir al usuario re-autorizar en el editor |
| `You do not have permission to call SpreadsheetApp.openById` | Scope | Revisar `appsscript.json` para `auth/spreadsheets` |
| `Cannot read properties of null (reading '...')` | Datos | Inspeccionar la data real con un `Logger.log` temporal |
| `Exception: Request failed for ... returned code 401` | API externa | Verificar Script Property con la key |
| `Service Spreadsheets timed out` | Performance | Revisar si el script hace demasiadas lecturas en loop |
| `Exceeded maximum execution time` | Timeout (6 min) | Considerar batch o trigger-based chunking — pero pregunta si entra en el milestone |

## Que NO hacer

- No edites codigo en el editor de Apps Script. Ni para "ver el error mas claro", ni para "probar rapido".
- No promuevas a PROD desde esta skill. Cuando el fix en DEV este validado, dirige a `/p-promover-prod`.
- No commitees fixes sin verificar en DEV primero.
- No marques el bug como resuelto solo porque "deberia funcionar". Pide al usuario re-ejecutar y confirmar.
- No intentes mas de 2 hipotesis sin pausa. Si dos hipotesis fallan, replantea el problema con el usuario — probablemente el modelo mental esta mal.
- No saltes la seccion de `## Bugs encontrados y resueltos` en el plan. Es la unica documentacion del incidente que va a quedar.
