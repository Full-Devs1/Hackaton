'use strict';

const API_BASE_URL = 'http://127.0.0.1:8000';
const STORAGE_KEY = 'ecoconecta_sesion';

const $ = (id) => document.getElementById(id);

let adminActual = null;
let peticionesAbiertas = false;
let estadoFiltro = '';
let recolectoresCache = [];
let peticionesCache = [];
let peticionSeleccionadaId = null;

function abrirDetallePeticion(idPeticion) {
  const pet = peticionesCache.find((item) => Number(item.id_peticion) === Number(idPeticion));
  if (!pet) return;

  peticionSeleccionadaId = pet.id_peticion;
  const etiquetaNormalizada = (pet.etiqueta || '').toLowerCase();
  const imgUrl = Array.isArray(pet.imagenes) && pet.imagenes.length ? pet.imagenes[0] : '';

  $('detail-etiqueta-badge').textContent = etiquetaNormalizada || 'Sin etiqueta';
  $('detail-direccion').textContent = pet.direccion || 'No especificada';
  $('detail-estado').textContent = pet.estado || 'pendiente';
  $('detail-nueva-etiqueta').value = etiquetaNormalizada === 'reciclable' ? 'reciclable' : 'organico';

  const imgEl = $('detail-imagen-img');
  const sinImgEl = $('detail-sin-imagen');

  if (imgUrl) {
    imgEl.src = imgUrl;
    imgEl.hidden = false;
    sinImgEl.hidden = true;
    imgEl.onerror = () => {
      imgEl.hidden = true;
      sinImgEl.hidden = false;
      sinImgEl.textContent = 'No se pudo cargar la imagen desde la URL.';
    };
  } else {
    imgEl.removeAttribute('src');
    imgEl.hidden = true;
    sinImgEl.hidden = false;
    sinImgEl.textContent = 'Esta petición no tiene imagen adjunta.';
  }

  const modal = $('petition-detail-modal');
  modal.hidden = false;
  modal.classList.add('is-open');
}

function cerrarDetallePeticion() {
  peticionSeleccionadaId = null;
  const modal = $('petition-detail-modal');
  modal.classList.remove('is-open');
  modal.hidden = true;
}

function obtenerSesionAdmin() {
  const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.tipo_acceso !== 'administrador' || !parsed.administrador) return null;
    return parsed.administrador;
  } catch {
    return null;
  }
}

function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('show'), 3800);
}

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatearFecha(iso) {
  if (!iso) return 'Sin fecha';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function configurarIdentidadRol(admin) {
  const tipo = (admin.tipo || '').toLowerCase();
  const esHuertero = tipo === 'huertero';

  const etiquetaRol = esHuertero
    ? '🌱 Administrador de Huerteros'
    : '♻ Administrador de Recicladores';

  const descripcion = esHuertero
    ? 'Gestionas las peticiones de residuos orgánicos y coordinas al equipo de huerteros en Villas de San Pablo.'
    : 'Gestionas las peticiones de material reciclable y coordinas al equipo de recicladores en Villas de San Pablo.';

  const filtroTexto = esHuertero
    ? 'ETIQUETA PERMITIDA: ORGÁNICO'
    : 'ETIQUETA PERMITIDA: RECICLABLE';

  const badge = $('admin-role-badge');
  badge.textContent = etiquetaRol;
  badge.classList.add(esHuertero ? 'role-huertero' : 'role-reciclador');

  $('admin-greeting').textContent = `Hola, ${admin.nombre}`;
  $('admin-role-description').textContent = descripcion;
  $('peticiones-filter-tag').textContent = filtroTexto;
  $('btn-peticiones-label').textContent = esHuertero
    ? 'Ver peticiones orgánicas'
    : 'Ver peticiones reciclables';

  $('rec-tipo-preview').textContent = esHuertero ? 'Huertero (Orgánico)' : 'Reciclador (Reciclable)';
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Error al consultar el servidor.');
  return data;
}

async function apiPost(path, payload) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'No se pudo guardar la información.');
  return data;
}

async function cargarPeticiones() {
  const listEl = $('peticiones-list');
  const feedbackEl = $('peticiones-feedback');
  feedbackEl.hidden = false;
  feedbackEl.textContent = 'Cargando peticiones de tu área...';
  listEl.innerHTML = '';

  try {
    const params = new URLSearchParams({ id_administrador: String(adminActual.id_administrador) });
    if (estadoFiltro) params.set('estado', estadoFiltro);

    const data = await apiGet(`/api/admin/peticiones?${params.toString()}`);
    const items = data.peticiones || [];
    peticionesCache = items;

    if (!items.length) {
      feedbackEl.textContent = 'No hay peticiones registradas para tu categoría con este filtro.';
      return;
    }

    feedbackEl.hidden = true;
    listEl.innerHTML = items
      .map((p) => {
        const esCompletada = p.estado === 'completada';
        const imgUrl = p.imagenes && p.imagenes.length ? p.imagenes[0] : '';
        const mediaHtml = imgUrl
          ? `<img src="${escaparHtml(imgUrl)}" alt="Evidencia de petición #${p.id_peticion}" loading="lazy">`
          : `<span class="no-photo">Sin foto adjunta</span>`;

        const estadoHtml = esCompletada
          ? `<span class="status-badge status-completada">✓ Completada</span>`
          : `<span class="status-badge status-pendiente">⏳ Pendiente</span>`;

        const accionHtml = esCompletada
          ? `<div class="peticion-date">Peso registrado: <strong>${p.completado?.peso ?? '—'} kg</strong></div>`
          : `<button class="btn-primary btn-sm" type="button" data-completar="${p.id_peticion}" data-direccion="${escaparHtml(p.direccion)}">Marcar como recolectada</button>`;

        return `
          <article class="peticion-card" data-ver-peticion="${p.id_peticion}">
            <div class="peticion-media">${mediaHtml}</div>
            <div class="peticion-body">
              <div class="peticion-top">
                <span class="tag-pill">🏷 ${escaparHtml(p.etiqueta)}</span>
                ${estadoHtml}
              </div>
              <div class="peticion-meta">
                <div><strong>Solicitud #${p.id_peticion}</strong> · ${escaparHtml(p.usuario_nombre)}</div>
                <div><strong>Dirección:</strong> ${escaparHtml(p.direccion)}</div>
                <div class="peticion-date">${formatearFecha(p.fecha_peticion)}</div>
              </div>
              ${accionHtml}
            </div>
          </article>
        `;
      })
      .join('');
  } catch (err) {
    feedbackEl.textContent = err.message;
  }
}

async function cargarRecolectores() {
  const listEl = $('recolectores-list');
  const emptyEl = $('recolectores-empty');
  const countEl = $('recolectores-count');

  try {
    const params = new URLSearchParams({ id_administrador: String(adminActual.id_administrador) });
    const data = await apiGet(`/api/admin/recolectores?${params.toString()}`);
    recolectoresCache = data.recolectores || [];

    countEl.textContent = `${recolectoresCache.length} registrado${recolectoresCache.length === 1 ? '' : 's'}`;

    if (!recolectoresCache.length) {
      emptyEl.hidden = false;
      listEl.innerHTML = '';
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = recolectoresCache
      .map(
        (r) => `
        <li class="recolector-item">
          <div class="recolector-info">
            <strong>${escaparHtml(r.nombre)}</strong>
            <span>Tel: ${escaparHtml(r.telefono || 'Sin teléfono')} · <em class="recolector-type-inline">${escaparHtml(r.tipo)}</em></span>
          </div>
          <button
            class="btn-danger-sm"
            type="button"
            data-eliminar-recolector="${r.id_recolector}"
            data-nombre-recolector="${escaparHtml(r.nombre)}"
          >
            Eliminar
          </button>
        </li>
      `
      )
      .join('');
  } catch (err) {
    notify(err.message);
  }
}

function abrirModalCompletar(idPeticion, direccion) {
  if (!recolectoresCache.length) {
    notify('Primero registra al menos un recolector a tu cargo para asignar la recolección.');
    return;
  }
  $('comp-id-peticion').value = idPeticion;
  $('modal-peticion-info').textContent = `Petición #${idPeticion} · ${direccion}`;
  $('comp-peso').value = '';
  $('comp-recolector-error').textContent = '';
  $('comp-peso-error').textContent = '';

  const select = $('comp-recolector');
  select.innerHTML =
    `<option value="">Selecciona un recolector a cargo</option>` +
    recolectoresCache
      .map((r) => `<option value="${r.id_recolector}">${escaparHtml(r.nombre)} (${escaparHtml(r.telefono || 'Sin tel.')})</option>`)
      .join('');

  const modal = $('completar-modal');
  modal.hidden = false;
  modal.classList.add('is-open');
}

function cerrarModal() {
  const modal = $('completar-modal');
  modal.classList.remove('is-open');
  modal.hidden = true;
}

function inicializar() {
  adminActual = obtenerSesionAdmin();
  if (!adminActual) {
    window.location.href = 'index.html#administrador';
    return;
  }

  configurarIdentidadRol(adminActual);
  cargarRecolectores();

  $('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = 'index.html#administrador';
  });

  $('btn-ver-peticiones').addEventListener('click', () => {
    peticionesAbiertas = !peticionesAbiertas;
    $('peticiones-section').hidden = !peticionesAbiertas;
    $('btn-ver-peticiones').setAttribute('aria-expanded', String(peticionesAbiertas));
    if (peticionesAbiertas) {
      cargarPeticiones();
    }
  });

  $('btn-refrescar-peticiones').addEventListener('click', cargarPeticiones);

  document.querySelectorAll('.chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip-btn').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      estadoFiltro = chip.dataset.estado || '';
      cargarPeticiones();
    });
  });

 $('petitions-list')?.addEventListener('click', (e) => {
    const btnCompletar = e.target.closest('[data-completar]');
    if (btnCompletar) {
      abrirModalCompletar(btnCompletar.dataset.completar, btnCompletar.dataset.direccion || '');
      return;
    }

    if (e.target.closest('button, select, input')) return;
    const card = e.target.closest('[data-ver-peticion]');
    if (!card) return;
    abrirDetallePeticion(card.dataset.verPeticicion);
  });

  $('recolectores-list').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-eliminar-recolector]');
    if (!btn) return;

    const idRecolector = btn.dataset.eliminarRecolector;
    const nombreRecolector = btn.dataset.nombreRecolector || 'este recolector';
    if (!confirm(`¿Seguro que deseas eliminar a ${nombreRecolector}?`)) return;

    try {
      const params = new URLSearchParams({ id_administrador: String(adminActual.id_administrador) });
      const res = await fetch(`${API_BASE_URL}/api/admin/recolectores/${idRecolector}?${params.toString()}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'No se pudo eliminar el recolector.');

      notify('Recolector eliminado correctamente.');
      await cargarRecolectores();
    } catch (err) {
      notify(err.message);
    }
  });

  $('recolector-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const nombre = $('rec-nombre').value.trim();
    const telefono = $('rec-telefono').value.trim();

    $('rec-nombre-error').textContent = nombre.length >= 2 ? '' : 'Escribe el nombre del recolector.';
    $('rec-telefono-error').textContent = telefono.replace(/\D/g, '').length >= 7 ? '' : 'Escribe un número de celular válido.';
    if (nombre.length < 2 || telefono.replace(/\D/g, '').length < 7) return;

    try {
      await apiPost('/api/admin/recolectores', {
        id_administrador: adminActual.id_administrador,
        nombre,
        telefono,
      });
      $('recolector-form').reset();
      notify(`Recolector añadido como ${adminActual.tipo}.`);
      await cargarRecolectores();
    } catch (err) {
      notify(err.message);
    }
  });

  $('close-petition-detail-btn')?.addEventListener('click', cerrarDetallePeticion);
  $('petition-detail-modal')?.addEventListener('click', (e) => {
    if (e.target === $('petition-detail-modal')) cerrarDetallePeticion();
  });

  $('save-reclassify-btn')?.addEventListener('click', async () => {
    if (!peticionSeleccionadaId) return;
    const nuevaEtiqueta = $('detail-nueva-etiqueta').value;
    const btnGuardar = $('save-reclassify-btn');
    btnGuardar.disabled = true;

    try {
      const res = await fetch(`${API_BASE_URL}/api/peticiones/${peticionSeleccionadaId}/etiqueta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etiqueta: nuevaEtiqueta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'No se pudo reclasificar la petición.');

      notify(`Petición #${peticionSeleccionadaId} reclasificada como "${data.etiqueta}".`);
      cerrarDetallePeticion();
      if (typeof cargarPeticiones === 'function') {
        await cargarPeticiones();
      }
    } catch (err) {
      notify(err.message);
    } finally {
      btnGuardar.disabled = false;
    }
  });

  $('cerrar-modal').addEventListener('click', cerrarModal);
  $('cancelar-modal').addEventListener('click', cerrarModal);

  $('completar-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const idPeticion = $('comp-id-peticion').value;
    const idRecolector = Number($('comp-recolector').value);
    const peso = Number($('comp-peso').value);

    $('comp-recolector-error').textContent = idRecolector ? '' : 'Selecciona un recolector.';
    $('comp-peso-error').textContent = peso > 0 ? '' : 'Ingresa un peso válido mayor a 0.';
    if (!idRecolector || !(peso > 0)) return;

    try {
      await apiPost(`/api/peticiones/${idPeticion}/completar`, {
        id_administrador: adminActual.id_administrador,
        id_recolector: idRecolector,
        peso,
      });
      cerrarModal();
      notify('Recolección confirmada y +10 puntos sumados al ciudadano.');
      await cargarPeticiones();
    } catch (err) {
      notify(err.message);
    }
  });
}

inicializar();