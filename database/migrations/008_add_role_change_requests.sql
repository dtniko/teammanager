-- Migration 008: richieste di cambio ruolo da onboarding

CREATE TABLE role_change_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role VARCHAR(10) NOT NULL CHECK (requested_role IN ('coach', 'admin')),
  reason TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_role_change_requests_user_id ON role_change_requests(user_id);
CREATE INDEX idx_role_change_requests_status ON role_change_requests(status);