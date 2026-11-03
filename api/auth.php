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

const PHOTO_DIR = __DIR__ . '/../uploads/fotos';
const PHOTO_NAME = '/^[a-f0-9]{32}\.(jpg|png|webp)$/';
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
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

function currentUser(PDO $db): ?array
{
    if (empty($_SESSION['user_id'])) return null;
    $query = $db->prepare('SELECT u.id, u.nome, u.email, u.bio, u.foto_url, u.curso_id, c.nome AS curso, c.universidade_id, v.nome AS universidade FROM usuarios u LEFT JOIN cursos c ON c.id = u.curso_id LEFT JOIN universidades v ON v.id = c.universidade_id WHERE u.id = ? AND u.ativo = 1');
    $query->execute([$_SESSION['user_id']]);
    $user = $query->fetch();
    if (!$user) return null;
    // A foto é servida pela API, que exige sessão; o nome do arquivo não é exposto.
    $user['foto'] = $user['foto_url'] ? 'api/auth.php?action=photo&id=' . $user['id'] . '&v=' . substr($user['foto_url'], 0, 8) : null;
    unset($user['foto_url']);
    $query = $db->prepare('SELECT interesse_id FROM usuario_interesses WHERE usuario_id = ?');
    $query->execute([$user['id']]);
    $user['interesses'] = array_map('intval', $query->fetchAll(PDO::FETCH_COLUMN));
    return $user;
}

function userPhotos(PDO $db, int $userId): array
{
    $query = $db->prepare('SELECT caminho FROM fotos WHERE usuario_id = ? UNION SELECT foto_url FROM usuarios WHERE id = ? AND foto_url IS NOT NULL');
    $query->execute([$userId, $userId]);
    return $query->fetchAll(PDO::FETCH_COLUMN);
}

function deletePhotoFiles(array $names): void
{
    foreach ($names as $name) {
        if (preg_match(PHOTO_NAME, (string) $name) && is_file(PHOTO_DIR . '/' . $name)) unlink(PHOTO_DIR . '/' . $name);
    }
}

$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$action = $_GET['action'] ?? 'session';
$method = $_SERVER['REQUEST_METHOD'];
$newPhoto = null;

try {
    if ($method === 'GET' && $action === 'session') {
        $user = empty($_SESSION['user_id']) ? null : currentUser(database());
        respond(['user' => $user, 'csrf' => $_SESSION['csrf']]);
    }
    if ($method === 'GET' && $action === 'catalog') {
        $db = database();
        respond([
            'universidades' => $db->query('SELECT id, nome FROM universidades WHERE ativo = 1 ORDER BY nome')->fetchAll(),
            'cursos' => $db->query('SELECT c.id, c.nome, c.universidade_id FROM cursos c JOIN universidades u ON u.id = c.universidade_id WHERE u.ativo = 1 ORDER BY c.nome')->fetchAll(),
            'interesses' => $db->query('SELECT id, nome FROM interesses ORDER BY nome')->fetchAll(),
        ]);
    }
    if ($method === 'GET' && $action === 'photo') {
        $db = database();
        if (!currentUser($db)) respond(['error' => 'Entre para ver fotos de perfil.'], 401);
        $query = $db->prepare('SELECT foto_url FROM usuarios WHERE id = ? AND ativo = 1');
        $query->execute([filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT) ?: 0]);
        $name = (string) $query->fetchColumn();
        if (!preg_match(PHOTO_NAME, $name, $match) || !is_file(PHOTO_DIR . '/' . $name)) {
            respond(['error' => 'Foto não encontrada.'], 404);
        }
        header('Content-Type: ' . ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$match[1]]);
        header('Content-Length: ' . filesize(PHOTO_DIR . '/' . $name));
        header('Cache-Control: private, max-age=86400');
        readfile(PHOTO_DIR . '/' . $name);
        exit;
    }
    if (!in_array($action, ['login', 'signup', 'logout', 'profile', 'photo', 'photo_remove'], true)) {
        respond(['error' => 'Ação inexistente.'], 404);
    }
    if ($method !== 'POST') {
        header('Allow: POST');
        respond(['error' => 'Use POST para esta ação.'], 405);
    }
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        respond(['error' => 'Sessão expirada. Recarregue a página.'], 403);
    }

    if ($action === 'photo') {
        $db = database();
        $user = currentUser($db);
        if (!$user) respond(['error' => 'Entre novamente para alterar sua foto.'], 401);
        // Sem o arquivo em $_FILES, o envio pode ter passado do post_max_size do PHP.
        $file = $_FILES['photo'] ?? null;
        $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
        $image = is_array($file) && ($file['error'] ?? null) === UPLOAD_ERR_OK && $file['size'] <= PHOTO_MAX_BYTES
            && is_uploaded_file($file['tmp_name']) ? @getimagesize($file['tmp_name']) : false;
        if (!$image || !isset($types[$image[2]]) || $image[0] > 4000 || $image[1] > 4000) {
            respond(['error' => 'Envie uma imagem JPG, PNG ou WebP de até 2 MB e no máximo 4000×4000 pixels.'], 422);
        }
        if (!is_dir(PHOTO_DIR) && !mkdir(PHOTO_DIR, 0755, true)) throw new RuntimeException('Pasta de fotos indisponível.');
        $name = bin2hex(random_bytes(16)) . '.' . $types[$image[2]];
        if (!move_uploaded_file($file['tmp_name'], PHOTO_DIR . '/' . $name)) throw new RuntimeException('Falha ao gravar a foto.');
        $newPhoto = $name;
        $old = userPhotos($db, (int) $user['id']);
        $db->beginTransaction();
        $db->prepare('DELETE FROM fotos WHERE usuario_id = ?')->execute([$user['id']]);
        $db->prepare('INSERT INTO fotos (usuario_id, caminho, principal) VALUES (?, ?, 1)')->execute([$user['id'], $name]);
        $db->prepare('UPDATE usuarios SET foto_url = ? WHERE id = ?')->execute([$name, $user['id']]);
        $db->commit();
        $newPhoto = null;
        deletePhotoFiles($old);
        respond(['user' => currentUser($db)]);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) respond(['error' => 'Dados inválidos.'], 400);

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        $cookie = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $cookie['path'],
            'secure' => $cookie['secure'], 'httponly' => true, 'samesite' => 'Lax']);
        respond(['ok' => true]);
    }

    if ($action === 'photo_remove') {
        $db = database();
        $user = currentUser($db);
        if (!$user) respond(['error' => 'Entre novamente para alterar sua foto.'], 401);
        $old = userPhotos($db, (int) $user['id']);
        $db->beginTransaction();
        $db->prepare('DELETE FROM fotos WHERE usuario_id = ?')->execute([$user['id']]);
        $db->prepare('UPDATE usuarios SET foto_url = NULL WHERE id = ?')->execute([$user['id']]);
        $db->commit();
        deletePhotoFiles($old);
        respond(['user' => currentUser($db)]);
    }

    if ($action === 'profile') {
        $db = database();
        $user = currentUser($db);
        if (!$user) respond(['error' => 'Entre novamente para editar seu perfil.'], 401);
        $bio = $data['bio'] ?? null;
        $course = filter_var($data['course_id'] ?? null, FILTER_VALIDATE_INT);
        $university = filter_var($data['university_id'] ?? null, FILTER_VALIDATE_INT);
        $interests = $data['interests'] ?? null;
        if (!is_string($bio) || mb_strlen($bio) > 500 || !is_array($interests) || count($interests) > 100) {
            respond(['error' => 'Informe uma bio de até 500 caracteres e interesses válidos.'], 422);
        }
        foreach ($interests as $interest) {
            if (!is_int($interest) || $interest < 1) respond(['error' => 'Interesse inválido.'], 422);
        }
        $interests = array_values(array_unique($interests));
        $query = $db->prepare('SELECT c.id FROM cursos c JOIN universidades v ON v.id = c.universidade_id WHERE c.id = ? AND v.id = ? AND v.ativo = 1');
        $query->execute([$course, $university]);
        if (!$query->fetch()) respond(['error' => 'Selecione universidade e curso válidos.'], 422);
        if ($interests) {
            $query = $db->prepare('SELECT COUNT(*) FROM interesses WHERE id IN (' . implode(',', array_fill(0, count($interests), '?')) . ')');
            $query->execute($interests);
            if ((int) $query->fetchColumn() !== count($interests)) respond(['error' => 'Interesse inválido.'], 422);
        }
        $db->beginTransaction();
        $query = $db->prepare('UPDATE usuarios SET bio = ?, curso_id = ? WHERE id = ?');
        $query->execute([trim($bio), $course, $user['id']]);
        $query = $db->prepare('DELETE FROM usuario_interesses WHERE usuario_id = ?');
        $query->execute([$user['id']]);
        $query = $db->prepare('INSERT INTO usuario_interesses (usuario_id, interesse_id) VALUES (?, ?)');
        foreach ($interests as $interest) $query->execute([$user['id'], $interest]);
        $db->commit();
        respond(['user' => currentUser($db)]);
    }

    $email = is_string($data['email'] ?? null) ? strtolower(trim($data['email'])) : '';
    $password = is_string($data['password'] ?? null) ? $data['password'] : '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
        respond(['error' => 'Informe um e-mail válido.'], 422);
    }
    if ($password === '' || strlen($password) > 72) {
        respond(['error' => 'A senha deve ter entre 1 e 72 bytes.'], 422);
    }
    $db = database();
    if ($action === 'signup') {
        $name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
        $course = filter_var($data['course_id'] ?? null, FILTER_VALIDATE_INT);
        $university = filter_var($data['university_id'] ?? null, FILTER_VALIDATE_INT);
        if ($name === '' || mb_strlen($name) > 120 || mb_strlen($password) < 8 || ($data['consent'] ?? false) !== true) {
            respond(['error' => 'Informe nome (até 120 caracteres), senha com pelo menos 8 caracteres e aceite o consentimento.'], 422);
        }
        $query = $db->prepare('SELECT c.id FROM cursos c JOIN universidades u ON u.id = c.universidade_id WHERE c.id = ? AND u.id = ? AND u.ativo = 1');
        $query->execute([$course, $university]);
        if (!$query->fetch()) respond(['error' => 'Selecione uma universidade e um curso válidos.'], 422);
        $db->beginTransaction();
        $query = $db->prepare('INSERT INTO usuarios (nome, email, senha_hash, curso_id) VALUES (?, ?, ?, ?)');
        $query->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $course]);
        $id = (int) $db->lastInsertId();
        $query = $db->prepare('INSERT INTO consentimentos (usuario_id, versao_termo) VALUES (?, ?)');
        $query->execute([$id, '1.0']);
        $db->commit();
        respond(['ok' => true], 201);
    }

    $query = $db->prepare('SELECT id, senha_hash FROM usuarios WHERE email = ? AND ativo = 1');
    $query->execute([$email]);
    $user = $query->fetch();
    // Verifica um hash também para e-mails inexistentes.
    $valid = password_verify($password, $user['senha_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
    if (!$user || !$valid) respond(['error' => 'E-mail ou senha inválidos.'], 401);
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    respond(['user' => currentUser($db), 'csrf' => $_SESSION['csrf']]);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    if ($newPhoto !== null) deletePhotoFiles([$newPhoto]);
    if ($error instanceof PDOException && ($error->errorInfo[1] ?? null) === 1062) {
        respond(['error' => 'Este e-mail já está cadastrado.'], 409);
    }
    error_log('Zuno auth: ' . $error->getMessage());
    respond(['error' => 'Não foi possível concluir a operação. Confira a configuração do banco e tente novamente.'], 503);
}
