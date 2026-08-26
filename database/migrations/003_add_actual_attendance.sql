ALTER TABLE attendance ADD COLUMN IF NOT EXISTS actual_status attendance_status;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS actual_marked_by INTEGER REFERENCES users(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS actual_marked_at TIMESTAMP;
