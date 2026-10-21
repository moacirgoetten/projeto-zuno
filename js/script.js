let authenticatedUser = null;
let csrfToken = '';
let catalogCourses = [];
let catalogUniversities = [];
let catalogInterests = [];

async function api(action, data) {
    const response = await fetch(`api/auth.php?action=${action}`, {
        method: data === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: data === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: data === undefined ? undefined : JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
    return result;
}

function updateIdentity(user) {
    authenticatedUser = user;
    const identity = document.querySelector('.side-bottom');
    identity.querySelector('b').textContent = user ? user.nome : 'Meu espaço';
    identity.querySelector('small').textContent = user ? 'Conta conectada' : 'Desconectado';
    identity.querySelector('.avatar').textContent = user ? user.nome.split(/\s+/).slice(0, 2).map(part => part[0]).join('') : 'Z';
    renderProfile();
}

function populateProfileCourses(selected = '') {
    const select = document.getElementById('curso-perfil');
    select.replaceChildren(new Option('Selecione seu curso', ''));
    catalogCourses.filter(course => String(course.universidade_id) === document.getElementById('uni-perfil').value)
        .forEach(course => select.add(new Option(course.nome, course.id)));
    select.value = String(selected || '');
}

function renderProfile() {
    const user = authenticatedUser;
    document.getElementById('profile-name').textContent = user?.nome || '';
    document.getElementById('profile-avatar').textContent = user ? user.nome.split(/\s+/).slice(0, 2).map(part => part[0]).join('') : '';
    document.getElementById('profile-education').textContent = user ? [user.curso, user.universidade].filter(Boolean).join(' · ') : '';
    document.getElementById('profile-bio').textContent = user ? (user.bio || 'Conte um pouco sobre você na sua bio.') : '';
    document.getElementById('bio').value = user?.bio || '';
    const universities = document.getElementById('uni-perfil');
    universities.replaceChildren(new Option('Selecione sua universidade', ''));
    catalogUniversities.forEach(item => universities.add(new Option(item.nome, item.id)));
    universities.value = String(user?.universidade_id || '');
    populateProfileCourses(user?.curso_id);
    const chips = document.getElementById('profile-interests');
    chips.replaceChildren();
    catalogInterests.forEach(interest => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.dataset.id = interest.id;
        chip.textContent = interest.nome;
        const selected = (user?.interesses || []).includes(Number(interest.id));
        chip.classList.toggle('selected', selected);
        chip.setAttribute('aria-pressed', String(selected));
        chips.appendChild(chip);
    });
    document.getElementById('profile-feedback').textContent = '';
    document.querySelector('#profile-form button[type="submit"]').disabled = !user || !catalogCourses.length;
}

document.getElementById('uni-perfil').addEventListener('change', () => populateProfileCourses());

// Navegação entre as telas do Zuno
function showScreen(id) {
    const appIds = ['sugestoes-screen', 'perfil-screen', 'conexoes-screen', 'mensagens-screen'];
    if (appIds.includes(id) && !authenticatedUser) id = 'login-screen';

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
document.addEventListener('click', async event => {
    const nav = event.target.closest('[data-screen]');
    if (nav) {
        event.preventDefault();
        if (nav.dataset.screen === 'login-screen' && authenticatedUser) {
            try {
                await api('logout', {});
                updateIdentity(null);
                const session = await api('session');
                csrfToken = session.csrf;
            } catch (error) {
                alert(error.message);
                return;
            }
        }
        showScreen(nav.dataset.screen);
    }
});

// Autenticação real com sessão PHP
document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    button.disabled = true;
    const feedback = document.getElementById('login-feedback');
    feedback.textContent = 'Entrando...';
    try {
        const result = await api('login', { email: document.getElementById('email').value, password: document.getElementById('senha').value });
        csrfToken = result.csrf;
        updateIdentity(result.user);
        event.target.reset();
        feedback.textContent = '';
        showScreen('sugestoes-screen');
    } catch (error) {
        feedback.textContent = error.message;
    } finally { button.disabled = false; }
});

document.getElementById('signup-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    button.disabled = true;
    const feedback = document.getElementById('signup-feedback');
    feedback.textContent = 'Criando conta...';
    try {
        await api('signup', {
            name: document.getElementById('nome').value,
            email: document.getElementById('email-cadastro').value,
            password: document.getElementById('senha-cadastro').value,
            university_id: document.getElementById('universidade').value,
            course_id: document.getElementById('curso').value,
            consent: document.getElementById('consentimento').checked,
        });
        event.target.reset();
        populateCourses();
        feedback.textContent = '';
        document.getElementById('login-feedback').textContent = 'Conta criada! Entre com seu e-mail e senha.';
        showScreen('login-screen');
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
});

function populateCourses() {
    const select = document.getElementById('curso');
    select.replaceChildren(new Option('Selecione seu curso', ''));
    catalogCourses.filter(course => String(course.universidade_id) === document.getElementById('universidade').value)
        .forEach(course => select.add(new Option(course.nome, course.id)));
    select.disabled = select.options.length === 1;
}

document.getElementById('universidade').addEventListener('change', populateCourses);

async function initializeAuth() {
    document.querySelector('#login-form button[type="submit"]').disabled = true;
    document.querySelector('#signup-form button[type="submit"]').disabled = true;
    try {
        const session = await api('session');
        csrfToken = session.csrf;
        updateIdentity(session.user);
        if (session.user) showScreen('sugestoes-screen');
        document.querySelector('#login-form button[type="submit"]').disabled = false;
        const catalog = await api('catalog');
        catalogCourses = catalog.cursos;
        catalogUniversities = catalog.universidades;
        catalogInterests = catalog.interesses;
        renderProfile();
        const universities = document.getElementById('universidade');
        universities.replaceChildren(new Option('Selecione sua universidade', ''));
        catalog.universidades.forEach(item => universities.add(new Option(item.nome, item.id)));
        populateCourses();
        document.querySelector('#signup-form button[type="submit"]').disabled = false;
    } catch (error) {
        const message = location.protocol === 'file:' ? 'Abra o projeto pelo servidor PHP, conforme o README.' : error.message;
        document.getElementById('login-feedback').textContent = message;
        document.getElementById('signup-feedback').textContent = message;
    }
}

initializeAuth();

// Edição do perfil da conta conectada
document.getElementById('profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    button.disabled = true;
    const feedback = document.getElementById('profile-feedback');
    feedback.textContent = 'Salvando...';
    try {
        const result = await api('profile', {
            bio: document.getElementById('bio').value,
            course_id: document.getElementById('curso-perfil').value,
            university_id: document.getElementById('uni-perfil').value,
            interests: Array.from(document.querySelectorAll('#profile-interests .selected'), chip => Number(chip.dataset.id)),
        });
        updateIdentity(result.user);
        feedback.textContent = 'Perfil salvo!';
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
});

// Seleção de interesses
document.getElementById('profile-interests').addEventListener('click', event => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    chip.classList.toggle('selected');
    chip.setAttribute('aria-pressed', String(chip.classList.contains('selected')));
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
