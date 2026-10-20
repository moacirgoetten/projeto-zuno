// Navegação entre as telas do Zuno
function showScreen(id) {
    const appIds = ['sugestoes-screen', 'perfil-screen', 'conexoes-screen', 'mensagens-screen'];

    document.querySelectorAll('body > .screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const authOrApp = appIds.includes(id) ? 'app-screen' : id;
    const parent = document.getElementById(authOrApp);
    if (parent) parent.classList.add('active');

    if (appIds.includes(id)) {
        document.querySelectorAll('#app-screen .main-content > .screen').forEach(screen => {
            screen.classList.toggle('active', screen.id === id);
        });
        document.querySelectorAll('.sidebar nav button').forEach(button => {
            button.classList.toggle('active', button.dataset.screen === id);
        });
    }

    window.scrollTo(0, 0);
}

// Links e botões de navegação
document.addEventListener('click', event => {
    const nav = event.target.closest('[data-screen]');
    if (nav) {
        event.preventDefault();
        showScreen(nav.dataset.screen);
    }
});

// Formulário de login (demonstração, sem autenticação real)
document.getElementById('login-form').addEventListener('submit', event => {
    event.preventDefault();
    document.getElementById('login-feedback').textContent =
        'Prévia: autenticação real será implementada na Semana 3.';
    showScreen('sugestoes-screen');
});

// Formulário de cadastro (demonstração)
document.getElementById('signup-form').addEventListener('submit', event => {
    event.preventDefault();
    document.getElementById('signup-feedback').textContent =
        'Cadastro validado na interface! O salvamento real será implementado na Semana 3.';
});

// Edição do perfil (demonstração)
document.getElementById('profile-form').addEventListener('submit', event => {
    event.preventDefault();
    document.getElementById('profile-feedback').textContent =
        'Alterações exibidas apenas nesta demonstração; o banco será conectado depois.';
});

// Seleção de interesses
document.querySelectorAll('.chips.selectable .chip').forEach(chip => {
    chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
    });
});

// Busca e filtro de pessoas
function filterPeople() {
    const term = document.getElementById('people-search').value.trim().toLocaleLowerCase('pt-BR');
    const interest = document.getElementById('interest-filter').value;
    let shown = 0;

    document.querySelectorAll('.person-card').forEach(card => {
        const text = (card.dataset.name + ' ' + card.dataset.interests + ' ' + card.innerText)
            .toLocaleLowerCase('pt-BR');
        const matches = text.includes(term) &&
            (!interest || card.dataset.interests.split(' ').includes(interest));

        card.hidden = !matches;
        if (matches) shown++;
    });

    document.getElementById('empty-state').hidden = shown !== 0;
}

document.getElementById('people-search').addEventListener('input', filterPeople);
document.getElementById('interest-filter').addEventListener('change', filterPeople);

// Envio de solicitação de conexão (demonstração)
document.querySelectorAll('.connect-btn').forEach(button => {
    button.addEventListener('click', () => {
        button.textContent = 'Solicitação enviada ✓';
        button.disabled = true;
        button.classList.remove('primary');
        button.classList.add('outline');
    });
});

// Aceitar ou recusar solicitação (demonstração)
document.querySelectorAll('.request-action').forEach(button => {
    button.addEventListener('click', () => {
        document.getElementById('request-row').remove();
        document.getElementById('request-feedback').textContent =
            button.textContent === 'Aceitar'
                ? 'Solicitação aceita na demonstração.'
                : 'Solicitação recusada na demonstração.';
    });
});

// Envio de mensagens no chat (somente na interface)
document.getElementById('message-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    const bubble = document.createElement('div');
    bubble.className = 'bubble sent';
    bubble.textContent = message;
    document.getElementById('chat-messages').appendChild(bubble);
    input.value = '';
    bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// Troca da pessoa selecionada no chat
document.querySelectorAll('.chat-person').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.chat-person').forEach(person => {
            person.classList.remove('active');
        });

        button.classList.add('active');
        const name = button.querySelector('b').textContent;
        document.getElementById('chat-name').textContent = name;
        document.getElementById('chat-avatar').textContent = name
            .split(' ')
            .map(part => part[0])
            .slice(0, 2)
            .join('');
        document.getElementById('chat-messages').innerHTML =
            '<div class="bubble received">Olá! Que bom ter você por aqui. Vamos conversar sobre nossos interesses em comum? 😊</div>';
    });
});
