<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

$user = getAuthenticatedUser();

if (!$user) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'authenticated' => false,
        'message' => 'Non connecté.',
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'authenticated' => true,
    'user' => $user,
]);
