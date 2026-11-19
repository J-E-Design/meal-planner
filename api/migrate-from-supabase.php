<?php
// ONE-OFF: copies your existing data from Supabase into the new MySQL table.
// Upload it, open it once in your browser, check the output, then DELETE this file.

header('Content-Type: text/plain; charset=utf-8');

$SUPABASE_URL = 'https://fqyacrjfyqfpqbfungqh.supabase.co';
$SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxeWFjcmpmeXFmcHFiZnVuZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDM3MDIsImV4cCI6MjEwNDI3OTcwMn0.wWaW18-IiNSvHcx8CSD1zKMQMrtY23gtMDUUUqiqKRw';

$config = require __DIR__ . '/config.php';
$pdo = new PDO(
    "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
    $config['db_user'], $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$ctx = stream_context_create(['http' => [
    'header' => "apikey: $SUPABASE_KEY\r\nAuthorization: Bearer $SUPABASE_KEY\r\n",
    'timeout' => 30,
]]);
$json = @file_get_contents("$SUPABASE_URL/rest/v1/app_state?select=name,value", false, $ctx);
if ($json === false) {
    echo "Could not reach Supabase. If the project is paused, restore it in the Supabase dashboard and try again.\n";
    exit;
}
$rows = json_decode($json, true);
if (!is_array($rows)) { echo "Unexpected response from Supabase:\n$json\n"; exit; }

$stmt = $pdo->prepare('INSERT INTO app_state (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)');
foreach ($rows as $row) {
    $value = json_encode($row['value'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt->execute([$row['name'], $value]);
    echo "Copied '{$row['name']}' (" . strlen($value) . " bytes)\n";
}
echo "\nDone. Now DELETE migrate-from-supabase.php from your server.\n";
