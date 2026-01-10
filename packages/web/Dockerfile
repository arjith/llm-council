# Production image - copies pre-built artifacts
# Run `pnpm --filter @llm-council/web build` locally before building this image
FROM nginx:alpine

# Copy pre-built files to nginx
COPY packages/web/dist /usr/share/nginx/html

# Configure nginx for SPA routing with API proxy
# API_URL will be set via environment variable
RUN mkdir -p /etc/nginx/templates && \
    echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass ${API_URL}; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $proxy_host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
}' > /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
