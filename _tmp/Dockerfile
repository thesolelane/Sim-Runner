# ============================================================
# Stage 1 — Build the React/Vite frontend
# VITE_* vars must be supplied as build args because Vite
# embeds them at compile time (they are NOT available at runtime).
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build-time env vars for Vite (passed via --build-arg)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ============================================================
# Stage 2 — Production image (no dev tools, smaller image)
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server source (runs directly as ESM — no compile step needed)
COPY server ./server

# Runtime secrets — supply via `docker run -e` or docker-compose
ENV PORT=80
ENV SUPABASE_SERVICE_ROLE_KEY=""
ENV STRIPE_SECRET_KEY=""
ENV STRIPE_WEBHOOK_SECRET=""
ENV TELNYX_API_KEY=""
ENV TELNYX_PHONE_NUMBER=""

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/healthz || exit 1

CMD ["node", "server/index.js"]
