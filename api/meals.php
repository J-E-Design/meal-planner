<?php
require_once __DIR__ . '/db.php';

send_cors_headers();

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if ($method === 'GET') {
        send_json(state_get('meals', []));
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) {
            send_json(['error' => 'Expected a JSON array of meals'], 400);
        }
        foreach ($body as $m) {
            if (!is_array($m) || !isset($m['name']) || !is_string($m['name']) || $m['name'] === '') {
                send_json(['error' => 'Each meal needs a name'], 400);
            }
        }
        state_set('meals', array_values($body));
        send_json(['ok' => true]);
    }

    send_json(['error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    send_json(['error' => 'Server error', 'detail' => $e->getMessage()], 500);
}
