# stage 1: зависимости 
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# stage 2: финальный образ 
FROM node:22-alpine AS runtime
WORKDIR /app

# Системный пользователь без root-прав
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY lib/           ./lib/
COPY server.js      ./
COPY docs-routes.js ./
COPY index.js       ./
COPY views/         ./views/
COPY static/        ./static/
# Снэпшот монтируется через ConfigMap/Volume, не копируется в образ

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]