<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/',
]);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$_SESSION['csrf'] ??= bin2hex(random_bytes(32));

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireCsrf(): void
{
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        respond(['error' => 'Sessão expirada. Recarregue a página.'], 403);
    }
}

function database(): PDO
{
    $path = __DIR__ . '/../config/database.local.php';
    if (!is_file($path)) {
        respond(['error' => 'Configure config/database.local.php para conectar ao banco.'], 503);
    }
    $config = require $path;
    return new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['host'], $config['port'], $config['name']),
        $config['user'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
         PDO::ATTR_EMULATE_PREPARES => false]
    );
}

// A foto é servida pela API, que exige sessão; o nome do arquivo não é exposto.
function photoUrl(int $userId, ?string $fileName): ?string
{
    return $fileName ? 'api/auth.php?action=photo&id=' . $userId . '&v=' . substr($fileName, 0, 8) : null;
}

function currentUser(PDO $db): ?array
{
    if (empty($_SESSION['user_id'])) return null;
    $query = $db->prepare('SELECT u.id, u.nome, u.email, u.bio, u.foto_url, u.curso_id, c.nome AS curso, c.universidade_id, v.nome AS universidade FROM usuarios u LEFT JOIN cursos c ON c.id = u.curso_id LEFT JOIN universidades v ON v.id = c.universidade_id WHERE u.id = ? AND u.ativo = 1');
    $query->execute([$_SESSION['user_id']]);
    $user = $query->fetch();
    if (!$user) return null;
    $user['foto'] = photoUrl((int) $user['id'], $user['foto_url']);
    unset($user['foto_url']);
    $query = $db->prepare('SELECT interesse_id FROM usuario_interesses WHERE usuario_id = ?');
    $query->execute([$user['id']]);
    $user['interesses'] = array_map('intval', $query->fetchAll(PDO::FETCH_COLUMN));
    return $user;
}
