from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario = Column(Integer, primary_key=True, index=True)
    correo = Column(String(150), unique=True, nullable=False, index=True)
    nombre = Column(String(120), nullable=False)
    contrasena = Column(String(255), nullable=True)

    puntos = relationship("PuntosUsu", back_populates="usuario", uselist=False)
    peticiones = relationship("Peticion", back_populates="usuario")


class PuntosUsu(Base):
    __tablename__ = "puntos_usu"

    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario", ondelete="CASCADE"), primary_key=True)
    puntos = Column(Integer, nullable=False, default=0)

    usuario = relationship("Usuario", back_populates="puntos")


class Administrador(Base):
    __tablename__ = "administradores"

    id_administrador = Column(Integer, primary_key=True, index=True)
    correo = Column(String(150), unique=True, nullable=False, index=True)
    nombre = Column(String(120), nullable=False)
    tipo = Column(String(30), nullable=False)
    contrasena = Column(String(255), nullable=True)


class Recolector(Base):
    __tablename__ = "recolectores"

    id_recolector = Column(Integer, primary_key=True, index=True)
    id_administrador = Column(Integer, ForeignKey("administradores.id_administrador", ondelete="CASCADE"), nullable=True)
    nombre = Column(String(120), nullable=False)
    tipo = Column(String(30), nullable=False)
    telefono = Column(String(20), nullable=True)


class Peticion(Base):
    __tablename__ = "peticiones"

    id_peticion = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario", ondelete="CASCADE"), nullable=False)
    etiqueta = Column(String(100), nullable=False)
    direccion = Column(Text, nullable=False)
    estado = Column(String(30), nullable=False, default="pendiente")
    fecha_peticion = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario", back_populates="peticiones")
    imagenes = relationship("Imagen", back_populates="peticion", cascade="all, delete-orphan")
    completado = relationship("PetCompletado", back_populates="peticion", uselist=False)


class Imagen(Base):
    __tablename__ = "imagen"

    id_imagen = Column(Integer, primary_key=True, index=True)
    id_peticion = Column(Integer, ForeignKey("peticiones.id_peticion", ondelete="CASCADE"), nullable=False)
    url_imagen = Column(Text, nullable=False)

    peticion = relationship("Peticion", back_populates="imagenes")


class PetCompletado(Base):
    __tablename__ = "pet_completado"

    id_completado = Column(Integer, primary_key=True, index=True)
    id_peticion = Column(Integer, ForeignKey("peticiones.id_peticion", ondelete="CASCADE"), unique=True, nullable=False)
    id_administrador = Column(Integer, ForeignKey("administradores.id_administrador", ondelete="RESTRICT"), nullable=False)
    id_recolector = Column(Integer, ForeignKey("recolectores.id_recolector", ondelete="RESTRICT"), nullable=False)
    peso = Column(Numeric(10, 2), nullable=True)
    fecha_completado = Column(DateTime(timezone=True), server_default=func.now())

    peticion = relationship("Peticion", back_populates="completado")