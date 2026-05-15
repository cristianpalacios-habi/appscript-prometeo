---
name: quick-fix
description: Ejecuta un cambio pequeno end-to-end (plan inline + ejecutar + verificar en DEV) y deja todo listo para que el usuario corra /promover-prod manualmente. Solo aplica sobre milestones ya promovidos a PROD. Aborta y redirige a /plan-milestone si detecta que el cambio es demasiado grande. Aplica versionado decimal: cada quick-fix promovido incrementa el minor (v2.3 -> v2.4).
---

# /quick-fix

Atajo del loop por milestone para **cambios pequenos** sobre algo que ya esta en PROD. Hace plan inline + ejecutar + verificar en una sola corrida, sin pausas entre fases. **Nunca promueve sola** — siempre termina pidiendo al usuario que corra `/promover-prod` explicitamente.

## Cuando usar

Casos validos:
- Cambiar un destinatario de correo, un titulo de columna, un formato de fecha.
- Corregir un typo en un mensaje.
- Ajustar un umbral numerico, un filtro existente.
- Mover una constante hardcodeada a Script Properties.
- Pequeno fix sobre operacion en PROD que no requiere debugging profundo.

Casos NO validos (redirige a `/plan-milestone`):
- Funcionalidad nueva.
- Cambios que requieren un scope OAuth nuevo.
- Cambios que requieren Script Properties nuevas.
- Cambios que crean archivos nuevos (mas alla de helper trivial).
- Cambios en mas de 3 archivos.
- Cambios en triggers (frecuencia, evento, instalacion).
- Cambios en la estructura de datos compartida (columnas de hojas, esquema de inputs/outputs).

Si el usuario describe algo que cae en "no validos", la skill aborta y le dice:

> Lo que describes se ve como funcionalidad nueva, no como ajuste. Te recomiendo correr `/plan-milestone` para tratarlo como un milestone — sera **v<next_major>.0** en el historial.

## Pre-checks (aborta si falla)

```bash
test -f .planning/state.json
test -f environments.json
```

Lee `.planning/state.json`. **Solo continua si**:

- `currentMilestoneNumber >= 1` — debe haber al menos un milestone en PROD. Si vale 0:
  > Aun no hay nada en PROD. /quick-fix solo aplica como ajuste sobre algo ya promovido. Empieza con `/plan-milestone` para construir M1.
- `status` ∈ {`promoted`, `closed`} — no permite quick-fix sobre un milestone en `verified` (debe promoverse o cancelarse primero). Si el status es otro:
  > Hay un milestone activo en estado `<status>`. Termina `/promover-prod` o cancela antes de hacer un quick-fix.

Verifica repo limpio:

```bash
git status --porcelain
```

Si hay cambios → "Hay cambios sin commitear. Resuelvelos antes de un quick-fix."

Lee `dev.scriptId`. Si no esta configurado → dirige a `/config-appsscript`.

## Plan que anuncias al usuario

> Voy a hacer un quick-fix sobre **v<current_version>**. El flujo es:
>
> 1. Te pido que describas el cambio en 1-2 frases.
> 2. Verifico que el cambio es lo suficientemente pequeno para quick-fix (sin scopes nuevos, sin archivos nuevos, < 3 archivos modificados).
> 3. Te propongo un mini-plan rapido. Confirmas.
> 4. Implemento el cambio.
> 5. Subo a Apps Script DEV con `npm run deploy:dev` (mismo deploymentId, sin commit).
> 6. Reviso el codigo y autoverificacion con browser de Cursor.
> 7. **PAUSO** — te muestro el diff completo, te invito a revisarlo en Source Control de Cursor, y te paso la pelota para que tu corras `/promover-prod` cuando estes seguro.
>
> La version que se va a asignar cuando promuevas sera: **v<current_major>.<current_minor + 1>**.
>
> ¿Procedo?

Solo continua si aprueba.

## Pasos detallados

### 1. Capturar la descripcion del cambio

Pide:

> ¿Que quieres ajustar? Describelo en 1-2 frases. Ejemplos:
> - "Cambia el destinatario del reporte de auditoria de test@habi.co a calidad@habi.co"
> - "El titulo del correo dice 'Reporte Diaro' (typo), debe ser 'Reporte Diario'"
> - "El umbral de alerta de invasion esta en 15 dias, ponlo en 10"

### 2. Detector de complejidad — decide si redirige

Lee la descripcion del usuario y comparala con la base de codigo. Decide si encaja en quick-fix.

**Si encaja como quick-fix**: anuncia lo que vas a hacer y procede al paso 3.

**Si NO encaja** (cualquiera de los criterios "no validos" del inicio): aborta. Formato:

> ⚠️ Esto se sale de quick-fix.
>
> Razon: <texto especifico, ej. "requiere un scope OAuth nuevo (Gmail.send) que el manifest no tiene">
>
> Te recomiendo correr **`/plan-milestone`** y tratarlo como un milestone (sera **v<next_major>.0**). El loop completo (plan + ejecutar + verificar + promover) te da las pausas necesarias para algo asi.
>
> Si crees que se puede achicar a un quick-fix valido, reformulalo. ¿Como prefieres seguir?

No fuerces quick-fix si dudas. Es mejor escalar a milestone que romper algo en PROD.

### 3. Mini-plan inline

Propon un mini-plan al usuario en el chat (no escribes archivo todavia):

```
Mini-plan:
- Archivo `Gmail.js`: cambiar el valor de `RECIPIENT` en linea 12 de `test@habi.co` a `calidad@habi.co`.
- Sin cambios en scopes, properties, triggers.
- Archivos a modificar: 1.

Si esto es lo que querias, digo "ok" y procedo.
```

Espera aprobacion. Si pide ajustar, itera.

### 4. Marcar inicio en state.json

Actualiza:

```json
{
  "status": "quick-fixing",
  "lastUpdated": "<ISO now>"
}
```

### 5. Implementar

Aplica los cambios con Edit/Write sobre los archivos del mini-plan.

Valida sintaxis:

```bash
for f in <archivos modificados>; do node --check "$f"; done
```

Si falla, arregla antes de seguir.

### 6. Subir a Apps Script DEV

```bash
npm run deploy:dev
```

(reutiliza el deploymentId estable de DEV; no necesita descripcion nueva — sigue siendo el mismo deployment, solo se actualiza el codigo).

Si falla → diagnostica y muestra al usuario.

### 7. Fase A — Revision estatica

Mismo procedimiento que `/verificar-dev` Fase A, pero acotado al diff de los archivos modificados.

Chequea:
- ¿API keys o secretos hardcodeados? (no debe haber)
- ¿Concuerda con el mini-plan?
- ¿Sintaxis valida?
- ¿`appsscript.json` valido si lo tocaste?

Si falla → propone fix inline y vuelve a paso 5.

### 8. Fase B — Autoverificacion con browser

Mismo procedimiento que `/verificar-dev` Fase B.

- Abre el editor de DEV en el browser de Cursor.
- Ejecuta la funcion afectada por el cambio.
- Lee logs.
- Si el cambio toca outputs observables (Sheet, correo), abre la URL e inspecciona.

Si encuentra un problema → propone fix inline, vuelve a paso 5.

**Limite de fix loop**: maximo 3 intentos. Si despues de 3 intentos el problema persiste, aborta:

> Llevo 3 intentos en este fix y el problema no se resuelve. Esto sugiere que el cambio es mas complejo de lo que se ve. Te recomiendo:
> 1. Cancelar el quick-fix (los cambios quedan en el working dir, los puedes descartar con `git restore`).
> 2. Tratar el problema como milestone con `/plan-milestone`, o como debug serio con `/debug-error`.

### 9. Escribir registro del fix

Calcula la version objetivo: `v<currentMilestoneNumber>.<currentFixNumber + 1>` (ej. v2.4 si state esta en 2.3).

Crea `docs/fixes/v<X.Y>-fix.md` con esta estructura:

```markdown
# Quick-fix v<X.Y>

> Generado por `/quick-fix` el <YYYY-MM-DD HH:MM>. Pendiente de promover a PROD.

## Descripcion (del usuario)

<lo que el usuario dijo>

## Mini-plan ejecutado

- `<archivo>`: <cambio>
- ...

## Eligibilidad verificada

- [x] Sin scopes OAuth nuevos
- [x] Sin Script Properties nuevas
- [x] Sin archivos nuevos
- [x] <= 3 archivos modificados (modifico: <N>)
- [x] Sin cambios en triggers
- [x] Fase A — revision estatica pasa
- [x] Fase B — autoverificacion en DEV pasa

## Diff resumen

(diff abreviado, max 30 lineas, generado de `git diff --stat`)

## Autoverificacion

- Editor DEV: <que se ejecuto, que logs salieron>
- Artefactos inspeccionados: <Sheet X, Web App Y si aplica>

## Promocion

Pendiente. Cuando el usuario corra `/promover-prod`:
- Tag git: `v<X.Y>`
- Commit: `fix(v<X.Y>): <descripcion corta>`
- Deployment PROD con descripcion `v<X.Y> - <descripcion> - <fecha>`
```

Crea la carpeta `docs/fixes/` si no existe.

### 10. Marcar en state.json el tipo de release pendiente

```json
{
  "status": "fix-verified",
  "pendingReleaseType": "fix",
  "pendingFixDescription": "<descripcion corta>",
  "pendingFixVersion": "<X.Y>",
  "lastUpdated": "<ISO now>"
}
```

`/promover-prod` leera estos campos para hacer el versionado correcto.

### 11. Pausa muy explicita — fin de la skill

> ✅ Quick-fix listo en DEV.
>
> **Resumen del cambio**:
> - Archivos modificados: `<lista>`
> - Diff: `<stat>`
> - Autoverificacion: paso ✓
> - Registro: `docs/fixes/v<X.Y>-fix.md`
>
> **Version asignada cuando promuevas: v<X.Y>**
>
> ---
>
> 🛑 **Pausa para tu revision.**
>
> Tu siguiente paso (manual):
>
> 1. **Revisa el diff completo** en el panel **Source Control** de Cursor (icono de rama en la barra lateral izquierda). Tomate el tiempo que necesites.
> 2. Si todo se ve bien, **corre `/promover-prod`** en este chat.
> 3. Si algo se ve raro, dime que ajustar — entramos a otro fix loop — o cancela con `git restore .` para descartar los cambios.
>
> **No voy a invocar `/promover-prod` por ti.** El gatillo es tuyo. Asi te aseguras de que lo que esta a punto de tocar PROD lo viste con tus propios ojos.

Termina la skill aqui. **No promuevas. No commitees.**

## Errores comunes y como manejarlos

- **Usuario invoca `/quick-fix` sin nada en PROD** → pre-check aborta. Dirige a `/plan-milestone`.
- **Cambio se ve trivial pero al implementar resulta que necesita un scope nuevo** → en paso 7 (Fase A) lo detectas. Abortas:
  > Al implementar descubri que necesitamos el scope OAuth `<scope>` que el manifest no tiene. Eso lo saca de quick-fix. Voy a revertir los cambios y te recomiendo `/plan-milestone` para tratarlo como milestone. Confirma para revertir.
  Si confirma:
  ```bash
  git restore .
  ```
- **Usuario olvida correr `/promover-prod` y desaparece** → no hay problema. Los cambios siguen en working dir, listos. La proxima vez que vuelva los puede revisar o descartar.
- **Usuario quiere modificar el quick-fix despues de la pausa** → vuelve al paso 3 con la nueva instruccion. Re-deploy a DEV. Re-verifica. Sustituye el archivo `docs/fixes/v<X.Y>-fix.md` con la version final.

## Que NO hacer

- **No promuevas.** /quick-fix termina antes de PROD. Siempre.
- **No commitees.** El commit lo hace `/promover-prod`.
- **No fuerces eligibilidad.** Si el cambio se sale de los criterios, redirige a `/plan-milestone`. Mejor escalar que romper PROD.
- **No saltes Fase A o B.** Aunque sea pequeno, autoverifica. Es lo que justifica la skill.
- **No marques `status: "promoted"`.** Esa transicion la hace solo `/promover-prod`.
- **No reutilices la misma version** si el usuario decide hacer dos quick-fixes seguidos sin promover el primero. Verifica al inicio que `pendingReleaseType` no este seteado; si lo esta, dile al usuario que termine el ciclo actual antes.
