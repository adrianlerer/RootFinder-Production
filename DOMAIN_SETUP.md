# Configuración de Dominios - RootFinder

## 🌐 Dominios Activos

- **Principal Internacional**: rootfinder.io ✅ Activo
- **Argentina**: rootfinder.com.ar ✅ Registrado (pendiente configuración)

## ⚙️ Configuración DNS para rootfinder.com.ar

### Paso 1: Configurar Nameservers en el Registrar
Cambiar nameservers a Cloudflare:
```
isla.ns.cloudflare.com
walt.ns.cloudflare.com
```

### Paso 2: Agregar Dominio en Cloudflare Pages
```bash
# Agregar dominio personalizado al proyecto
npx wrangler pages domain add rootfinder.com.ar --project-name rootfinder-legal-ai
```

### Paso 3: Configurar Registros DNS en Cloudflare
```
Tipo: CNAME
Nombre: @  
Valor: rootfinder-legal-ai.pages.dev
Proxy: ✅ Activado (orange cloud)

Tipo: CNAME  
Nombre: www
Valor: rootfinder.com.ar
Proxy: ✅ Activado (orange cloud)
```

### Paso 4: Verificación SSL
Cloudflare configurará automáticamente:
- ✅ SSL/TLS Universal
- ✅ Certificados Edge
- ✅ HTTP → HTTPS Redirect

## 🔄 Estrategia Multi-Dominio

### Redirecciones Recomendadas
- `www.rootfinder.com.ar` → `rootfinder.com.ar`
- `rootfinder.io` mantener como principal internacional
- `rootfinder.com.ar` específico para Argentina

### Page Rules (Cloudflare)
```
www.rootfinder.com.ar/*
→ Redirect: https://rootfinder.com.ar/$1 (301)

rootfinder.io/ar*  
→ Redirect: https://rootfinder.com.ar/$1 (301)
```

## 📊 Beneficios Estratégicos

### SEO Argentina
- ✅ Dominio .com.ar aumenta confianza local
- ✅ Mejor ranking en Google Argentina  
- ✅ Credibilidad profesional jurídica

### Marketing Legal
- ✅ Presencia profesional argentina
- ✅ Compliance con normativas locales
- ✅ Diferenciación competitiva

---

**© 2025 IntegridAI - Ignacio Adrián Lerer**