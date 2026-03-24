const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {

  const authHeader =
    req.headers['authorization'] ||
    req.headers['Authorization'] ||
    req.get('Authorization');

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 VALIDACIÓN MULTIEMPRESA
    if (!decoded.company_id) {
      return res.status(401).json({ error: "Token inválido (sin empresa)" });
    }

    req.user = decoded;

    const { pool } = require("../config/db");

    if (decoded.role !== 'superadmin') {

      const result = await pool.query(
        `SELECT subscription_status FROM companies WHERE id = $1`,
        [decoded.company_id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: "Empresa no encontrada"
        });
      }

      const company = result.rows[0];

      if (company.subscription_status !== 'active') {
        return res.status(403).json({
          error: "Suscripción vencida"
        });
      }
    }    

    next();

  } catch (error) {

    console.error("JWT ERROR:", error);

    res.status(401).json({ error: "Token inválido" });

  }

};