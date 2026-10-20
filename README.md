# Projeto Zuno — Semanas 1 e 2

Protótipo navegável com todas as telas em um único arquivo HTML e arquivos separados de CSS e JavaScript.

## Estrutura

- `index.html` — login, cadastro, sugestões, perfil, conexões e mensagens.
- `css/style.css` — estilos e responsividade.
- `js/script.js` — navegação e interações demonstrativas.
- `banco/zuno.sql` — script SQL preliminar para desenvolvimento.

## Como executar no XAMPP

1. Copie a pasta `zuno_projeto_completo` para `C:\xampp\htdocs\`.
2. Abra o XAMPP Control Panel e inicie o Apache.
3. Acesse `http://localhost/zuno_projeto_completo/`.

Também é possível abrir o `index.html` diretamente no navegador, mas usar o XAMPP deixa a estrutura pronta para a próxima etapa.

## Observações importantes

- Este é um protótipo de interface: login, cadastro, perfil e mensagens ainda não gravam dados em banco.
- Os dados exibidos nas telas são fictícios, usados apenas para demonstrar o layout.
- O arquivo `banco/zuno.sql` é um rascunho preliminar e precisa ser conferido com o modelo oficial da disciplina antes de ser usado como banco definitivo.
- A fonte visual pode depender de conexão com a internet para carregar as fontes do Google Fonts; o restante da interface funciona localmente.
