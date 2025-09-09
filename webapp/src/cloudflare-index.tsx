import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  OPENROUTER_API_KEY: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/*', serveStatic())

// ============================================================================
// AI API FUNCTIONS
// ============================================================================

async function callOpenRouter(text: string, apiKey: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rootfinder-legal-ai.pages.dev',
        'X-Title': 'RootFinder Legal AI'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis jurídico. Realiza análisis ABAN (Algoritmo de Búsqueda del Ancestro Normativo) del texto proporcionado, identificando genealogía normativa y patrones jurídicos.'
          },
          {
            role: 'user',
            content: `Analiza este texto jurídico usando ABAN: ${text}`
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter error:', error);
    throw error;
  }
}

async function callAnthropic(text: string, apiKey: string) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Realiza un análisis jurídico genealógico profundo de este texto, identificando genealogía normativa y antecedentes doctrinarios: ${text}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Anthropic error:', error);
    throw error;
  }
}

async function callOpenAI(text: string, apiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un especialista en análisis genealógico normativo. Identifica patrones memeticos y antecedentes históricos en textos jurídicos.'
          },
          {
            role: 'user',
            content: `Analiza la genealogía normativa y patrones memeticos de este texto: ${text}`
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI error:', error);
    throw error;
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
app.get('/api/health', async (c) => {
  const { env } = c;
  return c.json({ 
    status: 'ok', 
    service: 'RootFinder Legal AI System',
    timestamp: new Date().toISOString()
  });
});

// Main analysis endpoint
app.post('/api/analyze', async (c) => {
  try {
    const { env } = c;
    const { text } = await c.req.json();
    
    if (!text || text.trim().length === 0) {
      return c.json({ error: 'Texto requerido para análisis' }, 400);
    }

    if (text.length < 10) {
      return c.json({ error: 'El texto debe tener al menos 10 caracteres' }, 400);
    }

    // Ejecutar análisis híbrido con las 3 APIs en paralelo
    const [openRouterResult, anthropicResult, openAIResult] = await Promise.allSettled([
      env.OPENROUTER_API_KEY ? callOpenRouter(text, env.OPENROUTER_API_KEY) : Promise.reject(new Error('OpenRouter key not configured')),
      env.ANTHROPIC_API_KEY ? callAnthropic(text, env.ANTHROPIC_API_KEY) : Promise.reject(new Error('Anthropic key not configured')),
      env.OPENAI_API_KEY ? callOpenAI(text, env.OPENAI_API_KEY) : Promise.reject(new Error('OpenAI key not configured'))
    ]);

    // Procesar resultados
    const results = {
      aban_analysis: '',
      genealogy: '',
      memetic_analysis: '',
      hybrid_synthesis: '',
      timestamp: new Date().toISOString(),
      success_count: 0
    };

    if (openRouterResult.status === 'fulfilled') {
      results.aban_analysis = openRouterResult.value;
      results.success_count++;
    }

    if (anthropicResult.status === 'fulfilled') {
      results.genealogy = anthropicResult.value;
      results.success_count++;
    }

    if (openAIResult.status === 'fulfilled') {
      results.memetic_analysis = openAIResult.value;
      results.success_count++;
    }

    // Verificar que al menos una API funcionó
    if (results.success_count === 0) {
      return c.json({ 
        error: 'Todas las APIs fallaron. Verificar configuración de claves.',
        details: {
          openrouter: openRouterResult.status === 'rejected' ? openRouterResult.reason.message : 'OK',
          anthropic: anthropicResult.status === 'rejected' ? anthropicResult.reason.message : 'OK', 
          openai: openAIResult.status === 'rejected' ? openAIResult.reason.message : 'OK'
        }
      }, 500);
    }

    // Crear síntesis híbrida
    results.hybrid_synthesis = `Análisis jurídico híbrido completado usando ${results.success_count} modelo(s) de IA. Procesamiento ABAN ejecutado con arquitectura distribuida para análisis genealógico normativo.`;

    return c.json(results);

  } catch (error) {
    console.error('Analysis error:', error);
    return c.json({ 
      error: 'Error interno en análisis', 
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Main page route
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
                    Sistema ABAN - Algoritmo de Búsqueda del Ancestro Normativo con arquitectura híbrida de IA
                </p>
            </header>

            <main class="max-w-4xl mx-auto">
                <!-- Status Check -->
                <div id="statusCheck" class="mb-6">
                    <div class="bg-white/10 backdrop-blur-lg rounded-xl p-4 shadow-xl">
                        <button onclick="checkStatus()" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                            <i class="fas fa-heartbeat mr-2"></i>
                            Verificar Estado del Sistema
                        </button>
                        <div id="statusResult" class="mt-4 hidden"></div>
                    </div>
                </div>

                <div class="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl">
                    <div class="mb-6">
                        <label for="legalText" class="block text-lg font-semibold mb-3">
                            <i class="fas fa-file-alt mr-2"></i>
                            Ingrese el texto jurídico a analizar:
                        </label>
                        <textarea 
                            id="legalText" 
                            class="w-full h-40 p-4 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 resize-none"
                            placeholder="Ejemplo: Artículo 19 CN - Las acciones privadas de los hombres que de ningún modo ofendan al orden y a la moral pública, ni perjudiquen a un tercero, están sólo reservadas a Dios, y exentas de la autoridad de los magistrados..."
                        ></textarea>
                    </div>

                    <button 
                        onclick="analyzeText()" 
                        class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                        <i class="fas fa-brain mr-2"></i>
                        Iniciar Análisis Jurídico ABAN
                    </button>
                </div>

                <div id="results" class="mt-8" style="display: none;">
                    <div class="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl">
                        <h2 class="text-2xl font-bold mb-6 text-center">
                            <i class="fas fa-microscope mr-2"></i>
                            Análisis Genealógico Completado
                        </h2>
                        <div id="analysisContent"></div>
                    </div>
                </div>
            </main>
        </div>

        <script>
            async function checkStatus() {
                const statusResult = document.getElementById('statusResult');
                statusResult.classList.remove('hidden');
                statusResult.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Verificando sistema...</div>';

                try {
                    const response = await fetch('/api/health');
                    
                    if (!response.ok) {
                        throw new Error(\`HTTP \${response.status}\`);
                    }
                    
                    const result = await response.json();
                    
                    statusResult.innerHTML = \`
                        <div class="bg-green-800/50 border border-green-600 rounded-lg p-4">
                            <h3 class="text-green-400 font-bold mb-2">✅ Sistema Operativo</h3>
                            <p><strong>Estado:</strong> \${result.status}</p>
                            <p><strong>Servicio:</strong> \${result.service}</p>
                            <p><strong>Último check:</strong> \${new Date(result.timestamp).toLocaleString()}</p>
                        </div>
                    \`;
                } catch (error) {
                    statusResult.innerHTML = \`
                        <div class="bg-red-800/50 border border-red-600 rounded-lg p-4">
                            <h3 class="text-red-400 font-bold mb-2">❌ Error de Sistema</h3>
                            <p>Error: \${error.message}</p>
                        </div>
                    \`;
                }
            }

            async function analyzeText() {
                const text = document.getElementById('legalText').value.trim();
                
                if (!text) {
                    alert('Por favor, ingrese un texto jurídico para analizar.');
                    return;
                }

                if (text.length < 10) {
                    alert('El texto debe tener al menos 10 caracteres para un análisis efectivo.');
                    return;
                }

                const resultsDiv = document.getElementById('results');
                const contentDiv = document.getElementById('analysisContent');
                
                contentDiv.innerHTML = \`
                    <div class="text-center">
                        <i class="fas fa-robot fa-4x mb-4 text-purple-400 animate-pulse"></i>
                        <p class="text-xl mb-2">🧠 Ejecutando análisis jurídico...</p>
                        <p class="text-gray-300">Sistema ABAN procesando con IA híbrida...</p>
                        <div class="mt-4">
                            <div class="bg-gray-800 rounded-lg p-2">
                                <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                \`;
                resultsDiv.style.display = 'block';

                try {
                    const response = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ text: text })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || \`HTTP \${response.status}\`);
                    }

                    const result = await response.json();
                    
                    if (result.error) {
                        throw new Error(result.error);
                    }
                    
                    contentDiv.innerHTML = \`
                        <div class="space-y-6">
                            \${result.aban_analysis ? \`
                            <div class="border-l-4 border-blue-400 pl-4">
                                <h3 class="text-xl font-bold text-blue-400 mb-2">🔍 Análisis ABAN</h3>
                                <p class="text-gray-300 whitespace-pre-wrap">\${result.aban_analysis}</p>
                            </div>
                            \` : ''}
                            
                            \${result.genealogy ? \`
                            <div class="border-l-4 border-purple-400 pl-4">
                                <h3 class="text-xl font-bold text-purple-400 mb-2">🧬 Genealogía Normativa</h3>
                                <p class="text-gray-300 whitespace-pre-wrap">\${result.genealogy}</p>
                            </div>
                            \` : ''}
                            
                            \${result.memetic_analysis ? \`
                            <div class="border-l-4 border-green-400 pl-4">
                                <h3 class="text-xl font-bold text-green-400 mb-2">🧠 Análisis Memético</h3>
                                <p class="text-gray-300 whitespace-pre-wrap">\${result.memetic_analysis}</p>
                            </div>
                            \` : ''}
                            
                            <div class="border-l-4 border-yellow-400 pl-4">
                                <h3 class="text-xl font-bold text-yellow-400 mb-2">⚡ Síntesis Híbrida</h3>
                                <p class="text-gray-300">\${result.hybrid_synthesis}</p>
                            </div>
                            
                            <div class="border-l-4 border-gray-400 pl-4">
                                <h3 class="text-xl font-bold text-gray-400 mb-2">📊 Procesamiento</h3>
                                <p class="text-gray-300">Análisis completado: \${new Date(result.timestamp).toLocaleString()}</p>
                                <p class="text-gray-300">Modelos utilizados: \${result.success_count}/3</p>
                            </div>
                        </div>
                    \`;
                } catch (error) {
                    contentDiv.innerHTML = \`
                        <div class="text-center text-red-400">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p class="text-xl mb-2">Error en análisis</p>
                            <p class="text-gray-300">\${error.message}</p>
                            <p class="text-sm mt-2">Verificar configuración de API keys en Cloudflare</p>
                        </div>
                    \`;
                }
            }

            // Auto-check status on load
            window.addEventListener('load', () => {
                setTimeout(checkStatus, 1000);
            });
        </script>
    </body>
    </html>
  `);
});

export default app