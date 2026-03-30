import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ywqmhwgkctmetzsdburj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cW1od2drY3RtZXR6c2RidXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTg5MTIsImV4cCI6MjA5MDM3NDkxMn0.THJI80WqrDVZ-sC9Gtm9_TUvVN-oXENLc1y9hGLnQl8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
