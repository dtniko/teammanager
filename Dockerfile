FROM node:18-alpine AS development

# Installa dipendenze di sistema
RUN apk add --no-cache \
    postgresql-client \
    curl \
    git \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copia package.json e installa dipendenze
COPY package*.json ./
RUN npm install

# Copia tutto il codice sorgente
COPY . .

# Build React app
RUN npm run build

# Crea directory necessarie
RUN mkdir -p /app/server/uploads /app/logs

# Espone la porta
EXPOSE 5000

# Avvia SOLO il server Express (non React dev server)
CMD ["node", "server/index.js"]

# ---- Stage: builder (compila il frontend React) ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG REACT_APP_API_URL=/api
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY
ARG REACT_APP_GOOGLE_CLIENT_ID
ARG REACT_APP_VAPID_PUBLIC_KEY
# Versione del deployment: arriva da --build-arg APP_VERSION e viene esposta
# come REACT_APP_APP_VERSION per il bundle (window.__BUILD_VERSION__)
ARG APP_VERSION=dev
ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL \
    REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY \
    REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID \
    REACT_APP_VAPID_PUBLIC_KEY=$REACT_APP_VAPID_PUBLIC_KEY \
    REACT_APP_APP_VERSION=$APP_VERSION

# public/package.json (copia in build/ da CRA): il server lo legge per GET /api/version
RUN printf '{ "version": "%s" }' "$APP_VERSION" > public/package.json

RUN npm run build

# ---- Stage: production (solo backend + build statica, no devDependencies) ----
FROM node:18-alpine AS production
RUN apk add --no-cache curl && rm -rf /var/cache/apk/*
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY database ./database
COPY --from=builder /app/build ./build

RUN mkdir -p /app/server/uploads /app/logs \
    && addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
# Cloud Run inietta PORT (default 8080); server/index.js legge già process.env.PORT
EXPOSE 8080

CMD ["node", "server/index.js"]
