# Production image - copies pre-built artifacts
# Run `pnpm --filter @llm-council/web build` locally before building this image
FROM nginx:alpine

# Copy pre-built files to nginx
COPY packages/web/dist /usr/share/nginx/html

# Copy nginx config file directly to conf.d
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
