const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

module.exports = async (req, res, next) => {

  const authHeader =
    req.headers['authorization'] ||
    req.headers['Authorization'] ||
    req.get('Authorization');

    console.log("🔐 AUTH HEADER:", authHeader);

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    console.log("❌ HEADER MAL FORMADO:", authHeader);
    return res.status(401).json({ error: "Token inválido" });
  }

  const token = parts[1];

  // 🔥 BLOQUEAR TOKENS MALOS
  if (!token || token === "null" || token === "undefined") {
    console.log("❌ TOKEN VACÍO O INVÁLIDO:", token);
    return res.status(401).json({ error: "Token inválido" });
  }

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

  console.log("🔐 TOKEN USER:", decoded);

    // 🔥 MULTIEMPRESA
    if (decoded.role !== 'superadmin') {

      if (!decoded.company_id) {
        return res.status(401).json({
          error: "Token inválido (sin empresa)"
        });
      }

      const result = await pool.query(
        `
        SELECT subscription_status, expiration_date 
        FROM companies 
        WHERE id = $1
        `,
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
          error: "Suscripción inactiva"
        });
      }

      if (company.expiration_date) {
        const today = new Date();
        const expiration = new Date(company.expiration_date);

        if (expiration < today) {
          return res.status(403).json({
            error: "Suscripción expirada"
          });
        }
      }
    }

    req.user = decoded;
    req.company_id = decoded.company_id;
    req.role = decoded.role;
    req.company_type = decoded.company_type; // 🔥 NUEVO
    next();

  } catch (error) {

    console.error("JWT ERROR:", error);

    return res.status(401).json({ error: "Token inválido" });

  }

};