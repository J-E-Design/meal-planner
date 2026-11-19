<?php
// Recipe import: fetch a recipe page and pull out the structured recipe data
// (schema.org "Recipe" JSON-LD, which BBC Good Food, Jamie Oliver, Tesco Real Food,
// AllRecipes etc. all include). Returns only the parsed recipe, never the raw page.
//   GET import.php?url=https://www.bbcgoodfood.com/recipes/...
//   -> {"name": "...", "ingredients": [...], "image": "...", "sourceUrl": "...", "servings": "...", "totalTime": "..."}

$ALLOWED_ORIGINS = ['https://j-e-design.github.io'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $ALLOWED_ORIGINS, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
header('Vary: Origin');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $code, string $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

// ---- Simple rate limit: 40 imports per hour per IP ----
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rl_file = sys_get_temp_dir() . '/wft_import_' . hash('sha256', $ip . __DIR__);
$now = time();
$hits = array_filter(@json_decode(@file_get_contents($rl_file), true) ?: [], fn($t) => $t > $now - 3600);
if (count($hits) >= 40) fail(429, 'Too many imports - try again in a bit.');
$hits[] = $now;
@file_put_contents($rl_file, json_encode(array_values($hits)), LOCK_EX);

// ---- Validate the URL: public http(s) addresses only ----
$url = trim($_GET['url'] ?? '');
if ($url === '' || strlen($url) > 2000) fail(400, 'Paste a link to a recipe page.');

function check_url(string $url): array {
    $p = parse_url($url);
    if (!$p || !in_array(strtolower($p['scheme'] ?? ''), ['http', 'https'], true) || empty($p['host'])) {
        fail(400, "That doesn't look like a web link.");
    }
    if (isset($p['user']) || isset($p['pass'])) fail(400, "That doesn't look like a recipe link.");
    $port = $p['port'] ?? (strtolower($p['scheme']) === 'https' ? 443 : 80);
    if (!in_array($port, [80, 443], true)) fail(400, "That link isn't supported.");
    $host = strtolower(trim($p['host'], '[]'));
    $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : array_merge(
        array_column(@dns_get_record($host, DNS_A) ?: [], 'ip'),
        array_column(@dns_get_record($host, DNS_AAAA) ?: [], 'ipv6')
    );
    if (!$ips) fail(400, "Couldn't find that website.");
    foreach ($ips as $ip) {
        // Refuse private, loopback, link-local and reserved addresses (protects the server's own network)
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            fail(400, "That link isn't supported.");
        }
    }
    return ['host' => $host, 'port' => $port, 'ip' => $ips[0]];
}

// ---- Fetch, following up to 4 redirects and re-checking each hop ----
function fetch_page(string $url): array {
    for ($hop = 0; $hop < 5; $hop++) {
        $t = check_url($url);
        $ch = curl_init($url);
        $body = '';
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_TIMEOUT => 12,
            // Pin the checked IP so DNS can't change between the check and the fetch
            CURLOPT_RESOLVE => [$t['host'] . ':' . $t['port'] . ':' . (str_contains($t['ip'], ':') ? '[' . $t['ip'] . ']' : $t['ip'])],
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_HTTPHEADER => [
                'User-Agent: Mozilla/5.0 (compatible; WhatsForTea/1.0; recipe import)',
                'Accept: text/html,application/xhtml+xml',
                'Accept-Language: en-GB,en;q=0.9',
            ],
            CURLOPT_ENCODING => '',
            CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$body) {
                $body .= $chunk;
                return strlen($body) > 4 * 1024 * 1024 ? 0 : strlen($chunk); // 4 MB cap
            },
        ]);
        curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $location = curl_getinfo($ch, CURLINFO_REDIRECT_URL);
        $err = curl_errno($ch);
        curl_close($ch);
        if ($code >= 300 && $code < 400 && $location) { $url = $location; continue; }
        if ($err && $body === '') fail(502, "Couldn't open that page.");
        if ($code >= 400) fail(502, "That website wouldn't share the page (error $code).");
        return [$url, $body];
    }
    fail(502, 'That link redirects too many times.');
}

[$final_url, $html] = fetch_page($url);

// ---- Find the schema.org Recipe ----
function find_recipe($node) {
    if (!is_array($node)) return null;
    $type = $node['@type'] ?? null;
    if ($type === 'Recipe' || (is_array($type) && in_array('Recipe', $type, true))) return $node;
    foreach (['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement'] as $k) {
        if (isset($node[$k]) && ($r = find_recipe($node[$k]))) return $r;
    }
    if (array_is_list($node)) foreach ($node as $child) if ($r = find_recipe($child)) return $r;
    return null;
}
function clean_text($s): string {
    if (!is_string($s)) return '';
    $s = html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $s));
}
function image_url($img): string {
    if (is_string($img)) return $img;
    if (is_array($img)) {
        if (isset($img['url']) && is_string($img['url'])) return $img['url'];
        if (array_is_list($img) && $img) return image_url(end($img)); // last is usually the largest
    }
    return '';
}
function iso_minutes($d): string {
    if (!is_string($d) || !preg_match('/^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?$/i', $d, $m)) return '';
    $mins = (int)($m[1] ?? 0) * 60 + (int)($m[2] ?? 0);
    if (!$mins) return '';
    return $mins >= 60 ? intdiv($mins, 60) . ' hr' . ($mins % 60 ? ' ' . ($mins % 60) . ' min' : '') : "$mins min";
}

$recipe = null;
if (preg_match_all('#<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>#is', $html, $blocks)) {
    foreach ($blocks[1] as $json) {
        $data = json_decode(trim($json), true);
        if ($data === null) $data = json_decode(trim(preg_replace('/[\x00-\x1F]/', ' ', $json)), true);
        if ($recipe = find_recipe($data)) break;
    }
}

$meta = function (string $prop) use ($html): string {
    if (preg_match('#<meta[^>]+(?:property|name)=["\']' . preg_quote($prop, '#') . '["\'][^>]+content=["\']([^"\']*)#i', $html, $m)) return clean_text($m[1]);
    if (preg_match('#<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' . preg_quote($prop, '#') . '["\']#i', $html, $m)) return clean_text($m[1]);
    return '';
};

if (!$recipe) {
    $title = $meta('og:title');
    if ($title === '') fail(422, "Couldn't find a recipe on that page.");
    echo json_encode([
        'name' => $title, 'ingredients' => [], 'image' => $meta('og:image'), 'sourceUrl' => $final_url,
        'partial' => true,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$ingredients = [];
foreach ((array)($recipe['recipeIngredient'] ?? $recipe['ingredients'] ?? []) as $ing) {
    $t = clean_text($ing);
    if ($t !== '' && count($ingredients) < 60) $ingredients[] = mb_substr($t, 0, 120);
}
$servings = $recipe['recipeYield'] ?? '';
if (is_array($servings)) $servings = $servings[0] ?? '';

echo json_encode([
    'name' => mb_substr(clean_text($recipe['name'] ?? '') ?: $meta('og:title'), 0, 80),
    'ingredients' => $ingredients,
    'image' => image_url($recipe['image'] ?? '') ?: $meta('og:image'),
    'sourceUrl' => $final_url,
    'servings' => clean_text((string)$servings),
    'totalTime' => iso_minutes($recipe['totalTime'] ?? ($recipe['cookTime'] ?? '')),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
