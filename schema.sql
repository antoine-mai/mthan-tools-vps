-- =====================================================================
-- MTHAN VPS - SQLite Reference Schema
-- Default Database Path: ~/.mthan-vps/data/db.sqlite
-- (Configurable via SETTINGS_DB_PATH environment variable)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Table: settings
-- Purpose: Key-value configuration store for system & application settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default system settings:
-- INSERT OR IGNORE INTO settings (key, value) VALUES
--   ('general_app_name', 'MTHAN VPS'),
--   ('general_color_mode', 'system'),
--   ('apps_header', '[]'),
--   ('users_default_shell', '/bin/bash'),
--   ('users_home_base', '/home'),
--   ('users_create_home', 'true'),
--   ('users_auto_username', 'false');

-- ---------------------------------------------------------------------
-- Table: apis
-- Purpose: API tokens for external API access, with IP whitelisting
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS apis (
    id            TEXT PRIMARY KEY,                     -- Unique identifier (e.g. UUID or nanoid)
    name          TEXT NOT NULL,                        -- Friendly label / description
    key_hash      TEXT NOT NULL UNIQUE,                 -- SHA-256 hash of the generated API token
    key_prefix    TEXT NOT NULL,                        -- Visible prefix for identification (e.g. mvp_...)
    accepted_ips  TEXT NOT NULL DEFAULT '[]',           -- JSON array of allowed IP addresses / CIDRs
    enabled       INTEGER NOT NULL DEFAULT 1,           -- 1 = active, 0 = disabled
    last_used_at  DATETIME,                             -- Timestamp of most recent API request
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: backup_storages
-- Purpose: Remote storage destinations for backups (S3, R2, GDrive, OneDrive)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backup_storages (
    id           TEXT PRIMARY KEY,                      -- Unique identifier
    owner        TEXT NOT NULL,                         -- Linux username of owner (e.g. 'root', 'alice')
    name         TEXT NOT NULL,                         -- Display name for the storage target
    provider     TEXT NOT NULL,                         -- Storage provider: 's3', 'r2', 'gdrive', 'onedrive'
    bucket       TEXT NOT NULL DEFAULT '',              -- Bucket name (for S3/R2)
    path_prefix  TEXT NOT NULL DEFAULT '',              -- Target folder or key prefix path
    is_default   INTEGER NOT NULL DEFAULT 0,            -- 1 = default target, 0 = secondary
    config       TEXT NOT NULL DEFAULT '{}',            -- JSON string storing provider-specific credentials
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_storages_owner ON backup_storages(owner);
