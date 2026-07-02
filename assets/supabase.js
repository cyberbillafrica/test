import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://hlukjxyaamalristunwf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdWtqeHlhYW1hbHJpc3R1bndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1ODA5MTYsImV4cCI6MjA5ODE1NjkxNn0.hp-02-lQ0OHANRs3rvsHKSW-lDJKglTCKmw6LcgQY_g';

const supabase = createClient(supabaseUrl, supabaseKey);

window.supabase = supabase;