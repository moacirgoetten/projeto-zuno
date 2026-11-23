<?php
// Conta: sessão, catálogo, cadastro, login, perfil, foto e exclusão da conta.
require __DIR__ . '/base.php';

// Perfil completo de um usuário (usado para o usuário conectado).
function profile(int $id): array
{
    $user = q('SELECT u.id, u.nome, u.email, u.bio, u.foto_url, u.curso_id, c.nome AS curso, c.universidade_id, v.nome AS universidade
        FROM usuarios u LEFT JOIN cursos c ON c.id = u.curso_id LEFT JOIN universidades v ON v.id = c.universidade_id WHERE u.id = ?', [$id])->fetch();
    $user['foto'] = photoUrl($id, $user['foto_url']);
    unset($user['foto_url']);
    $user['interesses'] = q('SELECT interesse_id FROM usuario_interesses WHERE usuario_id = ?', [$id])->fetchAll(PDO::FETCH_COLUMN);
    return $user;
}

// Confere se o curso existe e pertence à universidade escolhida.
function validCourse(array $d): int
{
    $course = id($d, 'course_id');
    $ok = q('SELECT 1 FROM cursos c JOIN universidades v ON v.id = c.universidade_id WHERE c.id = ? AND v.id = ? AND v.ativo = 1',
        [$course, id($d, 'university_id')])->fetch();
    if (!$ok) respond(['error' => 'Selecione universidade e curso válidos.'], 422);
    return $course;
}

// Troca (ou remove, com $name = null) a foto e apaga os arquivos antigos.
function savePhoto(int $id, ?string $name): never
{
    $old = q('SELECT caminho FROM fotos WHERE usuario_id = ? UNION SELECT foto_url FROM usuarios WHERE id = ?', [$id, $id])->fetchAll(PDO::FETCH_COLUMN);
    try {
        db()->beginTransaction();
        q('DELETE FROM fotos WHERE usuario_id = ?', [$id]);
        if ($name) q('INSERT INTO fotos (usuario_id, caminho, principal) VALUES (?, ?, 1)', [$id, $name]);
        q('UPDATE usuarios SET foto_url = ? WHERE id = ?', [$name, $id]);
        db()->commit();
    } catch (Throwable $e) {
        if ($name) deletePhotos([$name]); // o banco falhou: apaga o arquivo novo
        throw $e;
    }
    deletePhotos($old);
    respond(['user' => profile($id)]);
}

function logout(): never
{
    $_SESSION = [];
    session_destroy();
    setcookie(session_name(), '', ['expires' => 1, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    respond(['ok' => true]);
}

$action = $_GET['action'] ?? 'session';
try {
    if ($action === 'session') {
        $id = (int) ($_SESSION['user_id'] ?? 0);
        $ok = $id && q('SELECT 1 FROM usuarios WHERE id = ? AND ativo = 1', [$id])->fetch();
        respond(['user' => $ok ? profile($id) : null, 'csrf' => $_SESSION['csrf']]);
    }
    if ($action === 'catalog') respond([
        'universidades' => q('SELECT id, nome FROM universidades WHERE ativo = 1 ORDER BY nome')->fetchAll(),
        'cursos' => q('SELECT id, nome, universidade_id FROM cursos ORDER BY nome')->fetchAll(),
        'interesses' => q('SELECT id, nome FROM interesses ORDER BY nome')->fetchAll(),
    ]);
    // Foto de perfil: só quem está conectado vê, e o nome do arquivo nunca é exposto.
    if ($action === 'photo' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        me();
        $name = (string) q('SELECT foto_url FROM usuarios WHERE id = ? AND ativo = 1', [id($_GET)])->fetchColumn();
        if (!preg_match(PHOTO_NAME, $name, $m) || !is_file(PHOTO_DIR . "/$name")) respond(['error' => 'Foto não encontrada.'], 404);
        header('Content-Type: image/' . ($m[1] === 'jpg' ? 'jpeg' : $m[1]));
        header('Cache-Control: private, max-age=86400');
        readfile(PHOTO_DIR . "/$name");
        exit;
    }
    if (!in_array($action, ['login', 'signup', 'logout', 'profile', 'photo', 'photo_remove', 'delete_account'], true)) {
        respond(['error' => 'Ação inexistente.'], 404);
    }

    $d = post(); // daqui em diante: só POST com token CSRF
    $pass = is_string($d['password'] ?? null) ? $d['password'] : '';

    if ($action === 'signup') {
        $name = text($d, 'name');
        $email = strtolower(text($d, 'email'));
        if ($name === '' || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190
            || mb_strlen($pass) < 8 || strlen($pass) > 72 || ($d['consent'] ?? false) !== true) {
            respond(['error' => 'Informe nome, e-mail válido, senha de 8 a 72 caracteres e aceite o termo.'], 422);
        }
        $course = validCourse($d);
        if (q('SELECT 1 FROM usuarios WHERE email = ?', [$email])->fetch()) respond(['error' => 'Este e-mail já está cadastrado.'], 409);
        db()->beginTransaction();
        q('INSERT INTO usuarios (nome, email, senha_hash, curso_id) VALUES (?, ?, ?, ?)', [$name, $email, password_hash($pass, PASSWORD_DEFAULT), $course]);
        q('INSERT INTO consentimentos (usuario_id, versao_termo) VALUES (?, ?)', [db()->lastInsertId(), '1.0']);
        db()->commit();
        respond(['ok' => true], 201);
    }
    if ($action === 'login') {
        $user = q('SELECT id, senha_hash FROM usuarios WHERE email = ? AND ativo = 1', [strtolower(text($d, 'email'))])->fetch();
        // Com e-mail inexistente compara com um hash falso: o tempo de resposta não revela quais contas existem.
        $valid = password_verify($pass, $user['senha_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
        if (!$user || !$valid) respond(['error' => 'E-mail ou senha inválidos.'], 401);
        session_regenerate_id(true); // novo id de sessão evita fixação de sessão
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        respond(['user' => profile($user['id']), 'csrf' => $_SESSION['csrf']]);
    }
    if ($action === 'logout') logout();

    $id = me(); // as ações abaixo sempre alteram a conta conectada, nunca um id enviado pelo navegador

    if ($action === 'profile') {
        $bio = text($d, 'bio');
        $interests = $d['interests'] ?? null;
        if (mb_strlen($bio) > 500 || !is_array($interests) || count($interests) > 50 || array_filter($interests, fn($i) => !is_int($i))) {
            respond(['error' => 'Informe uma bio de até 500 caracteres e interesses válidos.'], 422);
        }
        $course = validCourse($d);
        $interests = array_values(array_unique($interests));
        if ($interests && q('SELECT COUNT(*) FROM interesses WHERE id IN (' . rtrim(str_repeat('?,', count($interests)), ',') . ')', $interests)->fetchColumn() != count($interests)) {
            respond(['error' => 'Interesse inválido.'], 422);
        }
        db()->beginTransaction();
        q('UPDATE usuarios SET bio = ?, curso_id = ? WHERE id = ?', [$bio, $course, $id]);
        q('DELETE FROM usuario_interesses WHERE usuario_id = ?', [$id]);
        foreach ($interests as $i) q('INSERT INTO usuario_interesses (usuario_id, interesse_id) VALUES (?, ?)', [$id, $i]);
        db()->commit();
        respond(['user' => profile($id)]);
    }
    if ($action === 'photo') {
        $file = $_FILES['photo'] ?? null;
        $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
        // O tipo é conferido pelo conteúdo da imagem, não pela extensão do arquivo.
        $img = ($file['error'] ?? 1) === UPLOAD_ERR_OK && $file['size'] <= 2 * 1024 * 1024 ? @getimagesize($file['tmp_name']) : false;
        if (!$img || !isset($types[$img[2]]) || $img[0] > 4000 || $img[1] > 4000) {
            respond(['error' => 'Envie uma imagem JPG, PNG ou WebP de até 2 MB e no máximo 4000×4000 pixels.'], 422);
        }
        $name = bin2hex(random_bytes(16)) . '.' . $types[$img[2]]; // nome aleatório, impossível de adivinhar
        if (!is_dir(PHOTO_DIR)) mkdir(PHOTO_DIR, 0755, true);
        if (!move_uploaded_file($file['tmp_name'], PHOTO_DIR . "/$name")) throw new RuntimeException('Falha ao gravar a foto.');
        savePhoto($id, $name);
    }
    if ($action === 'photo_remove') savePhoto($id, null);

    // Exclusão da conta (LGPD): o ON DELETE CASCADE apaga interesses, conexões, mensagens, notificações, denúncias e consentimento.
    $hash = q('SELECT senha_hash FROM usuarios WHERE id = ?', [$id])->fetchColumn();
    if (!password_verify($pass, $hash)) respond(['error' => 'Senha incorreta.'], 422);
    $photos = q('SELECT caminho FROM fotos WHERE usuario_id = ?', [$id])->fetchAll(PDO::FETCH_COLUMN);
    q('DELETE FROM usuarios WHERE id = ?', [$id]);
    deletePhotos($photos);
    logout();
} catch (Throwable $e) {
    fail($e);
}
