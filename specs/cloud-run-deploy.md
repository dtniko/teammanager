# Deploy su Cloud Run — spec

## Obiettivo
Rendere il progetto deployabile su Google Cloud Run come singolo container
(Express serve sia le API sia i file statici React buildati), senza rompere
il flusso Docker Compose locale esistente (target `development`).

## 1. Dockerfile
Il Dockerfile attuale ha un solo stage `development` che builda React E fa
girare il server nello stesso container, con `.env` copiato dentro (rischio:
se `.env` esiste nella build context viene incluso nell'immagine).

Aggiungere in coda al Dockerfile esistente (NON toccare lo stage
`development`, usato da docker-compose.yml con `target: development`) un
nuovo multi-stage per la produzione:

```dockerfile
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
ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL \
    REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY \
    REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

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
```

Note:
- `server/index.js` già legge `process.env.PORT` e già serve `../build` quando
  `NODE_ENV === 'production'` — nessuna modifica al codice server necessaria.
- Non copiare `.env` nello stage `production` (non è nella COPY list, quindi
  al sicuro anche se presente nella build context).

## 2. .dockerignore (nuovo file, nella root del progetto)
Creare `.dockerignore` per evitare di includere segreti/file inutili nel
build context di QUALSIASI stage (anche `development`):

```
node_modules
build
.git
.gitignore
.env
.env.*
!.env.example
logs
*.log
npm-debug.log*
.DS_Store
server/uploads/*
!server/uploads/.gitkeep
specs
```

Se `server/uploads/.gitkeep` non esiste, ometti quella riga (verifica prima
con Glob/Read se il file esiste; se non esiste usa solo `server/uploads/*`
senza l'eccezione, per non rompere la build).

## 3. Verifica
Dopo le modifiche, eseguire (in bash, dalla root del progetto):
```
docker build --target production -t sportclub-manager-prod:test .
```
Deve completare senza errori. Non serve eseguire il container (nessun
accesso DB in questo ambiente di test). Riportare solo esito build (ok/errore)
e eventuali warning rilevanti.

## Non fare
- Non modificare `docker-compose.yml` né lo stage `development`.
- Non toccare codice applicativo (server/index.js, src/*) — è già pronto.
- Non aggiungere altre dipendenze o abstractions.
