-- Meal planner schema for MySQL / MariaDB (iFastNet).
-- Run this once in phpMyAdmin (select your database, then the SQL tab).

CREATE TABLE IF NOT EXISTS app_state (
  name VARCHAR(64) NOT NULL PRIMARY KEY,
  value LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO app_state (name, value) VALUES
  ('meals', '[]'),
  ('week', '[null,null,null,null,null,null,null]');
