# Projeto Zuno — versão final (Sprints 1 a 7)

Rede social universitária: o estudante se cadastra, monta o perfil com curso e interesses, recebe sugestões de pessoas parecidas, envia pedidos de conexão e conversa com quem aceitou.

Tecnologias: HTML, CSS e JavaScript puro no navegador; PHP 8.1+ com PDO no servidor; MariaDB/MySQL (XAMPP).

## Estrutura

| Arquivo | O que faz |
|---|---|
| `index.html` | Todas as telas: login, cadastro, sugestões, perfil, conexões, mensagens e notificações. Só uma fica visível por vez (classe `active`). |
| `css/style.css` | Visual e responsividade (`@media` para 1100px e 720px). |
| `js/script.js` | Navegação entre telas, formulários e chamadas à API com `fetch`. |
| `api/base.php` | Funções comuns: sessão, resposta JSON, conexão com o banco, CSRF e login obrigatório. |
| `api/auth.php` | Conta: sessão, catálogo, cadastro, login, logout, perfil, foto e exclusão da conta. |
| `api/social.php` | Sugestões, conexões, mensagens, notificações e denúncias. |
| `banco/zuno.sql` | Cria o banco `zuno` com as 11 tabelas e o catálogo: 18 universidades reais, 21 cursos em cada uma e 24 interesses. |
| `config/database.example.php` | Modelo da configuração do banco. A cópia `database.local.php` fica fora do Git. |
| `uploads/fotos/` | Fotos de perfil. O `.htaccess` bloqueia acesso direto; a foto só sai pela API. |

## Como executar no XAMPP

1. Inicie Apache e MySQL no XAMPP.
2. Se o banco ainda não existe, importe `banco/zuno.sql` no phpMyAdmin (só uma vez). Um banco já importado com o catálogo da Sprint 5 continua valendo: as tabelas não mudaram.
3. Copie `config/database.example.php` para `config/database.local.php` e confira host, porta (`3306` é o padrão do XAMPP; o exemplo usa `3307`), usuário e senha.
4. Copie o projeto para `C:\xampp\htdocs\zuno_projeto_completo\` (mantendo seu `database.local.php`).
5. Acesse `http://localhost/zuno_projeto_completo/`.

Alternativa sem Apache: `& C:\xampp\php\php.exe -S 127.0.0.1:8080 -t .` na pasta do projeto e abra `http://127.0.0.1:8080/`.

## Como o sistema funciona

**Fluxo de uma ação:** o JavaScript chama `api('acao', dados)` → `fetch` para `api/auth.php?action=acao` ou `api/social.php?action=acao` → o PHP valida a sessão e os dados, executa SQL com consultas preparadas e responde JSON → o JavaScript redesenha a tela.

- GET = só leitura (ex.: `suggestions`, `connections`, `messages`, `notifications`).
- POST = altera dados e exige o token CSRF no cabeçalho `X-CSRF-Token`.

**Sprint 3 — autenticação:** senha guardada com `password_hash` (bcrypt) e conferida com `password_verify`. No login, `session_regenerate_id` troca o id da sessão. O cadastro grava usuário e consentimento numa transação.

**Sprint 4 — perfil e foto:** o usuário só altera a própria conta (o id vem da sessão, nunca do navegador). A foto é validada pelo conteúdo (`getimagesize`), limitada a 2 MB e salva com nome aleatório.

**Sprint 5 — sugestões e conexões:**
- Algoritmo de sugestões (`social.php`, ação `suggestions`): mostra só pessoas ativas da sua universidade, tirando quem já tem conexão, pedido, recusa ou bloqueio com você. Ordena pela afinidade: cada interesse em comum vale 3 pontos (contagem com `JOIN` de `usuario_interesses` com ela mesma) e o mesmo curso vale 2.
- Conexão: `connect` cria uma linha `pendente` em `conexoes`. Só o destinatário pode `answer` (aceitar → `aceita`, recusar → `recusada`). `remove` desfaz a conexão ou cancela o pedido.

**Sprint 6 — mensagens, notificações, denúncia e privacidade:**
- Mensagens só entre conexões `aceita`; a função `chat()` confere se o usuário faz parte da conversa. Abrir a conversa marca as mensagens recebidas como lidas. A tela busca novidades a cada 5 segundos (`setInterval`).
- Notificações são criadas no servidor quando alguém pede conexão, aceita ou envia mensagem. O número de não lidas aparece no menu; abrir a tela marca todas como lidas.
- Denúncia grava em `denuncias` e bloqueia a pessoa (status `bloqueada`): ela some das sugestões, conexões e conversas dos dois lados.
- Exclusão da conta (LGPD), com confirmação de senha: `ON DELETE CASCADE` apaga perfil, interesses, conexões, mensagens, notificações e consentimento; as fotos são apagadas da pasta.

## Segurança (revisada na Sprint 6)

| Ameaça | Proteção |
|---|---|
| SQL Injection | Todas as consultas usam `prepare` + parâmetros `?` (função `q()`). |
| XSS | O JavaScript só usa `textContent` para mostrar dados de usuários; HTML digitado aparece como texto. |
| CSRF | Todo POST exige o token da sessão no cabeçalho; comparado com `hash_equals`. |
| Roubo de sessão | Cookie `HttpOnly` e `SameSite=Lax`, modo estrito de sessão, id novo no login. |
| Senhas | bcrypt; senha de 8 a 72 caracteres; hash falso quando o e-mail não existe (tempo de resposta igual). |
| Acesso indevido | Toda ação social chama `me()` (exige login) e confere se o usuário participa da conexão/conversa. |
| Upload malicioso | Tipo pelo conteúdo, tamanho máximo, nome aleatório, pasta bloqueada pelo `.htaccess`. |
| Vazamento de dados | Sugestões e conexões nunca retornam e-mail; erros internos vão para o log, não para a tela. |

Limitações conhecidas: não há limite de tentativas de login, o e-mail não é confirmado e não há painel de moderação para as denúncias (ficam na tabela `denuncias`).

## Roteiro de teste (Sprint 7)

1. Cadastre dois usuários (A e B) na mesma universidade e marque interesses parecidos. Cadastro com e-mail repetido deve ser recusado.
2. Como A, abra Sugestões: B aparece com o número de interesses em comum. Busque por nome e filtre por interesse.
3. A envia conexão para B → B sai das sugestões de A e aparece em "Solicitações enviadas".
4. Entre como B (outro navegador ou janela anônima): o sino mostra 1 notificação; em Conexões, aceite.
5. B clica em Mensagem e envia `<b>oi</b>`: deve aparecer como texto. A recebe em até 5 segundos.
6. Desfaça a conexão: a conversa some. Peça de novo e recuse: o pedido some.
7. Denuncie uma pessoa: ela some das sugestões e conexões dos dois.
8. Em Meu perfil, altere bio, curso, interesses e foto; recarregue a página e confira. Exclua a conta com a senha: o login deixa de funcionar.
9. Diminua a janela para celular: o menu vira uma barra horizontal e os cartões ficam em uma coluna.
