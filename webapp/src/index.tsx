import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  DB?: D1Database;
  RESEND_API_KEY?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('*', cors())

// Helper function to check API availability
function checkAPIAvailability(env: Bindings) {
  return {
    anthropic: !!env.ANTHROPIC_API_KEY,
    openai: !!env.OPENAI_API_KEY,
    openrouter: !!env.OPENROUTER_API_KEY,
    allConfigured: !!(env.ANTHROPIC_API_KEY && env.OPENAI_API_KEY && env.OPENROUTER_API_KEY)
  };
}

// Database functions
const DEMO_LIMIT = 10;
const ADMIN_EMAIL = 'adrian@lerer.com.ar';
const ADMIN_ACCESS_CODE = 'ABAN2025'; // Código secreto para acceso completo

async function initializeDatabase(db: D1Database) {
  try {
    // Create users table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        usage_count INTEGER DEFAULT 0,
        first_access DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create queries table for detailed tracking
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        query_type TEXT NOT NULL,
        text_preview TEXT,
        analysis_type TEXT,
        document_title TEXT,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email)
      )
    `).run();

    // Create auth codes table for admin verification
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

async function checkUsageLimit(email: string, db: D1Database, accessCode?: string): Promise<{ allowed: boolean; remaining: number; isAdmin: boolean }> {
  // Check if user is admin - either with access code OR already authenticated as admin
  const isAdminWithCode = email === ADMIN_EMAIL && accessCode === ADMIN_ACCESS_CODE;
  const isAdminEmail = email === ADMIN_EMAIL;
  
  // If it's admin email, give unlimited access (user already authenticated through login flow)
  if (isAdminEmail) {
    return { allowed: true, remaining: -1, isAdmin: true };
  }

  try {
    // Get or create user
    let user = await db.prepare(`
      SELECT usage_count FROM users WHERE email = ?
    `).bind(email).first();

    if (!user) {
      // Create new user
      await db.prepare(`
        INSERT INTO users (email, is_admin, usage_count) VALUES (?, ?, ?)
      `).bind(email, isAdmin, 0).run();
      user = { usage_count: 0 };
    }

    const currentUsage = user.usage_count || 0;
    const remaining = Math.max(0, DEMO_LIMIT - currentUsage);
    
    return {
      allowed: currentUsage < DEMO_LIMIT,
      remaining,
      isAdmin: false
    };
  } catch (error) {
    console.error('Usage check error:', error);
    // Fallback to allow access if DB fails
    return { allowed: true, remaining: DEMO_LIMIT, isAdmin: false };
  }
}

async function incrementUsage(email: string, queryType: string, textPreview: string, analysisType: string, documentTitle: string, db: D1Database, isAdmin: boolean = false): Promise<void> {
  if (isAdmin) return; // Admin has unlimited access

  try {
    // Update user usage count
    await db.prepare(`
      UPDATE users 
      SET usage_count = usage_count + 1, last_access = CURRENT_TIMESTAMP 
      WHERE email = ?
    `).bind(email).run();

    // Log detailed query
    await db.prepare(`
      INSERT INTO queries (user_email, query_type, text_preview, analysis_type, document_title, success)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(email, queryType, textPreview.substring(0, 200), analysisType, documentTitle, true).run();
    
  } catch (error) {
    console.error('Usage increment error:', error);
  }
}

async function logFailedQuery(email: string, queryType: string, errorMessage: string, db: D1Database): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO queries (user_email, query_type, success, error_message)
      VALUES (?, ?, ?, ?)
    `).bind(email, queryType, false, errorMessage).run();
  } catch (error) {
    console.error('Failed query log error:', error);
  }
}

// Send authentication code for admin
app.post('/api/send-auth-code', async (c) => {
  try {
    if (c.env.DB) {
      await initializeDatabase(c.env.DB);
    }

    const { email } = await c.req.json();
    
    if (email !== ADMIN_EMAIL) {
      return c.json({
        error: 'Email no autorizado para código de verificación',
        message: 'Este email no requiere código de verificación'
      }, 400);
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (c.env.DB) {
      // Store code in database
      await c.env.DB.prepare(`
        INSERT INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)
      `).bind(email, code, expiresAt.toISOString()).run();
    }

    // Send email if Resend API key is available
    if (c.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'RootFinder <noreply@rootfinder.legal>',
            to: [email],
            subject: 'RootFinder - Código de Acceso Administrativo',
            html: `
              <h2>Código de Acceso RootFinder</h2>
              <p>Su código de verificación es:</p>
              <h1 style="font-size: 32px; font-family: monospace; color: #2563eb;">${code}</h1>
              <p>Este código expira en 10 minutos.</p>
              <p>Si no solicitó este código, ignore este mensaje.</p>
              <hr>
              <p style="color: #666; font-size: 12px;">RootFinder - Sistema ABAN © Ignacio Adrián Lerer 2025</p>
            `
          })
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    }

    return c.json({
      success: true,
      message: 'Código de verificación enviado a su email',
      codeForDemo: c.env.RESEND_API_KEY ? undefined : code // Solo para demo sin email configurado
    });

  } catch (error) {
    return c.json({
      error: 'Error enviando código',
      message: error.message || 'Error interno del servidor'
    }, 500);
  }
});

// Verify authentication code
app.post('/api/verify-code', async (c) => {
  try {
    const { email, code } = await c.req.json();
    
    if (!c.env.DB) {
      return c.json({
        error: 'Base de datos no configurada',
        message: 'Sistema de verificación no disponible'
      }, 503);
    }

    // Get valid code from database
    const authCode = await c.env.DB.prepare(`
      SELECT * FROM auth_codes 
      WHERE email = ? AND code = ? AND used = FALSE AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).bind(email, code).first();

    if (!authCode) {
      return c.json({
        error: 'Código inválido o expirado',
        message: 'Verifique el código e intente nuevamente'
      }, 400);
    }

    // Mark code as used
    await c.env.DB.prepare(`
      UPDATE auth_codes SET used = TRUE WHERE id = ?
    `).bind(authCode.id).run();

    // Get or create user
    const usage = await checkUsageLimit(email, c.env.DB);

    return c.json({
      success: true,
      user: {
        email,
        isAdmin: usage.isAdmin,
        remainingQueries: usage.remaining,
        unlimited: usage.isAdmin,
        verified: true
      }
    });

  } catch (error) {
    return c.json({
      error: 'Error de verificación',
      message: error.message || 'Error interno del servidor'
    }, 500);
  }
});

// Login endpoint
app.post('/api/login', async (c) => {
  try {
    // Initialize database if exists
    if (c.env.DB) {
      await initializeDatabase(c.env.DB);
    }

    const { email, accessCode } = await c.req.json();
    
    if (!email || !email.includes('@')) {
      return c.json({
        error: 'Email válido requerido',
        message: 'Proporcione un email válido para acceder al sistema de demo'
      }, 400);
    }

    // Check if trying to access admin account
    if (email === ADMIN_EMAIL) {
      if (!accessCode || accessCode !== ADMIN_ACCESS_CODE) {
        return c.json({
          error: 'Código de acceso requerido',
          message: 'Este email requiere un código de acceso especial para acceso completo',
          requiresAccessCode: true
        }, 403);
      }
    }

    const usage = c.env.DB 
      ? await checkUsageLimit(email, c.env.DB, accessCode)
      : { allowed: true, remaining: DEMO_LIMIT, isAdmin: email === ADMIN_EMAIL && accessCode === ADMIN_ACCESS_CODE };
    
    return c.json({
      success: true,
      user: {
        email,
        isAdmin: usage.isAdmin,
        remainingQueries: usage.remaining,
        unlimited: usage.isAdmin
      }
    });

  } catch (error) {
    return c.json({
      error: 'Error de autenticación',
      message: error.message || 'Error interno del servidor'
    }, 500);
  }
});

// API Status endpoint
app.get('/api/status', async (c) => {
  const apiStatus = checkAPIAvailability(c.env);
  const email = c.req.header('X-User-Email');
  let userStatus = null;
  
  if (email) {
    const usage = checkUsageLimit(email);
    userStatus = {
      email,
      isAdmin: usage.isAdmin,
      remainingQueries: usage.remaining,
      unlimited: usage.isAdmin
    };
  }
  
  return c.json({
    status: 'ok',
    service: 'RootFinder Legal AI',
    timestamp: new Date().toISOString(),
    apis: apiStatus,
    user: userStatus
  });
});

// Admin stats endpoint (only for verified admin)
app.get('/api/admin/stats', async (c) => {
  try {
    const email = c.req.header('X-User-Email');
    const isVerified = c.req.header('X-User-Verified') === 'true';
    
    if (email !== ADMIN_EMAIL || !isVerified) {
      return c.json({
        error: 'Acceso no autorizado',
        message: 'Solo el administrador verificado puede ver estadísticas'
      }, 403);
    }

    if (!c.env.DB) {
      return c.json({
        error: 'Base de datos no configurada',
        stats: { message: 'Estadísticas no disponibles sin base de datos' }
      });
    }

    // Get user stats
    const users = await c.env.DB.prepare(`
      SELECT email, usage_count, first_access, last_access, is_admin
      FROM users 
      ORDER BY last_access DESC
    `).all();

    // Get query stats
    const queryStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_queries,
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_queries,
        COUNT(CASE WHEN query_type = 'individual' THEN 1 END) as individual_queries,
        COUNT(CASE WHEN query_type = 'corpus' THEN 1 END) as corpus_queries,
        COUNT(DISTINCT user_email) as unique_users_with_queries
      FROM queries
    `).first();

    // Recent queries
    const recentQueries = await c.env.DB.prepare(`
      SELECT user_email, query_type, text_preview, document_title, success, timestamp
      FROM queries
      ORDER BY timestamp DESC
      LIMIT 50
    `).all();

    return c.json({
      success: true,
      stats: {
        users: users.results || [],
        queryStats: queryStats || {},
        recentQueries: recentQueries.results || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    return c.json({
      error: 'Error obteniendo estadísticas',
      message: error.message || 'Error interno del servidor'
    }, 500);
  }
});

// Health check
app.get('/api/health', async (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'RootFinder Legal AI',
    timestamp: new Date().toISOString()
  });
});

// Admin stats endpoint (only for admin user)
app.get('/api/admin/stats', async (c) => {
  try {
    const userEmail = c.req.header('X-User-Email');
    const accessCode = c.req.header('X-Access-Code');
    
    if (userEmail !== ADMIN_EMAIL || accessCode !== ADMIN_ACCESS_CODE) {
      return c.json({
        error: 'Acceso denegado',
        message: 'Solo el administrador puede ver estadísticas'
      }, 403);
    }

    if (!c.env.DB) {
      return c.json({
        error: 'Base de datos no disponible',
        message: 'Estadísticas no disponibles sin base de datos'
      }, 503);
    }

    // Get user statistics
    const userStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN usage_count > 0 THEN 1 END) as active_users,
        AVG(usage_count) as avg_usage
      FROM users
    `).first();

    // Get query statistics
    const queryStats = await c.env.DB.prepare(`
      SELECT 
        query_type,
        COUNT(*) as count,
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful
      FROM queries
      GROUP BY query_type
    `).all();

    // Get recent users
    const recentUsers = await c.env.DB.prepare(`
      SELECT 
        email,
        usage_count,
        first_access,
        last_access,
        is_admin
      FROM users
      ORDER BY last_access DESC
      LIMIT 20
    `).all();

    return c.json({
      success: true,
      stats: {
        users: userStats,
        queries: queryStats.results || [],
        recentUsers: recentUsers.results || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats error:', error);
    return c.json({
      error: 'Error obteniendo estadísticas',
      message: error.message || 'Error interno del servidor'
    }, 500);
  }
});

// Corpus Analysis - analyze entire legal documents
app.post('/api/corpus', async (c) => {
  try {
    const apiStatus = checkAPIAvailability(c.env);
    if (!apiStatus.allConfigured) {
      return c.json({
        error: 'Sistema no configurado completamente',
        message: 'Faltan algunas API keys. Configure todas las claves en Cloudflare Dashboard.',
        apis: apiStatus
      }, 503);
    }

    const { text, documentType = 'constitution', title = 'Documento Legal', analysisDepth = 'global', userEmail } = await c.req.json();
    
    console.log('DEBUG CORPUS: analysisDepth received =', analysisDepth);
    console.log('DEBUG CORPUS: title =', title);
    console.log('DEBUG CORPUS: text length =', text?.length || 0);
    
    // Check authentication and usage limits
    if (!userEmail) {
      return c.json({
        error: 'Autenticación requerida',
        message: 'Debe autenticarse para usar el sistema de análisis'
      }, 401);
    }

    // Check usage limits - admin email gets unlimited access
    if (userEmail === ADMIN_EMAIL) {
      // Admin user - unlimited access
    } else {
      const usage = c.env.DB ? await checkUsageLimit(userEmail, c.env.DB) : { allowed: true, remaining: DEMO_LIMIT, isAdmin: false };
      if (!usage.allowed) {
        return c.json({
          error: 'Límite de consultas excedido',
          message: `Ha alcanzado el límite de ${DEMO_LIMIT} consultas de demo. Contacte para acceso completo.`,
          contactInfo: 'Contacto: adrian@lerer.com.ar'
        }, 429);
      }
    }
    
    if (!text || text.trim().length === 0) {
      return c.json({
        error: 'Texto requerido',
        message: 'Debe proporcionar un corpus normativo para analizar'
      }, 400);
    }

    // EXTENSIVE DOCUMENT DETECTION SYSTEM FOR CORPUS ANALYSIS
    // Same triggers as individual analysis
    const EXTENSIVE_DOCUMENT_TRIGGERS = [
      'ley bases', 'ley de bases', 'decreto 70/2023', 'ley ómnibus',
      'régimen de incentivos', 'modernización del estado', 
      'código civil y comercial', 'código penal', 'código procesal',
      'ley de procedimiento administrativo', 'ley de contrato de trabajo',
      'constitución nacional', 'código aduanero', 'ley general del ambiente',
      'código fiscal', 'ley de sociedades comerciales', 'ley de concursos',
      'régimen penal tributario', 'ley de impuesto a las ganancias',
      'ley de iva', 'código alimentario argentino', 'ley de defensa del consumidor'
    ];

    const textLowerCase = text.toLowerCase();
    const titleLowerCase = title.toLowerCase();
    const textLength = text.length;
    
    // Count articles - more comprehensive for corpus
    const articleMatches = text.match(/art[ií]culo\s+\d+/gi) || [];
    const articleCount = articleMatches.length;
    
    // Check both text content and document title
    const hasExtensiveTrigger = EXTENSIVE_DOCUMENT_TRIGGERS.some(trigger => 
      textLowerCase.includes(trigger) || titleLowerCase.includes(trigger)
    );
    
    const isExtensiveBySize = textLength > 150000; // Lower threshold for corpus (150KB)
    const isExtensiveByArticles = articleCount > 80; // Lower threshold for corpus (80 articles)
    
    const isExtensiveDocument = hasExtensiveTrigger || isExtensiveBySize || isExtensiveByArticles;

    // For extensive corpus analysis, require user API keys (higher processing cost)
    if (isExtensiveDocument && userEmail !== ADMIN_EMAIL) {
      return c.json({
        error: 'Corpus extenso detectado',
        message: 'Este corpus requiere configuración de API keys propias para análisis completo',
        extensiveCorpus: {
          detected: true,
          title: title,
          reasons: {
            containsExtensiveLaw: hasExtensiveTrigger,
            largeSize: isExtensiveBySize,
            manyArticles: isExtensiveByArticles,
            textLength: textLength,
            articleCount: articleCount
          },
          recommendation: 'Configure sus propias API keys para análisis de corpus extensos sin restricciones'
        },
        requiresOwnApiKeys: true,
        faqSection: 'api-configuration',
        estimatedCost: articleCount > 200 ? 'Alto ($15-30 USD)' : articleCount > 100 ? 'Medio ($5-15 USD)' : 'Bajo ($1-5 USD)'
      }, 402); // 402 Payment Required
    }

    let analysisPrompt = '';
    
    console.log('DEBUG CORPUS: Checking if detailed analysis:', analysisDepth === 'detailed');
    
    if (analysisDepth === 'detailed') {
      console.log('DEBUG CORPUS: Entering detailed analysis mode');
      // Extract individual articles for multi-block processing
      const articles = text.match(/ARTÍCULO\s+\d+°?[\s\S]*?(?=ARTÍCULO\s+\d+°?|$)/gi) || [];
      console.log('DEBUG CORPUS: Articles found =', articles.length);
      
      // Security check for extensive documents
      const EXTENSIVE_DOCUMENT_TRIGGERS = [
        'ley bases', 'ley de bases', 'decreto 70/2023', 'ley ómnibus',
        'régimen de incentivos', 'modernización del estado'
      ];
      
      const textLowerCase = text.toLowerCase();
      const isExtensiveDocument = articles.length > 100 || 
                                 text.length > 200000 ||
                                 EXTENSIVE_DOCUMENT_TRIGGERS.some(trigger => textLowerCase.includes(trigger));
      
      if (isExtensiveDocument) {
        return c.json({
          success: false,
          requiresOwnAPI: true,
          message: 'Documento Extenso Detectado - Configuración API Requerida',
          documentInfo: {
            title,
            articleCount: articles.length,
            textLength: text.length,
            estimatedTokens: Math.ceil(text.length / 4)
          },
          configuration: {
            title: '🔒 PROCESAMIENTO DE DOCUMENTOS EXTENSOS',
            description: 'Para analizar documentos de gran envergadura como este, RootFinder requiere configuración de API propia.',
            benefits: [
              '✅ Procesamiento completo sin límites de demo',
              '✅ Mayor velocidad de análisis',
              '✅ Control total sobre el proceso',
              '✅ Mayor privacidad de datos'
            ],
            setup: {
              message: 'Configure sus propias API keys para análisis ilimitado:',
              apis: [
                {
                  name: 'Anthropic Claude',
                  key: 'ANTHROPIC_API_KEY',
                  url: 'https://console.anthropic.com/',
                  description: 'Motor principal de análisis ABAN'
                },
                {
                  name: 'OpenAI GPT',
                  key: 'OPENAI_API_KEY', 
                  url: 'https://platform.openai.com/',
                  description: 'Validación cruzada y verificación'
                }
              ],
              envExample: `# Archivo .env para configuración local
ANTHROPIC_API_KEY=sk-ant-api03-tu-key-aqui
OPENAI_API_KEY=sk-proj-tu-key-aqui

# Para Cloudflare Pages (producción)
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name tu-proyecto
npx wrangler pages secret put OPENAI_API_KEY --project-name tu-proyecto`
            }
          },
          usage: {
            remainingQueries: 0,
            isAdmin: userEmail === ADMIN_EMAIL
          }
        });
      }
      
      if (articles.length > 5) {
        // Multi-block processing for comprehensive analysis
        let completeAnalysis = `ANÁLISIS GENEALÓGICO ABAN EXHAUSTIVO - ${title}\n\n`;
        completeAnalysis += `TOTAL DE ARTÍCULOS IDENTIFICADOS: ${articles.length}\n`;
        completeAnalysis += `METODOLOGÍA: Procesamiento por bloques para maximizar completitud del análisis\n\n`;
        
        const blockSize = 5; // Process 5 articles at a time to avoid token limits
        const totalBlocks = Math.ceil(articles.length / blockSize);
        
        // Process each block sequentially
        for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex++) {
          const blockStart = blockIndex * blockSize;
          const blockEnd = Math.min(blockStart + blockSize, articles.length);
          const blockArticles = articles.slice(blockStart, blockEnd);
          
          const blockPrompt = `Análisis ABAN - BLOQUE ${blockIndex + 1}/${totalBlocks} del corpus "${title}"

Analiza EXCLUSIVAMENTE estos artículos específicos:

${blockArticles.map((article, index) => {
            const articleNum = blockStart + index + 1;
            return `\n=== ARTÍCULO ${articleNum}° ===\n${article.trim()}\n`;
          }).join('')}

Para CADA artículo del bloque, proporciona:
★ ARTÍCULO X° - [Identificación]
★ ESTRUCTURA MEMÉTICA: conceptos nucleares
★ CADENA DE TRANSMISIÓN: influencias históricas específicas
★ ANÁLISIS ABAN: genealogía jurídica profunda
★ VALORACIÓN: densidad memética e impacto
★ CONCLUSIÓN ARTÍCULO: síntesis genealógica

REGLAS:
- Análisis completo de CADA artículo mostrado
- NO hagas preguntas finales
- NO digas "por limitaciones de espacio"
- Formato definitivo sin interrupciones

Marca al final: "BLOQUE ${blockIndex + 1} DE ${totalBlocks} COMPLETADO"`;

          // Make API call for this block
          const blockResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': c.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 8192,
              messages: [{
                role: 'user',
                content: blockPrompt
              }]
            })
          });

          const blockData = await blockResponse.json();
          
          if (blockResponse.ok && blockData.content?.[0]?.text) {
            completeAnalysis += `\n\n=== BLOQUE ${blockIndex + 1}/${totalBlocks} ===\n`;
            completeAnalysis += blockData.content[0].text;
          } else {
            completeAnalysis += `\n\n=== ERROR EN BLOQUE ${blockIndex + 1} ===\n`;
            completeAnalysis += `Error procesando bloque: ${blockData.error?.message || 'Error desconocido'}`;
          }
        }
        
        // Final synthesis
        const synthesisPrompt = `Basado en el análisis por bloques del corpus "${title}", proporciona una SÍNTESIS GENERAL FINAL:

★ MAPA GENEALÓGICO COMPLETO del corpus
★ PRINCIPALES LÍNEAS DE INFLUENCIA identificadas
★ VALORACIÓN GLOBAL en el derecho argentino
★ IMPACTO SISTÉMICO en el ordenamiento jurídico
★ CONCLUSIONES DEFINITIVAS del análisis ABAN

Total de artículos procesados: ${articles.length}`;

        const synthesisResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': c.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: synthesisPrompt
            }]
          })
        });

        const synthesisData = await synthesisResponse.json();
        
        if (synthesisResponse.ok && synthesisData.content?.[0]?.text) {
          completeAnalysis += `\n\n=== SÍNTESIS GENERAL FINAL ===\n`;
          completeAnalysis += synthesisData.content[0].text;
        }
        
        // Return the complete multi-block analysis
        await incrementUsage(userEmail, 'corpus', title, analysisDepth, title, c.env.DB, userEmail === ADMIN_EMAIL);
        
        const updatedUsage = c.env.DB 
          ? await checkUsageLimit(userEmail, c.env.DB)
          : { remaining: userEmail === ADMIN_EMAIL ? -1 : DEMO_LIMIT - 1, isAdmin: userEmail === ADMIN_EMAIL };

        return c.json({
          success: true,
          corpus: {
            title: title,
            documentType: documentType,
            analysisDepth: analysisDepth,
            methodology: 'ABAN - Algoritmo de Búsqueda del Ancestro Normativo (Multi-Block)',
            fullAnalysis: completeAnalysis,
            metadata: {
              timestamp: new Date().toISOString(),
              articleCount: articles.length,
              totalArticles: articles.length,
              blocksProcessed: totalBlocks,
              analysisId: Math.random().toString(36).substring(7)
            }
          },
          usage: updatedUsage
        });
        
      } else {
        // Single analysis for smaller documents
        analysisPrompt = `Análisis genealógico ABAN completo del corpus "${title}":

${text}

Proporciona análisis exhaustivo de todos los artículos presentes.`;
      }
    } else {
      console.log('DEBUG CORPUS: Using global analysis mode instead of detailed');
      analysisPrompt = `Realiza un ANÁLISIS GENEALÓGICO ABAN GLOBAL del corpus normativo: "${title}".

CORPUS COMPLETO: "${text}"

INSTRUCCIONES OBLIGATORIAS:
1. Identifica la ESTRUCTURA GENERAL del documento y sus principales bloques temáticos

2. Analiza las PRINCIPALES LÍNEAS GENEALÓGICAS del corpus completo:
   - ESTRUCTURA MEMÉTICA GLOBAL: memes constitucionales y normativos centrales
   - CADENAS DE TRANSMISIÓN PRINCIPALES: influencias históricas y doctrinarias
   - ANÁLISIS COMPARATIVO: con otros textos normativos relevantes
   - VALORACIÓN GENEALÓGICA GLOBAL: importancia histórico-jurídica y densidad memética

3. SÍNTESIS EJECUTIVA COMPLETA:
   - Principales características y innovaciones del documento
   - Influencias identificadas y su relevancia
   - Impacto en el sistema jurídico nacional
   - Conclusiones definitivas del análisis ABAN

REGLAS CRÍTICAS:
- NO hagas preguntas al final
- NO solicites aclaraciones o continuaciones
- Proporciona análisis completo y conclusivo
- Formato definitivo sin interrupciones

FORMATO: Informe ejecutivo profesional completo con visión panorámica definitiva.`;
    }

    // AI analysis
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: analysisPrompt
        }]
      })
    });

    const anthropicData = await anthropicResponse.json();
    
    if (!anthropicResponse.ok) {
      throw new Error(`Error en análisis: ${anthropicData.error?.message || 'Error desconocido'}`);
    }

    const fullAnalysis = anthropicData.content[0].text;

    // Increment usage counter
    if (c.env.DB) {
      await incrementUsage(userEmail, 'corpus', title, analysisDepth, title, c.env.DB, userEmail === ADMIN_EMAIL);
    }
    const updatedUsage = c.env.DB 
      ? await checkUsageLimit(userEmail, c.env.DB)
      : { remaining: userEmail === ADMIN_EMAIL ? -1 : DEMO_LIMIT - 1, isAdmin: userEmail === ADMIN_EMAIL };

    return c.json({
      success: true,
      corpus: {
        title,
        documentType,
        analysisDepth,
        originalText: text.trim(),
        fullAnalysis,
        metadata: {
          timestamp: new Date().toISOString(),
          textLength: text.length,
          analysisId: Math.random().toString(36).substring(7),
          articleCount: (text.match(/artículo\s+\d+/gi) || text.match(/art\.\s*\d+/gi) || []).length
        }
      },
      usage: {
        remainingQueries: updatedUsage.remaining,
        isAdmin: updatedUsage.isAdmin
      }
    });

  } catch (error) {
    console.error('Corpus analysis error:', error);
    return c.json({
      error: 'Error en análisis de corpus',
      message: error.message || 'Error interno del servidor',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Main RootFinder ABAN Analysis endpoint
app.post('/api/analyze', async (c) => {
  try {
    const apiStatus = checkAPIAvailability(c.env);
    if (!apiStatus.allConfigured) {
      return c.json({
        error: 'Sistema no configurado completamente',
        message: 'Faltan algunas API keys. Configure todas las claves en Cloudflare Dashboard.',
        apis: apiStatus
      }, 503);
    }

    const { text, analysisType = 'genealogical', userEmail } = await c.req.json();
    
    // Check authentication and usage limits
    if (!userEmail) {
      return c.json({
        error: 'Autenticación requerida',
        message: 'Debe autenticarse para usar el sistema de análisis'
      }, 401);
    }

    // Check usage limits - admin email gets unlimited access
    if (userEmail === ADMIN_EMAIL) {
      // Admin user - unlimited access
    } else {
      const usage = c.env.DB ? await checkUsageLimit(userEmail, c.env.DB) : { allowed: true, remaining: DEMO_LIMIT, isAdmin: false };
      if (!usage.allowed) {
        return c.json({
          error: 'Límite de consultas excedido',
          message: `Ha alcanzado el límite de ${DEMO_LIMIT} consultas de demo. Contacte para acceso completo.`,
          contactInfo: 'Contacto: adrian@lerer.com.ar'
        }, 429);
      }
    }
    
    if (!text || text.trim().length === 0) {
      return c.json({
        error: 'Texto requerido',
        message: 'Debe proporcionar un texto legal para analizar'
      }, 400);
    }

    // EXTENSIVE DOCUMENT DETECTION SYSTEM
    // Define triggers for expensive documents that require user API keys
    const EXTENSIVE_DOCUMENT_TRIGGERS = [
      'ley bases', 'ley de bases', 'decreto 70/2023', 'ley ómnibus',
      'régimen de incentivos', 'modernización del estado', 
      'código civil y comercial', 'código penal', 'código procesal',
      'ley de procedimiento administrativo', 'ley de contrato de trabajo',
      'constitución nacional', 'código aduanero', 'ley general del ambiente',
      'código fiscal', 'ley de sociedades comerciales', 'ley de concursos',
      'régimen penal tributario', 'ley de impuesto a las ganancias',
      'ley de iva', 'código alimentario argentino', 'ley de defensa del consumidor'
    ];

    const textLowerCase = text.toLowerCase();
    const textLength = text.length;
    
    // Count articles - more robust detection
    const articleMatches = text.match(/art[ií]culo\s+\d+/gi) || [];
    const articleCount = articleMatches.length;
    
    // Check if this is an extensive document that requires user API keys
    const hasExtensiveTrigger = EXTENSIVE_DOCUMENT_TRIGGERS.some(trigger => 
      textLowerCase.includes(trigger)
    );
    
    const isExtensiveBySize = textLength > 200000; // >200KB
    const isExtensiveByArticles = articleCount > 100; // >100 articles
    
    const isExtensiveDocument = hasExtensiveTrigger || isExtensiveBySize || isExtensiveByArticles;

    // For extensive documents, require user to configure their own API keys
    if (isExtensiveDocument && userEmail !== ADMIN_EMAIL) {
      return c.json({
        error: 'Documento extenso detectado',
        message: 'Este documento requiere configuración de API keys propias para su análisis',
        extensiveDocument: {
          detected: true,
          reasons: {
            containsExtensiveLaw: hasExtensiveTrigger,
            largeSize: isExtensiveBySize,
            manyArticles: isExtensiveByArticles,
            textLength: textLength,
            articleCount: articleCount
          },
          recommendation: 'Configure sus propias API keys para análisis ilimitados y mayor velocidad'
        },
        requiresOwnApiKeys: true,
        faqSection: 'api-configuration'
      }, 402); // 402 Payment Required - appropriate for requiring upgrade
    }



    // Analysis via Anthropic API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `Realiza un análisis genealógico legal profundo del siguiente texto usando la metodología ABAN (Algoritmo de Búsqueda del Ancestro Normativo). 

TEXTO A ANALIZAR: "${text}"

INSTRUCCIONES OBLIGATORIAS:
1. ESTRUCTURA MEMÉTICA: Identifica los conceptos clave y su genealogía normativa
2. CADENA DE TRANSMISIÓN NORMATIVA: Rastrea las influencias históricas específicas
3. ANÁLISIS MEMÉTICO PROFUNDO: Examina las influencias filosóficas y constitucionales
4. VALORACIÓN GENEALÓGICA: Autenticidad, densidad memética e impacto normativo
5. CONCLUSIÓN ABAN: Síntesis genealógica completa y definitiva

REGLAS CRÍTICAS:
- NO hagas preguntas al final del análisis
- NO solicites aclaraciones o continuaciones  
- Proporciona análisis completo y conclusivo
- Formato profesional definitivo sin interrupciones

Sé específico, académico y profundo en el análisis.`
        }]
      })
    });

    const anthropicData = await anthropicResponse.json();
    
    if (!anthropicResponse.ok) {
      throw new Error(`Error en análisis: ${anthropicData.error?.message || 'Error desconocido'}`);
    }

    const analysis = anthropicData.content[0].text;

    // Increment usage counter
    if (c.env.DB) {
      await incrementUsage(userEmail, 'individual', text.substring(0, 200), analysisType, 'Análisis Individual', c.env.DB, userEmail === ADMIN_EMAIL);
    }
    const updatedUsage = c.env.DB 
      ? await checkUsageLimit(userEmail, c.env.DB)
      : { remaining: userEmail === ADMIN_EMAIL ? -1 : DEMO_LIMIT - 1, isAdmin: userEmail === ADMIN_EMAIL };

    // Return comprehensive analysis
    return c.json({
      success: true,
      analysis: {
        text: text.trim(),
        type: analysisType,
        methodology: 'ABAN - Algoritmo de Búsqueda del Ancestro Normativo',
        result: analysis,
        metadata: {
          timestamp: new Date().toISOString(),
          textLength: text.length,
          analysisId: Math.random().toString(36).substring(7)
        }
      },
      usage: {
        remainingQueries: updatedUsage.remaining,
        isAdmin: updatedUsage.isAdmin
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return c.json({
      error: 'Error en el análisis',
      message: error.message || 'Error interno del servidor',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Main page with full RootFinder interface
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RootFinder - Sistema ABAN de Análisis Jurídico</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
    </head>
    <body class="bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 min-h-screen text-white">
        <div class="container mx-auto px-4 py-8">
            <!-- Navigation Menu -->
            <nav class="mb-8">
                <div class="max-w-6xl mx-auto">
                    <div class="flex flex-wrap justify-center gap-4 mb-8">
                        <button onclick="showSection('home')" id="homeBtn" class="nav-btn bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold transition-all hover:bg-blue-700">
                            <i class="fas fa-home mr-2"></i>Inicio
                        </button>
                        <button onclick="showSection('nosotros')" id="nosotrosBtn" class="nav-btn bg-transparent border border-white/30 text-white px-6 py-2 rounded-lg font-semibold transition-all hover:bg-white/10">
                            <i class="fas fa-user-tie mr-2"></i>Nosotros
                        </button>
                        <button onclick="showSection('faq')" id="faqBtn" class="nav-btn bg-transparent border border-white/30 text-white px-6 py-2 rounded-lg font-semibold transition-all hover:bg-white/10">
                            <i class="fas fa-question-circle mr-2"></i>FAQ
                        </button>
                        <a href="https://integridai.com.ar" target="_blank" class="nav-btn bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg font-semibold transition-all hover:from-purple-700 hover:to-pink-700">
                            <i class="fas fa-external-link-alt mr-2"></i>IntegridAI
                        </a>
                    </div>
                </div>
            </nav>

            <!-- Home Section -->
            <div id="homeSection">
                <header class="text-center mb-12">
                    <div class="flex items-center justify-center mb-6">
                        <i class="fas fa-search text-6xl text-blue-400 mr-4"></i>
                        <div>
                            <h1 class="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                RootFinder
                            </h1>
                            <p class="text-xl text-blue-300 mt-2">Sistema ABAN - Análisis Jurídico Memético Profesional</p>
                            <p class="text-sm text-purple-300 mt-1">Desarrollado por <span class="font-semibold">IntegridAI</span> - Tecnología Legal Avanzada</p>
                        </div>
                    </div>
                    <p class="text-gray-300 max-w-3xl mx-auto">
                        Algoritmo de Búsqueda del Ancestro Normativo para análisis genealógico profundo de textos jurídicos.
                        Funciona con CUALQUIER texto legal sin necesidad de bases de datos previas.
                    </p>
                    <div class="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 max-w-4xl mx-auto mt-6">
                        <p class="text-yellow-200 text-sm text-center">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            <strong>AVISO IMPORTANTE:</strong> RootFinder es una herramienta experimental de investigación. 
                            Los resultados NO constituyen asesoramiento legal profesional y deben ser validados con fuentes primarias y jurisprudencia actualizada.
                        </p>
                    </div>
                </header>

            <!-- Authentication Panel -->
            <div class="max-w-4xl mx-auto mb-8" id="authPanel">
                <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-xl">
                    <div class="text-center mb-6">
                        <i class="fas fa-key text-3xl text-blue-400 mb-3"></i>
                        <h2 class="text-2xl font-bold">Acceso al Sistema RootFinder</h2>
                        <p class="text-gray-300 mt-2">Sistema de demostración - 10 consultas gratuitas por email</p>
                    </div>
                    
                    <div class="max-w-md mx-auto">
                        <!-- Email Input Phase -->
                        <div id="emailPhase">
                            <label class="block text-lg font-semibold mb-3">
                                <i class="fas fa-envelope mr-2"></i>
                                Email Profesional:
                            </label>
                            <input id="userEmail" type="email" 
                                   class="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
                                   placeholder="su.email@bufete.com">
                            
                            <div id="accessCodeSection" class="mb-4 hidden">
                                <label class="block text-sm font-semibold mb-2 text-yellow-400">
                                    <i class="fas fa-key mr-2"></i>
                                    Código de Acceso Completo:
                                </label>
                                <input id="accessCode" type="password" 
                                       class="w-full p-3 bg-white/20 border border-yellow-400 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                       placeholder="Ingrese su código de acceso">
                            </div>
                            
                            <button onclick="authenticateUser()" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all">
                                <i class="fas fa-sign-in-alt mr-2"></i>
                                Acceder al Sistema ABAN
                            </button>
                        </div>

                        <!-- Verification Code Phase -->
                        <div id="verificationPhase" class="hidden">
                            <div class="text-center mb-4">
                                <i class="fas fa-shield-alt text-3xl text-yellow-400 mb-3"></i>
                                <h3 class="text-xl font-bold">Verificación de Administrador</h3>
                                <p class="text-gray-300 text-sm mt-2" id="verificationEmail"></p>
                            </div>
                            
                            <label class="block text-lg font-semibold mb-3">
                                <i class="fas fa-key mr-2"></i>
                                Código de Verificación:
                            </label>
                            <input id="verificationCode" type="text" maxlength="6" 
                                   class="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4 text-center font-mono text-xl"
                                   placeholder="123456">
                            
                            <button onclick="verifyCode()" class="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-all mb-3">
                                <i class="fas fa-check-circle mr-2"></i>
                                Verificar Código
                            </button>
                            
                            <button onclick="sendNewCode()" class="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-all text-sm">
                                <i class="fas fa-redo mr-2"></i>
                                Enviar Nuevo Código
                            </button>
                            
                            <button onclick="goBackToEmail()" class="w-full bg-transparent border border-gray-500 hover:border-gray-400 text-gray-400 hover:text-white font-bold py-2 px-6 rounded-lg transition-all text-sm mt-2">
                                <i class="fas fa-arrow-left mr-2"></i>
                                Cambiar Email
                            </button>
                        </div>
                        
                        <div class="mt-4 text-center text-sm text-gray-400">
                            <p><strong>Demo:</strong> 10 análisis gratuitos por email</p>
                            <p><strong>Acceso completo:</strong> adrian@lerer.com.ar (requiere verificación)</p>
                        </div>
                    </div>
                    
                    <div id="authError" class="mt-4 hidden"></div>
                </div>
            </div>

            <!-- User Status Panel -->
            <div class="max-w-4xl mx-auto mb-8 hidden" id="userPanel">
                <div class="bg-white/10 backdrop-blur-lg rounded-xl p-4 shadow-xl">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-green-400 font-semibold">
                                <i class="fas fa-user-check mr-2"></i>
                                <span id="userEmailDisplay"></span>
                            </p>
                            <p class="text-sm text-gray-300" id="userStatusDisplay"></p>
                        </div>
                        <div class="flex space-x-3">
                            <button onclick="checkSystemStatus()" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                <i class="fas fa-heartbeat mr-2"></i>
                                Estado Sistema
                            </button>
                            <button onclick="logoutUser()" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                <i class="fas fa-sign-out-alt mr-2"></i>
                                Salir
                            </button>
                        </div>
                    </div>
                    <div id="systemStatus" class="mt-4 hidden"></div>
                </div>
            </div>

            <!-- Analysis Mode Selector -->
            <div class="max-w-4xl mx-auto mb-8 hidden" id="analysisSelector">
                <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-xl">
                    <h2 class="text-2xl font-bold text-center mb-6">
                        <i class="fas fa-dna mr-3"></i>
                        Seleccionar Tipo de Análisis ABAN
                    </h2>
                    
                    <div class="grid md:grid-cols-2 gap-6">
                        <button onclick="setAnalysisMode('single')" id="singleModeBtn"
                                class="analysis-mode-btn bg-purple-600/80 hover:bg-purple-700 text-white p-6 rounded-lg transition-all border-2 border-purple-400">
                            <i class="fas fa-microscope text-3xl mb-3"></i>
                            <h3 class="text-xl font-bold mb-2">Análisis Individual</h3>
                            <p class="text-sm text-purple-200">Analizar artículos específicos o fragmentos normativos individuales</p>
                        </button>
                        
                        <button onclick="setAnalysisMode('corpus')" id="corpusModeBtn" 
                                class="analysis-mode-btn bg-blue-600/50 hover:bg-blue-700 text-white p-6 rounded-lg transition-all border-2 border-transparent">
                            <i class="fas fa-book-open text-3xl mb-3"></i>
                            <h3 class="text-xl font-bold mb-2">Corpus Completo</h3>
                            <p class="text-sm text-blue-200">Analizar documentos completos: constituciones, leyes, decretos, resoluciones</p>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Main Analysis Interface -->
            <main class="max-w-6xl mx-auto hidden" id="mainInterface">
                <div class="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl">
                    <div id="analysisInterface">
                        <!-- Single Article Analysis (Default) -->
                        <div id="singleAnalysis">
                            <h2 class="text-3xl font-bold text-center mb-8">
                                <i class="fas fa-search-plus mr-3"></i>
                                Análisis Individual ABAN
                            </h2>
                            
                            <div class="grid md:grid-cols-2 gap-8">
                                <!-- Input Panel -->
                                <div>
                                    <label class="block text-xl font-semibold mb-4">
                                        <i class="fas fa-scroll mr-2"></i>
                                        Texto Legal para Analizar:
                                    </label>
                                    <textarea id="legalText" 
                                              class="w-full h-64 p-4 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                              placeholder="Ingrese artículo específico, fragmento normativo, o cláusula legal:

Ejemplo:
Artículo 1.- El Estado Oriental del Uruguay es la asociación política de todos los ciudadanos comprendidos en los nueve departamentos actuales de su territorio."></textarea>
                                    
                                    <div class="mt-4 space-y-3">
                                        <button onclick="analyzeText()" 
                                                class="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105">
                                            <i class="fas fa-microscope mr-2"></i>
                                            Ejecutar Análisis ABAN Individual
                                        </button>
                                    </div>
                                </div>

                                <!-- Results Panel -->
                                <div>
                                    <h3 class="text-xl font-semibold mb-4">
                                        <i class="fas fa-chart-line mr-2"></i>
                                        Resultado del Análisis:
                                    </h3>
                                    <div id="analysisResult" class="bg-black/30 border border-white/20 rounded-lg p-4 h-64 overflow-y-auto text-sm">
                                        <div class="text-gray-400 text-center pt-20">
                                            <i class="fas fa-flask text-3xl mb-4"></i>
                                            <p>Los resultados del análisis genealógico aparecerán aquí...</p>
                                        </div>
                                    </div>
                                    
                                    <div id="downloadSection" class="mt-4 hidden">
                                        <button onclick="downloadResult()" 
                                                class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                                            <i class="fas fa-download mr-2"></i>
                                            Descargar Informe PDF
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Corpus Analysis -->
                        <div id="corpusAnalysis" class="hidden">
                            <h2 class="text-3xl font-bold text-center mb-8">
                                <i class="fas fa-book-reader mr-3"></i>
                                Análisis de Corpus Normativo Completo
                            </h2>
                            
                            <div class="space-y-6">
                                <div class="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label class="block text-lg font-semibold mb-3">
                                            <i class="fas fa-tag mr-2"></i>
                                            Título del Documento:
                                        </label>
                                        <input id="corpusTitle" type="text" 
                                               class="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                               placeholder="Ej: Constitución de la República Oriental del Uruguay 1830">
                                    </div>
                                    
                                    <div>
                                        <label class="block text-lg font-semibold mb-3">
                                            <i class="fas fa-list mr-2"></i>
                                            Tipo de Documento:
                                        </label>
                                        <select id="documentType" class="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                                            <option value="constitution">Constitución</option>
                                            <option value="law">Ley</option>
                                            <option value="decree">Decreto</option>
                                            <option value="resolution">Resolución</option>
                                            <option value="regulation">Reglamento</option>
                                            <option value="code">Código</option>
                                            <option value="other">Otro</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label class="block text-lg font-semibold mb-3">
                                        <i class="fas fa-cog mr-2"></i>
                                        Profundidad del Análisis:
                                    </label>
                                    <div class="grid md:grid-cols-2 gap-4 mb-6">
                                        <div class="bg-white/10 p-4 rounded-lg border-2 border-blue-400 transition-all cursor-pointer" onclick="setCorpusAnalysisType('global')" id="globalAnalysisOption">
                                            <div class="text-center">
                                                <i class="fas fa-eye text-2xl text-blue-400 mb-2"></i>
                                                <h4 class="font-bold text-white mb-1">Análisis Global</h4>
                                                <p class="text-xs text-gray-300">Visión general del corpus, estructura y principios fundamentales</p>
                                            </div>
                                        </div>
                                        
                                        <div class="bg-white/10 p-4 rounded-lg border-2 border-transparent hover:border-purple-400 transition-all cursor-pointer" onclick="setCorpusAnalysisType('detailed')" id="detailedAnalysisOption">
                                            <div class="text-center">
                                                <i class="fas fa-microscope text-2xl text-purple-400 mb-2"></i>
                                                <h4 class="font-bold text-white mb-1">Análisis Detallado</h4>
                                                <p class="text-xs text-gray-300">Análisis ABAN completo artículo por artículo + síntesis global</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <label class="block text-lg font-semibold mb-3">
                                        <i class="fas fa-file-alt mr-2"></i>
                                        Texto Completo del Documento:
                                    </label>
                                    <textarea id="corpusText" 
                                              class="w-full h-80 p-4 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                                              placeholder="Pegue aquí el texto completo de la constitución, ley, decreto o resolución.

El sistema identificará automáticamente todos los artículos y realizará análisis ABAN de cada uno.

Ejemplo:
CONSTITUCIÓN DE LA REPÚBLICA ORIENTAL DEL URUGUAY

Artículo 1.- El Estado Oriental del Uruguay es la asociación política de todos los ciudadanos...

Artículo 2.- El territorio de la República es el que actualmente posee...

[continúa con todo el documento]"></textarea>
                                </div>
                                
                                <div class="flex space-x-4">
                                    <button onclick="analyzeCorpus()" 
                                            class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300">
                                        <i class="fas fa-cogs mr-2"></i>
                                        Analizar Corpus Completo
                                    </button>
                                </div>
                                
                                <div id="corpusResult" class="bg-black/30 border border-white/20 rounded-lg p-6 min-h-64 hidden">
                                    <div class="text-center">
                                        <i class="fas fa-book text-3xl text-blue-400 mb-4"></i>
                                        <p class="text-gray-300">El análisis completo del corpus aparecerá aquí...</p>
                                    </div>
                                </div>
                                
                                <div id="corpusDownloadSection" class="hidden">
                                    <button onclick="downloadCorpusResult()" 
                                            class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-colors">
                                        <i class="fas fa-file-pdf mr-2"></i>
                                        Descargar Informe Completo del Corpus (PDF)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Features -->
                    <div class="mt-12 grid md:grid-cols-3 gap-6">
                        <div class="bg-blue-800/30 p-6 rounded-lg">
                            <h4 class="text-lg font-bold mb-3">
                                <i class="fas fa-brain mr-2 text-blue-400"></i>
                                IA Especializada
                            </h4>
                            <p class="text-gray-300 text-sm">Inteligencia artificial especializada en análisis jurídico y genealógico normativo profundo.</p>
                        </div>
                        <div class="bg-purple-800/30 p-6 rounded-lg">
                            <h4 class="text-lg font-bold mb-3">
                                <i class="fas fa-project-diagram mr-2 text-purple-400"></i>
                                Sin Limitaciones
                            </h4>
                            <p class="text-gray-300 text-sm">Funciona con cualquier texto legal sin necesidad de bases de datos preconfiguradas.</p>
                        </div>
                        <div class="bg-indigo-800/30 p-6 rounded-lg">
                            <h4 class="text-lg font-bold mb-3">
                                <i class="fas fa-download mr-2 text-indigo-400"></i>
                                Informes Descargables
                            </h4>
                            <p class="text-gray-300 text-sm">Descarga informes profesionales en PDF con análisis genealógico completo.</p>
                        </div>
                    </div>
                </div>
            </main>
            </div>
            <!-- End Home Section -->

            <!-- Nosotros Section -->
            <div id="nosotrosSection" class="hidden">
                <div class="max-w-6xl mx-auto">
                    <div class="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl">
                        <div class="text-center mb-12">
                            <i class="fas fa-user-tie text-6xl text-blue-400 mb-6"></i>
                            <h1 class="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
                                Nosotros
                            </h1>
                            <p class="text-xl text-blue-300">El Equipo Detrás de RootFinder</p>
                        </div>

                        <!-- IntegridAI Brand Section -->
                        <div class="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-xl p-8 mb-8">
                            <div class="text-center mb-6">
                                <h2 class="text-3xl font-bold text-white mb-3">
                                    <i class="fas fa-brain mr-3 text-purple-400"></i>
                                    IntegridAI
                                </h2>
                                <p class="text-lg text-purple-200">Tecnología Legal Avanzada para el Futuro del Derecho</p>
                            </div>
                            <div class="max-w-4xl mx-auto text-gray-200 leading-relaxed">
                                <p class="mb-4">
                                    <strong>IntegridAI</strong> es una consultora especializada en la aplicación de inteligencia artificial 
                                    al ámbito jurídico, liderada por Ignacio Adrián Lerer. Nuestra misión es democratizar 
                                    el acceso a tecnologías que permiten implementar programas de integridad sólidos, accesibles 
                                    y alineados con la legislación vigente.
                                </p>
                                <p class="mb-4">
                                    <strong>RootFinder</strong> representa la culminación de años de investigación en análisis 
                                    genealógico normativo, combinando experticia legal tradicional con las últimas tecnologías 
                                    de inteligencia artificial para ofrecer insights profundos sobre textos jurídicos.
                                </p>
                            </div>
                        </div>

                        <!-- Personal Profile Section -->
                        <div class="grid md:grid-cols-3 gap-8 mb-8">
                            <div class="md:col-span-1">
                                <div class="bg-white/10 rounded-xl p-6 text-center">
                                    <i class="fas fa-graduation-cap text-6xl text-blue-400 mb-4"></i>
                                    <h3 class="text-2xl font-bold text-white mb-4">Ignacio Adrián Lerer</h3>
                                    <p class="text-blue-300 font-semibold mb-2">Fundador de IntegridAI</p>
                                    <p class="text-purple-300 text-sm mb-4">Abogado Corporativo Senior</p>
                                    
                                    <div class="space-y-2 text-sm text-gray-300">
                                        <p><i class="fas fa-university mr-2 text-blue-400"></i>Abogado UBA</p>
                                        <p><i class="fas fa-user-graduate mr-2 text-purple-400"></i>EMBA IAE Business School</p>
                                        <p><i class="fas fa-shield-alt mr-2 text-green-400"></i>Especialista Compliance</p>
                                        <p><i class="fas fa-gavel mr-2 text-yellow-400"></i>Ley 27.401</p>
                                        <p><i class="fas fa-clock mr-2 text-red-400"></i>25+ años experiencia</p>
                                    </div>
                                    
                                    <div class="mt-6 space-y-3">
                                        <a href="https://linkedin.com/in/ignacio-lerer" target="_blank" 
                                           class="block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                            <i class="fab fa-linkedin mr-2"></i>Conectar en LinkedIn
                                        </a>
                                        <a href="mailto:adrian@lerer.com.ar" 
                                           class="block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                            <i class="fas fa-envelope mr-2"></i>adrian@lerer.com.ar
                                        </a>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="md:col-span-2">
                                <div class="bg-white/10 rounded-xl p-6">
                                    <h3 class="text-2xl font-bold text-white mb-6">
                                        <i class="fas fa-briefcase mr-3 text-blue-400"></i>
                                        Experiencia Profesional
                                    </h3>
                                    
                                    <div class="space-y-6 text-gray-200">
                                        <div>
                                            <h4 class="text-lg font-semibold text-blue-300 mb-2">Especialidades Técnicas</h4>
                                            <p class="leading-relaxed">
                                                Abogado de la Universidad de Buenos Aires y Executive MBA 
                                                del IAE Business School. Se especializa en <strong>integridad, ética y cumplimiento 
                                                normativo</strong> en Argentina y América Latina, con práctica real en la implementación 
                                                de programas de integridad de la <strong>Ley 27.401</strong> en empresas constructoras, 
                                                energéticas, proveedoras de servicios públicos y del sector fintech.
                                            </p>
                                        </div>
                                        
                                        <div>
                                            <h4 class="text-lg font-semibold text-purple-300 mb-2">Trayectoria Ejecutiva</h4>
                                            <p class="leading-relaxed">
                                                Con más de <strong>25 años de experiencia</strong>, combina experticia legal con 
                                                visión estratégica de negocios. Actualmente dirige su propia consultora especializada 
                                                en <strong>gobierno corporativo, compliance y gestión de riesgos</strong>, mientras 
                                                sirve como director independiente y síndico en empresas de diversos sectores 
                                                industriales (manufactura, agroindustria, energía, minería).
                                            </p>
                                        </div>
                                        
                                        <div>
                                            <h4 class="text-lg font-semibold text-green-300 mb-2">Visión Tecnológica</h4>
                                            <p class="leading-relaxed">
                                                Lidera IntegridAI con la visión de <strong>democratizar el acceso a tecnologías</strong> 
                                                que permiten implementar programas de integridad sólidos, accesibles y alineados 
                                                con la Ley 27.401. Se destaca por su capacidad para integrar perspectivas legales 
                                                y de negocios, contribuyendo a la integridad corporativa y la gestión eficiente de riesgos.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Academic Publications Section -->
                        <div class="bg-white/10 rounded-xl p-6">
                            <h3 class="text-2xl font-bold text-white mb-6">
                                <i class="fas fa-book mr-3 text-purple-400"></i>
                                Publicaciones Académicas
                            </h3>
                            <div class="space-y-4 text-gray-200">
                                <div class="bg-black/30 rounded-lg p-4">
                                    <h4 class="text-lg font-semibold text-blue-300 mb-2">Artículos en SSRN</h4>
                                    <p class="mb-3">
                                        Publicaciones académicas sobre metodologías de análisis jurídico, gobierno corporativo 
                                        y tecnologías aplicadas al derecho.
                                    </p>
                                    <a href="https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=7512489" target="_blank" 
                                       class="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                        <i class="fas fa-external-link-alt mr-2"></i>
                                        Ver Publicaciones en SSRN
                                    </a>
                                </div>
                                
                                <div class="bg-black/30 rounded-lg p-4">
                                    <h4 class="text-lg font-semibold text-green-300 mb-2">Metodología ABAN</h4>
                                    <p>
                                        Desarrollo del <strong>Algoritmo de Búsqueda del Ancestro Normativo (ABAN)</strong>, 
                                        metodología registrada para análisis genealógico profundo de textos jurídicos, 
                                        implementada en el sistema RootFinder.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- End Nosotros Section -->

            <!-- FAQ Section -->
            <div id="faqSection" class="hidden">
                <div class="max-w-6xl mx-auto">
                    <div class="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl">
                        <div class="text-center mb-12">
                            <i class="fas fa-question-circle text-6xl text-blue-400 mb-6"></i>
                            <h1 class="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
                                Preguntas Frecuentes
                            </h1>
                            <p class="text-xl text-blue-300">Todo lo que necesita saber sobre RootFinder</p>
                        </div>

                        <div class="space-y-6">
                            <!-- Technical Questions -->
                            <div class="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-6">
                                <h2 class="text-2xl font-bold text-white mb-6">
                                    <i class="fas fa-cogs mr-3 text-blue-400"></i>
                                    Aspectos Técnicos
                                </h2>
                                
                                <div class="space-y-4">
                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-blue-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq1')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq1-icon"></i>
                                            ¿Qué es el sistema ABAN?
                                        </h3>
                                        <div id="faq1" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>ABAN (Algoritmo de Búsqueda del Ancestro Normativo) es una metodología registrada desarrollada por Ignacio Adrián Lerer para realizar análisis genealógico profundo de textos jurídicos. Identifica antecedentes normativos, cadenas de modificaciones legislativas, relaciones jurisprudenciales y contexto histórico-doctrinario de cualquier texto legal.</p>
                                        </div>
                                    </div>

                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-blue-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq2')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq2-icon"></i>
                                            ¿Cómo funciona el análisis de corpus completo?
                                        </h3>
                                        <div id="faq2" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>RootFinder procesa documentos legales completos (constituciones, leyes, decretos) mediante sistema multi-bloque, minimizando truncamientos y maximizando completitud. Puede procesar documentos de hasta 71 artículos como la Ley 27401, realizando análisis ABAN artículo por artículo y síntesis global.</p>
                                        </div>
                                    </div>

                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-blue-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq3')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq3-icon"></i>
                                            ¿Qué diferencia RootFinder de otros sistemas?
                                        </h3>
                                        <div id="faq3" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>RootFinder no requiere bases de datos previas y funciona con CUALQUIER texto legal. Utiliza metodología académica respaldada por publicaciones científicas, ofrece análisis memético profundo y busca maximizar la exhaustividad en el procesamiento de documentos complejos.</p>
                                        </div>
                                    </div>
                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-blue-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq3b')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq3b-icon"></i>
                                            ¿Por qué algunos documentos requieren API propia?
                                        </h3>
                                        <div id="faq3b" class="hidden text-gray-200 mt-3 pl-6">
                                            <p><strong>Documentos extensos</strong> (como Ley Bases, Ley Ómnibus, documentos +100 artículos) requieren procesamiento intensivo que excede los límites de demostración.</p>
                                            <p class="mt-2"><strong>Beneficios de API propia:</strong></p>
                                            <ul class="list-disc ml-6 mt-2 space-y-1">
                                                <li>🚀 <strong>Sin límites:</strong> Procese documentos de cualquier tamaño</li>
                                                <li>⚡ <strong>Mayor velocidad:</strong> Procesamiento directo sin colas</li>
                                                <li>🔒 <strong>Privacidad total:</strong> Sus documentos no pasan por servidores demo</li>
                                                <li>🎯 <strong>Control completo:</strong> Configure parámetros de análisis</li>
                                            </ul>
                                            <p class="mt-3 text-blue-300"><strong>APIs recomendadas:</strong> Anthropic Claude (análisis principal) + OpenAI (validación cruzada)</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- API Configuration Section -->
                            <div class="bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-xl p-6">
                                <h2 class="text-2xl font-bold text-white mb-6">
                                    <i class="fas fa-key mr-3 text-green-400"></i>
                                    Configuración de APIs
                                </h2>
                                
                                <div class="space-y-4">
                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-green-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq3c')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq3c-icon"></i>
                                            ¿Cómo configuro mis propias API keys?
                                        </h3>
                                        <div id="faq3c" class="hidden text-gray-200 mt-3 pl-6">
                                            <p><strong>Para deployment propio:</strong></p>
                                            <div class="bg-black/30 rounded-lg p-3 mt-3 mb-3">
                                                <code class="text-green-400">
# Archivo .env<br>
ANTHROPIC_API_KEY=sk-ant-api03-tu-key-aqui<br>
OPENAI_API_KEY=sk-proj-tu-key-aqui<br>
OPENROUTER_API_KEY=sk-or-v1-tu-key-aqui
                                                </code>
                                            </div>
                                            <p><strong>Para Cloudflare Pages:</strong></p>
                                            <div class="bg-black/30 rounded-lg p-3 mt-3 mb-3">
                                                <code class="text-blue-400">
npx wrangler pages secret put ANTHROPIC_API_KEY<br>
npx wrangler pages secret put OPENAI_API_KEY
                                                </code>
                                            </div>
                                            <p class="mt-3"><strong>Obtener APIs:</strong></p>
                                            <ul class="list-disc ml-6 mt-2 space-y-1">
                                                <li><strong>Anthropic:</strong> <a href="https://console.anthropic.com/" target="_blank" class="text-blue-400">console.anthropic.com</a></li>
                                                <li><strong>OpenAI:</strong> <a href="https://platform.openai.com/" target="_blank" class="text-blue-400">platform.openai.com</a></li>
                                                <li><strong>OpenRouter:</strong> <a href="https://openrouter.ai/" target="_blank" class="text-blue-400">openrouter.ai</a> (alternativa)</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-green-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq3d')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq3d-icon"></i>
                                            ¿Cuánto cuesta procesar documentos extensos?
                                        </h3>
                                        <div id="faq3d" class="hidden text-gray-200 mt-3 pl-6">
                                            <p><strong>Costos estimados por documento (USD):</strong></p>
                                            <ul class="list-disc ml-6 mt-2 space-y-1">
                                                <li><strong>Ley típica (20-50 artículos):</strong> $0.50 - $2.00</li>
                                                <li><strong>Ley extensa (71 artículos):</strong> $2.00 - $5.00</li>
                                                <li><strong>Código completo (+200 artículos):</strong> $8.00 - $20.00</li>
                                                <li><strong>Constitución Nacional:</strong> $3.00 - $8.00</li>
                                            </ul>
                                            <p class="mt-3 text-yellow-300"><strong>Nota:</strong> Los costos varían según la API utilizada y profundidad del análisis. Anthropic Claude suele ser más eficiente para análisis jurídicos.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Usage Questions -->
                            <div class="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-6">
                                <h2 class="text-2xl font-bold text-white mb-6">
                                    <i class="fas fa-user-cog mr-3 text-purple-400"></i>
                                    Uso y Acceso
                                </h2>
                                
                                <div class="space-y-4">
                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-purple-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq4')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq4-icon"></i>
                                            ¿Cómo accedo al sistema completo?
                                        </h3>
                                        <div id="faq4" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>El sistema ofrece 10 consultas gratuitas por email para demostración. Para acceso ilimitado, contacte directamente con Ignacio Adrián Lerer en adrian@lerer.com.ar. Los usuarios administrativos tienen acceso completo mediante código de verificación.</p>
                                        </div>
                                    </div>

                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-purple-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq5')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq5-icon"></i>
                                            ¿Qué tipos de documentos puedo analizar?
                                        </h3>
                                        <div id="faq5" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>RootFinder procesa: Constituciones, Leyes, Decretos, Resoluciones, Reglamentos, Códigos, Artículos individuales, Fragmentos normativos y Cláusulas legales. No hay restricciones por país o jurisdicción.</p>
                                        </div>
                                    </div>

                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-purple-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq6')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq6-icon"></i>
                                            ¿Se almacenan mis consultas?
                                        </h3>
                                        <div id="faq6" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>El sistema registra estadísticas de uso (email, fecha, tipo de consulta) para control de límites y mejoras. Los textos completos NO se almacenan permanentemente. Toda la información se maneja con estricta confidencialidad profesional.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Professional Questions -->
                            <div class="bg-gradient-to-r from-green-900/50 to-teal-900/50 rounded-xl p-6">
                                <h2 class="text-2xl font-bold text-white mb-6">
                                    <i class="fas fa-briefcase mr-3 text-green-400"></i>
                                    Uso Profesional
                                </h2>
                                
                                <div class="space-y-4">
                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-green-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq7')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq7-icon"></i>
                                            ¿Puedo usar los resultados en dictamenes legales?
                                        </h3>
                                        <div id="faq7" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>Sí. Los análisis RootFinder están respaldados por metodología académica y pueden utilizarse como herramienta de investigación preliminar. Es fundamental validar los hallazgos con fuentes primarias y jurisprudencia actualizada.</p>
                                        </div>
                                    </div>

                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-green-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq8')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq8-icon"></i>
                                            ¿Ofrecen capacitación para estudios jurídicos?
                                        </h3>
                                        <div id="faq8" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>IntegridAI ofrece capacitación especializada en metodología ABAN y uso profesional de RootFinder. Contacte adrian@lerer.com.ar para programar sesiones personalizadas para su equipo legal.</p>
                                        </div>
                                    </div>

                                    <div class="faq-item bg-white/10 rounded-lg p-4">
                                        <h3 class="text-lg font-semibold text-green-300 mb-2 cursor-pointer" onclick="toggleFAQ('faq9')">
                                            <i class="fas fa-chevron-right mr-2 transition-transform" id="faq9-icon"></i>
                                            ¿Hay planes empresariales disponibles?
                                        </h3>
                                        <div id="faq9" class="hidden text-gray-200 mt-3 pl-6">
                                            <p>Sí. IntegridAI desarrolla soluciones empresariales personalizadas incluyendo: acceso ilimitado para equipos, integración con sistemas existentes, capacitación especializada y soporte técnico dedicado.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Contact Section in FAQ -->
                            <div class="bg-gradient-to-r from-indigo-900/50 to-blue-900/50 rounded-xl p-6 text-center">
                                <h2 class="text-2xl font-bold text-white mb-4">
                                    <i class="fas fa-headset mr-3 text-indigo-400"></i>
                                    ¿Tiene más preguntas?
                                </h2>
                                <p class="text-gray-200 mb-6">
                                    Nuestro equipo está disponible para resolver cualquier consulta adicional sobre RootFinder y la metodología ABAN.
                                </p>
                                <div class="flex flex-wrap justify-center gap-4">
                                    <a href="mailto:adrian@lerer.com.ar" 
                                       class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                                        <i class="fas fa-envelope mr-2"></i>Contactar por Email
                                    </a>
                                    <a href="https://integridai.com.ar" target="_blank" 
                                       class="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                                        <i class="fas fa-external-link-alt mr-2"></i>Visitar IntegridAI
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- End FAQ Section -->
        </div>

        <script>
            let isAnalyzing = false;
            let currentAnalysisResult = null;
            let currentCorpusResult = null;
            let analysisMode = 'single';
            let currentUser = null;
            let corpusAnalysisDepth = 'global';

            // Fetch with timeout for mobile compatibility
            async function fetchWithTimeout(url, options = {}, timeout = 45000) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                try {
                    const response = await fetch(url, {
                        ...options,
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    return response;
                } catch (error) {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        throw new Error('El análisis tardó demasiado tiempo. Por favor, intente con un texto más corto.');
                    }
                    throw error;
                }
            }

            // Progress indicator for long analyses
            function showProgressIndicator(duration) {
                const indicators = ['⏳', '⌛', '🔄', '⚡'];
                let index = 0;
                
                return setInterval(() => {
                    const progressElements = document.querySelectorAll('.analysis-progress');
                    progressElements.forEach(el => {
                        const icon = el.querySelector('.progress-icon');
                        if (icon) {
                            icon.textContent = indicators[index];
                        }
                    });
                    index = (index + 1) % indicators.length;
                }, 1000);
            }

            async function authenticateUser() {
                const emailInput = document.getElementById('userEmail');
                const accessCodeInput = document.getElementById('accessCode');
                const email = emailInput.value.trim();
                const accessCode = accessCodeInput?.value?.trim() || '';
                const errorDiv = document.getElementById('authError');

                if (!email || !email.includes('@')) {
                    showError(errorDiv, 'Por favor, ingrese un email válido');
                    return;
                }

                // Show access code field for admin email
                if (email === 'adrian@lerer.com.ar' && !accessCode) {
                    document.getElementById('accessCodeSection').classList.remove('hidden');
                    showError(errorDiv, 'Este email requiere un código de acceso especial para acceso completo', 'warning');
                    return;
                }

                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email, accessCode })
                    });

                    const result = await response.json();

                    if (result.success) {
                        currentUser = result.user;
                        showAuthenticatedInterface();
                        updateUserDisplay();
                    } else if (result.requiresAccessCode) {
                        document.getElementById('accessCodeSection').classList.remove('hidden');
                        showError(errorDiv, result.message, 'warning');
                    } else {
                        showError(errorDiv, result.message || 'Error de autenticación');
                    }

                } catch (error) {
                    showError(errorDiv, 'Error de conexión. Intente nuevamente.');
                }
            }

            async function sendVerificationCode(email) {
                const errorDiv = document.getElementById('authError');
                
                try {
                    const response = await fetch('/api/send-auth-code', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email })
                    });

                    const result = await response.json();

                    if (result.success) {
                        showVerificationPhase(email);
                        
                        // Show code for demo if email is not configured
                        if (result.codeForDemo) {
                            showError(errorDiv, \`Código de demo (email no configurado): \${result.codeForDemo}\`);
                        }
                    } else {
                        showError(errorDiv, result.message || 'Error enviando código');
                    }

                } catch (error) {
                    showError(errorDiv, 'Error enviando código de verificación');
                }
            }

            async function verifyCode() {
                const email = document.getElementById('userEmail').value.trim();
                const code = document.getElementById('verificationCode').value.trim();
                const errorDiv = document.getElementById('authError');

                if (!code || code.length !== 6) {
                    showError(errorDiv, 'Ingrese el código de 6 dígitos');
                    return;
                }

                try {
                    const response = await fetch('/api/verify-code', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email, code })
                    });

                    const result = await response.json();

                    if (result.success) {
                        currentUser = result.user;
                        showAuthenticatedInterface();
                        updateUserDisplay();
                    } else {
                        showError(errorDiv, result.message || 'Código inválido');
                    }

                } catch (error) {
                    showError(errorDiv, 'Error verificando código');
                }
            }

            function showVerificationPhase(email) {
                document.getElementById('emailPhase').classList.add('hidden');
                document.getElementById('verificationPhase').classList.remove('hidden');
                document.getElementById('verificationEmail').textContent = \`Código enviado a: \${email}\`;
                document.getElementById('verificationCode').focus();
            }

            function goBackToEmail() {
                document.getElementById('verificationPhase').classList.add('hidden');
                document.getElementById('emailPhase').classList.remove('hidden');
                document.getElementById('verificationCode').value = '';
                document.getElementById('authError').classList.add('hidden');
            }

            async function sendNewCode() {
                const email = document.getElementById('userEmail').value.trim();
                await sendVerificationCode(email);
            }

            function showError(container, message, type = 'error') {
                container.classList.remove('hidden');
                const colors = type === 'warning' 
                    ? { bg: 'bg-yellow-800/50', border: 'border-yellow-600', text: 'text-yellow-300', icon: 'fas fa-key' }
                    : { bg: 'bg-red-800/50', border: 'border-red-600', text: 'text-red-300', icon: 'fas fa-exclamation-triangle' };
                    
                container.innerHTML = \`
                    <div class="\${colors.bg} border \${colors.border} rounded-lg p-4">
                        <p class="\${colors.text} text-sm"><i class="\${colors.icon} mr-2"></i>\${message}</p>
                    </div>
                \`;
            }

            function showAuthenticatedInterface() {
                document.getElementById('authPanel').classList.add('hidden');
                document.getElementById('userPanel').classList.remove('hidden');
                document.getElementById('analysisSelector').classList.remove('hidden');
                document.getElementById('mainInterface').classList.remove('hidden');
            }

            function updateUserDisplay() {
                if (!currentUser) return;
                
                document.getElementById('userEmailDisplay').textContent = currentUser.email;
                
                const statusText = currentUser.isAdmin 
                    ? 'Acceso Completo (Administrador)' 
                    : \`Consultas restantes: \${currentUser.remainingQueries}/10\`;
                    
                document.getElementById('userStatusDisplay').textContent = statusText;
            }

            function logoutUser() {
                currentUser = null;
                document.getElementById('authPanel').classList.remove('hidden');
                document.getElementById('userPanel').classList.add('hidden');
                document.getElementById('analysisSelector').classList.add('hidden');
                document.getElementById('mainInterface').classList.add('hidden');
                document.getElementById('userEmail').value = '';
                if (document.getElementById('accessCode')) {
                    document.getElementById('accessCode').value = '';
                }
                if (document.getElementById('accessCodeSection')) {
                    document.getElementById('accessCodeSection').classList.add('hidden');
                }
                document.getElementById('authError').classList.add('hidden');
            }

            function setCorpusAnalysisType(type) {
                corpusAnalysisDepth = type;
                console.log('DEBUG FRONTEND: setCorpusAnalysisType called with:', type);
                console.log('DEBUG FRONTEND: corpusAnalysisDepth is now:', corpusAnalysisDepth);
                const globalBtn = document.getElementById('globalAnalysisOption');
                const detailedBtn = document.getElementById('detailedAnalysisOption');
                
                if (type === 'global') {
                    globalBtn.className = 'bg-white/20 p-4 rounded-lg border-2 border-blue-400 transition-all cursor-pointer';
                    detailedBtn.className = 'bg-white/10 p-4 rounded-lg border-2 border-transparent hover:border-purple-400 transition-all cursor-pointer';
                } else {
                    globalBtn.className = 'bg-white/10 p-4 rounded-lg border-2 border-transparent hover:border-blue-400 transition-all cursor-pointer';
                    detailedBtn.className = 'bg-white/20 p-4 rounded-lg border-2 border-purple-400 transition-all cursor-pointer';
                }
            }

            function setAnalysisMode(mode) {
                analysisMode = mode;
                
                // Update button styles
                const singleBtn = document.getElementById('singleModeBtn');
                const corpusBtn = document.getElementById('corpusModeBtn');
                
                if (mode === 'single') {
                    singleBtn.className = 'analysis-mode-btn bg-purple-600/80 hover:bg-purple-700 text-white p-6 rounded-lg transition-all border-2 border-purple-400';
                    corpusBtn.className = 'analysis-mode-btn bg-blue-600/50 hover:bg-blue-700 text-white p-6 rounded-lg transition-all border-2 border-transparent';
                    
                    document.getElementById('singleAnalysis').classList.remove('hidden');
                    document.getElementById('corpusAnalysis').classList.add('hidden');
                } else {
                    singleBtn.className = 'analysis-mode-btn bg-purple-600/50 hover:bg-purple-700 text-white p-6 rounded-lg transition-all border-2 border-transparent';
                    corpusBtn.className = 'analysis-mode-btn bg-blue-600/80 hover:bg-blue-700 text-white p-6 rounded-lg transition-all border-2 border-blue-400';
                    
                    document.getElementById('singleAnalysis').classList.add('hidden');
                    document.getElementById('corpusAnalysis').classList.remove('hidden');
                }
            }

            async function checkSystemStatus() {
                const statusDiv = document.getElementById('systemStatus');
                statusDiv.classList.remove('hidden');
                statusDiv.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Verificando sistema...</div>';

                try {
                    const headers = {};
                    if (currentUser?.email) {
                        headers['X-User-Email'] = currentUser.email;
                    }
                    
                    const response = await fetch('/api/status', { headers });
                    const result = await response.json();
                    
                    const apisConfigured = result.apis?.allConfigured;
                    const statusColor = apisConfigured ? 'green' : 'yellow';
                    const statusIcon = apisConfigured ? 'check-circle' : 'exclamation-triangle';
                    const statusText = apisConfigured ? 'Sistema completamente configurado' : 'APIs pendientes de configuración';
                    
                    statusDiv.innerHTML = \`
                        <div class="bg-\${statusColor}-800/50 border border-\${statusColor}-600 rounded-lg p-4 mt-4">
                            <h3 class="text-\${statusColor}-400 font-bold mb-3">
                                <i class="fas fa-\${statusIcon} mr-2"></i>
                                Estado del Sistema
                            </h3>
                            <div class="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p><strong>Estado:</strong> \${result.status.toUpperCase()}</p>
                                    <p><strong>Servicio:</strong> \${result.service}</p>
                                    <p><strong>Timestamp:</strong> \${new Date(result.timestamp).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p><strong>APIs Configuradas:</strong></p>
                                    <p>• Anthropic: \${result.apis?.anthropic ? '✅' : '❌'}</p>
                                    <p>• OpenAI: \${result.apis?.openai ? '✅' : '❌'}</p>
                                    <p>• OpenRouter: \${result.apis?.openrouter ? '✅' : '❌'}</p>
                                </div>
                            </div>
                            <p class="mt-3 text-\${statusColor}-300"><strong>\${statusText}</strong></p>
                        </div>
                    \`;
                } catch (error) {
                    statusDiv.innerHTML = \`
                        <div class="bg-red-800/50 border border-red-600 rounded-lg p-4 mt-4">
                            <h3 class="text-red-400 font-bold mb-2">❌ Error de Conexión</h3>
                            <p class="text-sm">Error: \${error.message}</p>
                        </div>
                    \`;
                }
            }

            async function analyzeText() {
                if (isAnalyzing) return;
                
                const textInput = document.getElementById('legalText');
                const resultDiv = document.getElementById('analysisResult');
                const text = textInput.value.trim();

                if (!text) {
                    alert('Por favor, ingrese un texto legal para analizar.');
                    return;
                }

                // Debug: Check authentication state
                console.log('DEBUG: Current user state:', currentUser);
                
                if (!currentUser || !currentUser.email) {
                    alert('ERROR: No hay usuario autenticado. Debe autenticarse primero para usar el sistema ABAN.');
                    return;
                }

                isAnalyzing = true;
                resultDiv.innerHTML = \`
                    <div class="text-center py-8 analysis-progress">
                        <i class="fas fa-cog fa-spin text-3xl text-blue-400 mb-4"></i>
                        <p class="text-blue-300">
                            <span class="progress-icon">⏳</span> Ejecutando análisis ABAN...
                        </p>
                        <p class="text-gray-400 text-sm mt-2">Esto puede tomar 30-60 segundos en móvil...</p>
                        <p class="text-gray-500 text-xs mt-1">Si tarda mucho, el sistema cancelará automáticamente</p>
                    </div>
                \`;
                
                const progressInterval = showProgressIndicator();

                try {
                    console.log('DEBUG: Starting analysis with user:', currentUser?.email || 'NO USER');
                    console.log('DEBUG: Text to analyze:', text.substring(0, 50) + '...');
                    
                    const requestBody = { 
                        text: text,
                        analysisType: 'genealogical',
                        userEmail: currentUser?.email
                    };
                    console.log('DEBUG: Request body:', requestBody);
                    
                    const response = await fetchWithTimeout('/api/analyze', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    }, 60000); // 60 seconds timeout for analysis
                    
                    console.log('DEBUG: Response status:', response.status);
                    console.log('DEBUG: Response ok:', response.ok);

                    const result = await response.json();

                    if (result.success) {
                        currentAnalysisResult = result.analysis;
                        
                        // Update user usage info
                        if (result.usage && currentUser) {
                            currentUser.remainingQueries = result.usage.remainingQueries;
                            updateUserDisplay();
                        }
                        
                        const usageInfo = result.usage && !result.usage.isAdmin 
                            ? \`<p class="text-xs text-yellow-400 mt-1">Consultas restantes: \${result.usage.remainingQueries}</p>\`
                            : '';
                        
                        resultDiv.innerHTML = \`
                            <div class="space-y-4">
                                <div class="bg-green-800/30 border-l-4 border-green-400 p-4">
                                    <h4 class="font-bold text-green-400 mb-2">
                                        <i class="fas fa-check-circle mr-2"></i>
                                        Análisis ABAN Completado
                                    </h4>
                                    <p class="text-xs text-gray-400">
                                        Análisis completado: \${new Date(result.analysis.metadata.timestamp).toLocaleString()}
                                    </p>
                                    \${usageInfo}
                                </div>
                                
                                <div class="bg-white/10 rounded-lg p-4">
                                    <h5 class="font-semibold text-blue-300 mb-3">Resultado del Análisis Genealógico:</h5>
                                    <div class="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                                        \${result.analysis.result}
                                    </div>
                                </div>
                            </div>
                        \`;
                        
                        // Show download section
                        document.getElementById('downloadSection').classList.remove('hidden');
                    } else {
                        throw new Error(result.message || result.error || 'Error desconocido');
                    }

                } catch (error) {
                    const errorResponse = await error.response?.json().catch(() => ({}));
                    const isUsageLimitError = errorResponse.error === 'Límite de consultas excedido';
                    const isTimeoutError = error.message.includes('tardó demasiado tiempo');
                    const isExtensiveDocument = errorResponse.requiresOwnApiKeys && errorResponse.extensiveDocument;
                    
                    if (isExtensiveDocument) {
                        // Special handling for extensive documents
                        const reasons = errorResponse.extensiveDocument.reasons;
                        const reasonTexts = [];
                        if (reasons.containsExtensiveLaw) reasonTexts.push('📋 Ley masiva detectada');
                        if (reasons.largeSize) reasonTexts.push(\`📊 Tamaño: \${Math.round(reasons.textLength/1000)}KB\`);
                        if (reasons.manyArticles) reasonTexts.push(\`📖 Artículos: \${reasons.articleCount}\`);
                        
                        resultDiv.innerHTML = \`
                            <div class="bg-amber-800/50 border border-amber-600 rounded-lg p-4">
                                <h4 class="text-amber-400 font-bold mb-3">
                                    <i class="fas fa-key mr-2"></i>
                                    Documento Extenso - API Propia Requerida
                                </h4>
                                <p class="text-sm text-gray-200 mb-3">\${errorResponse.message}</p>
                                
                                <div class="bg-black/30 rounded p-3 mb-3">
                                    <p class="text-amber-300 font-semibold mb-2">🔍 Detección:</p>
                                    <ul class="text-sm text-gray-300 space-y-1">
                                        \${reasonTexts.map(reason => \`<li>\${reason}</li>\`).join('')}
                                    </ul>
                                </div>
                                
                                <div class="bg-green-800/30 border border-green-600 rounded p-3 mb-3">
                                    <p class="text-green-300 font-semibold mb-2">✅ Beneficios de API propia:</p>
                                    <ul class="text-sm text-gray-200 space-y-1">
                                        <li>🚀 Sin límites de tamaño</li>
                                        <li>⚡ Mayor velocidad</li>
                                        <li>🔒 Privacidad total</li>
                                        <li>🎯 Control completo</li>
                                    </ul>
                                </div>
                                
                                <div class="flex flex-col sm:flex-row gap-3">
                                    <button onclick="showSection('faq')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                        <i class="fas fa-question-circle mr-2"></i>
                                        Ver Guía de APIs
                                    </button>
                                    <button onclick="window.open('mailto:adrian@lerer.com.ar?subject=RootFinder - API Configuration&body=Necesito ayuda configurando APIs para documento extenso')" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                        <i class="fas fa-envelope mr-2"></i>
                                        Contactar Soporte
                                    </button>
                                </div>
                            </div>
                        \`;
                    } else {
                        // Standard error handling
                        resultDiv.innerHTML = \`
                            <div class="bg-red-800/50 border border-red-600 rounded-lg p-4">
                                <h4 class="text-red-400 font-bold mb-2">
                                    <i class="fas fa-exclamation-triangle mr-2"></i>
                                    \${isUsageLimitError ? 'Límite de Demo Alcanzado' : isTimeoutError ? 'Timeout del Análisis' : 'Error en el Análisis'}
                                </h4>
                                <p class="text-sm text-gray-300">\${errorResponse.message || error.message}</p>
                                \${isTimeoutError ? \`
                                    <div class="mt-3 p-3 bg-yellow-800/30 border border-yellow-600 rounded">
                                        <p class="text-yellow-300 text-sm">
                                            <i class="fas fa-clock mr-2"></i>
                                            <strong>Sugerencia:</strong> Intente con un texto más corto o verifique su conexión móvil.
                                        </p>
                                    </div>
                                \` : ''}
                                \${isUsageLimitError ? \`
                                    <div class="mt-3 p-3 bg-blue-800/30 border border-blue-600 rounded">
                                        <p class="text-blue-300 text-sm">
                                            <i class="fas fa-envelope mr-2"></i>
                                            Para acceso completo contacte: <strong>adrian@lerer.com.ar</strong>
                                        </p>
                                    </div>
                                \` : \`
                                    <p class="text-xs text-gray-400 mt-2">
                                        Verifique su conexión o contacte al administrador.
                                    </p>
                                \`}
                            </div>
                        \`;
                    }
                }

                clearInterval(progressInterval);
                isAnalyzing = false;
            }

            async function analyzeCorpus() {
                if (isAnalyzing) return;
                
                const titleInput = document.getElementById('corpusTitle');
                const typeInput = document.getElementById('documentType');
                const textInput = document.getElementById('corpusText');
                const resultDiv = document.getElementById('corpusResult');
                
                const title = titleInput.value.trim();
                const documentType = typeInput.value;
                const text = textInput.value.trim();

                if (!text) {
                    alert('Por favor, ingrese el texto completo del documento.');
                    return;
                }

                if (!title) {
                    alert('Por favor, ingrese el título del documento.');
                    return;
                }

                isAnalyzing = true;
                resultDiv.classList.remove('hidden');
                resultDiv.innerHTML = \`
                    <div class="text-center py-8 analysis-progress">
                        <i class="fas fa-cogs fa-spin text-3xl text-blue-400 mb-4"></i>
                        <p class="text-blue-300">
                            <span class="progress-icon">⏳</span> Analizando corpus completo...
                        </p>
                        <p class="text-gray-400 text-sm mt-2">Análisis multi-bloque: esto puede tomar 5-10 minutos...</p>
                        <p class="text-gray-500 text-xs mt-1">Sistema procesa automáticamente por bloques - timeout en 10 minutos</p>
                    </div>
                \`;
                
                const progressInterval = showProgressIndicator();

                try {
                    console.log('DEBUG FRONTEND: corpusAnalysisDepth =', corpusAnalysisDepth);
                    console.log('DEBUG FRONTEND: Sending to /api/corpus with analysisDepth:', corpusAnalysisDepth);
                    
                    const response = await fetchWithTimeout('/api/corpus', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            text: text,
                            title: title,
                            documentType: documentType,
                            analysisDepth: corpusAnalysisDepth,
                            userEmail: currentUser?.email
                        })
                    }, 600000); // 10 minutes timeout for multi-block corpus analysis

                    const result = await response.json();

                    if (result.success) {
                        currentCorpusResult = result.corpus;
                        
                        resultDiv.innerHTML = \`
                            <div class="space-y-4">
                                <div class="bg-green-800/30 border-l-4 border-green-400 p-4">
                                    <h4 class="font-bold text-green-400 mb-2">
                                        <i class="fas fa-check-circle mr-2"></i>
                                        Análisis de Corpus Completado
                                    </h4>
                                    <p class="text-xs text-gray-400">
                                        Documento: \${result.corpus.title} | 
                                        Artículos: \${result.corpus.metadata.articleCount} |
                                        Completado: \${new Date(result.corpus.metadata.timestamp).toLocaleString()}
                                    </p>
                                </div>
                                
                                <div class="bg-white/10 rounded-lg p-4">
                                    <h5 class="font-semibold text-blue-300 mb-3">Análisis Completo del Corpus:</h5>
                                    <div class="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                                        \${result.corpus.fullAnalysis}
                                    </div>
                                </div>
                            </div>
                        \`;
                        
                        // Show download section
                        document.getElementById('corpusDownloadSection').classList.remove('hidden');
                    } else {
                        throw new Error(result.message || result.error || 'Error desconocido');
                    }

                } catch (error) {
                    const errorResponse = await error.response?.json().catch(() => ({}));
                    const isTimeoutError = error.message.includes('tardó demasiado tiempo');
                    const isExtensiveCorpus = errorResponse.requiresOwnApiKeys && errorResponse.extensiveCorpus;
                    
                    if (isExtensiveCorpus) {
                        // Special handling for extensive corpus
                        const reasons = errorResponse.extensiveCorpus.reasons;
                        const reasonTexts = [];
                        if (reasons.containsExtensiveLaw) reasonTexts.push('📋 Legislación masiva detectada');
                        if (reasons.largeSize) reasonTexts.push(\`📊 Tamaño: \${Math.round(reasons.textLength/1000)}KB\`);
                        if (reasons.manyArticles) reasonTexts.push(\`📖 Artículos: \${reasons.articleCount}\`);
                        
                        resultDiv.innerHTML = \`
                            <div class="bg-amber-800/50 border border-amber-600 rounded-lg p-4">
                                <h4 class="text-amber-400 font-bold mb-3">
                                    <i class="fas fa-key mr-2"></i>
                                    Corpus Extenso - API Propia Requerida
                                </h4>
                                <div class="mb-3">
                                    <p class="text-sm text-gray-200 mb-2">\${errorResponse.message}</p>
                                    <p class="text-lg font-semibold text-white">📄 \${errorResponse.extensiveCorpus.title}</p>
                                    <p class="text-sm text-amber-300">💰 Costo estimado: \${errorResponse.estimatedCost}</p>
                                </div>
                                
                                <div class="bg-black/30 rounded p-3 mb-3">
                                    <p class="text-amber-300 font-semibold mb-2">🔍 Análisis del documento:</p>
                                    <ul class="text-sm text-gray-300 space-y-1">
                                        \${reasonTexts.map(reason => \`<li>\${reason}</li>\`).join('')}
                                    </ul>
                                </div>
                                
                                <div class="bg-green-800/30 border border-green-600 rounded p-3 mb-3">
                                    <p class="text-green-300 font-semibold mb-2">🚀 Con API propia:</p>
                                    <ul class="text-sm text-gray-200 space-y-1">
                                        <li>📈 Análisis completo de \${reasons.articleCount}+ artículos</li>
                                        <li>⚡ Procesamiento directo y veloz</li>
                                        <li>🔒 Máxima privacidad de documentos</li>
                                        <li>🎛️ Control total sobre parámetros</li>
                                    </ul>
                                </div>
                                
                                <div class="flex flex-col sm:flex-row gap-3">
                                    <button onclick="showSection('faq')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                        <i class="fas fa-question-circle mr-2"></i>
                                        Configurar APIs
                                    </button>
                                    <button onclick="window.open('mailto:adrian@lerer.com.ar?subject=RootFinder - Corpus Extenso&body=Necesito analizar: ' + encodeURIComponent('\${errorResponse.extensiveCorpus.title}') + ' (\${reasons.articleCount} artículos)')" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                        <i class="fas fa-envelope mr-2"></i>
                                        Solicitar Asistencia
                                    </button>
                                </div>
                            </div>
                        \`;
                    } else {
                        // Standard error handling
                        resultDiv.innerHTML = \`
                            <div class="bg-red-800/50 border border-red-600 rounded-lg p-4">
                                <h4 class="text-red-400 font-bold mb-2">
                                    <i class="fas fa-exclamation-triangle mr-2"></i>
                                    \${isTimeoutError ? 'Timeout del Análisis de Corpus' : 'Error en el Análisis del Corpus'}
                                </h4>
                                <p class="text-sm text-gray-300">\${errorResponse.message || error.message}</p>
                                \${isTimeoutError ? \`
                                    <div class="mt-3 p-3 bg-yellow-800/30 border border-yellow-600 rounded">
                                        <p class="text-yellow-300 text-sm">
                                            <i class="fas fa-clock mr-2"></i>
                                            <strong>Sugerencia:</strong> El análisis de corpus es muy intensivo. Intente con un documento más corto o verifique su conexión.
                                        </p>
                                    </div>
                                \` : \`
                                    <p class="text-xs text-gray-400 mt-2">
                                        Verifique que todas las API keys estén configuradas correctamente.
                                    </p>
                                \`}
                            </div>
                        \`;
                    }
                }

                clearInterval(progressInterval);
                isAnalyzing = false;
            }

            function downloadResult() {
                if (!currentAnalysisResult) {
                    alert('No hay resultado para descargar.');
                    return;
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Professional header with logo area
                doc.setFontSize(24);
                doc.setFont(undefined, 'bold');
                doc.text('RootFinder', 20, 25);
                
                doc.setFontSize(14);
                doc.setFont(undefined, 'normal');
                doc.text('Sistema ABAN - Informe de Análisis Genealógico Legal', 20, 35);
                
                // Horizontal line
                doc.setLineWidth(0.5);
                doc.line(20, 40, 190, 40);
                
                // Document info box
                doc.setFillColor(240, 240, 240);
                doc.rect(20, 45, 170, 25, 'F');
                
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('INFORMACIÓN DEL DOCUMENTO', 25, 52);
                doc.setFont(undefined, 'normal');
                doc.text(\`Fecha de análisis: \${new Date(currentAnalysisResult.metadata.timestamp).toLocaleString('es-ES')}\`, 25, 58);
                doc.text(\`Metodología: \${currentAnalysisResult.methodology}\`, 25, 64);
                
                // Original text section
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('TEXTO OBJETO DE ANÁLISIS', 20, 85);
                
                doc.setFillColor(250, 250, 250);
                doc.rect(20, 90, 170, 15, 'F');
                
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                const textLines = doc.splitTextToSize(currentAnalysisResult.text, 165);
                doc.text(textLines, 22, 95);
                
                let currentY = 110 + (textLines.length * 4);
                
                // Analysis result section
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('ANÁLISIS GENEALÓGICO ABAN', 20, currentY);
                
                currentY += 10;
                
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                const analysisLines = doc.splitTextToSize(currentAnalysisResult.result, 170);
                
                // Split analysis into pages if needed
                const linesPerPage = Math.floor((280 - currentY) / 4);
                let lineIndex = 0;
                
                while (lineIndex < analysisLines.length) {
                    const pageLinesEnd = Math.min(lineIndex + linesPerPage, analysisLines.length);
                    const pageLines = analysisLines.slice(lineIndex, pageLinesEnd);
                    
                    doc.text(pageLines, 20, currentY);
                    
                    lineIndex = pageLinesEnd;
                    
                    if (lineIndex < analysisLines.length) {
                        // Add footer to current page
                        doc.setFontSize(8);
                        doc.text('© Ignacio Adrián Lerer 2025 - RootFinder Sistema ABAN', 20, 285);
                        doc.text(\`Página \${doc.getNumberOfPages()}\`, 180, 285);
                        
                        doc.addPage();
                        currentY = 20;
                    }
                }
                
                // Footer on last page
                const finalY = Math.max(currentY + (analysisLines.length % linesPerPage) * 4 + 20, 260);
                doc.setLineWidth(0.3);
                doc.line(20, finalY, 190, finalY);
                
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                doc.text('© Ignacio Adrián Lerer 2025 - RootFinder Sistema ABAN', 20, finalY + 8);
                doc.text('Algoritmo de Búsqueda del Ancestro Normativo', 20, finalY + 14);
                doc.text(\`Generado el \${new Date().toLocaleString('es-ES')}\`, 20, finalY + 20);
                doc.text(\`Página \${doc.getNumberOfPages()}\`, 180, finalY + 8);
                
                const filename = \`RootFinder-Analisis-ABAN-\${new Date().toISOString().slice(0,10)}-\${currentAnalysisResult.metadata.analysisId}.pdf\`;
                doc.save(filename);
            }

            function downloadCorpusResult() {
                if (!currentCorpusResult) {
                    alert('No hay resultado para descargar.');
                    return;
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Professional header
                doc.setFontSize(24);
                doc.setFont(undefined, 'bold');
                doc.text('RootFinder', 20, 25);
                
                doc.setFontSize(14);
                doc.setFont(undefined, 'normal');
                doc.text('Sistema ABAN - Análisis Genealógico de Corpus Normativo', 20, 35);
                
                // Horizontal line
                doc.setLineWidth(0.5);
                doc.line(20, 40, 190, 40);
                
                // Document info box
                doc.setFillColor(240, 240, 240);
                doc.rect(20, 45, 170, 35, 'F');
                
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('INFORMACIÓN DEL CORPUS', 25, 52);
                doc.setFont(undefined, 'normal');
                doc.text(\`Documento: \${currentCorpusResult.title}\`, 25, 58);
                doc.text(\`Tipo de documento: \${currentCorpusResult.documentType.charAt(0).toUpperCase() + currentCorpusResult.documentType.slice(1)}\`, 25, 64);
                doc.text(\`Fecha de análisis: \${new Date(currentCorpusResult.metadata.timestamp).toLocaleString('es-ES')}\`, 25, 70);
                doc.text(\`Artículos analizados: \${currentCorpusResult.metadata.articleCount}\`, 25, 76);
                
                // Methodology info
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('METODOLOGÍA APLICADA', 20, 95);
                doc.setFont(undefined, 'normal');
                doc.text('Algoritmo de Búsqueda del Ancestro Normativo (ABAN)', 20, 102);
                doc.text('Análisis genealógico exhaustivo de cada artículo del corpus', 20, 108);
                
                // Analysis result section
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('ANÁLISIS GENEALÓGICO COMPLETO DEL CORPUS', 20, 125);
                
                let currentY = 135;
                
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                const analysisLines = doc.splitTextToSize(currentCorpusResult.fullAnalysis, 170);
                
                // Split analysis into pages if needed
                const linesPerPage = Math.floor((270 - currentY) / 4);
                let lineIndex = 0;
                
                while (lineIndex < analysisLines.length) {
                    const pageLinesEnd = Math.min(lineIndex + linesPerPage, analysisLines.length);
                    const pageLines = analysisLines.slice(lineIndex, pageLinesEnd);
                    
                    doc.text(pageLines, 20, currentY);
                    
                    lineIndex = pageLinesEnd;
                    
                    if (lineIndex < analysisLines.length) {
                        // Add footer to current page
                        doc.setFontSize(8);
                        doc.text('© Ignacio Adrián Lerer 2025 - RootFinder Sistema ABAN', 20, 285);
                        doc.text(\`\${currentCorpusResult.title} - Página \${doc.getNumberOfPages()}\`, 130, 285);
                        
                        doc.addPage();
                        currentY = 20;
                    }
                }
                
                // Footer on last page
                const finalY = Math.max(currentY + (analysisLines.length % linesPerPage) * 4 + 20, 260);
                doc.setLineWidth(0.3);
                doc.line(20, finalY, 190, finalY);
                
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                doc.text('© Ignacio Adrián Lerer 2025 - RootFinder Sistema ABAN', 20, finalY + 8);
                doc.text('Algoritmo de Búsqueda del Ancestro Normativo', 20, finalY + 14);
                doc.text(\`Corpus: \${currentCorpusResult.title}\`, 20, finalY + 20);
                doc.text(\`Generado el \${new Date().toLocaleString('es-ES')}\`, 20, finalY + 26);
                doc.text(\`Página \${doc.getNumberOfPages()}\`, 180, finalY + 8);
                
                const cleanTitle = currentCorpusResult.title.replace(/[^a-zA-Z0-9\\s]/g, '').replace(/\\s+/g, '-').toLowerCase();
                const filename = \`RootFinder-Corpus-\${cleanTitle}-\${new Date().toISOString().slice(0,10)}.pdf\`;
                doc.save(filename);
            }

            // Section Navigation Functions
            function showSection(sectionName) {
                // Hide all sections
                document.getElementById('homeSection').classList.add('hidden');
                document.getElementById('nosotrosSection').classList.add('hidden');
                document.getElementById('faqSection').classList.add('hidden');
                
                // Reset all nav buttons
                const navButtons = document.querySelectorAll('.nav-btn');
                navButtons.forEach(btn => {
                    btn.classList.remove('bg-blue-600');
                    btn.classList.add('bg-transparent', 'border', 'border-white/30');
                });
                
                // Show selected section
                if (sectionName === 'home') {
                    document.getElementById('homeSection').classList.remove('hidden');
                    document.getElementById('homeBtn').classList.remove('bg-transparent', 'border', 'border-white/30');
                    document.getElementById('homeBtn').classList.add('bg-blue-600');
                } else if (sectionName === 'nosotros') {
                    document.getElementById('nosotrosSection').classList.remove('hidden');
                    document.getElementById('nosotrosBtn').classList.remove('bg-transparent', 'border', 'border-white/30');
                    document.getElementById('nosotrosBtn').classList.add('bg-blue-600');
                } else if (sectionName === 'faq') {
                    document.getElementById('faqSection').classList.remove('hidden');
                    document.getElementById('faqBtn').classList.remove('bg-transparent', 'border', 'border-white/30');
                    document.getElementById('faqBtn').classList.add('bg-blue-600');
                }
            }
            
            // FAQ Toggle Function
            function toggleFAQ(faqId) {
                const faqContent = document.getElementById(faqId);
                const faqIcon = document.getElementById(faqId + '-icon');
                
                if (faqContent.classList.contains('hidden')) {
                    faqContent.classList.remove('hidden');
                    faqIcon.classList.add('rotate-90');
                } else {
                    faqContent.classList.add('hidden');
                    faqIcon.classList.remove('rotate-90');
                }
            }

            // Initialize application
            window.addEventListener('load', function() {
                setAnalysisMode('single');
                setCorpusAnalysisType('global');
                showSection('home'); // Show home section by default
                // Don't check system status until user is authenticated
            });
        </script>
    </body>
    </html>
  `);
});

export default app