<?php
// Meal planner storage API (replaces Supabase).
//   GET  api/state.php?name=meals          -> {"value": <json>}  or {"value": null}
//   POST api/state.php  {"name":"meals","value":<json>}  -> {"ok": true}

// CORS: the app shell is hosted on GitHub Pages, so the browser calls this
// API cross-origin. Only that origin is allowed.
$ALLOWED_ORIGINS = ['https://j-e-design.github.io'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $ALLOWED_ORIGINS, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Household-Key');
    header('Access-Control-Max-Age: 86400');
}
header('Vary: Origin');

// Preflight request (sent before the JSON POST) - headers above are all it needs.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$ALLOWED_NAMES = ['meals', 'week', 'settings', 'history', 'ticks', 'extras', 'notes', 'plan', 'ratings', 'activity', 'shop_prefs', 'swipes'];
$MAX_BYTES = 2 * 1024 * 1024; // 2 MB per value is far more than this app needs

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) fail(500, 'Server not configured: copy config.sample.php to config.php');
$config = require $configFile;

// Household passcode: when set in config.php, every request must carry it.
if (!empty($config['passcode_sha256'])) {
    $key = strtolower(trim($_SERVER['HTTP_X_HOUSEHOLD_KEY'] ?? ''));
    if (!hash_equals($config['passcode_sha256'], hash('sha256', $key))) {
        usleep(400000); // slow down guessing
        fail(401, 'Passcode needed');
    }
}

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

// ---- Automatic daily backups ----
// The first request each day writes a copy of every row to backups/YYYY-MM-DD.json
// (folder is blocked from the web by its own .htaccess). The newest 30 are kept.
$BACKUP_DIR = __DIR__ . '/backups';
function ensure_backup_dir(string $dir): bool {
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) return false;
    $ht = "$dir/.htaccess";
    if (!file_exists($ht)) @file_put_contents($ht, "Require all denied\nOptions -Indexes\n");
    return is_writable($dir);
}
function list_backups(string $dir): array {
    $files = glob("$dir/????-??-??.json") ?: [];
    rsort($files);
    return $files;
}
function daily_backup(PDO $pdo, string $dir): void {
    $today = (new DateTime('now', new DateTimeZone('Europe/London')))->format('Y-m-d');
    $file = "$dir/$today.json";
    if (file_exists($file) || !ensure_backup_dir($dir)) return;
    $out = [];
    foreach ($pdo->query('SELECT name, value, updated_at FROM app_state') as $row) {
        $out[$row['name']] = ['value' => json_decode($row['value'], true), 'updated_at' => $row['updated_at']];
    }
    $json = json_encode(['created' => date('c'), 'data' => $out], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $tmp = "$file.tmp";
    if (@file_put_contents($tmp, $json, LOCK_EX) !== false) @rename($tmp, $file);
    foreach (array_slice(list_backups($dir), 30) as $old) @unlink($old);
}
try { daily_backup($pdo, $BACKUP_DIR); } catch (Throwable $e) { /* never block the app over a backup */ }

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $name = $_GET['name'] ?? '';

    // List automatic backups: GET ?name=_backups -> {"value": ["2026-11-19", ...]}
    if ($name === '_backups') {
        echo json_encode(['value' => array_map(fn($f) => basename($f, '.json'), list_backups($BACKUP_DIR))]);
        exit;
    }
    // Fetch one: GET ?name=_backup&date=2026-11-19 -> {"value": {"created": ..., "data": {...}}}
    if ($name === '_backup') {
        $date = $_GET['date'] ?? '';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail(400, 'Bad date');
        $file = "$BACKUP_DIR/$date.json";
        if (!is_file($file)) fail(404, 'No backup for that day');
        echo '{"value":' . file_get_contents($file) . '}';
        exit;
    }

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
