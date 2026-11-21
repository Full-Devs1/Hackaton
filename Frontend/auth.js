'use strict';

const API_BASE_URL = 'https://ecoconecta-backend-n4n2.onrender.com';
const STORAGE_KEY = 'ecoconecta_sesion';

const $ = (id) => document.getElementById(id);
const loginTab = $('login-tab');
const registerTab = $('register-tab');

function switchTab(tab) {
  const login = tab === 'login';
  loginTab.classList.toggle('active', login);
  registerTab.classList.toggle('active', !login);
  loginTab.setAttribute('aria-selected', String(login));
  registerTab.setAttribute('aria-selected', String(!login));
  $('login-form').hidden = !login;
  $('register-form').hidden = login;
}

function showAdmin(show) {
  $('citizen-view').hidden = show;
  $('admin-view').hidden = !show;
  history.replaceState(null, '', show ? '#administrador' : '#inicio');
  if (show) $('admin-email').focus({ preventScroll: true });
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function setError(id, message = '') {
  const field = $(id);
  if (field) field.classList.toggle('invalid', Boolean(message));
  const output = $(`${id}-error`);
  if (output) output.textContent = message;
  return !message;
}

function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('show'), 4200);
}

function guardarSesion(data) {
  const payload = JSON.stringify(data);
  sessionStorage.setItem(STORAGE_KEY, payload);
  localStorage.setItem(STORAGE_KEY, payload);
}

async function enviarAuth(endpoint, payload) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let mensaje = 'No se pudo completar la operación.';
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      mensaje = data.detail.map((err) => err.msg || 'Campo inválido').join(' · ');
    } else if (typeof data.detail === 'string') {
      mensaje = data.detail;
    } else if (typeof data.message === 'string') {
      mensaje = data.message;
    }
    throw new Error(mensaje);
  }
  return data;
}

loginTab.addEventListener('click', () => switchTab('login'));
registerTab.addEventListener('click', () => switchTab('register'));
$('go-register').addEventListener('click', () => switchTab('register'));
$('go-login').addEventListener('click', () => switchTab('login'));
$('admin-link').addEventListener('click', (event) => {
  event.preventDefault();
  showAdmin(true);
});
$('back-user').addEventListener('click', () => showAdmin(false));

document.querySelectorAll('[data-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $(button.dataset.toggle);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    document
      .querySelectorAll(`[data-toggle="${button.dataset.toggle}"]`)
      .forEach((peer) => {
        peer.textContent = show ? 'Ocultar' : 'Mostrar';
      });
  });
});

document.querySelectorAll('input, select').forEach((field) => {
  field.addEventListener('input', () => {
    if ($(`${field.id}-error`)) setError(field.id, '');
  });
  field.addEventListener('change', () => {
    if ($(`${field.id}-error`)) setError(field.id, '');
  });
});

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('login-email').value.trim();
  const password = $('login-password').value;

  let valid = setError('login-email', emailIsValid(email) ? '' : 'Escribe un correo electrónico válido.');
  valid = setError('login-password', password.length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres.') && valid;
  if (!valid) return;

  try {
    const data = await enviarAuth('/api/auth/login', { email, password });
    guardarSesion({ ...data, tipo_acceso: 'usuario' });
    setTimeout(() => {
      window.location.href = 'usuario.html';
    }, 500);
    notify(`Bienvenido, ${data.usuario?.nombre || 'usuario'}.`);
  } catch (err) {
    setError('login-password', err.message);
    notify(err.message);
  }
});

$('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const password = $('reg-password').value;
  const confirm = $('reg-confirm').value;

  let valid = setError('reg-name', name.length >= 3 ? '' : 'Escribe tu nombre completo.');
  valid = setError('reg-email', emailIsValid(email) ? '' : 'Escribe un correo electrónico válido.') && valid;
  valid = setError('reg-password', password.length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres.') && valid;
  valid = setError('reg-confirm', confirm && confirm === password ? '' : 'Las contraseñas no coinciden.') && valid;
  $('terms-error').textContent = $('terms').checked ? '' : 'Debes aceptar el tratamiento de datos para continuar.';
  valid = $('terms').checked && valid;
  if (!valid) return;

  try {
    const data = await enviarAuth('/api/auth/register', {
      nombre: name,
      email,
      password,
    });
    guardarSesion({ ...data, tipo_acceso: 'usuario' });
    setTimeout(() => {
      window.location.href = 'usuario.html';
    }, 500);
    notify(`Cuenta creada para ${data.usuario?.nombre || name}.`);
  } catch (err) {
    setError('reg-email', err.message);
    notify(err.message);
  }
});

$('admin-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('admin-email').value.trim();
  const password = $('admin-password').value;

  let valid = setError('admin-email', emailIsValid(email) ? '' : 'Escribe un correo administrativo válido.');
  valid = setError('admin-password', password.length >= 8 ? '' : 'Ingresa una contraseña válida.') && valid;
  if (!valid) return;

  try{
    const data = await enviarAuth('/api/auth/admin/login', { email, password });
    guardarSesion({ ...data, tipo_acceso: 'administrador' });
    notify(`Sesión administrativa iniciada: ${data.administrador?.nombre || 'Admin'}.`);
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 650);
  }catch (err) {
    setError('admin-password', err.message);
    notify(err.message);
  }
});

if (location.hash === '#administrador') showAdmin(true);