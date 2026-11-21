from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    email: str
    password: str = Field(..., min_length=8)


class RegisterIn(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    email: str
    password: str = Field(..., min_length=8)


class PeticionCreate(BaseModel):
    id_usuario: int
    etiqueta: str
    direccion: str
    url_imagen: Optional[str] = None


class ProgramarIn(BaseModel):
    fecha_programada: str
    hora_programada: str


class CompletarIn(BaseModel):
    id_administrador: int
    id_recolector: int
    peso: float = Field(..., gt=0)
    puntos_por_kg: int = 10