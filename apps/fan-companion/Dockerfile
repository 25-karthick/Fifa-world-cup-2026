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
COPY apps/fan-companion/package.json apps/fan-companion/

RUN npm ci --workspace=packages/shared-types --workspace=apps/fan-companion

COPY packages/shared-types packages/shared-types
COPY apps/fan-companion apps/fan-companion

RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=apps/fan-companion

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=builder /usr/src/app ./

EXPOSE 3000
ENV PORT=3000

CMD ["npx", "next", "start", "-p", "3000", "apps/fan-companion"]
