module.exports = {
  apps: [
    {
      name: 'memetic-analysis',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },
      env_file: '.env',
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}