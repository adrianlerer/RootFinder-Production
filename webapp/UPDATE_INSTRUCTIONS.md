# INSTRUCCIONES PARA ACTUALIZAR ROOTFINDER.IO

Adrian, el problema es que está usando el archivo original descargado que NO tiene mis correcciones.

## SOLUCIÓN RÁPIDA:

1. **REEMPLACE completamente** su archivo `/Users/adria1/Downloads/webapp2/src/index.tsx`

2. **CON EL ARCHIVO CORREGIDO** que está en:
   https://page.gensparksite.com/project_backups/tooluse_IBKCogwsTaOYN0h-AyovxA.tar.gz

3. **O copie directamente estos cambios específicos:**

### LÍNEA 1335 - Cambiar:
```
<h3 class="text-2xl font-bold text-white mb-4">Dr. Ignacio Adrián Lerer</h3>
```
### POR:
```
<h3 class="text-2xl font-bold text-white mb-4">Ignacio Adrián Lerer</h3>
```

### BUSCAR "papers.ssrn.com" y verificar que sea:
```
https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=7512489
```

### DESPUÉS DE LA LÍNEA ~943, AGREGAR el disclaimer:
```html
<div class="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 max-w-4xl mx-auto mt-6">
    <p class="text-yellow-200 text-sm text-center">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <strong>AVISO IMPORTANTE:</strong> RootFinder es una herramienta experimental de investigación. 
        Los resultados NO constituyen asesoramiento legal profesional y deben ser validados con fuentes primarias y jurisprudencia actualizada.
    </p>
</div>
```

## LUEGO:
```bash
npm run build
npx wrangler pages deploy dist --project-name rootfinder-legal-ai --commit-dirty=true
```

## VERIFICACIÓN:
Todos los cambios ESTÁN HECHOS en mi versión del sandbox. Solo necesita usar el archivo correcto.