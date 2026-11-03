# Projeto Zuno — Sprint 4

Interface navegável com cadastro, autenticação e perfil completo (universidade, curso, interesses e foto) em PHP/MariaDB. Sugestões, conexões e mensagens continuam demonstrativos.

## Estrutura

- `index.html` — login, cadastro, sugestões, perfil, conexões e mensagens.
- `css/style.css` — estilos e responsividade.
- `js/script.js` — navegação e interações demonstrativas.
- `banco/zuno.sql` — script SQL preliminar para desenvolvimento.
- `api/auth.php` — cadastro, login, sessão, saída, edição do próprio perfil, foto de perfil e catálogo de universidades/cursos/interesses.
- `uploads/fotos/` — fotos enviadas pelos usuários (ignoradas pelo Git). O `.htaccess` bloqueia o acesso direto no Apache; as fotos são entregues pela API somente para quem está conectado.
- `config/database.example.php` — modelo de configuração local (sem credenciais).

## Como executar no XAMPP

1. Inicie Apache e MySQL/MariaDB pelo XAMPP.
2. Caso o banco ainda não exista, importe `banco/zuno.sql` pelo phpMyAdmin. Se ele já foi importado, não execute o script novamente: ele não é uma migração e não é idempotente.
3. Copie `config/database.example.php` para `config/database.local.php`. Preencha usuário e senha locais do MariaDB; confira host, porta `3307` e banco `zuno`. O arquivo local é ignorado pelo Git.
4. Copie os arquivos atualizados do projeto para `C:\xampp\htdocs\zuno_projeto_completo\`, incluindo `api/`, `config/` e `uploads/` (com o `.htaccess`). Preserve sua configuração local ao atualizar a pasta.
5. Acesse `http://localhost/zuno_projeto_completo/`.

Para executar diretamente deste repositório, com MariaDB iniciado e a configuração local preenchida, use no PowerShell:

```powershell
& C:\xampp\php\php.exe -S 127.0.0.1:8080 -t .
```

Abra `http://127.0.0.1:8080/`. Abrir o HTML por `file://` não executa a API PHP.

## Validação da Sprint 3

1. Cadastre um usuário escolhendo universidade, curso e consentimento. A senha precisa ter ao menos 8 caracteres e no máximo 72 bytes (limite do bcrypt).
2. Confira no banco o usuário e o consentimento `1.0`. `senha_hash` deve conter um hash, nunca a senha informada.
3. Tente cadastrar novamente o mesmo e-mail: deve aparecer um aviso de duplicidade.
4. Teste senha incorreta: o acesso deve ser recusado. Entre com a senha correta e recarregue a página: a sessão deve permanecer conectada.
5. Clique em Sair e recarregue: a tela de login deve aparecer.
6. Teste pelo servidor requisições sem token CSRF, curso de outra universidade e consentimento ausente: devem ser recusadas.

O cadastro valida formato de e-mail; não verifica vínculo universitário nem envia confirmação por e-mail. O servidor usa consultas preparadas, `password_hash`/`password_verify`, cookie HttpOnly/SameSite e renovação do identificador da sessão no login.

## Validação da Sprint 4 — perfil e permissões

Perfil:

1. Abra Meu perfil: nome, curso e universidade devem corresponder ao cadastro. Uma conta nova começa sem bio, sem interesses e com as iniciais no lugar da foto.
2. Troque a universidade: a lista de cursos deve mostrar só os cursos dela. Salve bio, curso e interesses e recarregue: os dados devem permanecer salvos e aparecer no topo do perfil e na barra lateral.
3. Confira no banco: `usuarios.bio` e `usuarios.curso_id` atualizados e uma linha em `usuario_interesses` para cada interesse marcado.
4. Envie uma foto JPG, PNG ou WebP de até 2 MB: ela deve aparecer no perfil e na barra lateral e continuar após recarregar. Em `usuarios.foto_url` e `fotos` deve haver o mesmo nome de arquivo aleatório, e o arquivo deve estar em `uploads/fotos/`.
5. Envie outra foto: a anterior deve ser apagada da pasta e de `fotos`. Clique em Remover foto: as iniciais voltam e `foto_url` fica vazio.
6. Tente enviar um PDF, um arquivo renomeado para `.jpg` ou uma imagem maior que 2 MB: o envio deve ser recusado.

Permissões (pelo navegador conectado/desconectado ou por ferramentas como Postman/DevTools):

7. Sem estar conectado (mas com o token CSRF obtido em `?action=session`), `POST ?action=profile`, `?action=photo` e `?action=photo_remove` devem responder 401, e `GET ?action=photo&id=1` também.
8. Com sessão mas sem o cabeçalho `X-CSRF-Token`, os mesmos POST devem responder 403.
9. As ações de perfil e foto não recebem id de usuário: sempre alteram a conta conectada. Enviar `user_id` ou `id` no corpo não muda outra conta.
10. No Apache, abrir `uploads/fotos/<arquivo>` diretamente deve responder 403.
11. Bio acima de 500 caracteres, interesse inexistente e curso de outra universidade devem ser recusados com 422.

Os dados de perfil e interesses são gravados em uma transação; a foto também, e o arquivo novo é apagado se o banco falhar. O tipo da imagem é conferido pelo conteúdo (`getimagesize`), não pela extensão, e o arquivo é salvo com nome aleatório. No servidor embutido do PHP (`php -S`) o `.htaccess` não vale, mas os nomes aleatórios não são adivinháveis; no XAMPP o bloqueio funciona. Futuras APIs de conexões e mensagens também precisam validar a sessão e as permissões no servidor.

## Observações importantes

- Cadastro grava usuário e consentimento na mesma transação; login usa a conta cadastrada e sessão PHP.
- Meu perfil exibe os dados da conta conectada e permite salvar bio, curso, universidade, interesses e foto no banco.
- Sugestões, conexões e mensagens exibem dados fictícios e não gravam alterações no banco; sua integração fica para as próximas sprints.
- O arquivo `banco/zuno.sql` é um rascunho preliminar e precisa ser conferido com o modelo oficial da disciplina antes de ser usado como banco definitivo.
- A fonte visual pode depender de conexão com a internet para carregar as fontes do Google Fonts; o restante da interface funciona localmente.
