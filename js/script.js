// Estado da aplicação
let me = null;           // usuário conectado (null = desconectado)
let csrf = '';           // token enviado em todo POST (proteção CSRF)
let catalog = { universidades: [], cursos: [], interesses: [] };
let people = [];         // sugestões carregadas
let connections = [];    // conexões e solicitações carregadas
let chatId = null;       // conexão da conversa aberta
let lastCount = -1;      // quantidade de mensagens já desenhadas

const $ = id => document.getElementById(id);
const active = id => $(id).classList.contains('active');

// Chama a API PHP. Sem dados é GET; com dados é POST com o token CSRF.
async function api(action, data, file = 'auth') {
    const form = data instanceof FormData;
    const response = await fetch(`api/${file}.php?action=${action}`, data === undefined ? {} : {
        method: 'POST',
        headers: form ? { 'X-CSRF-Token': csrf } : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: form ? data : JSON.stringify(data),
    });
    const result = await response.json().catch(() => null);
    if (response.status === 401 && me) { setUser(null); show('login-screen'); } // sessão expirou
    if (!response.ok || !result) throw new Error(result?.error || 'Não foi possível concluir a operação.');
    return result;
}
const social = (action, data) => api(action, data, 'social');

// Cria um elemento. textContent nunca interpreta HTML, o que impede XSS com dados de usuários.
function el(tag, cls = '', text = '', data = {}) {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    Object.assign(e.dataset, data);
    return e;
}

const initials = name => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

// Mostra a foto da pessoa ou, sem foto, as iniciais do nome.
function avatar(user, box = el('span', 'avatar')) {
    box.textContent = user ? initials(user.nome) : '';
    if (user?.foto) {
        const img = new Image();
        img.src = user.foto;
        img.alt = '';
        img.onerror = () => { box.textContent = initials(user.nome); };
        box.replaceChildren(img);
    }
    return box;
}

function fillSelect(select, items, placeholder, value = '') {
    select.replaceChildren(new Option(placeholder, ''), ...items.map(item => new Option(item.nome, item.id)));
    select.value = value ?? '';
}

// Só mostra os cursos da universidade escolhida.
function fillCourses(uni, course, value) {
    fillSelect(course, catalog.cursos.filter(c => String(c.universidade_id) === uni.value), 'Selecione seu curso', value);
}

// ---------- Navegação ----------
const appScreens = ['sugestoes-screen', 'perfil-screen', 'conexoes-screen', 'mensagens-screen', 'notificacoes-screen'];
const loaders = {
    'sugestoes-screen': () => loadPeople(),
    'perfil-screen': () => fillProfileForm(),
    'conexoes-screen': () => loadConnections(),
    'mensagens-screen': () => loadConnections(),
    'notificacoes-screen': () => loadNotifications(),
};

function show(id) {
    if (appScreens.includes(id) && !me) id = 'login-screen';
    const parent = appScreens.includes(id) ? 'app-screen' : id;
    document.querySelectorAll('body > .screen').forEach(s => s.classList.toggle('active', s.id === parent));
    document.querySelectorAll('.main-content > .screen').forEach(s => s.classList.toggle('active', s.id === id));
    document.querySelectorAll('.sidebar nav button').forEach(b => b.classList.toggle('active', b.dataset.screen === id));
    window.scrollTo(0, 0);
    // Cada tela busca dados atualizados do servidor ao ser aberta.
    if (loaders[id]) Promise.resolve(loaders[id]()).catch(error => alert(error.message));
}

// ---------- Conta ----------
function setUser(user) {
    me = user;
    if (!user) closeChat();
    $('side-name').textContent = user?.nome || '';
    $('side-course').textContent = user?.curso || '';
    avatar(user, $('side-avatar'));
    avatar(user, $('profile-avatar'));
    $('photo-remove').hidden = !user?.foto;
    $('profile-name').textContent = user?.nome || '';
    $('profile-education').textContent = user ? [user.curso, user.universidade].filter(Boolean).join(' · ') : '';
    $('profile-bio').textContent = user?.bio || 'Conte um pouco sobre você na sua bio.';
}

function fillProfileForm() {
    $('bio').value = me.bio || '';
    fillSelect($('uni-perfil'), catalog.universidades, 'Selecione sua universidade', me.universidade_id);
    fillCourses($('uni-perfil'), $('curso-perfil'), me.curso_id);
    $('profile-interests').replaceChildren(...catalog.interesses.map(i => {
        const chip = el('button', 'chip', i.nome, { id: i.id });
        chip.type = 'button';
        chip.classList.toggle('selected', me.interesses.includes(i.id));
        return chip;
    }));
    $('profile-feedback').textContent = '';
}

async function logout() {
    await api('logout', {});
    setUser(null);
    csrf = (await api('session')).csrf; // a sessão nova tem outro token
}

// Envia um formulário: desativa o botão, mostra o retorno e trata erros.
function onSubmit(formId, feedbackId, work) {
    $(formId).addEventListener('submit', async event => {
        event.preventDefault();
        const button = event.target.querySelector('button');
        button.disabled = true;
        $(feedbackId).textContent = 'Aguarde...';
        try { $(feedbackId).textContent = await work(event.target) || ''; }
        catch (error) { $(feedbackId).textContent = error.message; }
        finally { button.disabled = false; }
    });
}

onSubmit('login-form', 'login-feedback', async form => {
    const result = await api('login', { email: $('email').value, password: $('senha').value });
    csrf = result.csrf;
    setUser(result.user);
    form.reset();
    show('sugestoes-screen');
});

onSubmit('signup-form', 'signup-feedback', async form => {
    await api('signup', {
        name: $('nome').value, email: $('email-cadastro').value, password: $('senha-cadastro').value,
        university_id: $('universidade').value, course_id: $('curso').value, consent: $('consentimento').checked,
    });
    form.reset();
    fillCourses($('universidade'), $('curso'));
    $('login-feedback').textContent = 'Conta criada! Entre com seu e-mail e senha.';
    show('login-screen');
});

onSubmit('profile-form', 'profile-feedback', async () => {
    const result = await api('profile', {
        bio: $('bio').value, university_id: $('uni-perfil').value, course_id: $('curso-perfil').value,
        interests: [...document.querySelectorAll('#profile-interests .selected')].map(chip => Number(chip.dataset.id)),
    });
    setUser(result.user);
    fillProfileForm();
    return 'Perfil salvo!';
});

onSubmit('delete-form', 'delete-feedback', async form => {
    if (!confirm('Excluir sua conta para sempre? Isso não pode ser desfeito.')) return;
    await api('delete_account', { password: $('delete-password').value });
    form.reset();
    setUser(null);
    csrf = (await api('session')).csrf;
    $('login-feedback').textContent = 'Sua conta foi excluída.';
    show('login-screen');
});

$('profile-interests').addEventListener('click', e => e.target.closest('.chip')?.classList.toggle('selected'));
$('universidade').addEventListener('change', () => fillCourses($('universidade'), $('curso')));
$('uni-perfil').addEventListener('change', () => fillCourses($('uni-perfil'), $('curso-perfil')));

// ---------- Foto de perfil ----------
async function changePhoto(request) {
    $('photo-feedback').textContent = 'Salvando foto...';
    try {
        setUser((await request).user);
        $('photo-feedback').textContent = me.foto ? 'Foto atualizada!' : 'Foto removida.';
    } catch (error) { $('photo-feedback').textContent = error.message; }
}

$('photo-choose').addEventListener('click', () => $('photo-input').click());
$('photo-input').addEventListener('change', e => {
    const form = new FormData();
    if (!e.target.files[0]) return;
    form.append('photo', e.target.files[0]);
    e.target.value = '';
    changePhoto(api('photo', form));
});
$('photo-remove').addEventListener('click', () => confirm('Remover sua foto de perfil?') && changePhoto(api('photo_remove', {})));

// ---------- Sugestões (Sprint 5) ----------
async function loadPeople() {
    people = (await social('suggestions')).people;
    renderPeople();
}

// Busca e filtro acontecem no navegador, sobre a lista já carregada.
function renderPeople() {
    const term = $('people-search').value.trim().toLowerCase();
    const interest = $('interest-filter').value;
    const list = people.filter(p => [p.nome, p.curso, p.interesses].join(' ').toLowerCase().includes(term)
        && (!interest || (p.interesses || '').split(', ').includes(interest)));
    $('people-grid').replaceChildren(...list.map(personCard));
    $('empty-state').hidden = list.length > 0;
}

function chips(person) {
    const box = el('div', 'chips');
    box.append(...(person.interesses || '').split(', ').filter(Boolean).map(name => el('span', 'chip', name)));
    return box;
}

function personCard(p) {
    const card = el('article', 'person-card');
    const top = el('div', 'person-top');
    top.append(avatar(p), el('span', 'match', `● ${p.comuns} em comum`));
    card.append(top, el('h2', '', p.nome), el('p', 'muted', p.curso || ''), el('p', 'person-bio', p.bio || ''), chips(p),
        el('button', 'btn primary full', 'Enviar conexão', { act: 'connect', id: p.id }),
        el('button', 'btn outline full', 'Denunciar', { act: 'report', id: p.id }));
    return card;
}

$('people-search').addEventListener('input', renderPeople);
$('interest-filter').addEventListener('change', renderPeople);

// ---------- Conexões (Sprint 5) ----------
function row(c, ...buttons) {
    const line = el('div', 'connection-row');
    const info = el('div', 'grow');
    info.append(el('b', '', c.nome), el('p', 'muted', [c.curso, c.interesses].filter(Boolean).join(' · ')));
    const pair = el('div', 'button-pair');
    pair.append(...buttons);
    line.append(avatar(c), info, pair);
    return line;
}

const button = (text, act, id, cls = 'outline') => el('button', 'btn ' + cls, text, { act, id });

function fillList(id, items, make) {
    $(id).replaceChildren(...(items.length ? items.map(make) : [el('p', 'muted', 'Nada por aqui ainda.')]));
}

async function loadConnections() {
    connections = (await social('connections')).connections;
    const accepted = connections.filter(c => c.status === 'aceita');
    fillList('received-list', connections.filter(c => c.status === 'pendente' && !c.enviada),
        c => row(c, button('Aceitar', 'accept', c.conexao_id, 'primary'), button('Recusar', 'decline', c.conexao_id)));
    fillList('sent-list', connections.filter(c => c.status === 'pendente' && c.enviada),
        c => row(c, button('Cancelar', 'remove', c.conexao_id)));
    fillList('accepted-list', accepted, c => row(c, button('Mensagem', 'chat', c.conexao_id, 'primary'),
        button('Desfazer', 'remove', c.conexao_id), button('Denunciar', 'report', c.id)));
    fillList('chat-list', accepted, c => {
        const item = el('button', 'chat-person' + (c.conexao_id === chatId ? ' active' : ''), '', { act: 'chat', id: c.conexao_id });
        const text = el('span');
        text.append(el('b', '', c.nome + (c.nao_lidas ? ` (${c.nao_lidas})` : '')), el('small', '', c.ultima || 'Diga oi!'));
        item.append(avatar(c), text);
        return item;
    });
    if (chatId && !accepted.some(c => c.conexao_id === chatId)) closeChat(); // a conexão foi desfeita
}

// ---------- Mensagens (Sprint 6) ----------
function closeChat() {
    chatId = null;
    $('chat-name').textContent = 'Escolha uma conversa';
    avatar(null, $('chat-avatar'));
    $('chat-messages').replaceChildren();
    $('message-input').disabled = $('message-form').querySelector('button').disabled = true;
}

async function openChat(id) {
    chatId = id;
    lastCount = -1;
    const c = connections.find(c => c.conexao_id === id);
    $('chat-name').textContent = c.nome;
    avatar(c, $('chat-avatar'));
    $('message-input').disabled = $('message-form').querySelector('button').disabled = false;
    show('mensagens-screen');
    await loadMessages();
}

async function loadMessages() {
    const id = chatId;
    const { messages } = await social(`messages&id=${id}`);
    if (id !== chatId || messages.length === lastCount) return; // trocou de conversa ou nada novo
    lastCount = messages.length;
    const box = $('chat-messages');
    box.replaceChildren(...messages.map(m => el('div', m.minha ? 'bubble sent' : 'bubble received', m.conteudo)));
    box.scrollTop = box.scrollHeight;
}

$('message-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
        await social('send', { id: chatId, text: $('message-input').value });
        $('message-input').value = '';
        await loadMessages();
    } catch (error) { alert(error.message); }
});

// ---------- Notificações (Sprint 6) ----------
async function loadNotifications() {
    const { notifications } = await social('notifications');
    const unread = notifications.filter(n => !n.lida).length;
    $('notif-count').textContent = unread;
    $('notif-count').hidden = !unread;
    fillList('notif-list', notifications, n => {
        const line = el('p', n.lida ? 'muted' : '', n.mensagem);
        line.append(el('small', '', n.quando));
        return line;
    });
    // Abrir a tela de notificações marca todas como lidas.
    if (unread && active('notificacoes-screen')) {
        await social('read_notifications', {});
        $('notif-count').hidden = true;
    }
}

// ---------- Botões das listas (um só ouvinte para todos) ----------
// data-act diz a ação; data-id é o id da pessoa (connect/report) ou da conexão (demais).
const actions = {
    connect: async id => {
        await social('connect', { user_id: id });
        $('people-feedback').textContent = 'Solicitação enviada! Acompanhe em Conexões.';
        await loadPeople();
    },
    accept: id => social('answer', { id, accept: true }).then(loadConnections),
    decline: id => social('answer', { id, accept: false }).then(loadConnections),
    remove: id => confirm('Tem certeza? As mensagens desta conexão serão apagadas.') && social('remove', { id }).then(loadConnections),
    chat: id => openChat(id),
    report: async id => {
        const reason = prompt('Conte o motivo da denúncia. A pessoa também será bloqueada para você.');
        if (!reason) return;
        await social('report', { user_id: id, reason });
        alert('Denúncia registrada. Obrigado por ajudar a manter o Zuno seguro.');
        await Promise.all([loadPeople(), loadConnections()]);
    },
};

document.addEventListener('click', async event => {
    const nav = event.target.closest('[data-screen]');
    const act = event.target.closest('[data-act]');
    try {
        if (nav) {
            event.preventDefault();
            if (nav.dataset.screen === 'login-screen' && me) await logout();
            show(nav.dataset.screen);
        }
        if (act) await actions[act.dataset.act](Number(act.dataset.id));
    } catch (error) { alert(error.message); }
});

// ---------- Início ----------
async function init() {
    try {
        const session = await api('session');
        csrf = session.csrf;
        catalog = await api('catalog');
        fillSelect($('universidade'), catalog.universidades, 'Selecione sua universidade');
        fillCourses($('universidade'), $('curso'));
        fillSelect($('interest-filter'), catalog.interesses.map(i => ({ id: i.nome, nome: i.nome })), 'Todos os interesses');
        setUser(session.user);
        if (me) show('sugestoes-screen');
    } catch (error) {
        $('login-feedback').textContent = location.protocol === 'file:' ? 'Abra o projeto pelo servidor PHP, conforme o README.' : error.message;
    }
}

// A cada 5 segundos busca notificações e, na tela de mensagens, conversas novas.
setInterval(() => {
    if (!me) return;
    loadNotifications().catch(() => {});
    if (active('mensagens-screen')) loadConnections().then(() => chatId && loadMessages()).catch(() => {});
}, 5000);

closeChat();
init();
