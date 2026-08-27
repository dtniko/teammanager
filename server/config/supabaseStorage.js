const { createClient } = require('@supabase/supabase-js');

// In produzione usa SERVICE_ROLE_KEY, in dev fallback su anon key
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(
    process.env.SUPABASE_URL,
    serviceKey,
    {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: { transport: { type: 'fetch' } },
    }
);

const DOCUMENTS_BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || 'documents';

module.exports = { supabase, DOCUMENTS_BUCKET };
