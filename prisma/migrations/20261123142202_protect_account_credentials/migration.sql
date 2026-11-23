BEGIN;

-- The app uses Auth.js/Prisma on the server, not the browser-facing Data API, for credentials.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Passkey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebAuthnChallenge" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "User", "Passkey", "WebAuthnChallenge" FROM PUBLIC;

DO $$
DECLARE
  api_role name;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE "User", "Passkey", "WebAuthnChallenge" FROM %I', api_role);
  END LOOP;
END;
$$;

COMMIT;
