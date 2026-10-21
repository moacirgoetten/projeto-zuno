# Projeto Zuno — Sprint 3

Interface navegável com cadastro, autenticação e perfil em PHP/MariaDB. Sugestões, conexões e mensagens continuam demonstrativos.

## Estrutura

- `index.html` — login, cadastro, sugestões, perfil, conexões e mensagens.
- `css/style.css` — estilos e responsividade.
- `js/script.js` — navegação e interações demonstrativas.
- `banco/zuno.sql` — script SQL preliminar para desenvolvimento.
- `api/auth.php` — cadastro, login, sessão, saída, edição do próprio perfil e catálogo de universidades/cursos/interesses.
- `config/database.example.php` — modelo de configuração local (sem credenciais).

## Como executar no XAMPP

1. Inicie Apache e MySQL/MariaDB pelo XAMPP.
2. Caso o banco ainda não exista, importe `banco/zuno.sql` pelo phpMyAdmin. Se ele já foi importado, não execute o script novamente: ele não é uma migração e não é idempotente.
3. Copie `config/database.example.php` para `config/database.local.php`. Preencha usuário e senha locais do MariaDB; confira host, porta `3307` e banco `zuno`. O arquivo local é ignorado pelo Git.
4. Copie os arquivos atualizados do projeto para `C:\xampp\htdocs\zuno_projeto_completo\`, incluindo `api/` e `config/`. Preserve sua configuração local ao atualizar a pasta.
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

7. Abra Meu perfil: nome, curso e universidade devem corresponder ao cadastro. Salve bio e interesses, altere o curso se desejar e recarregue: os dados devem permanecer salvos. Uma conta nova começa sem bio e sem interesses.

O cadastro valida formato de e-mail; não verifica vínculo universitário nem envia confirmação por e-mail. O servidor usa consultas preparadas, `password_hash`/`password_verify`, cookie HttpOnly/SameSite e renovação do identificador da sessão no login. A edição do perfil exige sessão e altera somente a conta conectada; os dados de perfil e interesses são gravados em uma transação. Futuras APIs de conexões e mensagens também precisam validar a sessão e as permissões no servidor.

## Observações importantes

- Cadastro grava usuário e consentimento na mesma transação; login usa a conta cadastrada e sessão PHP.
- Meu perfil exibe os dados da conta conectada e permite salvar bio, curso, universidade e interesses no banco.
- Sugestões, conexões e mensagens exibem dados fictícios e não gravam alterações no banco; sua integração fica para as próximas sprints.
- O arquivo `banco/zuno.sql` é um rascunho preliminar e precisa ser conferido com o modelo oficial da disciplina antes de ser usado como banco definitivo.
- A fonte visual pode depender de conexão com a internet para carregar as fontes do Google Fonts; o restante da interface funciona localmente.
