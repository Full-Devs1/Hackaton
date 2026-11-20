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
        .filter(Recolector.tipo == admin.tipo)
        .order_by(Recolector.id_recolector.desc())
        .all()
    )

    return {
        "tipo": admin.tipo,
        "recolectores": [
            {
                "id_recolector": r.id_recolector,
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
        nombre=data.nombre.strip(),
        tipo=admin.tipo,
        telefono=data.telefono.strip(),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return {
        "id_recolector": nuevo.id_recolector,
        "nombre": nuevo.nombre,
        "tipo": nuevo.tipo,
        "telefono": nuevo.telefono,
    }