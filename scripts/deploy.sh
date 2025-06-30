#!/bin/bash

# SportClub Manager - Script di Deployment
# Versione: 1.0.0
# Descrizione: Script per automatizzare il deployment dell'applicazione

set -e  # Esce in caso di errore

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurazione
APP_NAME="sportclub-manager"
DOCKER_IMAGE="$APP_NAME:latest"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"

# Funzioni utility
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

# Verifica prerequisiti
check_prerequisites() {
    log "Verifico prerequisiti..."

    # Verifica Docker
    if ! command -v docker &> /dev/null; then
        error "Docker non è installato!"
    fi

    # Verifica Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose non è installato!"
    fi

    # Verifica file .env
    if [ ! -f ".env" ]; then
        error "File .env non trovato! Copia .env.example e configuralo."
    fi

    # Verifica variabili essenziali
    source .env
    if [ -z "$DB_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$GOOGLE_CLIENT_ID" ]; then
        error "Variabili d'ambiente essenziali mancanti in .env"
    fi

    success "Prerequisiti verificati"
}

# Backup del database
backup_database() {
    if [ "$SKIP_BACKUP" != "true" ]; then
        log "Eseguo backup del database..."

        mkdir -p "$BACKUP_DIR"
        BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

        if docker-compose exec -T postgres pg_dump -U "${DB_USER:-sportclub_user}" -d "${DB_NAME:-sportclub_manager}" > "$BACKUP_FILE"; then
            success "Backup creato: $BACKUP_FILE"
        else
            warning "Backup fallito - continuo comunque"
        fi
    else
        log "Skip backup richiesto"
    fi
}

# Build dell'immagine Docker
build_image() {
    log "Build dell'immagine Docker..."

    if [ "$ENVIRONMENT" = "development" ]; then
        docker build -t "$DOCKER_IMAGE" --target development .
    else
        docker build -t "$DOCKER_IMAGE" --target backend .
    fi

    success "Immagine Docker creata"
}

# Deploy dell'applicazione
deploy_app() {
    log "Deploy dell'applicazione..."

    # Stop servizi esistenti
    log "Stopping existing services..."
    docker-compose down --remove-orphans

    # Cleanup immagini vecchie
    log "Cleanup old images..."
    docker image prune -f

    # Start servizi
    log "Starting services..."
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    elif [ "$ENVIRONMENT" = "staging" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
    else
        docker-compose up -d
    fi

    success "Applicazione deployata"
}

# Verifica health dell'applicazione
check_health() {
    log "Verifica health dell'applicazione..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
            success "Applicazione healthy dopo $attempt tentativi"
            return 0
        fi

        log "Tentativo $attempt/$max_attempts - attendo..."
        sleep 10
        ((attempt++))
    done

    error "Applicazione non risponde dopo $max_attempts tentativi"
}

# Esegui migrations del database
run_migrations() {
    log "Eseguo migrations del database..."

    if docker-compose exec app npm run db:migrate; then
        success "Migrations completate"
    else
        error "Migrations fallite"
    fi
}

# Setup SSL con Let's Encrypt
setup_ssl() {
    if [ "$SETUP_SSL" = "true" ] && [ ! -z "$DOMAIN" ]; then
        log "Setup SSL con Let's Encrypt per $DOMAIN..."

        # Installa certbot se non presente
        if ! command -v certbot &> /dev/null; then
            log "Installo certbot..."
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        fi

        # Ottieni certificato
        sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL"

        success "SSL configurato per $DOMAIN"
    fi
}

# Cleanup
cleanup() {
    log "Cleanup..."

    # Rimuovi immagini dangling
    docker image prune -f

    # Rimuovi volumi non utilizzati (solo se richiesto)
    if [ "$CLEANUP_VOLUMES" = "true" ]; then
        docker volume prune -f
    fi

    # Cleanup log vecchi (mantieni ultimi 30 giorni)
    find ./logs -name "*.log" -mtime +30 -delete

    success "Cleanup completato"
}

# Rollback all'ultima versione funzionante
rollback() {
    log "Eseguo rollback..."

    # Lista backup disponibili
    if [ -d "$BACKUP_DIR" ]; then
        LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/backup_*.sql 2>/dev/null | head -1)

        if [ ! -z "$LATEST_BACKUP" ]; then
            warning "Rollback del database a: $LATEST_BACKUP"

            # Conferma dall'utente
            read -p "Confermi il rollback del database? (y/N): " -n 1 -r
            echo

            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker-compose exec -T postgres psql -U "${DB_USER:-sportclub_user}" -d "${DB_NAME:-sportclub_manager}" < "$LATEST_BACKUP"
                success "Rollback database completato"
            fi
        else
            warning "Nessun backup trovato per rollback"
        fi
    fi

    # Restart servizi
    docker-compose restart
    success "Rollback completato"
}

# Monitoring e logs
show_logs() {
    echo "Logs dell'applicazione:"
    docker-compose logs -f --tail=50 app
}

show_status() {
    echo "Status dei servizi:"
    docker-compose ps

    echo -e "\nRisorse utilizzate:"
    docker stats --no-stream

    echo -e "\nHealth check:"
    curl -s http://localhost:5000/api/health | jq . || echo "API non raggiungibile"
}

# Menu principale
show_menu() {
    echo "SportClub Manager - Script di Deployment"
    echo "========================================"
    echo "1) Deploy completo"
    echo "2) Solo build"
    echo "3) Solo deploy"
    echo "4) Backup database"
    echo "5) Rollback"
    echo "6) Show logs"
    echo "7) Show status"
    echo "8) Setup SSL"
    echo "9) Cleanup"
    echo "0) Exit"
    echo
}

# Parsing argumenti
case "$1" in
    "full"|"deploy")
        ENVIRONMENT="${2:-production}"
        log "Avvio deploy completo per environment: $ENVIRONMENT"
        check_prerequisites
        backup_database
        build_image
        deploy_app
        run_migrations
        check_health
        setup_ssl
        cleanup
        success "Deploy completato con successo!"
        ;;
    "build")
        ENVIRONMENT="${2:-production}"
        log "Solo build per environment: $ENVIRONMENT"
        check_prerequisites
        build_image
        success "Build completata!"
        ;;
    "backup")
        log "Backup database"
        backup_database
        ;;
    "rollback")
        log "Rollback"
        rollback
        ;;
    "logs")
        show_logs
        ;;
    "status")
        show_status
        ;;
    "ssl")
        DOMAIN="$2"
        SSL_EMAIL="$3"
        setup_ssl
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  full [env]     - Deploy completo (default: production)"
        echo "  build [env]    - Solo build dell'immagine"
        echo "  backup         - Backup del database"
        echo "  rollback       - Rollback all'ultima versione"
        echo "  logs           - Mostra logs dell'applicazione"
        echo "  status         - Mostra status dei servizi"
        echo "  ssl [domain] [email] - Setup SSL con Let's Encrypt"
        echo "  cleanup        - Cleanup immagini e volumi"
        echo "  help           - Mostra questo help"
        echo ""
        echo "Environment variables:"
        echo "  SKIP_BACKUP=true     - Salta il backup"
        echo "  CLEANUP_VOLUMES=true - Cleanup anche i volumi"
        echo "  SETUP_SSL=true       - Setup automatico SSL"
        ;;
    "")
        # Menu interattivo
        while true; do
            show_menu
            read -p "Scegli un'opzione: " choice

            case $choice in
                1)
                    read -p "Environment (production/staging/development) [production]: " env
                    ENVIRONMENT="${env:-production}"
                    check_prerequisites
                    backup_database
                    build_image
                    deploy_app
                    run_migrations
                    check_health
                    setup_ssl
                    cleanup
                    success "Deploy completato!"
                    ;;
                2)
                    read -p "Environment [production]: " env
                    ENVIRONMENT="${env:-production}"
                    build_image
                    ;;
                3)
                    deploy_app
                    check_health
                    ;;
                4)
                    backup_database
                    ;;
                5)
                    rollback
                    ;;
                6)
                    show_logs
                    ;;
                7)
                    show_status
                    ;;
                8)
                    read -p "Domain: " domain
                    read -p "Email: " email
                    DOMAIN="$domain"
                    SSL_EMAIL="$email"
                    setup_ssl
                    ;;
                9)
                    cleanup
                    ;;
                0)
                    exit 0
                    ;;
                *)
                    warning "Opzione non valida"
                    ;;
            esac

            echo
            read -p "Premi ENTER per continuare..."
        done
        ;;
    *)
        error "Comando sconosciuto: $1. Usa '$0 help' per vedere i comandi disponibili."
        ;;
esac
