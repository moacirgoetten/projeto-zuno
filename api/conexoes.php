<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

// Afinidade de uma sugestão: interesses em comum pesam mais que o mesmo curso.
const SCORE_INTEREST = 3;
const SCORE_COURSE = 2;
const SUGGESTION_LIMIT = 60;

function interestsByUser(PDO $db, array $userIds): array
{
    if (!$userIds) return [];
    $query = $db->prepare('SELECT ui.usuario_id, i.id, i.nome FROM usuario_interesses ui JOIN interesses i ON i.id = ui.interesse_id WHERE ui.usuario_id IN (' . implode(',', array_fill(0, count($userIds), '?')) . ') ORDER BY i.nome');
    $query->execute($userIds);
    $interests = [];
    foreach ($query->fetchAll() as $row) {
        $interests[(int) $row['usuario_id']][] = ['id' => (int) $row['id'], 'nome' => $row['nome']];
    }
    return $interests;
}

// Só os dados públicos do perfil: e-mail e nome do arquivo da foto nunca saem daqui.
function publicPerson(array $row, array $interests): array
{
    $id = (int) $row['usuario_id'];
    return [
        'id' => $id,
        'nome' => $row['nome'],
        'bio' => $row['bio'],
        'curso' => $row['curso'],
        'foto' => photoUrl($id, $row['foto_url']),
        'interesses' => $interests[$id] ?? [],
    ];
}

$routes = ['suggestions' => 'GET', 'list' => 'GET', 'request' => 'POST', 'accept' => 'POST', 'decline' => 'POST', 'remove' => 'POST'];
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

try {
    if (!isset($routes[$action])) respond(['error' => 'Ação inexistente.'], 404);
    if ($method !== $routes[$action]) {
        header('Allow: ' . $routes[$action]);
        respond(['error' => 'Método não permitido para esta ação.'], 405);
    }
    if ($method === 'POST') requireCsrf();
    $db = database();
    $user = currentUser($db);
    if (!$user) respond(['error' => 'Entre novamente para continuar.'], 401);
    $me = (int) $user['id'];

    if ($action === 'suggestions') {
        // Qualquer vínculo existente, em qualquer direção, tira a pessoa das sugestões.
        $query = $db->prepare('SELECT * FROM (
                SELECT u.id AS usuario_id, u.nome, u.bio, u.foto_url, c.nome AS curso, c.id = ? AS mesmo_curso,
                    (SELECT COUNT(*) FROM usuario_interesses meu JOIN usuario_interesses dele ON dele.interesse_id = meu.interesse_id
                     WHERE meu.usuario_id = ? AND dele.usuario_id = u.id) AS em_comum
                FROM usuarios u JOIN cursos c ON c.id = u.curso_id
                WHERE u.ativo = 1 AND u.id <> ? AND c.universidade_id = ?
                  AND NOT EXISTS (SELECT 1 FROM conexoes x WHERE (x.solicitante_id = ? AND x.destinatario_id = u.id)
                                                              OR (x.solicitante_id = u.id AND x.destinatario_id = ?))
            ) candidatos
            ORDER BY em_comum * ' . SCORE_INTEREST . ' + mesmo_curso * ' . SCORE_COURSE . ' DESC, em_comum DESC, nome, usuario_id
            LIMIT ' . SUGGESTION_LIMIT);
        $query->execute([$user['curso_id'], $me, $me, $user['universidade_id'], $me, $me]);
        $rows = $query->fetchAll();
        $interests = interestsByUser($db, array_column($rows, 'usuario_id'));
        respond(['sugestoes' => array_map(fn(array $row) => publicPerson($row, $interests) + [
            'em_comum' => (int) $row['em_comum'],
            'mesmo_curso' => (bool) $row['mesmo_curso'],
        ], $rows)]);
    }

    if ($action === 'list') {
        $query = $db->prepare('SELECT x.id, x.status, x.solicitante_id, u.id AS usuario_id, u.nome, u.bio, u.foto_url, c.nome AS curso
            FROM conexoes x
            JOIN usuarios u ON u.id = IF(x.solicitante_id = ?, x.destinatario_id, x.solicitante_id)
            LEFT JOIN cursos c ON c.id = u.curso_id
            WHERE (x.solicitante_id = ? OR x.destinatario_id = ?) AND x.status IN (\'aceita\', \'pendente\') AND u.ativo = 1
            ORDER BY x.criada_em DESC, x.id DESC');
        $query->execute([$me, $me, $me]);
        $rows = $query->fetchAll();
        $interests = interestsByUser($db, array_column($rows, 'usuario_id'));
        $lists = ['conexoes' => [], 'recebidas' => [], 'enviadas' => []];
        foreach ($rows as $row) {
            $list = $row['status'] === 'aceita' ? 'conexoes' : ((int) $row['solicitante_id'] === $me ? 'enviadas' : 'recebidas');
            $lists[$list][] = ['id' => (int) $row['id'], 'usuario' => publicPerson($row, $interests)];
        }
        respond($lists);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $id = is_array($data) ? ($data['id'] ?? null) : null;
    if (!is_int($id) || $id < 1) respond(['error' => 'Dados inválidos.'], 422);

    if ($action === 'request') {
        if ($id === $me) respond(['error' => 'Você não pode se conectar a si mesmo.'], 422);
        $query = $db->prepare('SELECT 1 FROM usuarios u JOIN cursos c ON c.id = u.curso_id WHERE u.id = ? AND u.ativo = 1 AND c.universidade_id = ?');
        $query->execute([$id, $user['universidade_id']]);
        if (!$query->fetch()) respond(['error' => 'Pessoa não encontrada.'], 404);

        // A chave única de conexoes só cobre uma direção. Travar os dois usuários, sempre
        // na mesma ordem, impede que A→B e B→A sejam criadas ao mesmo tempo.
        $db->beginTransaction();
        $db->prepare('SELECT id FROM usuarios WHERE id IN (?, ?) ORDER BY id FOR UPDATE')->execute([$me, $id]);
        $query = $db->prepare('SELECT 1 FROM conexoes WHERE (solicitante_id = ? AND destinatario_id = ?) OR (solicitante_id = ? AND destinatario_id = ?)');
        $query->execute([$me, $id, $id, $me]);
        if ($query->fetch()) {
            $db->rollBack();
            // Mensagem única para não revelar se a pessoa recusou um pedido anterior.
            respond(['error' => 'Já existe uma solicitação ou conexão com esta pessoa.'], 409);
        }
        $db->prepare('INSERT INTO conexoes (solicitante_id, destinatario_id) VALUES (?, ?)')->execute([$me, $id]);
        $db->commit();
        respond(['ok' => true], 201);
    }

    // Só quem recebeu a solicitação decide; quem enviou não consegue aceitar o próprio pedido.
    if ($action === 'accept' || $action === 'decline') {
        $query = $db->prepare('UPDATE conexoes SET status = ? WHERE id = ? AND destinatario_id = ? AND status = \'pendente\'');
        $query->execute([$action === 'accept' ? 'aceita' : 'recusada', $id, $me]);
        if ($query->rowCount() === 0) respond(['error' => 'Solicitação não encontrada.'], 404);
        respond(['ok' => true]);
    }

    // Remove uma conexão aceita (qualquer lado) ou cancela um pedido pendente (só quem enviou).
    $query = $db->prepare('DELETE FROM conexoes WHERE id = ? AND ((status = \'aceita\' AND (solicitante_id = ? OR destinatario_id = ?)) OR (status = \'pendente\' AND solicitante_id = ?))');
    $query->execute([$id, $me, $me, $me]);
    if ($query->rowCount() === 0) respond(['error' => 'Conexão não encontrada.'], 404);
    respond(['ok' => true]);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('Zuno conexoes: ' . $error->getMessage());
    respond(['error' => 'Não foi possível concluir a operação. Tente novamente.'], 503);
}
