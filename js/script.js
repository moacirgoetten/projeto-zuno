let authenticatedUser = null;
let csrfToken = '';
let catalogCourses = [];
let catalogUniversities = [];
let catalogInterests = [];

async function api(action, data, endpoint = 'auth') {
    const isForm = data instanceof FormData;
    const response = await fetch(`api/${endpoint}.php?action=${action}`, {
        method: data === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: data === undefined ? {} : isForm ? { 'X-CSRF-Token': csrfToken } : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: data === undefined ? undefined : isForm ? data : JSON.stringify(data),
    });
    // Um erro do PHP fora do JSON não deve quebrar a interface.
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw new Error(result?.error || 'Não foi possível concluir a operação.');
    return result;
}

function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function renderAvatar(element, user, fallback = '') {
    element.replaceChildren();
    if (user?.foto) {
        const image = new Image();
        image.src = user.foto;
        image.alt = '';
        image.addEventListener('error', () => { element.textContent = initials(user.nome); });
        element.appendChild(image);
    } else {
        element.textContent = user ? initials(user.nome) : fallback;
    }
}

function updateIdentity(user) {
    if (user?.id !== authenticatedUser?.id) clearPeople();
    authenticatedUser = user;
    const identity = document.querySelector('.side-bottom');
    identity.querySelector('b').textContent = user ? user.nome : 'Meu espaço';
    identity.querySelector('small').textContent = user ? (user.curso || 'Conta conectada') : 'Desconectado';
    document.getElementById('photo-feedback').textContent = '';
    renderPhoto();
    renderProfile();
}

// Atualiza só a foto, sem descartar edições ainda não salvas do perfil
function renderPhoto() {
    const user = authenticatedUser;
    renderAvatar(document.querySelector('.side-bottom .avatar'), user, 'Z');
    renderAvatar(document.getElementById('profile-avatar'), user);
    document.getElementById('photo-choose').disabled = !user;
    document.getElementById('photo-remove').hidden = !user?.foto;
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

    if (id === 'sugestoes-screen') loadSuggestions();
    if (id === 'conexoes-screen') {
        document.getElementById('connections-feedback').textContent = '';
        loadConnections();
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
        const interestFilter = document.getElementById('interest-filter');
        catalog.interesses.forEach(item => interestFilter.add(new Option(item.nome, item.id)));
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

// Foto de perfil
async function changePhoto(request) {
    const feedback = document.getElementById('photo-feedback');
    const buttons = [document.getElementById('photo-choose'), document.getElementById('photo-remove')];
    buttons.forEach(button => { button.disabled = true; });
    feedback.textContent = 'Salvando foto...';
    try {
        const result = await request();
        authenticatedUser = result.user;
        renderPhoto();
        feedback.textContent = result.user.foto ? 'Foto atualizada!' : 'Foto removida.';
    } catch (error) { feedback.textContent = error.message; }
    finally { buttons.forEach(button => { button.disabled = !authenticatedUser; }); }
}

document.getElementById('photo-choose').addEventListener('click', () => document.getElementById('photo-input').click());

document.getElementById('photo-input').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        document.getElementById('photo-feedback').textContent = 'Envie uma imagem JPG, PNG ou WebP de até 2 MB.';
        return;
    }
    const form = new FormData();
    form.append('photo', file);
    changePhoto(() => api('photo', form));
});

document.getElementById('photo-remove').addEventListener('click', () => {
    if (confirm('Remover sua foto de perfil?')) changePhoto(() => api('photo_remove', {}));
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
    const cards = document.querySelectorAll('.person-card');
    let shown = 0;

    cards.forEach(card => {
        const matches = card.dataset.search.includes(term) &&
            (!interest || card.dataset.interests.split(' ').includes(interest));

        card.hidden = !matches;
        if (matches) shown++;
    });

    const empty = document.getElementById('empty-state');
    empty.textContent = cards.length
        ? 'Nenhuma pessoa encontrada com esse filtro.'
        : 'Ainda não há novas sugestões na sua universidade. Volte mais tarde!';
    empty.hidden = shown !== 0;
}

document.getElementById('people-search').addEventListener('input', filterPeople);
document.getElementById('interest-filter').addEventListener('change', filterPeople);

// Sugestões e conexões vindas do banco
const AVATAR_COLORS = ['purple', 'peach', 'green'];

function connectionsApi(action, data) {
    return api(action, data, 'conexoes');
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function createAvatar(person) {
    const avatar = createElement('div', `avatar ${AVATAR_COLORS[person.id % AVATAR_COLORS.length]}`);
    renderAvatar(avatar, person);
    return avatar;
}

function createSuggestionCard(person) {
    const card = createElement('article', 'person-card');
    card.dataset.search = [person.nome, ...person.interesses.map(item => item.nome)].join(' ').toLocaleLowerCase('pt-BR');
    card.dataset.interests = person.interesses.map(item => item.id).join(' ');

    const match = person.em_comum > 0 ? `● ${person.em_comum} em comum` : person.mesmo_curso ? '● Mesmo curso' : '● Mesma universidade';
    const top = createElement('div', 'person-top');
    top.append(createAvatar(person), createElement('span', 'match', match));

    const chips = createElement('div', 'chips');
    const mine = authenticatedUser.interesses;
    person.interesses.forEach(item => {
        chips.appendChild(createElement('span', mine.includes(item.id) ? 'chip selected' : 'chip', item.nome));
    });

    const button = createElement('button', 'btn primary full connect-btn', 'Enviar conexão');
    button.dataset.id = person.id;
    card.append(top, createElement('h2', '', person.nome), createElement('p', 'muted', person.curso),
        createElement('p', 'person-bio', person.bio || 'Esta pessoa ainda não escreveu uma bio.'), chips, button);
    return card;
}

async function loadSuggestions() {
    const userId = authenticatedUser?.id;
    const feedback = document.getElementById('suggestions-feedback');
    feedback.textContent = '';
    try {
        const result = await connectionsApi('suggestions');
        if (authenticatedUser?.id !== userId) return;
        document.getElementById('people-grid').replaceChildren(...result.sugestoes.map(createSuggestionCard));
        filterPeople();
    } catch (error) {
        if (authenticatedUser?.id === userId) feedback.textContent = error.message;
    }
}

document.getElementById('people-grid').addEventListener('click', async event => {
    const button = event.target.closest('.connect-btn');
    if (!button) return;
    const feedback = document.getElementById('suggestions-feedback');
    button.disabled = true;
    feedback.textContent = '';
    try {
        await connectionsApi('request', { id: Number(button.dataset.id) });
        button.textContent = 'Solicitação enviada ✓';
        button.classList.remove('primary');
        button.classList.add('outline');
    } catch (error) {
        feedback.textContent = error.message;
        button.disabled = false;
    }
});

function createButton(label, style, dataset) {
    const button = createElement('button', `btn ${style}`, label);
    button.type = 'button';
    Object.assign(button.dataset, dataset);
    return button;
}

function createConnectionRow(person, buttons) {
    const row = createElement('div', 'connection-row');
    const info = createElement('div', 'grow');
    const interests = person.interesses.slice(0, 3).map(item => item.nome).join(' · ');
    info.append(createElement('b', '', person.nome), createElement('p', 'muted', interests || person.curso || ''));
    const actions = createElement('div', 'button-pair');
    actions.append(...buttons);
    row.append(createAvatar(person), info, actions);
    return row;
}

function renderConnectionList(listId, countId, items, countLabel, emptyText, createButtons) {
    const list = document.getElementById(listId);
    list.replaceChildren(...(items.length
        ? items.map(item => createConnectionRow(item.usuario, createButtons(item)))
        : [createElement('p', 'muted small-text', emptyText)]));
    document.getElementById(countId).textContent = countLabel(items.length);
}

function connectionAction(action, item) {
    return { connectionAction: action, id: item.id, name: item.usuario.nome };
}

async function loadConnections() {
    const userId = authenticatedUser?.id;
    try {
        const result = await connectionsApi('list');
        if (authenticatedUser?.id !== userId) return;
        renderConnectionList('received-list', 'received-count', result.recebidas,
            total => `${total} ${total === 1 ? 'nova' : 'novas'}`, 'Nenhuma solicitação aguardando sua resposta.',
            item => [createButton('Aceitar', 'primary', connectionAction('accept', item)),
                createButton('Recusar', 'outline', connectionAction('decline', item))]);
        renderConnectionList('accepted-list', 'accepted-count', result.conexoes,
            total => `${total} ${total === 1 ? 'pessoa' : 'pessoas'}`, 'Você ainda não tem conexões. Comece pelas sugestões!',
            item => [createButton('Mensagem', 'outline', { screen: 'mensagens-screen' }),
                createButton('Remover', 'outline', connectionAction('remove', item))]);
        renderConnectionList('sent-list', 'sent-count', result.enviadas,
            total => `${total} ${total === 1 ? 'enviada' : 'enviadas'}`, 'Nenhuma solicitação aguardando resposta.',
            item => [createButton('Cancelar', 'outline', connectionAction('remove', item))]);
    } catch (error) {
        if (authenticatedUser?.id === userId) document.getElementById('connections-feedback').textContent = error.message;
    }
}

function clearPeople() {
    ['people-grid', 'received-list', 'accepted-list', 'sent-list'].forEach(id => document.getElementById(id).replaceChildren());
    ['received-count', 'accepted-count', 'sent-count'].forEach(id => { document.getElementById(id).textContent = ''; });
    document.getElementById('empty-state').hidden = true;
}

const CONNECTION_MESSAGES = {
    accept: { done: name => `Agora você e ${name} estão conectados.` },
    decline: { ask: name => `Recusar a solicitação de ${name}? Essa pessoa não voltará às suas sugestões.`, done: name => `Solicitação de ${name} recusada.` },
    remove: { ask: name => `Remover ou cancelar o vínculo com ${name}?`, done: name => `Vínculo com ${name} encerrado.` },
};

document.getElementById('conexoes-screen').addEventListener('click', async event => {
    const button = event.target.closest('[data-connection-action]');
    if (!button) return;
    const { connectionAction: action, id, name } = button.dataset;
    const messages = CONNECTION_MESSAGES[action];
    if (messages.ask && !confirm(messages.ask(name))) return;
    const feedback = document.getElementById('connections-feedback');
    button.disabled = true;
    try {
        await connectionsApi(action, { id: Number(id) });
        feedback.textContent = messages.done(name);
        await loadConnections();
    } catch (error) {
        feedback.textContent = error.message;
        button.disabled = false;
    }
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
