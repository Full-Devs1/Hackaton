'use strict';

const SUPABASE_URL = 'https://bqhucmjjhuakmwbbhdky.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KqWrGVVJWd0lu9W7PDXoKw_1fL5D04a';
const BUCKET_NAME = 'imagenes-peticiones';
const API_BASE_URL = 'https://ecoconecta-backend-n4n2.onrender.comhttp://127.0.0.1:8000';
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
                <span>${escaparHtml(formatearFecha(p.fecha_peticion))}</span>
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

async function subirImagenASupabase(file) {
  if (!SUPABASE_URL.startsWith('https://') || !SUPABASE_ANON_KEY) {
    throw new Error('Configura SUPABASE_URL y SUPABASE_ANON_KEY en usuario.js para subir archivos.');
  }

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const nombreArchivo = `peticiones/usu_${usuarioActual.id_usuario}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${extension || 'jpg'}`;

  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${nombreArchivo}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Error al subir imagen a Storage (${uploadRes.status}): ${errText || 'verifica el bucket y políticas'}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${nombreArchivo}`;
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
    let urlFinal = urlImagen;
    const archivo = $('archivoImagen')?.files?.[0];

    if (archivo) {
      if (archivo.size > 5 * 1024 * 1024) {
        $('urlImagen-error').textContent = 'La imagen no debe superar los 5 MB.';
        return;
      }
      urlFinal = await subirImagenASupabase(archivo);
    }

    const res = await fetch(`${API_BASE_URL}/api/peticiones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_usuario: usuarioActual.id_usuario,
        etiqueta,
        direccion,
        url_imagen: urlFinal || null,
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