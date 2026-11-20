from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario = Column(Integer, primary_key=True, index=True)
    correo = Column(String(120), unique=True, nullable=False, index=True)
    nombre = Column(String(120), nullable=False)
    telefono = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)

    puntos = relationship("PuntosUsu", back_populates="usuario", uselist=False)
    peticiones = relationship("Peticion", back_populates="usuario")


class PuntosUsu(Base):
    __tablename__ = "puntos_usu"

    id_puntos = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario"), unique=True, nullable=False)
    puntos = Column(Integer, nullable=False, default=0)

    usuario = relationship("Usuario", back_populates="puntos")


class Administrador(Base):
    __tablename__ = "administradores"

    id_administrador = Column(Integer, primary_key=True, index=True)
    correo = Column(String(120), unique=True, nullable=False, index=True)
    nombre = Column(String(120), nullable=False)
    tipo = Column(String(40), nullable=False)  # huerta | reciclaje | sistema
    password_hash = Column(String(255), nullable=False)


class Recolector(Base):
    __tablename__ = "recolectores"

    id_recolector = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(120), nullable=False)
    tipo = Column(String(40), nullable=False)  # huertero | reciclador
    telefono = Column(String(30), nullable=True)


class Peticion(Base):
    __tablename__ = "peticiones"

    id_peticion = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False)
    etiqueta = Column(String(40), nullable=False)  # biologico/organico | no_biologico/reciclable
    direccion = Column(String(255), nullable=False)
    fecha_peticion = Column(DateTime, default=datetime.utcnow)
    fecha_programada = Column(String(50), nullable=True)
    hora_programada = Column(String(20), nullable=True)
    estado = Column(String(30), nullable=False, default="RECIBIDA")

    usuario = relationship("Usuario", back_populates="peticiones")
    imagenes = relationship("Imagen", back_populates="peticion", cascade="all, delete-orphan")
    completado = relationship("PetCompletado", back_populates="peticion", uselist=False)


class Imagen(Base):
    __tablename__ = "imagen"

    id_imagen = Column(Integer, primary_key=True, index=True)
    id_peticion = Column(Integer, ForeignKey("peticiones.id_peticion"), nullable=False)
    url_imagen = Column(Text, nullable=False)

    peticion = relationship("Peticion", back_populates="imagenes")


class PetCompletado(Base):
    __tablename__ = "pet_completado"

    id_peticion = Column(Integer, ForeignKey("peticiones.id_peticion"), primary_key=True)
    id_administrador = Column(Integer, ForeignKey("administradores.id_administrador"), nullable=False)
    id_recolector = Column(Integer, ForeignKey("recolectores.id_recolector"), nullable=False)
    peso = Column(Numeric(8, 2), nullable=False)
    fecha_cierre = Column(DateTime, default=datetime.utcnow)

    peticion = relationship("Peticion", back_populates="completado")