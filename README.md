# Dataverse Form Designer

Editor visual de formularios de Dataverse (React + TypeScript + Tailwind). Se alimenta de un **paquete** generado con PAC CLI y exporta **FormXml** para pegarlo en el *XML Editor* de XRM Toolbox. Sin login en el navegador ni App Registration: la autenticación la hace `pac`.

## Flujo

```
pac auth create  →  scripts/Export-FormBundle.ps1  →  Cargar paquete  →  editar  →  Exportar XML  →  XML Editor (XRM Toolbox)
```

1. Una vez: `pac auth create` (el mismo inicio de sesión interactivo de siempre).
2. `.\scripts\Export-FormBundle.ps1` → menús para **entorno**, **solución** y **tabla**. Genera `bundles/<tabla>.<solución>.bundle.json`.
3. En la herramienta: **Cargar paquete** → elige el formulario → diseña → **Exportar XML** → pégalo en el XML Editor y publica desde XRM Toolbox.

También puedes pasar parámetros al script para saltarte los menús:

```powershell
.\scripts\Export-FormBundle.ps1 -Environment https://org.crm4.dynamics.com -Solution MiSolucion -Entity account -SkipPublish
```

## Arranque de la herramienta

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

## Qué hace el script (y qué no)

Usa `pac env list`, `pac solution list --json`, `pac solution publish` (con confirmación), `pac solution export` (no gestionada) y `pac solution unpack`. **No interpreta XML**: vuelca `Entity.xml`, los ficheros de `FormXml` y el idioma base tal cual. El parseo está en `src/domain/bundle.ts`, con tests.

## Qué se conserva al importar

El editor modela pestañas, secciones y campos. Todo lo demás se conserva y se reescribe tal cual: `events`, `formLibraries`, `header`, `footer`, subgrids, web resources, quick views, `parameters` de controles, atributos extra y **las etiquetas de todos los idiomas**.

## Límites y decisiones

- **Columnas**: salen de `Entity.xml` (solo las incluidas en la solución) **más** los campos que usan los formularios del paquete. Una columna estándar que no esté en la solución ni en ningún formulario no aparece en la paleta: usa "Añadir campo manual".
- **Tipos no clasificables** (`virtual`, imagen, archivo…) se omiten y se avisa. Añádelos a mano si los necesitas.
- **Es una foto**: si cambia el esquema, vuelve a ejecutar el script. El paquete queda guardado en el navegador para que la paleta sobreviva a recargas.
- **Solo soluciones no gestionadas** (entorno de desarrollo).
- **rowspan** no se modela: se exporta como 1 (se avisa al importar).
- **Etiquetas**: se edita el idioma elegido en la cabecera (por defecto, el idioma base de la solución).
- **Borrar un campo** referenciado en `events`/`header`/`footer` pide confirmación; esas referencias no se tocan.
- **Validación**: nombres únicos y válidos, ids de control únicos, campos duplicados, obligatorios ausentes. Los errores bloquean la exportación.
- **Borrador**: autoguardado en `localStorage`; se puede restaurar desde la pantalla de inicio.
- La herramienta no publica ni guarda en el entorno: eso queda en el XML Editor.

## Primera ejecución: qué comprobar

El script se escribió sin poder ejecutar `pac` y se apoya en la salida real de la CLI. Si algo no cuadra:

| Síntoma | Causa probable |
|---|---|
| No lista entornos / soluciones | Cambió el formato de salida de `pac`; el script pide el dato a mano como alternativa. |
| "La solución no contiene tablas" | La solución no incluye tablas, o el unpack usó otro formato de carpetas (`Entities/`). |
| Sin columnas en la paleta | `Entity.xml` solo trae las columnas incluidas en la solución; revisa los avisos del paquete. |
| Error al desempaquetar | Prueba a añadir `--allowWrite` a `pac solution unpack` en el script. |

## Estructura

```
scripts/        Export-FormBundle.ps1 (pac: entorno → solución → tabla → paquete)
src/domain      modelo, classids, bundle y parse/serialize/validate de FormXml (puro, con tests)
src/state       reducer con undo/redo, contexto, persistencia del paquete
src/components  canvas, paleta, propiedades, incidencias, diálogos
```
