# Workflow de Prometeo

Este documento describe **como se trabaja** en un proyecto Prometeo: el loop, los ambientes y que skill usar en cada momento.

> **Audiencia:** tu (usuario operativo) y el asistente de Cursor que te ayuda.
> **Idioma:** espanol. Toda la conversacion con el asistente debe ser en espanol.

---

## El loop por milestone

Tu PRD parte el proyecto en milestones entregables. **Cada milestone pasa por el mismo loop de 4 pasos**:

```
        ┌──────────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐
   ┌──> │  PLANEAR │ ──>│ EJECUTAR  │ ──>│ VERIFICAR  │ ──>│ PROMOVER │──┐
   │    │ Plan Mode│    │ Agent Mode│    │   en dev   │    │  a prod  │  │
   │    └──────────┘    └───────────┘    └────────────┘    └──────────┘  │
   │                                                                      │
   └───────────────── siguiente milestone ────────────────────────────────┘
```

**Principio**: solo se arranca el siguiente milestone cuando el actual esta corriendo en `prod`. No se hacen dos milestones en paralelo.

### 1. Planear

- Skill: `/plan-milestone`
- Modo Cursor: **Plan Mode**
- Que pasa: el asistente lee `docs/PRD.md`, identifica el milestone activo, te propone un plan paso a paso (que archivos, que funciones, que triggers).
- Tu rol: revisar el plan. Si algo sobra o falta, pedir ajuste. Iterar hasta que refleje el alcance del milestone (no del proyecto entero).

### 2. Ejecutar

- Skill: `/ejecutar-milestone`
- Modo Cursor: **Agent Mode**
- Que pasa: el asistente implementa el plan aprobado. Crea/modifica archivos, te pide aprobacion para cambios grandes.
- Tu rol: aprobar cambios. Pedir explicaciones cuando no entiendas. No aprobar a ciegas.

### 3. Verificar en dev

- Skill: `/verificar-dev`
- Que pasa: el asistente corre `npm run deploy:dev`, abre el editor de Apps Script en dev, te guia un checklist de validacion.
- Tu rol: ejecutar la funcion manualmente o esperar al trigger, revisar logs, confirmar que el output es el esperado.

**Checklist minimo antes de promover:**

- [ ] La funcion corre sin errores en dev
- [ ] Los outputs son los esperados (datos, correos, hojas)
- [ ] No hay efectos secundarios inesperados
- [ ] Los logs son legibles y utiles
- [ ] El entregable del milestone (segun PRD) se cumple

### 4. Promover a prod

- Skill: `/promover-prod`
- Que pasa: el asistente corre `npm run promote`, registra el nuevo `deploymentId` de prod, marca el milestone como cerrado en el PRD.
- Tu rol: confirmar una ultima vez. Despues, medir el KPI (si era el ultimo milestone) o pasar al siguiente (`/nuevo-milestone`).

---

## Los ambientes

```
   ┌─────────────────┐
   │  TU COMPUTADOR  │
   │     (local)     │ ─── git push ───>  GitHub (respaldo)
   │  Cursor + Git   │
   └────────┬────────┘
            │ npm run deploy:dev
            ▼
   ┌─────────────────┐         ┌─────────────────┐
   │   Apps Script   │ promote │   Apps Script   │
   │      DEV        │ ──────> │      PROD       │
   │   (pruebas)     │         │  (operacion)    │
   └─────────────────┘         └─────────────────┘
```

- **Local** — donde editas con Cursor. No corre nada todavia.
- **DEV** — donde el codigo corre por primera vez. Sin impacto en operacion real.
- **PROD** — operacion real. Lo que pase aqui tiene consecuencias reales.

**Promover, no editar.** Nunca editas codigo directamente en `prod` (ni en `dev`). Toda edicion nace en local y fluye `local → dev → prod`.

---

## Comandos npm (los corre el asistente por ti)

| Comando | Que hace |
| --- | --- |
| `npm run push:dev` | Sube codigo a dev sin crear deployment |
| `npm run deploy:dev` | Push + crea deployment en dev, guarda `deploymentId` |
| `npm run push:prod` | Sube codigo a prod sin crear deployment (raro) |
| `npm run promote` | Push + deployment en prod (promocion estandar) |
| `npm run open:dev` | Abre dev en el navegador |
| `npm run open:prod` | Abre prod en el navegador |
| `npm run logs:dev` | Logs de dev |
| `npm run logs:prod` | Logs de prod |

---

## Skills por momento

| Momento | Skill | Frecuencia |
| --- | --- | --- |
| Primer setup del computador | `/config-entorno` | 1 vez por computador |
| Crear proyectos Apps Script | `/config-appsscript` | 1 vez por proyecto |
| Empezar milestone | `/plan-milestone` | 1 vez por milestone |
| Implementar plan | `/ejecutar-milestone` | 1 vez por milestone |
| Validar en dev | `/verificar-dev` | 1+ veces por milestone |
| Promover a prod | `/promover-prod` | 1 vez por milestone |
| Cerrar y empezar siguiente | `/nuevo-milestone` | 1 vez por milestone |
| Algo fallo | `/debug-error` | Cuando aplique |

---

## Cuando algo se rompe en prod

Si lo que se rompio ya estaba en prod (no en el milestone que estas construyendo):

1. Trata el fix como un **mini-milestone de emergencia**.
2. Reproduce el error en dev (`/verificar-dev`).
3. Arregla con `/ejecutar-milestone`.
4. Promueve con `/promover-prod`.

**Nunca toques prod directamente, ni siquiera para un "fix rapidito".**
