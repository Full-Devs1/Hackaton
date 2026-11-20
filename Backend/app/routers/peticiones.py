from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Peticion, Imagen, PetCompletado, PuntosUsu, Usuario, Administrador, Recolector
from app.schemas import PeticionCreate, CompletarIn

router = APIRouter(prefix="/api/peticiones", tags=["Peticiones"])


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_peticion(data: PeticionCreate, db: Session = Depends(get_db)):
    if not db.query(Usuario).filter(Usuario.id_usuario == data.id_usuario).first():
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    pet = Peticion(
        id_usuario=data.id_usuario,
        etiqueta=data.etiqueta.strip(),
        direccion=data.direccion.strip(),
    )
    db.add(pet)
    db.flush()

    # Solo se almacena la URL de la imagen (alojada externamente / Storage)
    if data.url_imagen and data.url_imagen.strip():
        db.add(Imagen(id_peticion=pet.id_peticion, url_imagen=data.url_imagen.strip()))

    db.commit()
    db.refresh(pet)
    return {
        "id_peticion": pet.id_peticion,
        "id_usuario": pet.id_usuario,
        "etiqueta": pet.etiqueta,
        "direccion": pet.direccion,
        "fecha_creacion": pet.fecha_creacion,
        "imagenes": [img.url_imagen for img in pet.imagenes],
    }


@router.get("")
def listar_peticiones(etiqueta: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Peticion)
    if etiqueta:
        query = query.filter(Peticion.etiqueta == etiqueta)
    items = query.order_by(Peticion.fecha_creacion.desc()).all()
    return [
        {
            "id_peticion": p.id_peticion,
            "id_usuario": p.id_usuario,
            "etiqueta": p.etiqueta,
            "direccion": p.direccion,
            "fecha_creacion": p.fecha_creacion,
            "completada": p.completado is not None,
            "imagenes": [img.url_imagen for img in p.imagenes],
        }
        for p in items
    ]


@router.post("/{id_peticion}/completar")
def completar_peticion(id_peticion: int, data: CompletarIn, db: Session = Depends(get_db)):
    pet = db.query(Peticion).filter(Peticion.id_peticion == id_peticion).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Petición no encontrada.")
    if pet.completado is not None:
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

    # El trigger trg_after_pet_completado en PostgreSQL suma los puntos automáticamente
    reg_puntos = db.query(PuntosUsu).filter(PuntosUsu.id_usuario == pet.id_usuario).first()
    puntos_actuales = reg_puntos.puntos if reg_puntos else 0

    return {
        "id_peticion": pet.id_peticion,
        "completada": True,
        "peso": data.peso,
        "puntos_totales_usuario": puntos_actuales,
    }