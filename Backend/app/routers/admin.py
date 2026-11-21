from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Administrador, Peticion, Recolector, Usuario

router = APIRouter(prefix="/api/admin", tags=["Administracion"])


class RecolectorAdminCreate(BaseModel):
    id_administrador: int
    nombre: str = Field(..., min_length=2, max_length=120)
    telefono: str = Field(..., min_length=7, max_length=20)


def _etiquetas_por_rol(tipo_admin: str) -> list[str]:
    tipo = (tipo_admin or "").strip().lower()
    if tipo == "huertero":
        return ["organico", "orgánico", "biologico", "biológico", "huerta"]
    if tipo == "reciclador":
        return ["reciclable", "no_biologico", "no biológico", "no biologico", "reciclaje"]
    raise HTTPException(status_code=400, detail="Tipo de administrador no reconocido.")


@router.get("/peticiones")
def listar_peticiones_por_admin(
    id_administrador: int = Query(..., gt=0),
    estado: str | None = Query(None),
    db: Session = Depends(get_db),
):
    admin = db.query(Administrador).filter(Administrador.id_administrador == id_administrador).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Administrador no encontrado.")

    etiquetas_validas = _etiquetas_por_rol(admin.tipo)
    filtros_etiqueta = [Peticion.etiqueta.ilike(f"%{etq}%") for etq in etiquetas_validas]

    query = (
        db.query(Peticion, Usuario)
        .join(Usuario, Peticion.id_usuario == Usuario.id_usuario)
        .filter(or_(*filtros_etiqueta))
    )

    if estado:
        query = query.filter(Peticion.estado == estado.strip().lower())

    resultados = query.order_by(Peticion.fecha_peticion.desc()).all()

    return {
        "administrador": {
            "id_administrador": admin.id_administrador,
            "nombre": admin.nombre,
            "tipo": admin.tipo,
        },
        "peticiones": [
            {
                "id_peticion": pet.id_peticion,
                "id_usuario": pet.id_usuario,
                "usuario_nombre": usu.nombre,
                "usuario_correo": usu.correo,
                "etiqueta": pet.etiqueta,
                "direccion": pet.direccion,
                "estado": pet.estado,
                "fecha_peticion": pet.fecha_peticion,
                "imagenes": [img.url_imagen for img in pet.imagenes],
                "completado": {
                    "id_completado": pet.completado.id_completado,
                    "id_recolector": pet.completado.id_recolector,
                    "peso": float(pet.completado.peso) if pet.completado.peso is not None else None,
                    "fecha_completado": pet.completado.fecha_completado,
                }
                if pet.completado
                else None,
            }
            for pet, usu in resultados
        ],
    }


@router.get("/recolectores")
def listar_recolectores_por_admin(
    id_administrador: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    admin = db.query(Administrador).filter(Administrador.id_administrador == id_administrador).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Administrador no encontrado.")

    recolectores = (
        db.query(Recolector)
        .filter(Recolector.id_administrador == admin.id_administrador)
        .order_by(Recolector.id_recolector.desc())
        .all()
    )

    return {
        "tipo": admin.tipo,
        "recolectores": [
            {
                "id_recolector": r.id_recolector,
                "id_administrador": r.id_administrador,
                "nombre": r.nombre,
                "tipo": r.tipo,
                "telefono": r.telefono,
            }
            for r in recolectores
        ],
    }


@router.post("/recolectores", status_code=status.HTTP_201_CREATED)
def crear_recolector_por_admin(data: RecolectorAdminCreate, db: Session = Depends(get_db)):
    admin = db.query(Administrador).filter(Administrador.id_administrador == data.id_administrador).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Administrador no encontrado.")

    nuevo = Recolector(
        id_administrador=admin.id_administrador,
        nombre=data.nombre.strip(),
        tipo=admin.tipo,
        telefono=data.telefono.strip(),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return {
        "id_recolector": nuevo.id_recolector,
        "id_administrador": nuevo.id_administrador,
        "nombre": nuevo.nombre,
        "tipo": nuevo.tipo,
        "telefono": nuevo.telefono,
    }


@router.delete("/recolectores/{id_recolector}")
def eliminar_recolector_por_admin(
    id_recolector: int,
    id_administrador: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    recolector = (
        db.query(Recolector)
        .filter(
            Recolector.id_recolector == id_recolector,
            Recolector.id_administrador == id_administrador,
        )
        .first()
    )
    if not recolector:
        raise HTTPException(
            status_code=404,
            detail="Recolector no encontrado o no pertenece a este administrador.",
        )

    try:
        db.delete(recolector)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar este recolector porque tiene recolecciones completadas asociadas.",
        )

    return {"eliminado": True, "id_recolector": id_recolector}