# 🏆 SportClub Manager

**Gestionale completo per società sportive** - Una Progressive Web App moderna per gestire atleti, calendari, documenti e comunicazioni.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.2.0-blue.svg)

## 📋 Indice

- [Caratteristiche](#-caratteristiche)
- [Demo](#-demo)
- [Requisiti](#-requisiti)
- [Installazione](#-installazione)
- [Configurazione](#-configurazione)
- [Utilizzo](#-utilizzo)
- [Sviluppo](#-sviluppo)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [Licenza](#-licenza)

## ✨ Caratteristiche

### 🔐 **Autenticazione e Autorizzazione**
- Login sicuro tramite Google OAuth
- Gestione ruoli: Admin, Coach, Genitore, Atleta
- Controllo accessi granulare

### 👥 **Gestione Atleti**
- Anagrafica completa con informazioni personali
- Associazione genitori-atleti automatica
- Raggruppamento per categorie/squadre
- Archivio storico per stagioni passate

### 📅 **Calendario e Eventi**
- Calendario interattivo per allenamenti e partite
- Gestione presenze con conferma online
- Notifiche automatiche per eventi
- Vista mensile, settimanale e lista

### 📄 **Gestione Documenti**
- Upload sicuro di certificati medici e pagamenti
- Controllo scadenze automatico con avvisi
- Organizzazione per stagione sportiva
- Download e visualizzazione protetta

### 💬 **Comunicazioni**
- Sistema di messaggistica integrato
- Comunicazioni massive per gruppo o globali
- Notifiche push in tempo reale
- Tracciamento letture

### 🔔 **Notifiche Automatiche**
- Promemoria per scadenze documenti
- Avvisi per eventi del giorno
- Notifiche personalizzate per ruolo
- Support notifiche push PWA

### 📱 **Progressive Web App**
- Installabile su dispositivi mobili
- Funzionamento offline
- Sincronizzazione automatica
- Performance ottimizzate

### 📊 **Dashboard e Reportistica**
- Dashboard personalizzata per ruolo
- Statistiche e metriche
- Export dati in CSV
- Report settimanali automatici

## 🎮 Demo

Puoi testare l'applicazione in modalità demo:

- **URL Demo**: [https://sportclub-demo.example.com](https://sportclub-demo.example.com)
- **Admin**: admin@demo.com
- **Coach**: coach@demo.com
- **Genitore**: parent@demo.com

## 🛠 Requisiti

### Requisiti di Sistema
- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0 (o yarn >= 1.22.0)
- **PostgreSQL**: >= 12.0
- **Git**: Per il controllo versione

### Servizi Esterni
- **Google Cloud Console**: Per OAuth2 authentication
- **VAPID Keys**: Per notifiche push (opzionale)
- **Email Service**: Per notifiche email (opzionale)

## 🚀 Installazione

### 1. Clona il Repository
```bash
git clone https://github.com/tuouser/sportclub-manager.git
cd sportclub-manager
```

### 2. Installa le Dipendenze
```bash
# Installa dipendenze backend e frontend
npm install

# Oppure con yarn
yarn install
```

### 3. Setup Database PostgreSQL

#### Opzione A: Installazione Locale
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (con Homebrew)
brew install postgresql
brew services start postgresql

# Crea database e utente
sudo -u postgres psql
CREATE DATABASE sportclub_manager;
CREATE USER sportclub_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE sportclub_manager TO sportclub_user;
\q
```

#### Opzione B: Docker
```bash
# Avvia PostgreSQL con Docker
docker run --name sportclub-postgres \
  -e POSTGRES_DB=sportclub_manager \
  -e POSTGRES_USER=sportclub_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:14
```

### 4. Configurazione Google OAuth

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita la "Google+ API"
4. Crea credenziali OAuth 2.0:
    - **Tipo**: Applicazione web
    - **Origini autorizzate**: `http://localhost:3000`, `https://yourdomain.com`
    - **URI di reindirizzamento**: `http://localhost:3000`, `https://yourdomain.com`
5. Salva Client ID e Client Secret

## ⚙️ Configurazione

### 1. Variabili d'Ambiente

Crea un file `.env` nella root del progetto:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sportclub_manager
DB_USER=sportclub_user
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_min_32_chars

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Email (opzionale)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Push Notifications (opzionale)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# Logging
LOG_QUERIES=false
```

### 2. Variabili d'Ambiente Frontend

Crea un file `.env` nella cartella del frontend:

```bash
# API
REACT_APP_API_URL=http://localhost:5000/api

# Google OAuth
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id

# Push Notifications (opzionale)
REACT_APP_VAPID_PUBLIC_KEY=your_vapid_public_key

# Analytics (opzionale)
REACT_APP_GA_TRACKING_ID=your_google_analytics_id
```

### 3. Inizializzazione Database

Il database viene inizializzato automaticamente al primo avvio. Per forzare la reinizializzazione:

```bash
npm run db:reset
```

## 🎯 Utilizzo

### Avvio in Sviluppo

```bash
# Avvia sia backend che frontend
npm run dev

# Oppure separatamente:
# Backend
npm run server

# Frontend  
npm start
```

L'applicazione sarà disponibile su:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **API Docs**: http://localhost:5000/api-docs

### Primo Accesso

1. Accedi a http://localhost:3000
2. Clicca su "Accedi con Google"
3. Il primo utente viene automaticamente creato come **Admin**
4. Configura gruppi, stagioni e inizia ad aggiungere atleti

### Creazione Utenti

Gli utenti vengono creati automaticamente al primo login:
- **Ruolo predefinito**: Genitore
- **Cambio ruolo**: Solo gli Admin possono modificare i ruoli
- **Associazione atleti**: Gli Admin possono associare genitori agli atleti

## 🔧 Sviluppo

### Struttura del Progetto

```
sportclub-manager/
├── public/                 # File pubblici PWA
├── src/                   # Codice sorgente React
│   ├── components/        # Componenti React
│   ├── contexts/         # Context providers
│   ├── services/         # Servizi API
│   ├── utils/           # Utilità
│   └── index.js         # Entry point
├── server/               # Backend Express.js
│   ├── config/          # Configurazioni
│   ├── middleware/      # Middleware Express
│   ├── routes/          # Route API
│   ├── services/        # Servizi backend
│   └── index.js         # Server entry point
├── database/            # Schema e migrations
└── docs/               # Documentazione
```

### Script Disponibili

```bash
# Sviluppo
npm run dev              # Avvia backend + frontend
npm start               # Solo frontend
npm run server          # Solo backend

# Build
npm run build           # Build produzione
npm run build:analyze   # Analizza bundle size

# Test
npm test               # Esegui test
npm run test:coverage  # Test con coverage
npm run test:e2e       # Test end-to-end

# Database
npm run db:migrate     # Esegui migrations
npm run db:seed        # Popolamento dati test
npm run db:reset       # Reset completo

# Linting
npm run lint           # ESLint
npm run lint:fix       # Fix automatico
npm run prettier       # Formattazione codice

# Deploy
npm run deploy:staging # Deploy su staging
npm run deploy:prod    # Deploy su produzione
```

### Aggiunta Nuove Funzionalità

1. **Backend (API)**:
   ```bash
   # Crea nuova route
   touch server/routes/newroute.js
   
   # Aggiungi a server/index.js
   const newRoutes = require('./routes/newroute');
   app.use('/api/newroute', authenticateToken, newRoutes);
   ```

2. **Frontend (Componenti)**:
   ```bash
   # Crea nuovo componente
   mkdir src/components/NewComponent
   touch src/components/NewComponent/NewComponent.js
   touch src/components/NewComponent/index.js
   ```

3. **Database (Schema)**:
   ```sql
   -- Aggiungi a database/schema.sql
   CREATE TABLE new_table (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

### Testing

```bash
# Test unitari
npm test

# Test con watch mode
npm run test:watch

# Test di integrazione
npm run test:integration

# Test end-to-end con Playwright
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Debug

```bash
# Debug backend con Node Inspector
npm run debug:server

# Debug frontend con React DevTools
npm run debug:client

# Logs backend
npm run logs

# Performance monitoring
npm run perf:monitor
```

## 🚀 Deployment

### Docker (Consigliato)

```bash
# Build immagine
docker build -t sportclub-manager .

# Avvia con docker-compose
docker-compose up -d

# Scale dell'applicazione
docker-compose up -d --scale web=3
```

### Vercel (Frontend)

```bash
# Installa Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Environment variables su Vercel dashboard
```

### Railway/Heroku (Fullstack)

```bash
# Heroku
heroku create sportclub-manager
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main

# Railway
railway login
railway init
railway up
```

### VPS/Server Dedicato

```bash
# Setup con PM2
npm install -g pm2

# Build applicazione
npm run build

# Avvia con PM2
pm2 start ecosystem.config.js

# Setup reverse proxy con Nginx
sudo cp nginx.conf /etc/nginx/sites-available/sportclub-manager
sudo ln -s /etc/nginx/sites-available/sportclub-manager /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

### Variabili d'Ambiente Produzione

```bash
# Database (usa connection string in produzione)
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Sicurezza
JWT_SECRET=super_secure_random_string_min_32_chars
NODE_ENV=production

# Dominio
FRONTEND_URL=https://yourdomain.com

# SSL/TLS
FORCE_HTTPS=true
```

## 📚 API Documentation

### Autenticazione

```http
POST /api/auth/google
Content-Type: application/json

{
  "googleToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}
```

### Atleti

```http
# Lista atleti
GET /api/athletes?page=1&limit=20&search=nome

# Dettagli atleta  
GET /api/athletes/{id}

# Crea atleta
POST /api/athletes
Content-Type: application/json

{
  "firstName": "Mario",
  "lastName": "Rossi",
  "dateOfBirth": "2010-05-15",
  "fiscalCode": "RSSMRA10E15H501X"
}
```

### Eventi

```http
# Lista eventi
GET /api/events?startDate=2024-01-01&endDate=2024-12-31

# Segna presenza
POST /api/events/{id}/attendance
Content-Type: application/json

{
  "athleteId": 123,
  "status": "present",
  "notes": "Presente"
}
```

### Documenti

```http
# Upload documento
POST /api/documents/upload
Content-Type: multipart/form-data

athleteId=123
documentType=medical_certificate
title=Certificato Medico
document=[file]
```

Per la documentazione API completa, visita: http://localhost:5000/api-docs

## 🤝 Contributing

1. **Fork** del repository
2. **Crea** un branch per la feature (`git checkout -b feature/amazing-feature`)
3. **Commit** delle modifiche (`git commit -m 'Add amazing feature'`)
4. **Push** del branch (`git push origin feature/amazing-feature`)
5. **Apri** una Pull Request

### Convenzioni

- **Commit messages**: Usa [Conventional Commits](https://www.conventionalcommits.org/)
- **Code style**: Segui le regole ESLint e Prettier
- **Testing**: Aggiungi test per le nuove funzionalità
- **Documentation**: Aggiorna la documentazione se necessario

### Roadmap

- [ ] **v1.1**: Integrazione con federazioni sportive
- [ ] **v1.2**: Sistema di pagamenti online
- [ ] **v1.3**: App mobile nativa (React Native)
- [ ] **v1.4**: Dashboard analytics avanzata
- [ ] **v1.5**: Integrazione con dispositivi IoT
- [ ] **v2.0**: Multi-tenancy per multiple società

## 🔒 Sicurezza

- **Authentication**: Google OAuth 2.0
- **Authorization**: JWT con scadenza
- **Data encryption**: HTTPS/TLS in produzione
- **Input validation**: Sanitizzazione su tutti gli input
- **File upload**: Controllo tipo e dimensione file
- **CORS**: Configurato per domini autorizzati
- **Rate limiting**: Protezione da attacchi DDoS
- **SQL injection**: Prevenzione con query parametrizzate

Per segnalare vulnerabilità: security@yourdomain.com

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT. Vedi il file [LICENSE](LICENSE) per dettagli.

## 👥 Team

- **Sviluppo**: [Il tuo nome](https://github.com/tuouser)
- **Design**: [Designer](https://github.com/designer)
- **Product**: [Product Manager](https://github.com/pm)

## 🙏 Ringraziamenti

- [React](https://reactjs.org/) - UI Framework
- [Express.js](https://expressjs.com/) - Backend framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Tailwind CSS](https://tailwindcss.com/) - CSS Framework
- [Lucide Icons](https://lucide.dev/) - Icone
- [date-fns](https://date-fns.org/) - Gestione date

## 📞 Supporto

- **📧 Email**: support@yourdomain.com
- **💬 Discord**: [Server Discord](https://discord.gg/yourserver)
- **📚 Wiki**: [Wiki del progetto](https://github.com/tuouser/sportclub-manager/wiki)
- **🐛 Bug Report**: [Issues GitHub](https://github.com/tuouser/sportclub-manager/issues)

---

<div align="center">

**Fatto con ❤️ per le società sportive italiane**

[Website](https://yourdomain.com) • [Demo](https://demo.yourdomain.com) • [Docs](https://docs.yourdomain.com)

</div>
