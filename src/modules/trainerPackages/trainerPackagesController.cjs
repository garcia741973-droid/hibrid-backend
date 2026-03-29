const { pool } = require('../../config/db');

/// CREAR PAQUETE
exports.createPackage = async (req, res) => {
  try {

    const { name, total_sessions, price } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO trainer_packages
      (name, total_sessions, price, company_id)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [
        name,
        total_sessions,
        price,
        req.user.company_id
      ]
    );

    res.json(rows[0]);

  } catch (err) {
    res.status(500).json({ error: 'Error creando paquete' });
  }
};


/// LISTAR PAQUETES
exports.getPackages = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT *
      FROM trainer_packages
      WHERE company_id = $1
      AND is_active = true
      `,
      [req.user.company_id]
    );

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo paquetes' });
  }
};


/// ASIGNAR A CLIENTE
exports.assignPackage = async (req, res) => {
  try {

    const { client_id, package_id } = req.body;

    const pkg = await pool.query(
      `
      SELECT total_sessions
      FROM trainer_packages
      WHERE id=$1 AND company_id=$2
      `,
      [package_id, req.user.company_id]
    );

    if(pkg.rows.length === 0){
      return res.status(400).json({ error: 'Paquete no existe' });
    }

    const total = pkg.rows[0].total_sessions;

    const { rows } = await pool.query(
      `
      INSERT INTO trainer_client_packages
      (client_id, package_id, sessions_total, company_id)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [
        client_id,
        package_id,
        total,
        req.user.company_id
      ]
    );

    res.json(rows[0]);

  } catch (err) {
    res.status(500).json({ error: 'Error asignando paquete' });
  }
};


/// VER PAQUETES DE CLIENTE
exports.getClientPackages = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT *
      FROM trainer_client_packages
      WHERE client_id = $1
      AND company_id = $2
      `,
      [req.params.id, req.user.company_id]
    );

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo paquetes' });
  }
};