-- Migration 003: richieste di collegamento account -> profilo atleta (onboarding)

CREATE TABLE profile_link_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  context VARCHAR(10) NOT NULL CHECK (context IN ('athlete','parent')),
  relationship VARCHAR(20),
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_profile_link_requests_user_id ON profile_link_requests(user_id);
CREATE INDEX idx_profile_link_requests_status ON profile_link_requests(status);
