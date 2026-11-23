# Dataverse Form Designer

Editor visual de formularios de Dataverse (React + TypeScript + Tailwind) con login OAuth (Authorization Code + PKCE, sin secretos) y exportación a **FormXml**, pensado para pegarlo en el *XML Editor* de XRM Toolbox.

## Arranque

```bash
npm install
cp .env.example .env      # rellena VITE_AZURE_CLIENT_ID (o ponlo en la pantalla de login)
npm run dev               # http://localhost:5173
npm test                  # round-trip de FormXml + reducer
npm run build
```

## App Registration (una sola vez)

XRM Toolbox usa un Client ID propio con redirect nativo; en un navegador **no se puede reutilizar**. Crea el tuyo:

1. Entra ID → *App registrations* → *New registration* (cuentas de cualquier directorio organizativo).
2. *Authentication* → *Add a platform* → **Single-page application**. Redirect URI: `http://localhost:5173/redirect.html` (añade también la de producción si lo despliegas).
3. *API permissions* → *Dataverse* → *Delegated* → `user_impersonation`.
4. Copia el *Application (client) ID* a `.env` o a la pantalla de login.

El usuario necesita permiso de lectura sobre metadatos y `systemform` en el entorno (p. ej. rol *System Customizer*).

## Flujo de trabajo

1. **Conectar** (URL del entorno + Client ID) → elige entidad y formulario.
2. Edita: arrastra campos desde la paleta, reordena celdas/secciones, cambia columnas, etiquetas, solo lectura…
3. **Exportar XML** → copia o descarga → pégalo en el XML Editor de XRM Toolbox → publica desde allí.

También funciona **sin conexión**: formulario nuevo, importar FormXml (pegar/fichero) y añadir campos a mano.

## Qué se conserva al importar

El editor solo modela pestañas, secciones y campos. Todo lo demás se guarda como XML y se reescribe tal cual:
`events`, `formLibraries`, `header`, `footer`, `DisplayConditions`, subgrids, web resources, quick views, timeline, `parameters` de controles, atributos extra de tab/section/cell/control y **todas las etiquetas de todos los idiomas**.

## Decisiones y límites conocidos

- **rowspan**: no se modela; las celdas se exportan con `rowspan="1"` (se avisa al importar).
- **Etiquetas**: se edita solo el idioma seleccionado en la cabecera (por defecto el idioma base de la organización).
- **classid de controles**: tabla en `src/domain/classIds.ts`. Los tipos sin entrada propia usan el control de texto. Verifica con un formulario real si usas tipos poco comunes (multiselect, duration).
- **Borrar un campo** referenciado en `events`/`header`/`footer` pide confirmación (esas referencias no se tocan).
- **Validación**: nombres únicos y válidos, ids de control únicos, campos duplicados, obligatorios ausentes (necesita metadatos). Los errores bloquean la exportación.
- **Sesión caducada**: el editor no se descarta; hay autoguardado de borrador en `localStorage` y banner para reautenticar.
- **Nubes soberanas** (GCC High, China): la authority está fija en `login.microsoftonline.com`.
- No publica ni guarda en el entorno: esa parte queda en el XML Editor de XRM Toolbox.

## Estructura

```
src/domain      modelo, classids, parse/serialize/validate de FormXml (puro, con tests)
src/state       reducer con undo/redo, contexto, hook de metadatos
src/auth        MSAL v5 (popup + redirect.html puente)
src/api         cliente mínimo de la Web API de Dataverse
src/components  canvas, paleta, propiedades, incidencias, diálogos
```
