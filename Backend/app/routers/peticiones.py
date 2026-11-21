from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Peticion, Imagen, PetCompletado, PuntosUsu, Usuario, Administrador, Recolector
from app.schemas import PeticionCreate, CompletarIn
from pydantic import BaseModel

router = APIRouter(prefix="/api/peticiones", tags=["Peticiones"])


class EtiquetaUpdateIn(BaseModel):
    etiqueta: str


@router.patch("/{id_peticion}/etiqueta")
def reclasificar_etiqueta_peticion(
    id_peticion: int,
    payload: EtiquetaUpdateIn,
    db: Session = Depends(get_db),
):
    nueva_etiqueta = payload.etiqueta.strip().lower()
    if nueva_etiqueta not in {"organico", "reciclable"}:
        raise HTTPException(
            status_code=400,
            detail="La etiqueta debe ser 'organico' o 'reciclable'.",
        )

    peticion = db.query(Peticion).filter(Peticion.id_peticion == id_peticion).first()
    if not peticion:
        raise HTTPException(status_code=404, detail="Petición no encontrada.")

    peticion.etiqueta = nueva_etiqueta
    db.commit()
    db.refresh(peticion)

    return {
        "id_peticion": peticion.id_peticion,
        "etiqueta": peticion.etiqueta,
        "estado": peticion.estado,
    }


@router.get("/usuario/{id_usuario}")
def obtener_resumen_usuario(id_usuario: int, db: Session = Depends(get_db)):
    usu = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usu:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    puntos_reg = db.query(PuntosUsu).filter(PuntosUsu.id_usuario == id_usuario).first()
    return {
        "id_usuario": usu.id_usuario,
        "nombre": usu.nombre,
        "correo": usu.correo,
        "puntos": puntos_reg.puntos if puntos_reg else 0,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_peticion(data: PeticionCreate, db: Session = Depends(get_db)):
    if not db.query(Usuario).filter(Usuario.id_usuario == data.id_usuario).first():
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    pet = Peticion(
        id_usuario=data.id_usuario,
        etiqueta=data.etiqueta.strip(),
        direccion=data.direccion.strip(),
        estado="pendiente",
    )
    db.add(pet)
    db.flush()

    if data.url_imagen and data.url_imagen.strip():
        db.add(Imagen(id_peticion=pet.id_peticion, url_imagen=data.url_imagen.strip()))

    db.commit()
    db.refresh(pet)
    return {
        "id_peticion": pet.id_peticion,
        "id_usuario": pet.id_usuario,
        "etiqueta": pet.etiqueta,
        "direccion": pet.direccion,
        "estado": pet.estado,
        "fecha_peticion": pet.fecha_peticion,
        "imagenes": [img.url_imagen for img in pet.imagenes],
    }


@router.get("")
def listar_peticiones(id_usuario: int | None = None, etiqueta: str | None = None, estado: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Peticion)
    if id_usuario is not None:
        query = query.filter(Peticion.id_usuario == id_usuario)
    if etiqueta:
        query = query.filter(Peticion.etiqueta == etiqueta)
    if estado:
        query = query.filter(Peticion.estado == estado)
    items = query.order_by(Peticion.fecha_peticion.desc()).all()

    return [
        {
            "id_peticion": p.id_peticion,
            "id_usuario": p.id_usuario,
            "etiqueta": p.etiqueta,
            "direccion": p.direccion,
            "estado": p.estado,
            "fecha_peticion": p.fecha_peticion,
            "completada": p.estado == "completada" or p.completado is not None,
            "imagenes": [img.url_imagen for img in p.imagenes],
        }
        for p in items
    ]


@router.post("/{id_peticion}/completar")
def completar_peticion(id_peticion: int, data: CompletarIn, db: Session = Depends(get_db)):
    pet = db.query(Peticion).filter(Peticion.id_peticion == id_peticion).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Petición no encontrada.")
    if pet.completado is not None or pet.estado == "completada":
        raise HTTPException(status_code=400, detail="Esta petición ya fue completada.")
    if not db.query(Administrador).filter(Administrador.id_administrador == data.id_administrador).first():
        raise HTTPException(status_code=404, detail="Administrador no encontrado.")
    if not db.query(Recolector).filter(Recolector.id_recolector == data.id_recolector).first():
        raise HTTPException(status_code=404, detail="Recolector no encontrado.")

    cierre = PetCompletado(
        id_peticion=pet.id_peticion,
        id_administrador=data.id_administrador,
        id_recolector=data.id_recolector,
        peso=data.peso,
    )
    db.add(cierre)
    db.commit()

    # El trigger trg_after_pet_completado actualiza peticiones.estado y suma los 10 puntos
    db.expire_all()
    pet_actualizada = db.query(Peticion).filter(Peticion.id_peticion == id_peticion).first()
    reg_puntos = db.query(PuntosUsu).filter(PuntosUsu.id_usuario == pet.id_usuario).first()
    puntos_actuales = reg_puntos.puntos if reg_puntos else 0

    return {
        "id_peticion": pet.id_peticion,
        "estado": pet_actualizada.estado if pet_actualizada else "completada",
        "completada": True,
        "peso": data.peso,
        "puntos_totales_usuario": puntos_actuales,
    }


@router.get("/recolectores")
def listar_recolectores(db: Session = Depends(get_db)):
    recolectores = db.query(Recolector).order_by(Recolector.tipo, Recolector.nombre).all()
    return [
        {
            "id_recolector": r.id_recolector,
            "nombre": r.nombre,
            "tipo": r.tipo,
            "telefono": r.telefono,
        }
        for r in recolectores
    ]