<?php
require_once __DIR__ . '/db.php';

send_cors_headers();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $default = array_fill(0, 7, null);

    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if ($method === 'GET') {
        send_json(state_get('week', $default));
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body) || count($body) !== 7) {
            send_json(['error' => 'Expected an array of 7 day slots'], 400);
        }
        foreach ($body as $day) {
            if ($day !== null && (!is_array($day) || !isset($day['text']) || !is_string($day['text']))) {
                send_json(['error' => 'Each day must be null or have a text field'], 400);
            }
        }
        state_set('week', array_values($body));
        send_json(['ok' => true]);
    }

    send_json(['error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    send_json(['error' => 'Server error', 'detail' => $e->getMessage()], 500);
}
