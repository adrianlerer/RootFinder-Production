# RootFinder Web Application

## Sistema ABAN - Análisis Jurídico Memético Profesional

Este directorio contiene la implementación completa de la aplicación web RootFinder con sistema de protección anti-abuso integrado.

### 🔍 **Sistema Anti-Abuso Implementado**

#### **Detección Inteligente de Documentos Extensos:**
- Detecta automáticamente documentos como "Ley Bases", "Ley Ómnibus", códigos completos
- Límites cuantitativos:
  - Análisis individual: >200KB o >100 artículos
  - Análisis de corpus: >150KB o >80 artículos
- Estimación de costos automática ($1-5, $5-15, $15-30 USD)

#### **Características de Seguridad:**
- Autenticación por email requerida
- Rate limiting (10 consultas por email en modo demo)
- Protección administrativa para adrian@lerer.com.ar
- Verificación por código para acceso administrativo
- Sistema de logging y auditoría

### 🚀 **Deployment**

#### **Local Development:**
```bash
cd webapp
npm install
npm run build
npm run dev:sandbox
```

#### **Producción (Cloudflare Pages):**
```bash
# Setup API keys
npx wrangler pages secret put ANTHROPIC_API_KEY
npx wrangler pages secret put OPENAI_API_KEY
npx wrangler pages secret put OPENROUTER_API_KEY

# Deploy
npm run build
npx wrangler pages deploy dist --project-name rootfinder-production
```

### 📋 **URLs de Producción**
- **Principal**: https://rootfinder.legal
- **Backup**: https://rootfinder.com.ar
- **GitHub**: https://github.com/adrianlerer/RootFinder-Production

### 🛡️ **Arquitectura de Seguridad**

El sistema implementa las mejores prácticas de OWASP para aplicaciones agénticas:

1. **Single-Agent Architecture**: Minimiza superficie de ataque
2. **Memory Limitada**: Solo sesión actual (KC4.1)
3. **API Access Controlado**: Limited API Access (KC6.1.1)
4. **Rate Limiting**: Protección contra abuso
5. **Input Validation**: Sanitización de textos legales

### 🎯 **Casos de Uso**

#### **Análisis Individual:**
- Artículos específicos de leyes
- Fragmentos normativos
- Cláusulas legales puntuales

#### **Análisis de Corpus:**
- Constituciones completas
- Códigos legales
- Leyes extensas
- Decretos reglamentarios

### 📊 **Métricas de Uso**

La aplicación incluye sistema de métricas:
- Cantidad de análisis por usuario
- Tipos de documentos analizados
- Documentos extensos detectados
- Tiempo promedio de procesamiento

### 🔧 **Configuración Técnica**

#### **Variables de Entorno:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
OPENROUTER_API_KEY=sk-or-v1-...
RESEND_API_KEY=re_... (opcional para emails)
```

#### **Base de Datos D1:**
- Usuarios y autenticación
- Log de consultas
- Códigos de verificación
- Estadísticas de uso

### 📖 **Metodología ABAN**

El sistema implementa el Algoritmo de Búsqueda del Ancestro Normativo:

1. **Análisis Genealógico**: Identifica antecedentes normativos
2. **Cadenas de Modificación**: Rastrea evolución legislativa  
3. **Contexto Histórico**: Proporciona marco temporal
4. **Relaciones Jurisprudenciales**: Conecta doctrina y precedentes

### ⚠️ **Disclaimer Legal**

RootFinder es una herramienta experimental de investigación. Los resultados NO constituyen asesoramiento legal profesional y deben ser validados con fuentes primarias y jurisprudencia actualizada.

### 📧 **Soporte**

Para consultas técnicas o académicas:
- Email: adrian@lerer.com.ar
- ORCID: https://orcid.org/0009-0007-6378-9749
- LinkedIn: https://linkedin.com/in/adrianlerer