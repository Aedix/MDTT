<?php

declare(strict_types=1);

/**
 * Configuration principale du MDT.
 *
 * Ne mets pas de vrai mot de passe BDD dans le repository public.
 * Pour la production, crée un fichier includes/config.local.php directement sur l'hébergeur.
 */

$localConfigPath = __DIR__ . '/config.local.php';

if (file_exists($localConfigPath)) {
    require $localConfigPath;
}

defined('DB_HOST') or define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
defined('DB_NAME') or define('DB_NAME', getenv('DB_NAME') ?: 'REPLACE_DB_NAME');
defined('DB_USER') or define('DB_USER', getenv('DB_USER') ?: 'REPLACE_DB_USER');
defined('DB_PASSWORD') or define('DB_PASSWORD', getenv('DB_PASSWORD') ?: '');
defined('DB_CHARSET') or define('DB_CHARSET', 'utf8mb4');
defined('DB_USERS_TABLE') or define('DB_USERS_TABLE', getenv('DB_USERS_TABLE') ?: 'users');

defined('DEBUG_MODE') or define('DEBUG_MODE', false);
