(() => {
  const RECOLECTORES = [
    {
      nombre: "Carlos Mendoza",
      tipo: "Orgánico (Huerta / Compostaje)",
      telefono: "573001112233",
      mensaje: "Hola Carlos, soy de EcoConecta (Villas de San Pablo). ¿Me confirmas si hay demora en la recolección orgánica?"
    },
    {
      nombre: "Laura Suárez",
      tipo: "Reciclaje",
      telefono: "573004445566",
      mensaje: "Hola Laura, soy de EcoConecta (Villas de San Pablo). ¿A qué hora pasan hoy por reciclaje?"
    },
    {
      nombre: "Andrés Quintero",
      tipo: "Ordinarios",
      telefono: "573007778899",
      mensaje: "Hola Andrés, soy de EcoConecta (Villas de San Pablo). Quería consultar el estado de la recolección."
    }
  ];

  function usuarioEstaAutenticado() {
    if (window.usuarioActual && (window.usuarioActual.id_usuario || window.usuarioActual.correo)) {
      return true;
    }
    const claves = ["usuarioActual", "usuario", "user", "token", "access_token"];
    return claves.some((k) => {
      const val = localStorage.getItem(k) || sessionStorage.getItem(k);
      return Boolean(val && val !== "null" && val !== "undefined");
    });
  }

  function construirUrlWhatsApp(recolector) {
    const telefonoLimpio = String(recolector.telefono).replace(/\D/g, "");
    const texto = encodeURIComponent(
      recolector.mensaje ||
        `Hola ${recolector.nombre}, soy de EcoConecta (Villas de San Pablo). ¿Me confirmas si hay demora en la recolección?`
    );
    return `https://wa.me/${telefonoLimpio}?text=${texto}`;
  }

  function agruparPorTipo(lista) {
    return lista.reduce((acc, item) => {
      const tipo = item.tipo || "General";
      if (!acc[tipo]) acc[tipo] = [];
      acc[tipo].push(item);
      return acc;
    }, {});
  }

  function inyectarEstilos() {
    if (document.getElementById("ecoconecta-contacto-styles")) return;
    const style = document.createElement("style");
    style.id = "ecoconecta-contacto-styles";
    style.textContent = `
      .eco-footer-contacto-btn {
        background: #15803d;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease, transform 0.15s ease;
      }
      .eco-footer-contacto-btn:hover {
        background: #166534;
        transform: translateY(-1px);
      }
      .eco-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 16px;
      }
      .eco-modal-backdrop.open {
        display: flex;
      }
      .eco-modal-card {
        background: #ffffff;
        color: #0f172a;
        width: 100%;
        max-width: 520px;
        max-height: 85vh;
        overflow-y: auto;
        border-radius: 14px;
        padding: 20px;
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22);
      }
      .eco-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 12px;
        margin-bottom: 14px;
      }
      .eco-modal-header h3 {
        margin: 0;
        font-size: 1.15rem;
      }
      .eco-close-btn {
        background: transparent;
        border: none;
        font-size: 1.35rem;
        line-height: 1;
        cursor: pointer;
        color: #475569;
      }
      .eco-grupo-titulo {
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #15803d;
        margin: 14px 0 8px;
      }
      .eco-recolector-fila {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        margin-bottom: 8px;
      }
      .eco-recolector-nombre {
        font-weight: 600;
        font-size: 0.95rem;
      }
      .eco-wpp-btn {
        background: #16a34a;
        color: #ffffff;
        text-decoration: none;
        padding: 7px 12px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .eco-wpp-btn:hover {
        background: #15803d;
      }
    `;
    document.head.appendChild(style);
  }

  function crearModal() {
    if (document.getElementById("ecoContactoModal")) return;
    const backdrop = document.createElement("div");
    backdrop.id = "ecoContactoModal";
    backdrop.className = "eco-modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "ecoModalTitulo");

    const grupos = agruparPorTipo(RECOLECTORES);
    const contenidoGrupos = Object.entries(grupos)
      .map(([tipo, lista]) => {
        const filas = lista
          .map(
            (r) => `
              <div class="eco-recolector-fila">
                <span class="eco-recolector-nombre">${r.nombre}</span>
                <a class="eco-wpp-btn" href="${construirUrlWhatsApp(r)}" target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </div>
            `
          )
          .join("");
        return `
          <div class="eco-grupo-titulo">${tipo}</div>
          ${filas}
        `;
      })
      .join("");

    backdrop.innerHTML = `
      <div class="eco-modal-card">
        <div class="eco-modal-header">
          <h3 id="ecoModalTitulo">Recolectores disponibles</h3>
          <button type="button" class="eco-close-btn" id="ecoCerrarModal" aria-label="Cerrar">&times;</button>
        </div>
        <p style="margin: 0 0 8px; font-size: 0.9rem; color: #475569;">
          Escríbeles por WhatsApp para consultar demoras o coordinar tu recolección.
        </p>
        ${contenidoGrupos}
      </div>
    `;

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) cerrarModal();
    });
    document.body.appendChild(backdrop);
    document.getElementById("ecoCerrarModal").addEventListener("click", cerrarModal);
  }

  function abrirModal() {
    crearModal();
    const modal = document.getElementById("ecoContactoModal");
    if (modal) modal.classList.add("open");
  }

  function cerrarModal() {
    const modal = document.getElementById("ecoContactoModal");
    if (modal) modal.classList.remove("open");
  }

  function montarBotonFooter() {
    if (!usuarioEstaAutenticado()) return;
    if (document.getElementById("ecoBotonContactanos")) return;

    let footer = document.querySelector("footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.style.padding = "16px";
      footer.style.textAlign = "center";
      document.body.appendChild(footer);
    }

    const btn = document.createElement("button");
    btn.id = "ecoBotonContactanos";
    btn.type = "button";
    btn.className = "eco-footer-contacto-btn";
    btn.textContent = "Contáctanos!";
    btn.addEventListener("click", abrirModal);

    footer.appendChild(btn);
  }

  document.addEventListener("DOMContentLoaded", () => {
    inyectarEstilos();
    montarBotonFooter();
  });

  // Por si el estado de sesión se carga de forma asíncrona tras DOMContentLoaded
  window.addEventListener("eco:auth-ready", () => {
    inyectarEstilos();
    montarBotonFooter();
  });
})();