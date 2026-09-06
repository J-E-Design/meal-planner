-- Meal planner database schema
-- Run this once in phpMyAdmin against if0_42321898_meal_planner (safe to re-run).
-- The API also creates this table automatically on first request if it's missing,
-- so running this manually is optional but confirms the DB is reachable and set up.

CREATE TABLE IF NOT EXISTS app_state (
  name VARCHAR(50) NOT NULL PRIMARY KEY,
  value LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO app_state (name, value)
VALUES
  ('meals', '[]'),
  ('week', '[null,null,null,null,null,null,null]')
ON DUPLICATE KEY UPDATE name = name;
