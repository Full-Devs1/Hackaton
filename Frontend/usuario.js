'use strict';

const API_BASE_URL = 'http://127.0.0.1:8000';
const STORAGE_KEY = 'ecoconecta_sesion';

const $ = (id) => document.getElementById(id);

let usuarioActual = null;
let peticionesUsuario = [];
let filtroEstado = 'todas';

function obtenerSesionUsuario() {
  const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.tipo_acceso !== 'usuario' || !parsed.usuario?.id_usuario) return null;
    return parsed.usuario;
  } catch {
    return null;
  }
}

function mostrarToast(mensaje) {
  const toast = $('toast');
  toast.textContent = mensaje;
  toast.classList.add('show');
  clearTimeout(mostrarToast.timer);
  mostrarToast.timer = setTimeout(() => toast.classList.remove('show'), 3400);
}

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatearFecha(iso) {
  if (!iso) return 'Reciente';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function actualizarResumenUsuario() {
  const puntos = Number(usuarioActual?.puntos ?? 0);
  const completadas = peticionesUsuario.filter((p) => (p.estado || '').toLowerCase() === 'completada').length;

  $('accountName').textContent = usuarioActual.nombre || 'Vecino';
  $('accountEmail').textContent = usuarioActual.correo || '';
  $('menuUserName').textContent = usuarioActual.nombre || 'Vecino';
  $('menuUserEmail').textContent = usuarioActual.correo || '';
  $('welcomeTitle').textContent = `¡Hola, ${usuarioActual.nombre || 'vecino'}! Bienvenido a EcoConecta`;

  $('pointsValue').textContent = `${puntos.toLocaleString('es-CO')} pts`;
  $('completedCountValue').textContent = String(completadas);
  $('benefitsSummary').textContent = `Tienes ${puntos.toLocaleString('es-CO')} puntos acumulados en Villas de San Pablo.`;
}

async function refrescarPuntosUsuario() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/peticiones/usuario/${usuarioActual.id_usuario}`);
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.puntos === 'number') {
      usuarioActual.puntos = data.puntos;
      actualizarResumenUsuario();
    }
  } catch {
    // Mantiene los puntos de sesión si no existe aún el endpoint auxiliar
  }
}

async function cargarPeticiones() {
  const listEl = $('petitionList');
  const emptyEl = $('emptyState');

  try {
    const res = await fetch(`${API_BASE_URL}/api/peticiones?id_usuario=${usuarioActual.id_usuario}`);
    const data = await res.json().catch(() => ([]));
    if (!res.ok) throw new Error(data.detail || 'No se pudieron cargar las peticiones.');

    peticionesUsuario = Array.isArray(data) ? data : [];
    $('totalPill').textContent = `${peticionesUsuario.length} ${peticionesUsuario.length === 1 ? 'petición' : 'peticiones'}`;
    actualizarResumenUsuario();
    renderizarPeticiones();
  } catch (err) {
    listEl.innerHTML = '';
    emptyEl.classList.add('show');
    emptyEl.querySelector('b').textContent = 'No se pudieron cargar tus peticiones';
    emptyEl.querySelector('p').textContent = err.message;
  }
}

function renderizarPeticiones() {
  const listEl = $('petitionList');
  const emptyEl = $('emptyState');

  const visibles = filtroEstado === 'todas'
    ? peticionesUsuario
    : peticionesUsuario.filter((p) => (p.estado || 'pendiente').toLowerCase() === filtroEstado);

  if (!visibles.length) {
    listEl.innerHTML = '';
    emptyEl.classList.add('show');
    emptyEl.querySelector('b').textContent = 'No hay peticiones en esta categoría';
    emptyEl.querySelector('p').textContent = 'Cuando tengas solicitudes con este estado, aparecerán aquí.';
    return;
  }

  emptyEl.classList.remove('show');
  listEl.innerHTML = visibles
    .map((p) => {
      const esCompletada = (p.estado || '').toLowerCase() === 'completada';
      const estadoClase = esCompletada ? 'completed' : 'pending';
      const estadoTexto = esCompletada ? 'Completada' : 'Pendiente';
      const esOrganico = (p.etiqueta || '').toLowerCase().includes('org');
      const simbolo = esOrganico ? '🌱' : '♻';
      const imgUrl = Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes[0] : '';

      const thumbHtml = imgUrl
        ? `<img class="petition-thumb" src="${escaparHtml(imgUrl)}" alt="Imagen de petición #${p.id_peticion}" loading="lazy">`
        : `<span class="petition-symbol" aria-hidden="true">${simbolo}</span>`;

      return `
        <article class="petition">
          <div class="petition-main">
            ${thumbHtml}
            <div>
              <h3>Solicitud #${p.id_peticion} · ${escaparHtml(p.etiqueta)}</h3>
              <div class="petition-meta">
                <span>${escaparHtml(formatearFecha(p.fecha_creacion))}</span>
                <span>• Etiqueta: <strong>${escaparHtml(p.etiqueta)}</strong></span>
              </div>
              <p class="petition-address"><strong>Dirección:</strong> ${escaparHtml(p.direccion)}</p>
            </div>
          </div>
          <span class="status ${estadoClase}">${estadoTexto}</span>
        </article>
      `;
    })
    .join('');
}

function abrirModal(id) {
  $(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}

function cerrarModal(id) {
  $(id).classList.remove('show');
  if (!document.querySelector('.modal-bg.show')) {
    document.body.style.overflow = '';
  }
}

function inicializar() {
  usuarioActual = obtenerSesionUsuario();
  if (!usuarioActual) {
    window.location.replace('index.html');
    return;
  }

  actualizarResumenUsuario();
  cargarPeticiones();
  refrescarPuntosUsuario();

  const accountBtn = $('accountBtn');
  const accountMenu = $('accountMenu');
  accountBtn.addEventListener('click', () => {
    const abierto = accountMenu.classList.toggle('open');
    accountBtn.setAttribute('aria-expanded', String(abierto));
  });

  document.addEventListener('click', (e) => {
    if (!$('accountWrap').contains(e.target)) {
      accountMenu.classList.remove('open');
      accountBtn.setAttribute('aria-expanded', 'false');
    }
  });

  $('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    window.location.replace('index.html');
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => cerrarModal(btn.dataset.close));
  });

  $('redeemBtn').addEventListener('click', () => abrirModal('benefitsModal'));
  $('newPetitionBtn').addEventListener('click', () => abrirModal('requestModal'));
  $('refreshBtn').addEventListener('click', async () => {
    await refrescarPuntosUsuario();
    await cargarPeticiones();
    mostrarToast('Información actualizada.');
  });

  document.querySelectorAll('.filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      filtroEstado = btn.dataset.filter;
      document.querySelectorAll('.filter').forEach((b) => b.classList.toggle('active-filter', b === btn));
      renderizarPeticiones();
    });
  });

  $('requestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const etiqueta = $('etiqueta').value.trim();
    const direccion = $('direccion').value.trim();
    const urlImagen = $('urlImagen').value.trim();

    $('etiqueta-error').textContent = etiqueta ? '' : 'Selecciona el tipo de residuo.';
    $('direccion-error').textContent = direccion.length >= 4 ? '' : 'Escribe la dirección de recolección.';
    $('urlImagen-error').textContent = '';

    if (urlImagen) {
      try {
        const parsed = new URL(urlImagen);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          $('urlImagen-error').textContent = 'La URL debe comenzar con http:// o https://.';
          return;
        }
      } catch {
        $('urlImagen-error').textContent = 'Ingresa una URL válida.';
        return;
      }
    }

    if (!etiqueta || direccion.length < 4) return;

    const btnSubmit = $('submitPetitionBtn');
    btnSubmit.disabled = true;

    try {
      const res = await fetch(`${API_BASE_URL}/api/peticiones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: usuarioActual.id_usuario,
          etiqueta,
          direccion,
          url_imagen: urlImagen || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'No se pudo registrar la petición.');

      $('requestForm').reset();
      cerrarModal('requestModal');
      mostrarToast('Petición registrada correctamente.');
      await cargarPeticiones();
    } catch (err) {
      $('urlImagen-error').textContent = err.message;
      mostrarToast(err.message);
    } finally {
      btnSubmit.disabled = false;
    }
  });
}

inicializar();