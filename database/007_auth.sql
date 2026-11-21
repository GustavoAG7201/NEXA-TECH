CREATE SCHEMA nexa_auth;
REVOKE ALL ON SCHEMA nexa_auth FROM PUBLIC;

CREATE TABLE nexa_auth.identity (
  uid text PRIMARY KEY REFERENCES public.app_user(uid) ON DELETE RESTRICT,
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
  password_hash text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false
);

CREATE TABLE nexa_auth.session (
  token_hash text PRIMARY KEY,
  uid text NOT NULL REFERENCES nexa_auth.identity(uid) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX session_uid_idx ON nexa_auth.session (uid);
CREATE INDEX session_expiry_idx ON nexa_auth.session (expires_at);

CREATE TABLE nexa_auth.email_token (
  token_hash text PRIMARY KEY,
  uid text NOT NULL REFERENCES nexa_auth.identity(uid) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('reset', 'verify')),
  expires_at timestamptz NOT NULL
);
CREATE INDEX email_token_uid_idx ON nexa_auth.email_token (uid);
CREATE INDEX email_token_expiry_idx ON nexa_auth.email_token (expires_at);

CREATE TABLE nexa_auth.rate_limit (
  bucket text PRIMARY KEY,
  hits integer NOT NULL CHECK (hits > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limit_expiry_idx ON nexa_auth.rate_limit (expires_at);
