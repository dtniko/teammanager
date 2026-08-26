-- Schema del database per SportClub Manager

-- Tipologie di utenti
CREATE TYPE user_role AS ENUM ('admin', 'coach', 'parent', 'athlete');
CREATE TYPE document_type AS ENUM ('payment', 'medical_certificate', 'other');
CREATE TYPE event_type AS ENUM ('training', 'match', 'meeting');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'pending', 'called_up');

-- Tabella utenti principali
CREATE TABLE users (
                       id SERIAL PRIMARY KEY,
                       google_id VARCHAR(255) UNIQUE,
                       email VARCHAR(255) UNIQUE NOT NULL,
                       first_name VARCHAR(100) NOT NULL,
                       last_name VARCHAR(100) NOT NULL,
                       role user_role NOT NULL DEFAULT 'parent',
                       avatar_url TEXT,
                       phone VARCHAR(20),
                       password_hash TEXT,
                       must_change_password BOOLEAN DEFAULT false,
                       is_active BOOLEAN DEFAULT true,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella stagioni sportive
CREATE TABLE seasons (
                         id SERIAL PRIMARY KEY,
                         name VARCHAR(100) NOT NULL,
                         start_date DATE NOT NULL,
                         end_date DATE NOT NULL,
                         is_current BOOLEAN DEFAULT false,
                         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella gruppi/squadre
CREATE TABLE groups (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        description TEXT,
                        age_group VARCHAR(50),
                        season_id INTEGER REFERENCES seasons(id),
                        is_active BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella atleti
CREATE TABLE athletes (
                          id SERIAL PRIMARY KEY,
                          first_name VARCHAR(100) NOT NULL,
                          last_name VARCHAR(100) NOT NULL,
                          date_of_birth DATE NOT NULL,
                          fiscal_code VARCHAR(16),
                          place_of_birth VARCHAR(100),
                          address TEXT,
                          phone VARCHAR(20),
                          email VARCHAR(255),
                          emergency_contact_name VARCHAR(200),
                          emergency_contact_phone VARCHAR(20),
                          user_id INTEGER REFERENCES users(id), -- Se l'atleta ha un account
                          is_active BOOLEAN DEFAULT true,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relazione genitori-atleti
CREATE TABLE parent_athlete (
                                id SERIAL PRIMARY KEY,
                                parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                                athlete_id INTEGER REFERENCES athletes(id) ON DELETE CASCADE,
                                relationship VARCHAR(50) DEFAULT 'parent', -- parent, guardian, tutor
                                can_edit BOOLEAN DEFAULT true,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                UNIQUE(parent_id, athlete_id)
);

-- Relazione atleti-gruppi
CREATE TABLE athlete_group (
                               id SERIAL PRIMARY KEY,
                               athlete_id INTEGER REFERENCES athletes(id) ON DELETE CASCADE,
                               group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
                               joined_date DATE DEFAULT CURRENT_DATE,
                               left_date DATE,
                               is_active BOOLEAN DEFAULT true,
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               UNIQUE(athlete_id, group_id, joined_date)
);

-- Relazione staff-gruppi (allenatori e dirigenti)
CREATE TABLE staff_group (
                             id SERIAL PRIMARY KEY,
                             user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                             group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
                             role VARCHAR(50) DEFAULT 'coach', -- coach, manager, assistant
                             can_manage BOOLEAN DEFAULT true,
                             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                             UNIQUE(user_id, group_id)
);

-- Tabella documenti
CREATE TABLE documents (
                           id SERIAL PRIMARY KEY,
                           athlete_id INTEGER REFERENCES athletes(id) ON DELETE CASCADE,
                           season_id INTEGER REFERENCES seasons(id),
                           document_type document_type NOT NULL,
                           title VARCHAR(255) NOT NULL,
                           filename VARCHAR(255) NOT NULL,
                           file_path TEXT NOT NULL,
                           file_size INTEGER,
                           mime_type VARCHAR(100),
                           expiry_date DATE,
                           uploaded_by INTEGER REFERENCES users(id),
                           notes TEXT,
                           is_valid BOOLEAN DEFAULT true,
                           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella eventi del calendario
CREATE TABLE events (
                        id SERIAL PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        description TEXT,
                        event_type event_type NOT NULL,
                        start_datetime TIMESTAMP NOT NULL,
                        end_datetime TIMESTAMP NOT NULL,
                        location VARCHAR(255),
                        group_id INTEGER REFERENCES groups(id),
                        created_by INTEGER REFERENCES users(id),
                        is_recurring BOOLEAN DEFAULT false,
                        recurring_pattern JSONB, -- Per gestire ricorrenze
                        recurring_group_id UUID,
                        is_active BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella presenze agli eventi
CREATE TABLE attendance (
                            id SERIAL PRIMARY KEY,
                            event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
                            athlete_id INTEGER REFERENCES athletes(id) ON DELETE CASCADE,
                            status attendance_status DEFAULT 'pending',
                            notes TEXT,
                            marked_by INTEGER REFERENCES users(id),
                            marked_at TIMESTAMP,
                            actual_status attendance_status,
                            actual_marked_by INTEGER REFERENCES users(id),
                            actual_marked_at TIMESTAMP,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(event_id, athlete_id)
);

-- Tabella comunicazioni
CREATE TABLE communications (
                                id SERIAL PRIMARY KEY,
                                title VARCHAR(255) NOT NULL,
                                content TEXT NOT NULL,
                                sender_id INTEGER REFERENCES users(id),
                                target_type VARCHAR(50) NOT NULL, -- all, group, parents, athletes
                                target_group_id INTEGER REFERENCES groups(id),
                                is_urgent BOOLEAN DEFAULT false,
                                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella letture delle comunicazioni
CREATE TABLE communication_reads (
                                     id SERIAL PRIMARY KEY,
                                     communication_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
                                     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                                     read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                     UNIQUE(communication_id, user_id)
);

-- Tabella notifiche
CREATE TABLE notifications (
                               id SERIAL PRIMARY KEY,
                               user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                               title VARCHAR(255) NOT NULL,
                               message TEXT NOT NULL,
                               type VARCHAR(50) DEFAULT 'info', -- info, warning, urgent, reminder
                               related_type VARCHAR(50), -- document, event, payment, communication
                               related_id INTEGER,
                               is_read BOOLEAN DEFAULT false,
                               sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella pagamenti
CREATE TABLE payments (
                          id SERIAL PRIMARY KEY,
                          athlete_id INTEGER REFERENCES athletes(id) ON DELETE CASCADE,
                          season_id INTEGER REFERENCES seasons(id),
                          amount DECIMAL(10,2) NOT NULL,
                          description VARCHAR(255) NOT NULL,
                          due_date DATE NOT NULL,
                          paid_date DATE,
                          payment_method VARCHAR(50),
                          receipt_number VARCHAR(100),
                          notes TEXT,
                          is_paid BOOLEAN DEFAULT false,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per ottimizzazione
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_athletes_user_id ON athletes(user_id);
CREATE INDEX idx_parent_athlete_parent ON parent_athlete(parent_id);
CREATE INDEX idx_parent_athlete_athlete ON parent_athlete(athlete_id);
CREATE INDEX idx_athlete_group_athlete ON athlete_group(athlete_id);
CREATE INDEX idx_athlete_group_group ON athlete_group(group_id);
CREATE INDEX idx_documents_athlete ON documents(athlete_id);
CREATE INDEX idx_documents_season ON documents(season_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_events_group ON events(group_id);
CREATE INDEX idx_events_date ON events(start_datetime);
CREATE INDEX idx_attendance_event ON attendance(event_id);
CREATE INDEX idx_attendance_athlete ON attendance(athlete_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON athletes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
