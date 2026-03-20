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

    req.user = decoded;

    next();

  } catch (error) {

    console.error("JWT ERROR:", error);

    res.status(401).json({ error: "Token inválido" });

  }

};