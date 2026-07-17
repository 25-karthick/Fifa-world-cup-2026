# Build stage
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

ARG NEXT_PUBLIC_AGENT_CORE_URL
ENV NEXT_PUBLIC_AGENT_CORE_URL=$NEXT_PUBLIC_AGENT_CORE_URL
ARG NEXT_PUBLIC_SIMULATION_URL
ENV NEXT_PUBLIC_SIMULATION_URL=$NEXT_PUBLIC_SIMULATION_URL
ARG NEXT_PUBLIC_SIMULATION_WS
ENV NEXT_PUBLIC_SIMULATION_WS=$NEXT_PUBLIC_SIMULATION_WS

COPY package*.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/ops-console/package.json apps/ops-console/

RUN npm ci --workspace=packages/shared-types --workspace=apps/ops-console

COPY packages/shared-types packages/shared-types
COPY apps/ops-console apps/ops-console

RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=apps/ops-console

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=builder /usr/src/app ./

EXPOSE 3003
ENV PORT=3003

CMD ["npx", "next", "start", "-p", "3003", "apps/ops-console"]
