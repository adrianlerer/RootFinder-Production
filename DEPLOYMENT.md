# Guía de Despliegue - RootFinder

## 🚀 Configuración Rápida

### 1. Requisitos
- Node.js 18+
- Cuenta Cloudflare
- API Keys de IA (Anthropic, OpenAI, OpenRouter)

### 2. Instalación

```bash
# Clonar repositorio
git clone https://github.com/adrianlerer/RootFinder-Production.git
cd RootFinder-Production

# Instalar dependencias
npm install
```

### 3. Configuración de Variables

```bash
# Copiar archivo de ejemplo
cp .env.example .dev.vars

# Editar con sus API keys
nano .dev.vars
```

### 4. Despliegue Local

```bash
# Construir
npm run build

# Desarrollo local
npm run preview
```

### 5. Despliegue a Cloudflare Pages

```bash
# Autenticarse (una sola vez)
npx wrangler login

# Crear proyecto (una sola vez)
npx wrangler pages project create rootfinder-legal-ai --production-branch main

# Desplegar
npm run deploy
```

## 🔑 Configuración de Secretos

Para producción, use Cloudflare secrets:

```bash
# Configurar secrets en Cloudflare
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name rootfinder-legal-ai
npx wrangler pages secret put OPENAI_API_KEY --project-name rootfinder-legal-ai  
npx wrangler pages secret put OPENROUTER_API_KEY --project-name rootfinder-legal-ai
```

## 🌐 Configuración de Dominio Personalizado

```bash
# Agregar dominio personalizado
npx wrangler pages domain add your-domain.com --project-name rootfinder-legal-ai
```

## 📊 Monitoreo

- Dashboard Cloudflare: Analytics y logs
- Wrangler CLI: `npx wrangler pages deployment list`

---

**© 2025 IntegridAI - Ignacio Adrián Lerer**