# Workflow de Prometeo

Este documento describe **como se trabaja** en un proyecto Prometeo: el loop, los ambientes, las ramas de GitHub y que skill usar en cada momento.

> **Audiencia:** tu (usuario operativo) y el asistente de Cursor que te ayuda.
> **Idioma:** espanol.

---

## El loop por milestone

Tu PRD parte el proyecto en milestones entregables. **Cada milestone pasa por el mismo loop de 4 pasos**:

```
        ┌──────────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐
   ┌──> │  PLANEAR │ ──>│ EJECUTAR  │ ──>│ VERIFICAR  │ ──>│ PROMOVER │──┐
   │    │ Plan Mode│    │ Agent Mode│    │   en DEV   │    │  a PROD  │  │
   │    └──────────┘    └───────────┘    └────────────┘    └──────────┘  │
   │                                                                      │
   └───────────────── siguiente milestone ────────────────────────────────┘
```

**Principio**: solo se arranca el siguiente milestone cuando el actual esta corriendo en PROD.

---

## Que hace cada skill (resumen operativo)

| Skill | Git local | GitHub | Apps Script |
| --- | --- | --- | --- |
| `/plan-milestone` | escribe plan + state.json (sin commit) | — | — |
| `/ejecutar-milestone` | escribe codigo (sin commit) | — | `npm run push:dev` |
| `/verificar-dev` | fixes (sin commit) | — | `push:dev` por fix; `deploy:dev` al cierre |
| `/promover-prod` | **1 commit** `feat(<M>): <obj>` | push a `dev` luego a `main` | `npm run promote` (PROD) |

**No se commitea hasta `/promover-prod`.** Durante todo el milestone los cambios viven sin commitear en el working directory. El usuario los revisa cuando quiera en el panel **Source Control** de Cursor.

---

## Ambientes (Apps Script + GitHub)

```
   ┌─────────────────┐
   │  TU COMPUTADOR  │
   │     (local)     │
   │  Cursor + Git   │
   └────────┬────────┘
            │
            │  npm run push:dev / deploy:dev   (durante el milestone)
            ▼
   ┌─────────────────┐
   │   Apps Script   │
   │      DEV        │  ← sandbox, sin efectos reales
   │   (pruebas)     │
   └────────┬────────┘
            │
            │  /promover-prod:
            │    1. git commit
            │    2. git push origin main:dev   (GitHub)
            │    3. git push origin main:main  (GitHub)
            │    4. npm run promote            (Apps Script PROD)
            ▼
   ┌─────────────────┐
   │   Apps Script   │
   │      PROD       │  ← operacion real
   │  (operacion)    │
   └─────────────────┘
```

- **Local** — donde editas con Cursor. No corre nada todavia.
- **Apps Script DEV** — donde el codigo corre por primera vez. Sin impacto en operacion real.
- **Apps Script PROD** — operacion real. Lo que pase aqui tiene consecuencias reales.
- **GitHub `dev` (rama)** — codigo actualmente validado y desplegado en Apps Script DEV.
- **GitHub `main` (rama)** — codigo actualmente en Apps Script PROD.

**Promover, no editar.** Nunca editas codigo directamente en PROD ni en DEV. Toda edicion nace en local y fluye `local → DEV → PROD`. **No edites en el editor web de Apps Script**, ni siquiera para "fixes rapidos" — eso rompe la sincronizacion con GitHub.

---

## Las 4 fases en detalle

### 1. Planear — `/plan-milestone`

- Modo Cursor recomendado: **Plan Mode**.
- Que pasa: el asistente lee `docs/PRD.md`, identifica el milestone activo desde `.planning/state.json`, te propone un plan paso a paso (archivos, funciones, triggers, scopes OAuth, URLs de artefactos a verificar, checklist).
- Output: `docs/milestones/<M>-plan.md`.
- **No edita codigo ni commitea.**

### 2. Ejecutar — `/ejecutar-milestone`

- Modo Cursor: **Agent Mode**.
- Que pasa: el asistente implementa el plan en archivos separados por responsabilidad, valida sintaxis (`node --check`), y al final sube el codigo a Apps Script DEV con `npm run push:dev`.
- Solo pausa si encuentra una **desviacion** del plan (scope OAuth nuevo, propiedad nueva, archivo no contemplado, trigger distinto).
- **No commitea.** Cambios visibles en Source Control de Cursor.

### 3. Verificar en DEV — `/verificar-dev`

**5 fases internas**:

- **A. Revision estatica** — el asistente lee el diff y lo contrasta contra CLAUDE.md, el plan, el PRD y buenas practicas de Apps Script.
- **B. Autoverificacion** — el asistente abre el editor de DEV (y URLs relevantes: Sheets, Web App) en el **browser integrado de Cursor**, ejecuta la funcion principal, lee logs, inspecciona outputs.
- **C. Fix loop** — si A o B detectan problemas, propone fix, lo implementa, hace `npm run push:dev` y reinicia.
- **D. Checklist guiado al usuario** — recorre contigo cada item del checklist del plan. Si algo falla, vuelve a C.
- **E. Marcar verificado** — `npm run deploy:dev` (crea deployment versionado en DEV), sincroniza `docs/IDS.md`, marca state como `verified`.

**Sigue sin commitear.** Cuando termina, los cambios siguen visibles en Source Control.

### 4. Promover a PROD — `/promover-prod`

Orden estricto:

1. **Configurar Script Properties en PROD** (probablemente con valores DISTINTOS a DEV: destinatarios reales, API keys de produccion).
2. **Un solo commit** de todo lo acumulado del milestone: `feat(<M>): <objetivo>`.
3. **`git push origin main:dev`** — actualiza la rama `dev` en GitHub.
4. **`git push origin main:main`** — actualiza la rama `main` en GitHub.
5. **`npm run promote -- --desc "..."`** — push + deployment versionado a Apps Script PROD.
6. Smoke test minimo opcional en PROD.
7. Tag git `<M>-prod-<YYYYMMDD>`.
8. Cierra el milestone en `state.json` con history completo.

---

## Comandos npm (los corre la skill por ti)

| Comando | Que hace |
| --- | --- |
| `npm run push:dev` | Sube codigo a DEV sin crear deployment (usado durante ejecutar y verificar) |
| `npm run deploy:dev` | Push + crea deployment versionado en DEV (al cierre de verificar) |
| `npm run push:prod` | Sube codigo a PROD sin crear deployment (raro — uso interno) |
| `npm run promote` | Push + deployment versionado en PROD (usado solo por /promover-prod) |
| `npm run open:dev` | Abre DEV en el navegador |
| `npm run open:prod` | Abre PROD en el navegador |
| `npm run logs:dev` | Logs de DEV |
| `npm run logs:prod` | Logs de PROD |

---

## Skills por momento

| Momento | Skill | Frecuencia |
| --- | --- | --- |
| Primer setup del computador | `/config-entorno` | 1 vez por computador |
| Crear proyectos Apps Script + rama `dev` GitHub | `/config-appsscript` | 1 vez por proyecto |
| Empezar milestone | `/plan-milestone` | 1 vez por milestone |
| Implementar plan | `/ejecutar-milestone` | 1 vez por milestone |
| Validar en dev | `/verificar-dev` | 1+ veces por milestone |
| Promover a prod | `/promover-prod` | 1 vez por milestone |
| Cerrar y empezar siguiente | `/nuevo-milestone` | 1 vez por milestone |
| Algo fallo | `/debug-error` | Cuando aplique |

---

## Cuando algo se rompe en PROD

Si lo que se rompio ya estaba en PROD (no en el milestone que estas construyendo):

1. Trata el fix como un **mini-milestone de emergencia**.
2. Reproduce el error en DEV (`/verificar-dev` apunta logs a DEV).
3. Arregla con `/debug-error` o `/ejecutar-milestone`.
4. Verifica con `/verificar-dev`.
5. Promueve con `/promover-prod` (el commit incluye el fix; las ramas `dev` y `main` en GitHub quedan actualizadas; PROD recibe el nuevo deployment).

**Nunca toques PROD directamente** — ni en el editor web ni saltando el flujo de promote.
