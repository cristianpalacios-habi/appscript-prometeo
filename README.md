# Prometeo — Plantilla de Apps Script

> _Prometeo robo el fuego de los dioses y lo entrego a los mortales para que dejaran de depender de lo divino y crearan con sus propias manos._

Plantilla del proyecto **Prometeo** (Habi / Inteligencia de Mercados): habilita a personas del equipo operativo —sin perfil tecnico— a construir, mantener y operar automatizaciones en Google Apps Script con ayuda de Cursor.

**Autores**: Cristian Palacios, Miguel Cruz.

---

## ¿Que hace esta plantilla?

Te da el setup completo para que **conversando con Cursor en espanol** puedas:

- Crear soluciones que lean/escriban en Sheets, Forms, Drive, Gmail o Calendar.
- Llamar APIs externas (Slack, OpenAI, Gemini, servicios internos).
- Trabajar con dos ambientes: **DEV** (pruebas) y **PROD** (operacion real).
- Mantener historial de cambios con Git, sin necesidad de conocer Git.
- Versionar despliegues con `clasp deploy` y trazabilidad de cada cambio en PROD.

**No necesitas saber programar.** Necesitas saber que quieres lograr.

---

## Como funciona — el workflow

Cada proyecto Prometeo se construye en **milestones entregables**. Cada milestone pasa por un loop de 4 pasos, orquestados por **skills de Cursor** que invocas con un comando:

```
        ┌──────────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐
   ┌──> │  PLANEAR │ ──>│ EJECUTAR  │ ──>│ VERIFICAR  │ ──>│ PROMOVER │──┐
   │    │ /plan-…  │    │ /ejecutar-│    │ /verificar-│    │/promover-│  │
   │    └──────────┘    └───────────┘    └────────────┘    └──────────┘  │
   │                                                                      │
   └────────────── /nuevo-milestone (siguiente) ─────────────────────────-┘
```

Ver el flujo detallado en [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

---

## Skills disponibles

| Skill | Cuando | Que hace |
| --- | --- | --- |
| `/config-entorno` | 1 vez por computador | Instala Node 20 LTS, nvm, clasp, configura git |
| `/config-appsscript` | 1 vez por proyecto | Crea proyectos DEV/PROD en Apps Script, llena IDs, smoke test |
| `/plan-milestone` | Por milestone | Lee PRD, propone plan, genera `docs/milestones/<M>-plan.md` |
| `/ejecutar-milestone` | Por milestone | Implementa el plan en archivos por responsabilidad, hace commit |
| `/verificar-dev` | Por milestone | Despliega a DEV, valida checklist, sincroniza `docs/IDS.md` |
| `/promover-prod` | Por milestone | Despliega a PROD, smoke test, tag git, cierra milestone |
| `/debug-error` | Cuando falla | Diagnostica con metodo cientifico, arregla en local |
| `/nuevo-milestone` | Al cerrar uno | Cierra el activo y arranca el siguiente del PRD |

Todas las skills viven en `.claude/skills/` y se invocan con `/<nombre>` en el chat de Cursor (Agent Mode).

---

## Pre-requisitos

- **Cursor** instalado y logueado con SSO de Habi.
- **PRD aprobado** del proyecto (Google Doc). Se copia a `docs/PRD.md` al inicio.
- **macOS o Linux** (en Windows: usar WSL antes — ver Anexo A de la Guia Prometeo).
- Permisos de administrador en el computador.
- Acceso a la org Habi en GitHub.

---

## Setup inicial (primera vez)

### Si es tu primera vez con Cursor en este computador

Usa el **prompt maestro de instalacion** ([`docs/PROMPT-INSTALACION.md`](docs/PROMPT-INSTALACION.md)). Lo pegas en Cursor recien instalado y prepara todo: Git, GitHub CLI, autenticacion, crea tu repo desde la plantilla y lo abre. Despues, sigue con los pasos de abajo.

### Si Cursor y el repo ya estan listos

1. En el chat de Cursor (Agent Mode), corre:

   ```
   /config-entorno
   ```

2. Cuando termine:

   ```
   /config-appsscript
   ```

3. Copia tu PRD aprobado al repo como `docs/PRD.md` (instrucciones en la seccion 2.3 de la Guia Prometeo).

4. Empieza a construir:

   ```
   /plan-milestone
   ```

---

## Ambientes

Tres lugares donde vive tu codigo:

- **Local** (tu computador) — donde editas con Cursor. Tambien respaldado en GitHub.
- **DEV** (Apps Script) — donde el codigo corre por primera vez. Aislado de operacion real.
- **PROD** (Apps Script) — operacion real, con consecuencias reales.

**Toda edicion nace en local y fluye `local → DEV → PROD`.** Nunca se edita en el editor web.

Ver detalle en [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

---

## Comandos npm (los corre la skill por ti)

| Comando | Que hace |
| --- | --- |
| `npm run push:dev` | Sube codigo a DEV (sin crear deployment) |
| `npm run push:prod` | Sube codigo a PROD (sin crear deployment, raro) |
| `npm run deploy:dev` | Push + crea deployment en DEV, guarda `deploymentId` |
| `npm run deploy:prod` | Push + crea deployment en PROD |
| `npm run promote` | Push + deployment en PROD (promocion estandar desde DEV validado) |
| `npm run open:dev` | Abre DEV en el navegador (solo para logs/ejecutar) |
| `npm run open:prod` | Abre PROD en el navegador (solo para logs/ejecutar) |
| `npm run logs:dev` | Logs de DEV |
| `npm run logs:prod` | Logs de PROD |

Todos aceptan `-- --desc "..."` para personalizar la descripcion del deployment.

---

## Estructura del repo

```
.
├── .claude/skills/         # Skills de Cursor (configurar, planear, ejecutar, etc.)
├── .planning/state.json    # Estado del proyecto (milestone activo, historial)
├── docs/
│   ├── PRD.md                  # PRD del proyecto (tu lo copias del Google Doc)
│   ├── WORKFLOW.md             # Referencia visual del loop
│   ├── PROMPT-INSTALACION.md   # Prompt maestro para bootstrap inicial del computador
│   ├── IDS.md                  # IDs reales (gitignored, generado por config-appsscript)
│   ├── IDS.example.md          # Plantilla de IDS.md
│   └── milestones/             # Plan de cada milestone aprobado
│       └── M1-plan.md
├── scripts/                # Helpers de Node (push, deploy, promote, logs, open)
├── appsscript.json         # Manifest de Apps Script (scopes, timezone)
├── .clasp.json             # Config de clasp (scriptId placeholder)
├── environments.json       # IDs reales por ambiente (gitignored)
├── environments.example.json
├── Main.js                 # Codigo de tu automatizacion (mas archivos por responsabilidad)
├── .claspignore            # Que NO sube a Apps Script (docs, skills, secretos)
├── .gitignore              # Que NO sube a GitHub
├── CLAUDE.md               # Guia para asistentes de IA en este repo
├── .cursorrules            # Reglas para Cursor
└── package.json
```

---

## Seguridad y privacidad

- **API keys y secretos** viven en `PropertiesService.getScriptProperties()`, nunca en codigo.
- `environments.json` y `docs/IDS.md` estan **gitignored** — los IDs de tus proyectos nunca se suben a GitHub.
- `.claspignore` bloquea que documentacion, skills, secretos o configs lleguen al editor de Apps Script. Solo sube `.js`/`.gs`/`.html` y `appsscript.json`.
- Si alguien tiene acceso a tu repositorio, no puede deducir los IDs ni accesos de tus proyectos productivos.

---

## Soporte

- **G-chat**: [prometeo-ayuda](https://chat.google.com/room/AAQAvHQfwAI?cls=7)
- Office hours semanal con Cristian.
- Ruta Platzi (fundamentos opcionales).

---

## Para mantenedores de la plantilla

Cuando actualices skills o scripts:

1. Cambia version en `package.json`.
2. Documenta cambios en `CHANGELOG.md` (si lo creas).
3. Notifica a usuarios activos.
