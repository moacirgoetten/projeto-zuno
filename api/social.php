<?php
// Sprints 5 e 6: sugestões, conexões, mensagens, notificações e denúncias.
require __DIR__ . '/base.php';

// Colunas públicas de uma pessoa (nunca e-mail ou senha) + seus interesses em texto.
const PERSON = "u.id, u.nome, u.bio, u.foto_url, c.nome AS curso,
    (SELECT GROUP_CONCAT(i.nome ORDER BY i.nome SEPARATOR ', ') FROM usuario_interesses ui
     JOIN interesses i ON i.id = ui.interesse_id WHERE ui.usuario_id = u.id) AS interesses";

// Troca o nome do arquivo da foto pelo endereço protegido da API.
function people(array $rows): array
{
    foreach ($rows as &$r) {
        $r['foto'] = photoUrl($r['id'], $r['foto_url']);
        unset($r['foto_url']);
    }
    return $rows;
}

// Conexão entre duas pessoas, em qualquer direção.
function connection(int $a, int $b): array|false
{
    return q('SELECT * FROM conexoes WHERE (solicitante_id = ? AND destinatario_id = ?) OR (solicitante_id = ? AND destinatario_id = ?)', [$a, $b, $b, $a])->fetch();
}

// Conexão aceita da qual o usuário conectado participa; senão responde 404.
function chat(int $me, int $id): array
{
    $c = q("SELECT id, IF(solicitante_id = ?, destinatario_id, solicitante_id) AS outro FROM conexoes
        WHERE id = ? AND status = 'aceita' AND ? IN (solicitante_id, destinatario_id)", [$me, $id, $me])->fetch();
    if (!$c) respond(['error' => 'Conversa não encontrada.'], 404);
    return $c;
}

function otherUser(int $me, int $id): int
{
    if ($id === $me || !q('SELECT 1 FROM usuarios WHERE id = ? AND ativo = 1', [$id])->fetch()) respond(['error' => 'Pessoa não encontrada.'], 404);
    return $id;
}

function notify(int $user, string $type, string $text): void
{
    q('INSERT INTO notificacoes (usuario_id, tipo, mensagem) VALUES (?, ?, ?)', [$user, $type, $text]);
}

function myName(int $me): string
{
    return q('SELECT nome FROM usuarios WHERE id = ?', [$me])->fetchColumn();
}

$action = $_GET['action'] ?? '';
try {
    $me = me(); // toda a API social exige login

    // Algoritmo de sugestões: só pessoas da mesma universidade, ordenadas por afinidade
    // (cada interesse em comum vale 3 pontos e o mesmo curso vale 2).
    // Quem já tem conexão, solicitação, recusa ou bloqueio com o usuário não aparece.
    if ($action === 'suggestions') {
        $my = q('SELECT u.curso_id, c.universidade_id FROM usuarios u JOIN cursos c ON c.id = u.curso_id WHERE u.id = ?', [$me])->fetch();
        respond(['people' => people(q('SELECT ' . PERSON . ",
            (SELECT COUNT(*) FROM usuario_interesses a JOIN usuario_interesses b ON b.interesse_id = a.interesse_id
             WHERE a.usuario_id = u.id AND b.usuario_id = ?) AS comuns
            FROM usuarios u JOIN cursos c ON c.id = u.curso_id
            WHERE u.ativo = 1 AND u.id <> ? AND c.universidade_id = ? AND NOT EXISTS (SELECT 1 FROM conexoes x
                WHERE (x.solicitante_id = ? AND x.destinatario_id = u.id) OR (x.solicitante_id = u.id AND x.destinatario_id = ?))
            ORDER BY comuns * 3 + (c.id = ?) * 2 DESC, u.nome LIMIT 60", [$me, $me, $my['universidade_id'], $me, $me, $my['curso_id']])->fetchAll())]);
    }

    // Conexões aceitas e solicitações pendentes (enviadas = 1 quando foi o usuário que pediu).
    if ($action === 'connections') respond(['connections' => people(q('SELECT x.id AS conexao_id, x.status, x.solicitante_id = ? AS enviada, ' . PERSON . ",
        (SELECT conteudo FROM mensagens m WHERE m.conexao_id = x.id ORDER BY m.id DESC LIMIT 1) AS ultima,
        (SELECT COUNT(*) FROM mensagens m WHERE m.conexao_id = x.id AND m.remetente_id <> ? AND m.lida = 0) AS nao_lidas
        FROM conexoes x JOIN usuarios u ON u.id = IF(x.solicitante_id = ?, x.destinatario_id, x.solicitante_id)
        LEFT JOIN cursos c ON c.id = u.curso_id
        WHERE ? IN (x.solicitante_id, x.destinatario_id) AND x.status IN ('pendente', 'aceita') AND u.ativo = 1
        ORDER BY x.id DESC", [$me, $me, $me, $me])->fetchAll())]);

    // Abrir uma conversa marca como lidas as mensagens recebidas.
    if ($action === 'messages') {
        $c = chat($me, id($_GET));
        q('UPDATE mensagens SET lida = 1 WHERE conexao_id = ? AND remetente_id <> ?', [$c['id'], $me]);
        respond(['messages' => q('SELECT id, conteudo, remetente_id = ? AS minha FROM mensagens WHERE conexao_id = ? ORDER BY id', [$me, $c['id']])->fetchAll()]);
    }
    if ($action === 'notifications') {
        respond(['notifications' => q("SELECT mensagem, lida, DATE_FORMAT(criada_em, '%d/%m %H:%i') AS quando FROM notificacoes WHERE usuario_id = ? ORDER BY id DESC LIMIT 30", [$me])->fetchAll()]);
    }

    if (!in_array($action, ['connect', 'answer', 'remove', 'send', 'read_notifications', 'report'], true)) {
        respond(['error' => 'Ação inexistente.'], 404);
    }
    $d = post(); // daqui em diante: só POST com token CSRF

    if ($action === 'connect') {
        $other = otherUser($me, id($d, 'user_id'));
        if (connection($me, $other)) respond(['error' => 'Já existe uma conexão ou solicitação com esta pessoa.'], 409);
        q('INSERT INTO conexoes (solicitante_id, destinatario_id) VALUES (?, ?)', [$me, $other]);
        notify($other, 'conexao', myName($me) . ' quer se conectar com você.');
        respond(['ok' => true], 201);
    }
    // Só quem recebeu a solicitação pode aceitar ou recusar.
    if ($action === 'answer') {
        $c = q("SELECT id, solicitante_id FROM conexoes WHERE id = ? AND destinatario_id = ? AND status = 'pendente'", [id($d), $me])->fetch();
        if (!$c) respond(['error' => 'Solicitação não encontrada.'], 404);
        $accept = ($d['accept'] ?? false) === true;
        q('UPDATE conexoes SET status = ? WHERE id = ?', [$accept ? 'aceita' : 'recusada', $c['id']]);
        if ($accept) notify($c['solicitante_id'], 'conexao', myName($me) . ' aceitou sua conexão.');
        respond(['ok' => true]);
    }
    // Desfazer conexão ou cancelar solicitação (apaga também as mensagens, por ON DELETE CASCADE).
    if ($action === 'remove') {
        $done = q("DELETE FROM conexoes WHERE id = ? AND status IN ('pendente', 'aceita') AND ? IN (solicitante_id, destinatario_id)", [id($d), $me])->rowCount();
        respond($done ? ['ok' => true] : ['error' => 'Conexão não encontrada.'], $done ? 200 : 404);
    }
    if ($action === 'send') {
        $c = chat($me, id($d));
        $text = text($d, 'text');
        if ($text === '' || mb_strlen($text) > 1000) respond(['error' => 'A mensagem deve ter de 1 a 1000 caracteres.'], 422);
        q('INSERT INTO mensagens (conexao_id, remetente_id, conteudo) VALUES (?, ?, ?)', [$c['id'], $me, $text]);
        notify($c['outro'], 'mensagem', 'Nova mensagem de ' . myName($me) . '.');
        respond(['ok' => true], 201);
    }
    if ($action === 'read_notifications') {
        q('UPDATE notificacoes SET lida = 1 WHERE usuario_id = ?', [$me]);
        respond(['ok' => true]);
    }
    // Denunciar também bloqueia: a pessoa some das sugestões, das conexões e das conversas.
    if ($action === 'report') {
        $other = otherUser($me, id($d, 'user_id'));
        $reason = text($d, 'reason');
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 255) respond(['error' => 'Descreva o motivo com 5 a 255 caracteres.'], 422);
        db()->beginTransaction();
        q('INSERT INTO denuncias (denunciante_id, usuario_denunciado_id, motivo) VALUES (?, ?, ?)', [$me, $other, $reason]);
        $c = connection($me, $other);
        if ($c) q("UPDATE conexoes SET status = 'bloqueada' WHERE id = ?", [$c['id']]);
        else q("INSERT INTO conexoes (solicitante_id, destinatario_id, status) VALUES (?, ?, 'bloqueada')", [$me, $other]);
        db()->commit();
        respond(['ok' => true], 201);
    }
} catch (Throwable $e) {
    fail($e);
}
