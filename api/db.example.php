<?php
declare(strict_types=1);

// Copy this file to db.php and fill in your real InfinityFree MySQL details.
// db.php is gitignored so real credentials never get committed to this
// (public) repo - only upload db.php to the server via FTP directly.

const DB_HOST = "sqlXXX.infinityfree.com";
const DB_PORT = 3306;
const DB_NAME = "if0_XXXXXXXX_meal_planner";
const DB_USER = "if0_XXXXXXXX";
const DB_PASS = "your-password-here";

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS app_state (
                name VARCHAR(50) NOT NULL PRIMARY KEY,
                value LONGTEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }
    return $pdo;
}

function state_get(string $name, $default) {
    $stmt = get_db()->prepare("SELECT value FROM app_state WHERE name = ?");
    $stmt->execute([$name]);
    $row = $stmt->fetch();
    if (!$row) return $default;
    $decoded = json_decode($row['value'], true);
    return $decoded ?? $default;
}

function state_set(string $name, $value): void {
    $stmt = get_db()->prepare(
        "INSERT INTO app_state (name, value) VALUES (:name, :value)
         ON DUPLICATE KEY UPDATE value = VALUES(value)"
    );
    $stmt->execute([':name' => $name, ':value' => json_encode($value)]);
}

function send_cors_headers(): void {
    // The app shell is hosted on GitHub Pages; this API only needs to answer that origin.
    header("Access-Control-Allow-Origin: https://j-e-design.github.io");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
}

function send_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
