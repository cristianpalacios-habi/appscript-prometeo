# Guia para asistentes de IA — Proyecto Prometeo

Este repositorio es una **plantilla del proyecto Prometeo** (Habi / Inteligencia de Mercados). El usuario es del equipo operativo y construye automatizaciones en Google Apps Script con tu ayuda (vibecoding). **No es desarrollador.**

## Antes de hacer cualquier cosa

**1. Lee `docs/PRD.md`.** Es la fuente de verdad del proyecto: define problema, alcance, KPI, milestones y plan de ejecucion. Si el archivo no existe todavia, pidele al usuario que copie su PRD aprobado al repo antes de continuar.

**2. Lee `docs/WORKFLOW.md`.** Explica el loop de trabajo (planear → ejecutar → verificar → promover) y los ambientes (local / dev / prod).

**3. Identifica el milestone activo.** Cada conversacion trabaja sobre **un milestone especifico** del PRD. Si no esta claro cual, pregunta antes de planear o escribir codigo.

## Idioma

**Trabaja en espanol.** Mensajes, commits, comentarios, nombres de funciones cuando corresponda. El usuario habla espanol y los stakeholders tambien.

## Reglas duras (no negociables)

### 1. Nunca edites el editor web de Apps Script

Todo cambio de codigo nace en local (Cursor + repo) y se sincroniza con `clasp`. El editor de [script.google.com](https://script.google.com) se abre **solo** para:

- Revisar logs (`npm run logs:dev` o `logs:prod`).
- Ejecutar manualmente una funcion durante la verificacion.
- Autorizar permisos OAuth la primera vez.

Si el usuario te pide "edita esto en Apps Script", reorientalo: explicale que vamos a hacer el cambio en local y desplegarlo con `npm run deploy:dev`.

### 2. Mantente dentro del scope del milestone activo

El antipatron mas comun es construir cosas de M2 mientras se trabaja en M1. Cuando planees:

- Recorta el plan al milestone activo del PRD.
- Si surge una idea util pero fuera de scope, registra una nota — no la implementes.
- Si dudas si algo entra en este milestone, **pregunta al usuario antes de codificar**.

### 3. Secretos nunca van en el codigo

API keys, tokens, credenciales: viven en `PropertiesService.getScriptProperties()`. Si el usuario quiere usar un servicio externo:

1. Pide la API key por chat.
2. Guia para configurarla en `Settings del proyecto > Script properties` (esto se hace en el editor web, es una excepcion permitida).
3. Lee la propiedad desde el codigo con `PropertiesService.getScriptProperties().getProperty('NOMBRE_KEY')`.

**Nunca pegues una API key en un archivo .js / .gs.**

### 4. Codigo en archivos separados por responsabilidad

No archivo gigante. Estructura sugerida:

```
Main.js        — punto de entrada y triggers
Config.js      — constantes y lectura de PropertiesService
Sheets.js      — lectura/escritura en Google Sheets
Gmail.js       — envio de correos
Ai.js          — llamadas a APIs de IA (si aplica)
Api.js         — otras integraciones externas
Utils.js       — helpers generales
```

Solo crea archivos que el milestone necesite. No anticipes archivos para milestones futuros.

### 5. La fuente de verdad es el repo, no el Google Doc

Si durante la ejecucion cambia algo del PRD (alcance, decisiones, milestones), actualiza `docs/PRD.md` en el repo. El Google Doc original lo actualiza el usuario despues.

## Como trabajar con el usuario

**Es perfil no-tecnico.** Tres principios:

- **Explica antes de actuar.** En una frase: "voy a X porque Y". No narres tu razonamiento interno extenso.
- **No avances sin confirmacion en pasos grandes.** Cambios chicos (renombrar una variable, mover una linea): procede. Cambios estructurales (crear archivos, instalar paquetes, desplegar): muestra y espera.
- **Pregunta cuando dudes.** Es mejor una pregunta de mas que codigo en la direccion equivocada. Especialmente sobre alcance del milestone.

## Skills disponibles

El repo trae skills en `.claude/skills/` que orquestan el flujo. Usalas en el momento correcto en lugar de improvisar:

| Momento | Skill | Cuando |
| --- | --- | --- |
| Setup inicial | `/config-entorno` | Una vez por computador (Node, nvm, clasp) |
| Setup inicial | `/config-appsscript` | Crear proyectos dev/prod, llenar IDs |
| Planear milestone | `/plan-milestone` | Antes de escribir codigo de un milestone |
| Ejecutar plan | `/ejecutar-milestone` | Despues de aprobar plan |
| Validar en dev | `/verificar-dev` | Despues de implementar, antes de prod |
| Promover a prod | `/promover-prod` | Cuando dev esta validado |
| Diagnostico | `/debug-error` | Cuando algo falla |
| Cerrar milestone | `/nuevo-milestone` | Al cerrar uno, antes de planear el siguiente |

Si el usuario describe una intencion que matchea con una skill, **invoca la skill** en vez de improvisar. Las skills aseguran consistencia entre proyectos Prometeo.

## Comandos del repo (referencia)

- `npm run push:dev` — sube codigo a dev (sin crear deployment)
- `npm run deploy:dev` — push + crea/actualiza deployment en dev
- `npm run promote` — promueve dev validado a prod (push + deploy en prod)
- `npm run open:dev` / `open:prod` — abre el editor en el ambiente correcto
- `npm run logs:dev` / `logs:prod` — muestra logs del ambiente

Estos comandos usan `environments.json` (gitignored). El `scriptId` y `deploymentId` reales viven ahi.

## Archivos clave

- `docs/PRD.md` — contexto del proyecto (lo creas/actualizas)
- `docs/IDS.md` — IDs de scriptId/deploymentId reales (gitignored, lo genera `config-appsscript`)
- `docs/WORKFLOW.md` — diagrama del loop y ambientes
- `environments.json` — IDs reales (gitignored, gestionado por scripts)
- `.claspignore` — define que sube a Apps Script (solo codigo `.js`/`.gs`/`.html`)
- `.gitignore` — define que sube a GitHub (sin secretos, sin notas locales)

## Antipatrones a evitar

- Construir features completas del proyecto en una sola conversacion sin parar a verificar en dev.
- Crear archivos "por si acaso" que el milestone activo no necesita.
- Agregar manejo de errores complejo en el primer milestone — la version mas simple va primero.
- Sugerir abrir el editor web para "editar rapido".
- Saltar a prod sin validar en dev.
- Mantener silencio mientras escribes codigo durante minutos. Avisa que estas avanzando.
