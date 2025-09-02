# Proceso de Sincronización Repositorios

## 🔄 Flujo: Privado → Público

### Repositorios
- **🔒 PRIVADO**: Desarrollo completo con secrets
- **🌐 PÚBLICO**: Código limpio sin secrets (este repo)

## 📋 Lista de Verificación Pre-Sync

Antes de sincronizar al repo público, verificar:

### ❌ ELIMINAR/REEMPLAZAR
- [ ] API Keys reales → Variables de ejemplo
- [ ] Códigos de acceso → Placeholders  
- [ ] Emails específicos → Variables genéricas
- [ ] Configuraciones de desarrollo → Configuraciones de ejemplo
- [ ] Archivos de testing → Solo estructura necesaria

### ✅ MANTENER
- [ ] Código funcional principal
- [ ] Documentación técnica
- [ ] Estructura del proyecto
- [ ] README profesional
- [ ] Configuración de deployment
- [ ] Metodología ABAN

## 🛠️ Proceso Manual de Sync

### 1. Preparar Código Limpio
```bash
# En repo privado
git checkout main
git pull origin main

# Crear branch de limpieza
git checkout -b public-sync-$(date +%Y%m%d)

# Limpiar secrets
sed -i 's/ABAN2025/REPLACE_WITH_YOUR_SECRET/g' src/index.tsx
sed -i 's/adrian@lerer.com.ar/your-admin@email.com/g' src/index.tsx

# Verificar limpieza
grep -r "ABAN2025\|sk-" . || echo "✅ Limpio"
```

### 2. Sincronizar a Público
```bash
# Copiar archivos limpios
cp -r src/ ../RootFinder-Production/
cp package.json ../RootFinder-Production/
cp README.md ../RootFinder-Production/

# Push al público
cd ../RootFinder-Production/
git add .
git commit -m "Sync: $(date '+%Y-%m-%d %H:%M')"
git push origin main
```

### 3. Revertir Cambios Privado
```bash
# Volver al privado
cd ../RootFinder-Private/
git checkout main
git branch -D public-sync-$(date +%Y%m%d)
```

## 🤖 Automatización Futura (GitHub Actions)

```yaml
# .github/workflows/sync-public.yml (en repo privado)
name: Sync to Public Repo
on:
  push:
    branches: [ main ]
    paths: [ 'src/**' ]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Clean secrets
        run: |
          sed -i 's/${{ secrets.ACCESS_CODE }}/REPLACE_WITH_YOUR_SECRET/g' src/index.tsx
      - name: Deploy to public
        uses: cpina/github-action-push-to-another-repository@main
        env:
          API_TOKEN_GITHUB: ${{ secrets.PUBLIC_REPO_TOKEN }}
        with:
          source-directory: 'src'
          destination-github-username: 'adrianlerer'
          destination-repository-name: 'RootFinder-Production'
```

## 🔐 Seguridad

### Nunca Sincronizar
- Archivos .env, .dev.vars
- ecosystem.config.cjs con keys
- Logs con información sensible
- Backups con datos reales
- Configuraciones específicas de producción

---

**© 2025 IntegridAI - Proceso de Sync Seguro**