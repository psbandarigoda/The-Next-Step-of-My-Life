// -----------------------------------------------------------------------------
// Supabase connection for saving + reading responses.
// These two values are safe to be public (the anon key only allows calling the
// date-response Edge Function; it cannot read your database directly).
//
// Already filled in for your project. You normally never need to touch this.
// -----------------------------------------------------------------------------
window.TNS = window.TNS || {};

// The date-response Edge Function endpoint.
window.TNS.responseUrl =
  "https://pjzhwnztlqbfyjnrqvrl.supabase.co/functions/v1/date-response";

// Public anon key (used only as the gateway "apikey" header).
window.TNS.anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqemh3bnp0bHFiZnlqbnJxdnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODY1NzIsImV4cCI6MjA5NzE2MjU3Mn0.feyDSuD951TGndME1dElGikBZ8lwzSctpE7xbQUH-tM";
