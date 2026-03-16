module.exports = (req, res, next) => {

  try {

    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado"
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Acceso solo para administradores"
      });
    }

    next();

  } catch (err) {

    console.error("ADMIN MIDDLEWARE ERROR", err);

    res.status(500).json({
      error: "Error verificando permisos"
    });

  }

};