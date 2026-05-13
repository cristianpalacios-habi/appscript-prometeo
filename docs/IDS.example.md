# IDs del proyecto

> Este archivo es una **plantilla**. La skill `config-appsscript` genera `docs/IDS.md` (gitignored) con los IDs reales.
> No commitees `docs/IDS.md` — contiene IDs de tus proyectos personales de Apps Script.

## Resumen

| Recurso | DEV | PROD |
| --- | --- | --- |
| Script ID | `<pendiente>` | `<pendiente>` |
| Deployment ID actual | `<pendiente>` | `<pendiente>` |
| Descripcion del deploy | `<pendiente>` | `<pendiente>` |
| Ultima fecha de deploy | `<pendiente>` | `<pendiente>` |
| Link al editor | `<pendiente>` | `<pendiente>` |

## Como se generan

- `npm run deploy:dev` — crea/actualiza Deployment ID de DEV y lo guarda en `environments.json`.
- `npm run promote` — crea/actualiza Deployment ID de PROD.
- La skill `config-appsscript` sincroniza estos valores en `docs/IDS.md` para tener una vista legible.

## Enlaces utiles

- Editor de Apps Script DEV: `https://script.google.com/d/<SCRIPT_ID_DEV>/edit`
- Editor de Apps Script PROD: `https://script.google.com/d/<SCRIPT_ID_PROD>/edit`
- Repositorio GitHub: `<pendiente>`

## Notas operativas

- Nunca edites codigo en el editor web. Todos los cambios pasan por Cursor + clasp.
- Si los IDs cambian, corre `/config-appsscript` para regenerar este archivo.
