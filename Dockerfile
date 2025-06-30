# Multi-stage build per ottimizzare le dimensioni dell'immagine

# Stage 1: Build dell'applicazione React
FROM node:18-alpine AS frontend-build

# Imposta la directory di lavoro
WORKDIR /app

# Copia i file di configurazione delle dipendenze
COPY package*.json ./

# Installa le dipendenze
RUN npm ci --only=production && npm cache clean --force

# Copia il codice sorgente
COPY . .

# Build dell'applicazione React per produzione
RUN npm run build

# Stage 2: Setup del server Node.js
FROM node:18-alpine AS backend

# Aggiungi metadata
LABEL maintainer="your-email@domain.com"
LABEL version="1.0.0"
LABEL description="SportClub Manager - Gestionale per società sportive"

# Installa dipendenze di sistema necessarie
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Crea un utente non-root per maggiore sicurezza
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Imposta la directory di lavoro
WORKDIR /app

# Copia i file di configurazione delle dipendenze
COPY package*.json ./

# Installa solo le dipendenze di produzione
RUN npm ci --only=production && npm cache clean --force

# Copia il codice del server
COPY server/ ./server/
COPY database/ ./database/

# Copia il build del frontend dal stage precedente
COPY --from=frontend-build /app/build ./build

# Crea directory per upload e logs
RUN mkdir -p /app/server/uploads /app/logs

# Cambia ownership delle directory all'utente nodejs
RUN chown -R nodejs:nodejs /app

# Cambia all'utente non-root
USER nodejs

# Espone la porta dell'applicazione
EXPOSE 5000

# Configura variabili d'ambiente di default
ENV NODE_ENV=production
ENV PORT=5000

# Health check per verificare che l'app sia funzionante
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Comando di avvio dell'applicazione
CMD ["node", "server/index.js"]

# ===============================================
# Stage alternativo per development
# ===============================================
FROM node:18-alpine AS development

# Installa dipendenze di sistema per development
RUN apk add --no-cache \
    postgresql-client \
    curl \
    git \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copia i file di configurazione
COPY package*.json ./

# Installa tutte le dipendenze (incluse quelle di development)
RUN npm install

# Copia tutto il codice sorgente
COPY . .

# Crea directory necessarie
RUN mkdir -p /app/server/uploads /app/logs

# Espone le porte per development (frontend e backend)
EXPOSE 3000 5000

# Comando per development con hot reload
CMD ["npm", "run", "dev"]

# ===============================================
# Stage per testing
# ===============================================
FROM node:18-alpine AS testing

WORKDIR /app

# Installa dipendenze per testing
RUN apk add --no-cache \
    postgresql-client \
    curl \
    chromium \
    && rm -rf /var/cache/apk/*

# Copia package.json e installa dipendenze
COPY package*.json ./
RUN npm install

# Copia il codice sorgente
COPY . .

# Configura Puppeteer per usare Chromium installato
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Comando per eseguire i test
CMD ["npm", "test"]

# ===============================================
# .dockerignore suggerito (da creare separatamente)
# ===============================================
# node_modules
# npm-debug.log*
# yarn-debug.log*
# yarn-error.log*
# .git
# .env
# .env.local
# .env.development.local
# .env.test.local
# .env.production.local
# build/
# dist/
# coverage/
# .nyc_output
# .next
# .nuxt
# .cache
# logs/
# *.log
# .DS_Store
# Thumbs.db
# *.swp
# *.swo
# *~
# .vscode/
# .idea/
# *.sublime-project
# *.sublime-workspace
# README.md
# LICENSE
# docker-compose*.yml
# Dockerfile*
# .dockerignore
