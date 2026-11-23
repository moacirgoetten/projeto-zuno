<?php
// Funções comuns das APIs: sessão, respostas JSON, banco e proteção CSRF.
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));

const PHOTO_DIR = __DIR__ . '/../uploads/fotos';
const PHOTO_NAME = '/^[a-f0-9]{32}\.(jpg|png|webp)$/';

function respond(array $body, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function db(): PDO
{
    static $db = null;
    if ($db) return $db;
    $path = __DIR__ . '/../config/database.local.php';
    if (!is_file($path)) respond(['error' => 'Configure config/database.local.php para conectar ao banco.'], 503);
    $c = require $path;
    return $db = new PDO("mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset=utf8mb4", $c['user'], $c['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
}

// Executa uma consulta preparada (os valores nunca são colados no SQL).
function q(string $sql, array $params = []): PDOStatement
{
    $query = db()->prepare($sql);
    $query->execute($params);
    return $query;
}

// Id do usuário conectado; responde 401 se ninguém estiver conectado.
function me(): int
{
    $id = (int) ($_SESSION['user_id'] ?? 0);
    if (!$id || !q('SELECT 1 FROM usuarios WHERE id = ? AND ativo = 1', [$id])->fetch()) respond(['error' => 'Entre na sua conta para continuar.'], 401);
    return $id;
}

// Endereço da foto (servida pela API, que exige sessão) ou null.
function photoUrl(int $id, ?string $file): ?string
{
    return $file ? "api/auth.php?action=photo&id=$id&v=" . substr($file, 0, 8) : null;
}

// Ações POST exigem o token CSRF no cabeçalho e devolvem o corpo JSON.
function post(): array
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error' => 'Use POST para esta ação.'], 405);
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) respond(['error' => 'Sessão expirada. Recarregue a página.'], 403);
    return json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
}

// Lê um texto ou um id inteiro do corpo da requisição (outros tipos viram '' ou 0).
function text(array $d, string $key): string
{
    return is_string($d[$key] ?? null) ? trim($d[$key]) : '';
}

function id(array $d, string $key = 'id'): int
{
    return (int) filter_var($d[$key] ?? null, FILTER_VALIDATE_INT);
}

function deletePhotos(array $names): void
{
    foreach ($names as $name) {
        if (preg_match(PHOTO_NAME, (string) $name) && is_file(PHOTO_DIR . "/$name")) unlink(PHOTO_DIR . "/$name");
    }
}

function fail(Throwable $error): never
{
    try { if (db()->inTransaction()) db()->rollBack(); } catch (Throwable) {}
    error_log('Zuno: ' . $error->getMessage());
    respond(['error' => 'Não foi possível concluir a operação. Tente novamente.'], 500);
}
