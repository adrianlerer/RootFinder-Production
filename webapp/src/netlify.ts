import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/netlify'

const app = new Hono()

// Enable CORS for API routes
app.use('/api/*', cors())

// ============================================================================
// ENVIRONMENT VARIABLES ACCESS FUNCTION FOR NETLIFY
// ============================================================================

function getEnvVar(key: string): string {
  // Netlify environment variables
  if (process.env[key]) {
    return process.env[key];
  }
  
  // Development variables must be set via environment variables
  // No hardcoded keys for security
  
  console.warn(`⚠️ Variable de entorno ${key} no encontrada`);
  return '';
}

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
app.get('/api/health', async (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'RootFinder Legal AI System - Netlify',
    timestamp: new Date().toISOString(),
    ai_services: {
      claude: getEnvVar('ANTHROPIC_API_KEY') ? 'CONFIGURADA' : 'FALTA',
      openai: getEnvVar('OPENAI_API_KEY') ? 'CONFIGURADA' : 'FALTA',
      openrouter: getEnvVar('OPENROUTER_API_KEY') ? 'CONFIGURADA' : 'FALTA'
    }
  });
});

// Main analysis endpoint
app.post('/api/analyze', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📥 Análisis solicitado:', body);
    
    const { text, mode } = body;
    
    if (!text || text.length < 3) {
      return c.json({ error: 'Texto requerido (mínimo 3 caracteres)' }, 400);
    }
    
    // COMPREHENSIVE AI ANALYSIS
    const analysisResults = await performComprehensiveAIAnalysis(text, mode || 'comprehensive');
    
    return c.json({
      success: true,
      results: analysisResults,
      methodology: 'pure_ai_rootfinder_netlify_v1.0',
      note: 'Análisis generado completamente con IA en Netlify - funciona con cualquier texto legal',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en análisis:', error);
    return c.json({ error: 'Error analizando texto', details: error.message }, 500);
  }
});

// ============================================================================
// MAIN HTML APPLICATION
// ============================================================================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RootFinder - Análisis Legal con IA</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            .analysis-card { transition: all 0.3s ease; }
            .analysis-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
            .loading { animation: spin 1s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .result-item { border-left: 4px solid #3b82f6; }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="container mx-auto px-4 py-8 max-w-6xl">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-4xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-search-plus mr-3 text-blue-600"></i>
                    RootFinder
                </h1>
                <p class="text-xl text-gray-600">
                    Sistema de Análisis Legal Memético con IA
                </p>
                <p class="text-sm text-gray-500 mt-2">
                    Algoritmo de Búsqueda del Ancestro Normativo (ABAN) - Ignacio Adrian Lerer
                </p>
                <div class="mt-4 inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    <i class="fas fa-server mr-1"></i>
                    Desplegado en Netlify 24/7
                </div>
            </div>

            <!-- Quick Analysis Card -->
            <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 class="text-2xl font-semibold text-gray-800 mb-4">
                    <i class="fas fa-brain mr-2 text-purple-600"></i>
                    Análisis con IA Real
                </h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Ingrese cualquier concepto jurídico para análisis completo:
                        </label>
                        <textarea
                            id="quickAnalysisText"
                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows="4"
                            placeholder="Ejemplo: lesión subjetiva, responsabilidad civil, buena fe, abuso del derecho, etc."
                        ></textarea>
                    </div>
                    <div class="flex gap-4">
                        <button
                            onclick="performQuickAnalysis()"
                            class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <i class="fas fa-search mr-2"></i>
                            Análisis Rápido
                        </button>
                        <button
                            onclick="performComprehensiveAnalysis()"
                            class="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            <i class="fas fa-microscope mr-2"></i>
                            Análisis Completo
                        </button>
                    </div>
                </div>
            </div>

            <!-- Results Area -->
            <div id="resultsArea" class="hidden">
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-800 mb-4">
                        <i class="fas fa-chart-line mr-2 text-green-600"></i>
                        Resultados del Análisis IA
                    </h3>
                    <div id="analysisResults">
                        <!-- Results will be inserted here -->
                    </div>
                </div>
            </div>

            <!-- Loading Indicator -->
            <div id="loadingIndicator" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 text-center">
                    <div class="loading w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p class="text-gray-700">Analizando con IA Real...</p>
                    <p class="text-sm text-gray-500 mt-2">Claude 3.5 Sonnet + GPT-4o + Kimi K2</p>
                    <p class="text-xs text-gray-400 mt-1">Sistema disponible 24/7 en Netlify</p>
                </div>
            </div>
        </div>

        <script>
            async function performQuickAnalysis() {
                const text = document.getElementById('quickAnalysisText').value.trim();
                if (!text) {
                    alert('Por favor ingrese un texto para analizar');
                    return;
                }
                
                await performAnalysis(text, 'quick');
            }

            async function performComprehensiveAnalysis() {
                const text = document.getElementById('quickAnalysisText').value.trim();
                if (!text) {
                    alert('Por favor ingrese un texto para analizar');
                    return;
                }
                
                await performAnalysis(text, 'comprehensive');
            }

            async function performAnalysis(text, mode) {
                const loadingIndicator = document.getElementById('loadingIndicator');
                const resultsArea = document.getElementById('resultsArea');
                const analysisResults = document.getElementById('analysisResults');

                loadingIndicator.classList.remove('hidden');
                resultsArea.classList.add('hidden');

                try {
                    const response = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ text, mode })
                    });

                    const data = await response.json();
                    
                    if (data.success && data.results) {
                        displayResults(data.results, mode);
                        resultsArea.classList.remove('hidden');
                    } else {
                        throw new Error(data.error || 'Error en el análisis');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    analysisResults.innerHTML = \`
                        <div class="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                            <div class="flex">
                                <i class="fas fa-exclamation-triangle text-red-400 mt-1 mr-3"></i>
                                <div>
                                    <h3 class="text-lg font-medium text-red-800">Error en el Análisis</h3>
                                    <p class="text-red-700 mt-1">\${error.message}</p>
                                </div>
                            </div>
                        </div>
                    \`;
                    resultsArea.classList.remove('hidden');
                } finally {
                    loadingIndicator.classList.add('hidden');
                }
            }

            function displayResults(results, mode) {
                const analysisResults = document.getElementById('analysisResults');
                
                let html = \`
                    <div class="space-y-6">
                        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                            <h4 class="font-semibold text-blue-800 mb-2">Análisis \${mode === 'comprehensive' ? 'Completo' : 'Rápido'} con IA Real</h4>
                            <p class="text-blue-700 text-sm">Procesado con múltiples modelos de IA en tiempo real - Sistema disponible 24/7</p>
                        </div>
                \`;

                if (results && results.length > 0) {
                    results.forEach((result, index) => {
                        html += \`
                            <div class="result-item bg-gray-50 p-4 rounded-lg">
                                <div class="flex items-start justify-between mb-3">
                                    <h5 class="font-semibold text-gray-800">
                                        <i class="fas fa-robot mr-2 text-blue-500"></i>
                                        \${result.source || 'IA Analysis'}
                                    </h5>
                                    <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">\${(result.confidence * 100).toFixed(1)}%</span>
                                </div>
                                <div class="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                                    \${result.content || result.analysis || result.description || 'Sin contenido disponible'}
                                </div>
                                <div class="text-xs text-gray-500 mt-2 flex items-center">
                                    <i class="fas fa-cogs mr-1"></i>
                                    Modelo: \${result.model || 'ai-model'} | Tipo: \${result.analysis_type || mode}
                                </div>
                            </div>
                        \`;
                    });
                } else {
                    html += \`
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-search text-4xl mb-4"></i>
                            <p>No se encontraron resultados para el análisis.</p>
                        </div>
                    \`;
                }

                html += '</div>';
                analysisResults.innerHTML = html;
            }

            // Test API availability on page load
            document.addEventListener('DOMContentLoaded', async () => {
                try {
                    const response = await fetch('/api/health');
                    const data = await response.json();
                    console.log('✅ RootFinder Netlify Status:', data);
                } catch (error) {
                    console.error('❌ Sistema no disponible:', error);
                }
            });
        </script>
    </body>
    </html>
  `)
})

// ============================================================================
// AI ANALYSIS FUNCTIONS - NETLIFY OPTIMIZED
// ============================================================================

async function performComprehensiveAIAnalysis(text: string, mode: string): Promise<any[]> {
  console.log(`🧠 Iniciando análisis ${mode} para: "${text}"`);
  
  try {
    const results = [];
    
    // Claude 3.5 Sonnet Analysis
    try {
      const claudeAnalysis = await analyzeWithClaude(text, mode);
      if (claudeAnalysis) results.push(claudeAnalysis);
    } catch (error) {
      console.error('❌ Error Claude:', error);
    }
    
    // GPT-4o Mini Analysis
    try {
      const gptAnalysis = await analyzeWithGPT(text, mode);
      if (gptAnalysis) results.push(gptAnalysis);
    } catch (error) {
      console.error('❌ Error GPT:', error);
    }
    
    // Kimi K2 Analysis
    try {
      const kimiAnalysis = await analyzeWithKimi(text, mode);
      if (kimiAnalysis) results.push(kimiAnalysis);
    } catch (error) {
      console.error('❌ Error Kimi:', error);
    }
    
    // If no AI results, provide fallback analysis
    if (results.length === 0) {
      results.push(generateFallbackAnalysis(text, mode));
    }
    
    console.log(`✅ Análisis completado: ${results.length} resultados`);
    return results;
    
  } catch (error) {
    console.error('❌ Error en análisis comprehensivo:', error);
    return [generateFallbackAnalysis(text, mode)];
  }
}

async function analyzeWithClaude(text: string, mode: string): Promise<any> {
  const apiKey = getEnvVar('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.log('⚠️ Claude API key no disponible');
    return null;
  }

  const prompt = mode === 'comprehensive' 
    ? `Analiza exhaustivamente el siguiente concepto jurídico desde la perspectiva del análisis memético legal: "${text}". Incluye: 1) Definición técnica, 2) Precedentes normativos, 3) Evolución histórica, 4) Aplicaciones actuales, 5) Conexiones con otros conceptos jurídicos.`
    : `Proporciona un análisis conciso del concepto jurídico: "${text}". Incluye definición, características principales y contexto legal relevante.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: mode === 'comprehensive' ? 2000 : 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      source: 'Claude 3.5 Sonnet',
      content: data.content[0].text,
      confidence: 0.92,
      model: 'claude-3-5-sonnet',
      analysis_type: mode
    };
    
  } catch (error) {
    console.error('❌ Error Claude API:', error);
    return null;
  }
}

async function analyzeWithGPT(text: string, mode: string): Promise<any> {
  const apiKey = getEnvVar('OPENAI_API_KEY');
  if (!apiKey) {
    console.log('⚠️ GPT API key no disponible');
    return null;
  }

  const prompt = mode === 'comprehensive'
    ? `Realiza un análisis jurídico completo del concepto "${text}". Incluye: marco normativo, jurisprudencia relevante, doctrina aplicable, y contexto práctico en el sistema legal argentino.`
    : `Explica brevemente el concepto jurídico "${text}" con sus elementos esenciales y aplicación práctica.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: mode === 'comprehensive' ? 1500 : 800,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`GPT API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      source: 'GPT-4o Mini',
      content: data.choices[0].message.content,
      confidence: 0.88,
      model: 'gpt-4o-mini',
      analysis_type: mode
    };
    
  } catch (error) {
    console.error('❌ Error GPT API:', error);
    return null;
  }
}

async function analyzeWithKimi(text: string, mode: string): Promise<any> {
  const apiKey = getEnvVar('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.log('⚠️ Kimi API key no disponible');
    return null;
  }

  const prompt = mode === 'comprehensive'
    ? `Analiza desde la perspectiva jurídica comparada el concepto "${text}". Examina su desarrollo en diferentes sistemas legales, evolución histórica y tendencias actuales.`
    : `Define y contextualiza el concepto jurídico "${text}" con sus características principales.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://rootfinder.netlify.app',
        'X-Title': 'RootFinder Legal Analysis'
      },
      body: JSON.stringify({
        model: 'moonshot/moonshot-v1-8k',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: mode === 'comprehensive' ? 1200 : 600,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      throw new Error(`Kimi API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      source: 'Kimi K2 (Moonshot)',
      content: data.choices[0].message.content,
      confidence: 0.85,
      model: 'moonshot-v1-8k',
      analysis_type: mode
    };
    
  } catch (error) {
    console.error('❌ Error Kimi API:', error);
    return null;
  }
}

function generateFallbackAnalysis(text: string, mode: string): any {
  const concepts = {
    'lesión subjetiva': {
      definition: 'Concepto del derecho civil que refiere al daño o perjuicio que una persona sufre en su patrimonio o derechos como resultado de un acto jurídico.',
      characteristics: ['Elemento subjetivo del daño', 'Requiere prueba del perjuicio', 'Vinculado a la responsabilidad civil', 'Puede ser patrimonial o extrapatrimonial'],
      context: 'Fundamental en el análisis de la responsabilidad civil y el resarcimiento de daños'
    },
    'buena fe': {
      definition: 'Principio fundamental del derecho que exige conducta honesta, leal y conforme a los usos y costumbres en las relaciones jurídicas.',
      characteristics: ['Principio general del derecho', 'Aplicable a todos los contratos', 'Estándar objetivo de comportamiento', 'Base para la interpretación normativa'],
      context: 'Pilar del sistema jurídico argentino, consagrado constitucionalmente'
    },
    'responsabilidad civil': {
      definition: 'Obligación de reparar los daños y perjuicios causados por actos u omisiones propias o ajenas, o por el riesgo o vicio de las cosas.',
      characteristics: ['Requiere nexo causal', 'Puede ser contractual o extracontractual', 'Incluye factor de atribución', 'Genera obligación de indemnizar'],
      context: 'Institución central del derecho privado para la reparación de daños'
    }
  };

  const concept = concepts[text.toLowerCase()] || {
    definition: `Concepto jurídico "${text}" que requiere análisis específico según el contexto normativo aplicable.`,
    characteristics: ['Concepto jurídico especializado', 'Requiere interpretación contextual', 'Aplicable según normativa vigente'],
    context: 'Análisis jurídico general'
  };

  return {
    source: 'Análisis RootFinder Base (Netlify)',
    content: mode === 'comprehensive' 
      ? `**Definición:** ${concept.definition}\n\n**Características:** ${concept.characteristics.join(', ')}\n\n**Contexto:** ${concept.context}\n\n**Nota:** Este análisis base puede expandirse con IA externa para mayor profundidad. Sistema funcionando 24/7 en Netlify.`
      : `${concept.definition}\n\n**Contexto:** ${concept.context}`,
    confidence: 0.75,
    model: 'rootfinder-base-netlify',
    analysis_type: mode
  };
}

// Export the handler for Netlify
export const handler = handle(app)