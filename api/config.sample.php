<?php
// Copy this file to config.php (same folder) and fill in the MySQL details
// from your iFastNet control panel (MySQL Databases section).
// config.php is git-ignored so your password never ends up on GitHub.
return [
    'db_host' => 'localhost',
    'db_name' => 'youraccount_mealplanner',
    'db_user' => 'youraccount_mealuser',
    'db_pass' => 'change-me',
    // Household passcode lock (optional but recommended). Store only hashes, never the passcode:
    //   php -r 'echo hash("sha256", "your-passcode"), "\n", substr(hash("sha256", "calendar:your-passcode"), 0, 32), "\n";'
    // The passcode is compared lower-cased and trimmed.
    'passcode_sha256' => '',
    'calendar_token' => '',
];
