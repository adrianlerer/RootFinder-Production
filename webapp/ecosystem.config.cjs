module.exports = {
  apps: [
    {
      name: 'memetic-analysis',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        OPENROUTER_API_KEY: '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',
        OPENAI_API_KEY: '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',
        ANTHROPIC_API_KEY: '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'
      },
      env_file: '.env',
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}