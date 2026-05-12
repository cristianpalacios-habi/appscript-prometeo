---
name: verificar-dev
description: Despliega el milestone implementado al ambiente DEV de Apps Script, valida que las propiedades requeridas esten configuradas, y guia al usuario por el checklist de verificacion del plan. No promueve a prod — eso lo hace /promover-prod.
---

# /verificar-dev

Ejecuta la fase de **verificacion** del loop por milestone. Despliega a DEV y guia la validacion funcional. Si el checklist pasa, actualiza estado y abre el camino a `/promover-prod`. Si falla, dirige a `/debug-error`.

## Cuando usar

- Despues de `/ejecutar-milestone` (codigo implementado y commiteado).
- El usuario dice: "validemos en dev", "despliega a dev", "verifica que funcione", "probemoslo".

## Pre-checks (aborta si falla)

```bash
test -f .planning/state.json
test -f environments.json
```

Lee `.planning/state.json`. Casos:

- **`activeMilestone` vacio** → "No hay milestone activo. Corre `/plan-milestone`."
- **`status` ≠ `executed` y ≠ `verifying`**:
  - `planning` o `planned` → "El milestone no esta implementado. Corre `/ejecutar-milestone` primero."
  - `executing` → "La implementacion no termino. Termina `/ejecutar-milestone` primero."
  - `promoted` o `closed` → "Este milestone ya esta cerrado. Si necesitas re-validar, replanea o trata como un debug."
- **`status` = `verifying`** → "Ya hay una verificacion en curso. Continuamos desde el checklist o reiniciamos?"

Lee `environments.json`. Si `dev.scriptId` esta vacio o con placeholder → "DEV no esta configurado. Corre `/config-appsscript`."

Verifica que exista el plan: `docs/milestones/<activeMilestone>-plan.md`.

Verifica repo limpio:

```bash
git status --porcelain
```

Si hay cambios sin commitear → "Hay cambios sin commitear. ¿Los integro al milestone (volver a `/ejecutar-milestone`) o los dejo aparte?". No despliegues con codigo no commiteado.

## Plan que anuncias al usuario

> Voy a validar el milestone **`<milestone>`** en DEV. El flujo es:
> 1. Revisar que las propiedades de Script requeridas esten configuradas (si el plan menciona alguna).
> 2. Desplegar el codigo a DEV con `npm run deploy:dev`.
> 3. Abrir el editor de DEV en el navegador.
> 4. Recorrer contigo el checklist del plan, item por item.
> 5. Si todo pasa, sincronizar `docs/IDS.md` y marcar el milestone como verificado.
>
> **Recuerda**: en el editor solo vas a ejecutar funciones y leer logs. No edites codigo ahi.
>
> ¿Procedo?

Solo continua si aprueba.

## Pasos detallados

### 1. Marcar inicio de verificacion

Actualiza `.planning/state.json`:

```json
{
  "status": "verifying",
  "lastUpdated": "<ISO now>"
}
```

### 2. Validar propiedades de Script

Lee la seccion `## Property Service (claves a configurar)` del plan.

Si hay claves listadas:

> El plan requiere estas propiedades configuradas en Apps Script DEV:
> - `RECIPIENT_EMAIL`
> - `API_KEY_GEMINI`
>
> Voy a abrir la pantalla de Script Properties en DEV. Por favor:
> 1. Verifica que existan con valores correctos.
> 2. Si falta alguna, agregala (no edites codigo, solo Settings).
> 3. Vuelve a Cursor y confirma "listo".

Abre la URL directa a Settings (no al editor de codigo):

```bash
SCRIPT_ID=$(node -e "console.log(require('./environments.json').dev.scriptId)")
open "https://script.google.com/home/projects/$SCRIPT_ID/settings" 2>/dev/null || \
  echo "Abre manualmente: https://script.google.com/home/projects/$SCRIPT_ID/settings"
```

(En Linux usa `xdg-open` en lugar de `open`.)

Espera la confirmacion del usuario. **No avances hasta que confirme.**

Si no hay claves en el plan, salta este paso.

### 3. Construir descripcion del deployment

Lee del plan:

- `## Objetivo` (1 frase)
- `activeMilestone` de state.json

Construye descripcion sugerida:

```
<milestone> - <objetivo, max 60 caracteres> - <YYYY-MM-DD HH:MM>
```

Ejemplo: `M1 - Procesar tickets pendientes y mandar reporte diario - 2026-05-12 14:30`

Pregunta al usuario:

> Voy a desplegar a DEV con esta descripcion:
> > `<descripcion sugerida>`
>
> ¿La uso, o prefieres otra?

Espera respuesta.

### 4. Deploy a DEV

```bash
npm run deploy:dev -- --desc "<descripcion final>"
```

Captura el output. Si falla:

- **Apps Script API not enabled** → guia al usuario a [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
- **Permisos OAuth** → la primera vez que un scope nuevo se usa, hay que autorizar. Va a salir al ejecutar la funcion, no aqui.
- **Otro error** → diagnostica antes de avanzar.

Verifica que `environments.json` quedo actualizado con el nuevo `deploymentId`.

### 5. Abrir DEV en el navegador

```bash
npm run open:dev
```

Recordatorio claro:

> Se abrio DEV. **No edites codigo en el editor.** Solo vamos a:
> - Ejecutar una funcion (boton play arriba).
> - Leer logs (panel "Registro de ejecuciones" abajo a la izquierda).
> - Si es trigger: instalarlo desde la funcion `installTriggers()`.

### 6. Recorrer checklist

Lee el bloque `## Checklist de verificacion (para /verificar-dev)` del plan. Es una lista de items tipo `- [ ] ...`.

Para cada item:

#### Si involucra ejecucion manual de funcion

> Item: <texto del item>
>
> 1. En el editor, selecciona la funcion `<nombre>` en el dropdown de arriba.
> 2. Pulsa "Ejecutar". Si pide autorizar permisos OAuth, acepta con tu cuenta Habi.
> 3. Espera a que termine.
> 4. Revisa el panel de ejecucion: ¿muestra lo esperado (`<criterio del item>`)?
> 5. Vuelve a Cursor y dime: "ok", "no ok", o pega el error.

#### Si involucra un trigger time-driven

> Item: <texto del item>
>
> Tienes dos opciones para validar:
>
> **Opcion A (recomendada para validacion inmediata)**: ejecuta la funcion subyacente `<nombre>` directamente desde el editor, igual que arriba. Esto simula lo que el trigger hara cuando se dispare.
>
> **Opcion B (validacion del trigger en su horario natural)**: ejecuta la funcion `installTriggers()` desde el editor para instalar el trigger en DEV. Despues, espera al horario natural (ej. 07:00) y vuelve a revisar logs.
>
> ¿Cual opcion prefieres? Para el primer milestone, recomiendo A — es mas rapido.

Si elige A, mismo flujo que ejecucion manual.

Si elige B:
1. Le pide instalar trigger.
2. Marca el item como "pending — esperar horario natural" en state.json y termina la skill, dejando al usuario volver cuando el trigger se ejecute.

#### Si involucra side-effects observables (correo enviado, hoja actualizada)

> Item: <texto del item>
>
> Despues de ejecutar la funcion:
> 1. Revisa <correo destino / hoja Y / etc>.
> 2. Confirma que el efecto esperado ocurrio.

### 7. Si algun item falla

Marca el item fallido en state.json:

```json
{
  "status": "verifying",
  "failedChecks": ["item que fallo"],
  "lastUpdated": "<ISO now>"
}
```

Dirige al usuario:

> El item `<X>` no pasa. Vamos a diagnosticar con `/debug-error`. Pega el error que viste o el comportamiento inesperado, y trabajamos sobre eso.

**No marques el milestone como verificado.** No corras `/promover-prod` con checks pendientes.

### 8. Si todos los items pasan

Sincroniza `docs/IDS.md` con el estado actual de `environments.json`:

Lee `environments.json`, escribe `docs/IDS.md` con:
- Script IDs (dev y prod)
- Deployment IDs (dev recien actualizado, prod = lo que hubiera)
- Descripcion del ultimo deploy
- Timestamp
- Links a editores

Actualiza `.planning/state.json`:

```json
{
  "status": "verified",
  "verifiedAt": "<ISO now>",
  "lastUpdated": "<ISO now>"
}
```

### 9. Cierre

> Verificacion de `<milestone>` completa.
>
> **Checklist**: todos los items pasan ✓
> **Deployment DEV**: `<deploymentId>` — `<descripcion>`
> **docs/IDS.md**: sincronizado
>
> Siguiente paso: `/promover-prod` cuando estes listo para mover este milestone a produccion.

## Errores comunes y como manejarlos

- **`PropertiesService` retorna null** durante la ejecucion → propiedad no esta configurada. Volver al paso 2 con el usuario.
- **`Authorization required`** → primera ejecucion de un scope nuevo. El usuario debe autorizar en el dialogo del editor. Es normal, no es error.
- **Trigger instalado pero no se ejecuta a la hora esperada** → revisar zona horaria en `appsscript.json` (`"timeZone": "America/Bogota"`).
- **Logs vacios despues de ejecutar** → el usuario probablemente no tiene abierto el panel de "Registro de ejecuciones". Guialo a abrirlo (icono abajo izquierda).
- **`environments.json` con `dev.deploymentId` vacio despues del deploy** → el parser de `deploy.js` no capturo el ID. Lee output crudo y guardalo manualmente.

## Que NO hacer

- No despliegues a PROD en esta skill. **PROD se toca solo en `/promover-prod`.**
- No edites codigo en el editor web bajo ningun motivo. Si el usuario reporta que "edito directo y arreglo algo", reorientalo: hay que volver a Cursor, replicar el cambio en local, commitear y volver a desplegar — sino `prod` quedara distinto a `dev`.
- No saltes la verificacion de Script Properties. Es la causa #1 de fallos en primera ejecucion.
- No marques `status: "verified"` si algun item del checklist no paso.
- No instales triggers en codigo de produccion. `installTriggers()` se ejecuta manualmente, no automaticamente.
