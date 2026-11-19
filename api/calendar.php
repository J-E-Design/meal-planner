<?php
// Calendar feed (iCalendar) of planned teas, for subscribing in Apple / Google Calendar.
//   webcal://jamieemerydesign.co.uk/meal-planner/calendar.php
// Each planned day becomes an event at tea time with a reminder; meals marked
// "needs defrosting" also get a defrost reminder the evening before.

header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: inline; filename="whats-for-tea.ics"');
header('Cache-Control: no-cache, max-age=0');

$config = require __DIR__ . '/config.php';
try {
    $pdo = new PDO(
        "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
        $config['db_user'], $config['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );
} catch (PDOException $e) {
    http_response_code(503);
    exit;
}

function load_state(PDO $pdo, string $name, $fallback) {
    $stmt = $pdo->prepare('SELECT value FROM app_state WHERE name = ?');
    $stmt->execute([$name]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return $fallback;
    $v = json_decode($row['value'], true);
    return $v === null ? $fallback : $v;
}

$plan     = load_state($pdo, 'plan', ['weeks' => []]);
$notes    = load_state($pdo, 'notes', []);
$meals    = load_state($pdo, 'meals', []);
$settings = load_state($pdo, 'settings', []);

$valid_time = fn($t, $d) => (is_string($t) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t)) ? $t : $d;
$tea_time    = $valid_time($settings['teaTime'] ?? null, '17:30');
$defrost_at  = $valid_time($settings['defrostTime'] ?? null, '20:00');
$remind_mins = isset($settings['remindMins']) ? max(0, min(600, (int)$settings['remindMins'])) : 60;

// Meals by lower-cased name
$by_name = [];
foreach ((is_array($meals) ? $meals : []) as $m) {
    if (is_array($m) && isset($m['name'])) $by_name[mb_strtolower(trim($m['name']))] = $m;
}

function ics_escape(string $s): string {
    return str_replace(["\\", ";", ",", "\r\n", "\n"], ["\\\\", "\\;", "\\,", "\\n", "\\n"], $s);
}
// Fold lines longer than 75 octets without splitting a UTF-8 character
function ics_fold(string $line): string {
    $out = '';
    while (strlen($line) > 75) {
        $cut = 75;
        while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) $cut--;
        $out .= substr($line, 0, $cut) . "\r\n ";
        $line = substr($line, $cut);
    }
    return $out . $line;
}

$tz = new DateTimeZone('Europe/London');
$today = new DateTime('today', $tz);
$from = (clone $today)->modify('-14 days');
$to   = (clone $today)->modify('+35 days');
$stamp = gmdate('Ymd\THis\Z');

$lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Whats for tea//Meal planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    "X-WR-CALNAME:What's for tea?",
    'X-WR-TIMEZONE:Europe/London',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    // UK time zone rules so times stay right across the clock changes
    'BEGIN:VTIMEZONE', 'TZID:Europe/London',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0000', 'TZOFFSETTO:+0100', 'TZNAME:BST', 'DTSTART:19700329T010000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0000', 'TZNAME:GMT', 'DTSTART:19701025T020000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
];

$weeks = (is_array($plan) && isset($plan['weeks']) && is_array($plan['weeks'])) ? $plan['weeks'] : [];
foreach ($weeks as $week_key => $days) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $week_key) || !is_array($days)) continue;
    $start = DateTime::createFromFormat('Y-m-d', $week_key, $tz);
    if (!$start) continue;
    $start->setTime(0, 0);
    foreach (array_values($days) as $i => $day) {
        if ($i > 6) break;
        $date = (clone $start)->modify("+$i days");
        if ($date < $from || $date > $to) continue;
        $ymd = $date->format('Ymd');
        $iso = $date->format('Y-m-d');
        $note = is_array($notes) && isset($notes[$iso]) && is_string($notes[$iso]) ? $notes[$iso] : '';
        if (!is_array($day) || empty($day['text'])) {
            if ($note === '') continue;
            $day = null; // a note on an unplanned day still shows up
        }

        $text = $day ? trim((string)$day['text']) : '';
        $meal = $day ? ($by_name[mb_strtolower($text)] ?? null) : null;
        $eating_out = $day && !empty($day['eatingOut']);
        $summary = $day ? (($eating_out ? '🥡 ' : '🍲 ') . $text) : '📝 ' . $note;

        $desc = [];
        if ($note !== '' && $day) $desc[] = '📝 ' . $note;
        if ($eating_out) $desc[] = 'Night off - no cooking!';
        if ($meal && !$eating_out && !empty($meal['ingredients']) && is_array($meal['ingredients'])) {
            $desc[] = 'Ingredients: ' . implode(', ', array_filter($meal['ingredients'], 'is_string'));
        }
        if ($meal && !empty($meal['sourceUrl']) && is_string($meal['sourceUrl'])) $desc[] = 'Recipe: ' . $meal['sourceUrl'];

        [$h, $mi] = explode(':', $tea_time);
        $begin = (clone $date)->setTime((int)$h, (int)$mi);
        $end = (clone $begin)->modify('+1 hour');

        $lines[] = 'BEGIN:VEVENT';
        $lines[] = "UID:tea-$ymd@whats-for-tea";
        $lines[] = "DTSTAMP:$stamp";
        $lines[] = 'DTSTART;TZID=Europe/London:' . $begin->format('Ymd\THis');
        $lines[] = 'DTEND;TZID=Europe/London:' . $end->format('Ymd\THis');
        $lines[] = 'SUMMARY:' . ics_escape($summary);
        if ($desc) $lines[] = 'DESCRIPTION:' . ics_escape(implode("\n", $desc));
        $lines[] = 'TRANSP:TRANSPARENT';
        if ($remind_mins > 0 && $day) {
            $lines[] = 'BEGIN:VALARM';
            $lines[] = 'ACTION:DISPLAY';
            $lines[] = 'DESCRIPTION:' . ics_escape("Tea tonight: $text");
            $lines[] = "TRIGGER:-PT{$remind_mins}M";
            $lines[] = 'END:VALARM';
        }
        $lines[] = 'END:VEVENT';

        // Defrost reminder the evening before
        if ($meal && !$eating_out && !empty($meal['defrost'])) {
            [$dh, $dm] = explode(':', $defrost_at);
            $d_begin = (clone $date)->modify('-1 day')->setTime((int)$dh, (int)$dm);
            $d_end = (clone $d_begin)->modify('+15 minutes');
            $lines[] = 'BEGIN:VEVENT';
            $lines[] = "UID:defrost-$ymd@whats-for-tea";
            $lines[] = "DTSTAMP:$stamp";
            $lines[] = 'DTSTART;TZID=Europe/London:' . $d_begin->format('Ymd\THis');
            $lines[] = 'DTEND;TZID=Europe/London:' . $d_end->format('Ymd\THis');
            $lines[] = 'SUMMARY:' . ics_escape("🧊 Defrost for tomorrow: $text");
            $lines[] = 'TRANSP:TRANSPARENT';
            $lines[] = 'BEGIN:VALARM';
            $lines[] = 'ACTION:DISPLAY';
            $lines[] = 'DESCRIPTION:' . ics_escape("Take the $text ingredients out of the freezer");
            $lines[] = 'TRIGGER:PT0M';
            $lines[] = 'END:VALARM';
            $lines[] = 'END:VEVENT';
        }
    }
}

$lines[] = 'END:VCALENDAR';
echo implode("\r\n", array_map('ics_fold', $lines)) . "\r\n";
