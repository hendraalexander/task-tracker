# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------- base
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------- deps
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, so the schema must exist first.
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------- build
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------- migrator
# Contains the Prisma CLI + migrations. Used only for deploy/seed jobs.
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json tsconfig.json ./
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------- runner
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
