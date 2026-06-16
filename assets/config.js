// -----------------------------------------------------------------------------
// Supabase connection for saving + reading responses.
// These two values are safe to be public (the anon key only allows calling the
// date-response Edge Function; it cannot read your database directly).
//
// Already filled in for your project. You normally never need to touch this.
// -----------------------------------------------------------------------------
window.TNS = window.TNS || {};

// The date-response Edge Function endpoint (saves + lists her answers).
window.TNS.responseUrl =
  "https://pjzhwnztlqbfyjnrqvrl.supabase.co/functions/v1/date-response";

// The girls Edge Function endpoint (serves each girl's profile by slug).
window.TNS.girlUrl =
  "https://pjzhwnztlqbfyjnrqvrl.supabase.co/functions/v1/girls";

// Public anon key (used only as the gateway "apikey" header).
window.TNS.anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqemh3bnp0bHFiZnlqbnJxdnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODY1NzIsImV4cCI6MjA5NzE2MjU3Mn0.feyDSuD951TGndME1dElGikBZ8lwzSctpE7xbQUH-tM";
