<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

logoutAuthenticatedUser();

echo json_encode([
    'success' => true,
    'message' => 'Déconnexion réussie.',
    'redirect' => '/index.html',
]);
