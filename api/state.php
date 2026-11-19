<?php
// Meal planner storage API (replaces Supabase).
//   GET  api/state.php?name=meals          -> {"value": <json>}  or {"value": null}
//   POST api/state.php  {"name":"meals","value":<json>}  -> {"ok": true}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$ALLOWED_NAMES = ['meals', 'week', 'settings', 'history'];
$MAX_BYTES = 2 * 1024 * 1024; // 2 MB per value is far more than this app needs

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) fail(500, 'Server not configured: copy config.sample.php to config.php');
$config = require $configFile;

try {
    $pdo = new PDO(
        "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
        $config['db_user'],
        $config['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );
} catch (PDOException $e) {
    fail(503, 'Database connection failed');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $name = $_GET['name'] ?? '';
    if (!in_array($name, $ALLOWED_NAMES, true)) fail(400, 'Unknown name');
    $stmt = $pdo->prepare('SELECT value FROM app_state WHERE name = ?');
    $stmt->execute([$name]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    // value is stored as JSON text already, so splice it in without re-encoding
    echo '{"value":' . ($row ? $row['value'] : 'null') . '}';
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if (strlen($raw) > $MAX_BYTES) fail(413, 'Too large');
    $body = json_decode($raw, true);
    if (!is_array($body) || !array_key_exists('value', $body)) fail(400, 'Invalid JSON body');
    $name = $body['name'] ?? '';
    if (!in_array($name, $ALLOWED_NAMES, true)) fail(400, 'Unknown name');
    $value = json_encode($body['value'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt = $pdo->prepare(
        'INSERT INTO app_state (name, value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)'
    );
    $stmt->execute([$name, $value]);
    echo '{"ok":true}';
    exit;
}

fail(405, 'Method not allowed');
