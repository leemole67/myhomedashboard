<?php
// calendar-proxy.php - Working version
error_reporting(0);
ini_set('display_errors', 0);

$configFile = __DIR__ . '/config.txt';
if (!file_exists($configFile)) {
    header('Content-Type: text/plain');
    http_response_code(500);
    die('ERROR: config.txt not found');
}

$lines = file($configFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$calendarUrl = '';

foreach ($lines as $line) {
    $line = trim($line);
    if (strpos($line, '#') === 0) continue;
    
    if (strpos($line, 'CALENDAR1=') === 0) {
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $calendarUrl = trim($parts[1]);
            $calendarUrl = ltrim($calendarUrl, '=');
        }
        break;
    }
}

if (empty($calendarUrl)) {
    header('Content-Type: text/plain');
    http_response_code(500);
    die('ERROR: CALENDAR1 not found in config.txt');
}

if (strpos($calendarUrl, 'http') !== 0) {
    header('Content-Type: text/plain');
    http_response_code(500);
    die('ERROR: Invalid URL format: ' . $calendarUrl);
}

$context = stream_context_create([
    'http' => [
        'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'timeout' => 10
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false
    ]
]);

$calendarData = @file_get_contents($calendarUrl, false, $context);

if ($calendarData === false) {
    header('Content-Type: text/plain');
    http_response_code(500);
    die('ERROR: Failed to fetch calendar');
}

if (strpos($calendarData, 'BEGIN:VCALENDAR') === false) {
    header('Content-Type: text/plain');
    http_response_code(500);
    die('ERROR: Invalid calendar data');
}

header('Content-Type: text/calendar; charset=utf-8');
echo $calendarData;
?>