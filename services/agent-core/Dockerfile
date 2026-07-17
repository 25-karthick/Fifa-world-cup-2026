# Build stage
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY services/agent-core/package.json services/agent-core/

RUN npm ci --workspace=packages/shared-types --workspace=services/agent-core

COPY packages/shared-types packages/shared-types
COPY services/agent-core services/agent-core

RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=services/agent-core

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=builder /usr/src/app ./

EXPOSE 3001
ENV PORT=3001

CMD ["node", "services/agent-core/dist/server.js"]
