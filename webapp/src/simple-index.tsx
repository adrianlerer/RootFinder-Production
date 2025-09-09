import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  OPENROUTER_API_KEY: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('*', cors())

// Health check - simple test
app.get('/api/health', async (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'RootFinder Legal AI',
    timestamp: new Date().toISOString()
  });
});

// Main page with embedded HTML
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RootFinder - Análisis Jurídico con IA</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 min-h-screen text-white">
        <div class="container mx-auto px-4 py-8">
            <header class="text-center mb-12">
                <div class="flex items-center justify-center mb-6">
                    <i class="fas fa-search text-6xl text-blue-400 mr-4"></i>
                    <div>
                        <h1 class="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            RootFinder
                        </h1>
                        <p class="text-xl text-blue-300 mt-2">Análisis Jurídico Memético con IA</p>
                    </div>
                </div>
                <p class="text-gray-300 max-w-2xl mx-auto">
                    Sistema ABAN funcionando en Cloudflare Pages
                </p>
            </header>

            <main class="max-w-4xl mx-auto">
                <div class="bg-white/10 backdrop-blur-lg rounded-xl p-4 shadow-xl mb-6">
                    <button onclick="checkStatus()" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                        <i class="fas fa-heartbeat mr-2"></i>
                        Verificar Estado del Sistema
                    </button>
                    <div id="statusResult" class="mt-4 hidden"></div>
                </div>

                <div class="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl">
                    <h2 class="text-2xl font-bold text-center mb-6">🚀 RootFinder Deployado Exitosamente</h2>
                    <div class="space-y-4 text-center">
                        <p class="text-green-400 text-xl">✅ Cloudflare Pages funcionando</p>
                        <p class="text-blue-400">✅ Worker desplegado correctamente</p>
                        <p class="text-purple-400">⚠️ APIs pendientes de configuración</p>
                    </div>
                    
                    <div class="mt-8 p-4 bg-blue-900/30 rounded-lg">
                        <h3 class="text-lg font-bold mb-2">Próximo paso:</h3>
                        <p class="text-gray-300">Configurar las API keys en el dashboard de Cloudflare para activar el análisis jurídico completo.</p>
                    </div>
                </div>
            </main>
        </div>

        <script>
            async function checkStatus() {
                const statusResult = document.getElementById('statusResult');
                statusResult.classList.remove('hidden');
                statusResult.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Verificando...</div>';

                try {
                    const response = await fetch('/api/health');
                    const result = await response.json();
                    
                    statusResult.innerHTML = \`
                        <div class="bg-green-800/50 border border-green-600 rounded-lg p-4">
                            <h3 class="text-green-400 font-bold mb-2">✅ Sistema Operativo</h3>
                            <p><strong>Estado:</strong> \${result.status}</p>
                            <p><strong>Servicio:</strong> \${result.service}</p>
                            <p><strong>Timestamp:</strong> \${new Date(result.timestamp).toLocaleString()}</p>
                        </div>
                    \`;
                } catch (error) {
                    statusResult.innerHTML = \`
                        <div class="bg-red-800/50 border border-red-600 rounded-lg p-4">
                            <h3 class="text-red-400 font-bold mb-2">❌ Error</h3>
                            <p>Error: \${error.message}</p>
                        </div>
                    \`;
                }
            }
        </script>
    </body>
    </html>
  `);
});

export default app