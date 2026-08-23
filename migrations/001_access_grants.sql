CREATE TABLE IF NOT EXISTS mailgate_access_grants (
  id uuid PRIMARY KEY,
  code_hash text NOT NULL UNIQUE,
  code_hint varchar(4) NOT NULL,
  service varchar(80) NOT NULL,
  from_address text NOT NULL,
  to_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeem_expires_at timestamptz NOT NULL,
  used_at timestamptz,
  session_hash text UNIQUE,
  session_expires_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT mailgate_access_grants_redeem_after_create
    CHECK (redeem_expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS mailgate_access_grants_session_lookup
  ON mailgate_access_grants (session_hash)
  WHERE session_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS mailgate_access_grants_created_at
  ON mailgate_access_grants (created_at DESC);
