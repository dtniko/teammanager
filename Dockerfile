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

# Comando per avviare solo il server (non npm run dev)
CMD ["node", "server/index.js"]
