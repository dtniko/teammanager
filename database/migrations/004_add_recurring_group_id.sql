ALTER TABLE events ADD COLUMN IF NOT EXISTS recurring_group_id UUID;
CREATE INDEX IF NOT EXISTS idx_events_recurring_group_id ON events(recurring_group_id);
