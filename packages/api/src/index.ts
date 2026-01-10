import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { councilRoutes } from './routes/council.js';
import { sessionRoutes } from './routes/sessions.js';
import { healthRoutes } from './routes/health.js';
import { websocketRoutes } from './routes/websocket.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

// Plugins
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

await fastify.register(websocket);

// Routes
await fastify.register(healthRoutes, { prefix: '/api/health' });
await fastify.register(councilRoutes, { prefix: '/api/council' });
await fastify.register(sessionRoutes, { prefix: '/api/sessions' });
await fastify.register(websocketRoutes, { prefix: '/api/ws' });

// Start server
const port = parseInt(process.env.API_PORT ?? '3001', 10);
const host = process.env.API_HOST ?? '0.0.0.0';

try {
  await fastify.listen({ port, host });
  console.log(`🏛️  LLM Council API running at http://${host}:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
