'use strict';

const API_BASE_URL = 'http://127.0.0.1:8000';
const STORAGE_KEY = 'ecoconecta_sesion';

const $ = (id) => document.getElementById(id);
const loginTab = $('login-tab');
const registerTab = $('register-tab');

function showUserForm(which) {
  const isLogin = which === 'login';
  loginTab.classList.toggle('active', isLogin);
  registerTab.classList.toggle('active', !isLogin);
  loginTab.setAttribute('aria-selected', String(isLogin));
  registerTab.setAttribute('aria-selected', String(!isLogin));
  $('login-panel').hidden = !isLogin;
  $('register-panel').hidden = isLogin;
}

function showAdmin(show) {
  $('user-view').hidden = show;
  $('admin-view').hidden = !show;
  history.replaceState(null, '', show ? '#administrador' : '#acceso');
  if (show) $('admin-email').focus({ preventScroll: true });
}

function setError(id, message = '') {
  const input = $(id);
  if (input) input.classList.toggle('invalid', Boolean(message));
  const target = $(`${id}-error`);
  if (target) target.textContent = message;
  return !message;
}

function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3600);
}

function guardarSesion(data, persistente = true) {
  const payload = JSON.stringify(data);
  sessionStorage.setItem(STORAGE_KEY, payload);
  if (persistente) {
    localStorage.setItem(STORAGE_KEY, payload);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function enviarAuth(endpoint, payload) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'No se pudo completar la operación.');
  }
  return data;
}

loginTab.addEventListener('click', () => showUserForm('login'));
registerTab.addEventListener('click', () => showUserForm('register'));
$('go-register').addEventListener('click', () => showUserForm('register'));
$('go-login').addEventListener('click', () => showUserForm('login'));
$('admin-link').addEventListener('click', (event) => {
  event.preventDefault();
  showAdmin(true);
});
$('back-user').addEventListener('click', () => showAdmin(false));

document.querySelectorAll('[data-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $(button.dataset.toggle);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});

document.querySelectorAll('.field input').forEach((input) => {
  input.addEventListener('input', () => {
    if (input.id && $(`${input.id}-error`)) setError(input.id, '');
  });
});

$('login-panel').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  const recordar = $('remember')?.checked ?? false;

  let ok = setError('login-email', emailValid(email) ? '' : 'Escribe un correo electrónico válido.');
  ok = setError('login-password', password.length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres.') && ok;
  if (!ok) return;

  try {
    const data = await enviarAuth('/api/auth/login', { email, password });
    guardarSesion({ ...data, tipo_acceso: 'usuario' }, recordar);
    toast(`Bienvenido, ${data.usuario?.nombre || 'usuario'}.`);
  } catch (err) {
    setError('login-password', err.message);
    toast(err.message);
  }
});

$('register-panel').addEventListener('submit', async (event) => {
  event.preventDefault();
  const nombre = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const telefono = $('reg-phone').value.trim();
  const password = $('reg-password').value;
  const confirm = $('reg-confirm').value;
  const acepto = $('terms').checked;

  let ok = setError('reg-name', nombre.length >= 3 ? '' : 'Escribe tu nombre completo.');
  ok = setError('reg-email', emailValid(email) ? '' : 'Escribe un correo válido.') && ok;
  ok = setError('reg-phone', telefono.replace(/\D/g, '').length >= 7 ? '' : 'Escribe un número de celular válido.') && ok;
  ok = setError('reg-password', password.length >= 8 ? '' : 'Usa al menos 8 caracteres.') && ok;
  ok = setError('reg-confirm', confirm && confirm === password ? '' : 'Las contraseñas no coinciden.') && ok;
  $('terms-error').textContent = acepto ? '' : 'Debes aceptar el tratamiento de datos para continuar.';
  ok = acepto && ok;
  if (!ok) return;

  try {
    const data = await enviarAuth('/api/auth/register', { nombre, email, telefono, password });
    guardarSesion({ ...data, tipo_acceso: 'usuario' }, true);
    toast(`Cuenta creada para ${data.usuario?.nombre || nombre}.`);
  } catch (err) {
    setError('reg-email', err.message);
    toast(err.message);
  }
});

$('admin-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('admin-email').value.trim();
  const password = $('admin-password').value;

  let ok = setError('admin-email', emailValid(email) ? '' : 'Escribe un correo válido.');
  ok = setError('admin-password', password.length >= 8 ? '' : 'Ingresa una contraseña de al menos 8 caracteres.') && ok;
  if (!ok) return;

  try {
    const data = await enviarAuth('/api/auth/admin/login', { email, password });
    guardarSesion({ ...data, tipo_acceso: 'administrador' }, false);
    toast(`Sesión administrativa iniciada: ${data.administrador?.nombre || 'Admin'}.`);
  } catch (err) {
    setError('admin-password', err.message);
    toast(err.message);
  }
});

$('forgot-link').addEventListener('click', () => {
  toast('La recuperación de contraseña se habilitará al conectar el servicio de correo.');
});

if (location.hash === '#administrador') showAdmin(true);