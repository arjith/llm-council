# Production image - copies pre-built artifacts
# Run `pnpm build` locally before building this image
FROM node:20-alpine

# Install pnpm for production dependencies
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

WORKDIR /app

# Copy workspace files for pnpm
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy pre-built dist folders
COPY packages/core/dist packages/core/dist/
COPY packages/api/dist packages/api/dist/

WORKDIR /app/packages/api

EXPOSE 3001

CMD ["node", "dist/index.js"]
