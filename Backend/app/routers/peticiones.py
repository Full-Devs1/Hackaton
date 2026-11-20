from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Peticion, Imagen, PetCompletado, PuntosUsu, Usuario, Administrador, Recolector
from app.schemas import PeticionCreate, ProgramarIn, CompletarIn

router = APIRouter(prefix="/api/peticiones", tags=["Peticiones"])


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_peticion(data: PeticionCreate, db: Session = Depends(get_db)):
    if not db.query(Usuario).filter(Usuario.id_usuario == data.id_usuario).first():
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    pet = Peticion(
        id_usuario=data.id_usuario,
        etiqueta=data.etiqueta.strip(),
        direccion=data.direccion.strip(),
        estado="RECIBIDA",
    )
    db.add(pet)
    db.flush()

    if data.url_imagen:
        db.add(Imagen(id_peticion=pet.id_peticion, url_imagen=data.url_imagen.strip()))

    db.commit()
    db.refresh(pet)
    return {"id_peticion": pet.id_peticion, "etiqueta": pet.etiqueta, "estado": pet.estado}


@router.get("")
def listar_peticiones(etiqueta: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Peticion)
    if etiqueta:
        query = query.filter(Peticion.etiqueta == etiqueta)
    items = query.order_by(Peticion.fecha_peticion.desc()).all()
    return [
        {
            "id_peticion": p.id_peticion,
            "id_usuario": p.id_usuario,
            "etiqueta": p.etiqueta,
            "estado": p.estado,
            "fecha_peticion": p.fecha_peticion,
            "fecha_programada": p.fecha_programada,
            "hora_programada": p.hora_programada,
            "imagenes": [img.url_imagen for img in p.imagenes],
        }
        for p in items
    ]


@router.patch("/{id_peticion}/programar")
def programar_peticion(id_peticion: int, data: ProgramarIn, db: Session = Depends(get_db)):
    pet = db.query(Peticion).filter(Peticion.id_peticion == id_peticion).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Petición no encontrada.")

    pet.fecha_programada = data.fecha_programada.strip()
    pet.hora_programada = data.hora_programada.strip()
    pet.estado = "PROGRAMADA"
    db.commit()
    return {"id_peticion": pet.id_peticion, "estado": pet.estado, "fecha_programada": pet.fecha_programada, "hora_programada": pet.hora_programada}


@router.post("/{id_peticion}/completar")
def completar_peticion(id_peticion: int, data: CompletarIn, db: Session = Depends(get_db)):
    pet = db.query(Peticion).filter(Peticion.id_peticion == id_peticion).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Petición no encontrada.")
    if pet.estado == "RECOLECTADA":
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
    pet.estado = "RECOLECTADA"
    db.add(cierre)

    puntos_ganados = int(round(data.peso * data.puntos_por_kg))
    registro_puntos = db.query(PuntosUsu).filter(PuntosUsu.id_usuario == pet.id_usuario).first()
    if registro_puntos:
        registro_puntos.puntos += puntos_ganados
    else:
        db.add(PuntosUsu(id_usuario=pet.id_usuario, puntos=puntos_ganados))

    db.commit()
    return {"id_peticion": pet.id_peticion, "estado": pet.estado, "peso": data.peso, "puntos_ganados": puntos_ganados}