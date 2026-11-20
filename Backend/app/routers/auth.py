from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Usuario, PuntosUsu, Administrador
from app.schemas import LoginIn, RegisterIn
from app.security import hash_password, verify_password, create_token

router = APIRouter(prefix="/api/auth", tags=["Autenticacion"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_usuario(data: RegisterIn, db: Session = Depends(get_db)):
    correo = data.email.strip().lower()
    if db.query(Usuario).filter(Usuario.correo == correo).first():
        raise HTTPException(status_code=400, detail="Este correo ya está registrado.")

    nuevo = Usuario(
        nombre=data.nombre.strip(),
        correo=correo,
        telefono=data.telefono.strip(),
        password_hash=hash_password(data.password),
    )
    db.add(nuevo)
    db.flush()

    db.add(PuntosUsu(id_usuario=nuevo.id_usuario, puntos=0))
    db.commit()
    db.refresh(nuevo)

    token = create_token(str(nuevo.id_usuario), "usuario")
    return {
        "access_token": token,
        "usuario": {"id_usuario": nuevo.id_usuario, "nombre": nuevo.nombre, "correo": nuevo.correo, "puntos": 0},
    }


@router.post("/login")
def login_usuario(data: LoginIn, db: Session = Depends(get_db)):
    correo = data.email.strip().lower()
    user = db.query(Usuario).filter(Usuario.correo == correo).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")

    puntos = user.puntos.puntos if user.puntos else 0
    token = create_token(str(user.id_usuario), "usuario")
    return {
        "access_token": token,
        "usuario": {"id_usuario": user.id_usuario, "nombre": user.nombre, "correo": user.correo, "puntos": puntos},
    }


@router.post("/admin/login")
def login_admin(data: LoginIn, db: Session = Depends(get_db)):
    correo = data.email.strip().lower()
    admin = db.query(Administrador).filter(Administrador.correo == correo).first()
    if not admin or not verify_password(data.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales administrativas inválidas.")

    token = create_token(str(admin.id_administrador), f"admin_{admin.tipo}")
    return {
        "access_token": token,
        "administrador": {
            "id_administrador": admin.id_administrador,
            "nombre": admin.nombre,
            "correo": admin.correo,
            "tipo": admin.tipo,
        },
    }