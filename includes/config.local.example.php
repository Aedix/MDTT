<?php

declare(strict_types=1);

/**
 * Copie ce fichier en includes/config.local.php directement sur l'hébergeur.
 * Ne commit jamais config.local.php avec les vrais identifiants BDD.
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'nom_de_ta_base');
define('DB_USER', 'utilisateur_bdd');
define('DB_PASSWORD', 'mot_de_passe_bdd');
define('DB_USERS_TABLE', 'users');

define('DEBUG_MODE', false);
