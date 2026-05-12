---
name: ejecutar-milestone
description: Implementa el plan aprobado del milestone activo. Escribe codigo en archivos separados por responsabilidad, sin desplegar. Solo pausa si encuentra una desviacion del plan que requiere aprobacion. Al terminar, hace commit con mensaje convencional.
---

# /ejecutar-milestone

Ejecuta el plan generado por `/plan-milestone`. **Escribe codigo local; no despliega.** El deploy es responsabilidad de `/verificar-dev`.

## Cuando usar

- Despues de `/plan-milestone` (plan aprobado y escrito en `docs/milestones/<milestone>-plan.md`).
- El usuario dice: "ejecuta el plan", "implementalo", "vamos con la implementacion", "ya esta el plan, codifica".

## Pre-checks (aborta si falla)

```bash
test -f .planning/state.json
test -f docs/PRD.md
```

Lee `.planning/state.json`. Casos:

- **Sin `state.json` o `activeMilestone` vacio** → "No hay milestone activo. Corre `/plan-milestone` primero."
- **`status` ≠ `planned`** → segun valor:
  - `planning` → "El plan no esta aprobado todavia. Termina `/plan-milestone` primero."
  - `executing` → "Ya hay una ejecucion en curso. ¿Continuamos donde quedo o reiniciamos? Si reinicias, revisa que `git status` no tenga cambios que pierdas."
  - `verifying` / `promoted` / `closed` → "Este milestone ya esta en una fase posterior. Si quieres re-ejecutarlo, corre `/plan-milestone` para replanear, o `/nuevo-milestone` para empezar el siguiente."

Verifica que exista el plan:

```bash
test -f docs/milestones/<activeMilestone>-plan.md
```

Si no existe → "El plan del milestone activo no esta. Corre `/plan-milestone`."

Verifica que el repo este limpio:

```bash
git status --porcelain
```

Si hay cambios sin commitear, avisa al usuario y pregunta si los descarta, los commitea aparte o los integra al milestone.

## Plan que anuncias al usuario

> Voy a implementar el plan de **`<milestone>`** que esta en `docs/milestones/<milestone>-plan.md`.
>
> **Forma de trabajar**:
> - Implemento todos los pasos del plan de corrido.
> - **Solo pauso si encuentro una desviacion** del plan (un scope OAuth que no estaba, un trigger distinto, un archivo extra que el plan no contemplaba).
> - Detalles internos (helpers, naming, formato) los resuelvo sin pausar.
> - Al terminar, hago **un solo commit** con mensaje `feat(<milestone>): <objetivo>`.
> - **No despliego.** Eso lo haces despues con `/verificar-dev`.
>
> ¿Procedo?

Solo continua si aprueba.

## Pasos detallados

### 1. Marcar inicio de ejecucion

Actualiza `.planning/state.json`:

```json
{
  "activeMilestone": "<sin cambio>",
  "status": "executing",
  "lastUpdated": "<ISO now>"
}
```

### 2. Leer plan y PRD

Carga en memoria:

- `docs/milestones/<milestone>-plan.md` — fuente de verdad de QUE construir.
- `docs/PRD.md` — fuente de verdad del POR QUE y del scope global.
- `CLAUDE.md` — guias de organizacion (archivos por responsabilidad, secretos en PropertiesService, etc.).

### 3. Implementar

Recorre la tabla `## Archivos` del plan y aplica cada cambio. Para cada archivo:

- Si `crear`: usa Write con la ruta indicada.
- Si `modificar`: usa Read primero, luego Edit con el cambio puntual.

Reglas de organizacion (de CLAUDE.md):

- **Responsabilidad unica por archivo.** Si el plan dice "agregar funcion de envio de correo a Main.js" pero la responsabilidad es correo, considera ponerla en `Gmail.js`. Si eso difiere del plan → es una desviacion (ver paso 5).
- **Secretos en PropertiesService.** Si el plan menciona una API key, no la pongas en codigo. Genera `Config.js` (o usa el existente) con un wrapper como:

  ```js
  function getProperty(key) {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    if (!value) throw new Error(`Falta la propiedad: ${key}`);
    return value;
  }
  ```

  Y documenta al usuario en el cierre que debe configurar las propiedades en el editor (Settings > Script Properties — unica excepcion donde toca entrar al editor, pero NO a editar codigo).

- **`appsscript.json`**: si el plan agrega scopes nuevos, edita el manifest con los scopes listados. No agregues scopes que el plan no menciona.

- **Triggers**: si el plan menciona un trigger time-driven, no lo crees con codigo de `ScriptApp.newTrigger(...)` en una funcion `main()`. Crea una funcion separada `installTriggers()` que el usuario corre una sola vez en el editor durante la verificacion. La skill `/verificar-dev` lo recuerda.

### 4. Validacion sintactica local

Despues de cada archivo `.js`/`.gs` escrito, valida sintaxis con Node:

```bash
node --check <archivo>
```

Si falla, **arregla antes de continuar**. No acumules errores de sintaxis para el final.

### 5. Manejo de desviaciones

Una desviacion = cambio en el contrato del plan con el usuario. **Pausa y pide aprobacion** si:

- Necesitas un **scope OAuth** no listado en el plan.
- Necesitas una **propiedad de Script** no listada.
- Necesitas un **archivo nuevo** que el plan no menciona (mas alla de helpers triviales).
- El **trigger** debe ser distinto al planeado (otra frecuencia, otro evento).
- Una **regla de negocio** se interpreta distinto al PRD (orden de columnas, formato de fecha, criterio de filtro).

Formato de pausa:

> ⚠️ Desviacion del plan:
>
> **Plan dice**: <texto literal del plan>
> **Encontre que**: <explicacion>
> **Propongo**: <ajuste>
> **Impacto**: <efecto en el milestone o en futuros milestones>
>
> ¿Apruebas el ajuste? Si si, actualizo el plan y sigo. Si no, dimelo y reorganizo.

Si el usuario aprueba la desviacion, **actualiza `docs/milestones/<milestone>-plan.md`** con el cambio (es la fuente de verdad viva), y continua.

No pauses por:

- Naming de variables internas.
- Estructura interna de funciones.
- Helpers privados que no afectan el contrato externo.
- Comentarios en codigo (no los agregues a menos que el WHY sea no obvio — ver CLAUDE.md).

### 6. Validacion final

Antes de commit, corre:

```bash
git status
git diff --stat
```

Muestra al usuario el resumen de cambios:

> Archivos modificados/creados:
> - `Main.js` (+12 lineas)
> - `Sheets.js` (nuevo, 45 lineas)
> - `appsscript.json` (+1 scope)
>
> ¿Reviso algo antes de commitear, o procedo?

Espera respuesta. Si pide revisar, mostrale los archivos relevantes y espera.

### 7. Commit

Stage solo lo relevante (NO toques `environments.json` ni `docs/IDS.md` — ya estan gitignored):

```bash
git add Main.js Sheets.js appsscript.json docs/milestones/<milestone>-plan.md .planning/state.json
```

Lee el `Objetivo` (1 frase) del plan. Commit:

```bash
git commit -m "feat(<milestone>): <objetivo>

- archivo1: cambio principal
- archivo2: cambio principal
- ...

Plan: docs/milestones/<milestone>-plan.md"
```

### 8. Push a GitHub (opcional, con confirmacion)

Pregunta al usuario:

> Codigo commiteado en local. ¿Hago `git push` para respaldar en GitHub? (recomendado)

Si si:

```bash
git push
```

Si el upstream no esta seteado:

```bash
git push -u origin $(git branch --show-current)
```

Si no, deja al usuario decidir cuando.

### 9. Marcar fin de ejecucion

Actualiza `.planning/state.json`:

```json
{
  "status": "executed",
  "lastUpdated": "<ISO now>"
}
```

### 10. Cierre

Resume:

> Implementacion lista para `<milestone>`.
>
> **Archivos**: <lista>
> **Commit**: `<hash corto>` — `feat(<milestone>): <objetivo>`
> **Push a GitHub**: si/no
>
> **Acciones manuales pendientes** (si aplica):
> - Configurar propiedades en el editor de Apps Script (Settings > Script Properties):
>   - `RECIPIENT_EMAIL` = <pendiente>
>   - `OTRA_KEY` = <pendiente>
>
> **Siguiente paso**: `/verificar-dev` para desplegar a DEV y validar.

Si hay propiedades pendientes, **lista las claves** que el usuario debe configurar. Es la unica vez donde entra al editor — y solo a Settings, no a editar codigo.

## Errores comunes y como manejarlos

- **`git status` con cambios previos** → no committees por encima sin entender. Pregunta al usuario antes.
- **`node --check` falla** → es bug en codigo recien escrito; lee el archivo, corrige, valida de nuevo.
- **Plan ambiguo o vacio** → no inventes. Pausa y dile al usuario: "el plan no detalla X. ¿Cual es la decision?". Si es importante, actualiza el plan antes de seguir.
- **Conflicto con commit previo del mismo milestone** → puede pasar si replanearon. Sigue, el commit nuevo se acumula. No fuerces rebase ni amend.

## Que NO hacer

- No corras `npm run push:*`, `deploy:*`, `promote` ni `clasp push/deploy`. Eso es de `/verificar-dev` y `/promover-prod`.
- No agregues "mejoras" fuera del plan (refactors, logging extra, manejo de errores para casos no previstos). Si crees que vale la pena, registralo como sugerencia en el cierre, no en el codigo.
- No abras el editor de Apps Script en esta skill.
- No commitees `environments.json`, `docs/IDS.md`, `node_modules/`, `.env*`, `*.local.*`. Si por algun motivo `git status` los muestra como rastreados, alerta al usuario — falla en gitignore.
- No hagas `git push --force`. Si push normal falla, diagnostica.
- No saltes `node --check`. Es la unica validacion local antes del deploy.
- No marques `status: "executed"` si hubo errores no resueltos.
