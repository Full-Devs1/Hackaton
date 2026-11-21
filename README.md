# EcoConecta · Villas de San Pablo

Plataforma web para la gestión ciudadana de solicitudes de recolección de residuos, reclasificación operativa y contacto directo con recolectores comunitarios en **Villas de San Pablo**.

## Arquitectura y Stack Tecnológico

* **Frontend:** HTML5, CSS3 y JavaScript Vanilla desplegado en **Vercel**.
* **Backend:** Python + **FastAPI** + **SQLAlchemy** desplegado en **Render** (`https://ecoconecta-backend-n4n2.onrender.com`).
* **Base de Datos y Almacenamiento:** **PostgreSQL** y **Storage** público en **Supabase** para persistencia de usuarios, peticiones, puntos, recolectores y fotografías de residuos.

## Funcionalidades Principales

### Portal de Usuario Ciudadano
* **Autenticación:** Registro e inicio de sesión de ciudadanos.
* **Registro de peticiones:** Creación de solicitudes indicando tipo de residuo (etiqueta), dirección de recolección y fotografía opcional del residuo (subida a almacenamiento público o mediante URL).
* **Seguimiento y puntos:** Consulta del estado de peticiones activas/completadas (`Mis peticiones`) y visualización del saldo de puntos acumulados (`+10 pts` por cada recolección confirmada).
* **Contacto directo con recolectores (`Contáctanos!`):** Modal integrado en el pie de página que consulta los recolectores registrados en la base de datos, los agrupa por tipo de residuo y genera enlaces directos a **WhatsApp** (`wa.me`) con mensaje prellenado para verificar horarios o demoras.

### Panel de Administración
* **Gestión de solicitudes:** Visualización, filtrado y reclasificación de etiquetas de residuos.
* **Confirmación de recolección:** Asignación de recolector, registro de peso recolectado y acreditación automática de puntos al ciudadano.

## Estructura General del Proyecto

```text
├── Backend/
│   ├── app/
│   │   ├── main.py          # Configuración de FastAPI y middleware CORS
│   │   ├── config.py        # Variables de entorno (DATABASE_URL, CORS_ORIGINS)
│   │   ├── database.py      # Conexión SQLAlchemy y sesión get_db
│   │   ├── models.py        # Modelos ORM (Usuario, PuntosUsu, Administrador, Recolector, Peticion, Imagen, PetCompletado)
│   │   └── routers/
│   │       ├── auth.py      # Registro e inicio de sesión
│   │       ├── peticiones.py# CRUD de peticiones, resumen de usuario y listado de recolectores
│   │       └── admin.py     # Gestión administrativa y confirmaciones
│   └── requirements.txt
└── Frontend/
    ├── index.html
    ├── usuario.html
    ├── admin.html
    ├── css/
    └── js/
        ├── auth.js
        ├── usuario.js
        └── admin.js