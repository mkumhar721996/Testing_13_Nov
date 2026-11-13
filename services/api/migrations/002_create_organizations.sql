-- Down step (manual): DROP TABLE organizations;
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NULL,
  admin_name text NULL,
  admin_email text NULL,
  created_by text NOT NULL,
  fc_name text NULL,
  fc_email text NULL,
  fc_phone text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
