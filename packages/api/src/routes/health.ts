import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  });

  fastify.get('/ready', async () => {
    // Check if Azure OpenAI is configured
    const hasEndpoint = !!process.env.AZURE_OPENAI_ENDPOINT;
    const hasApiKey = !!process.env.AZURE_OPENAI_API_KEY;

    return {
      ready: hasEndpoint && hasApiKey,
      checks: {
        azureOpenAI: hasEndpoint && hasApiKey,
      },
    };
  });
};
