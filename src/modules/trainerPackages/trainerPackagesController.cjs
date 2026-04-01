const { pool } = require('../../config/db');

// =============================
// 🔥 CREAR PAQUETE
// =============================
exports.createPackage = async (req, res) => {
  try {
    const { name, sessions_total, price } = req.body;

    if (!name || !sessions_total || !price) {
      return res.status(400).json({
        error: 'Faltan datos'
      });
    }

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO trainer_packages
      (company_id, name, sessions_total, price)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [
        req.user.company_id,
        name,
        sessions_total,
        price
      ]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error creando paquete'
    });
  }
};

// =============================
// 🔥 LISTAR PAQUETES
// =============================
exports.getPackages = async (req, res) => {
  try {

    console.log("🔥 GET PACKAGES HIT");
    console.log("COMPANY ID TOKEN:", req.user.company_id);
    console.log("COMPANY TYPE TOKEN:", req.user.company_type);    

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

        const { rows } = await pool.query(
        `
        SELECT 
            tp.*,

            COALESCE((
            SELECT COUNT(*)
            FROM trainer_client_packages tcp
            WHERE tcp.package_id = tp.id
                AND tcp.company_id = tp.company_id
                AND tcp.status = 'active'
            ), 0) AS clients_count

        FROM trainer_packages tp
        WHERE tp.company_id = $1
        ORDER BY tp.created_at DESC
        `,
        [req.user.company_id]
        );

    console.log("ROWS FOUND:", rows);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo paquetes'
    });
  }
};

// =============================
// 🔥 ASIGNAR PAQUETE A CLIENTE
// =============================
exports.assignPackage = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { client_id, package_id } = req.body;

    if (!client_id || !package_id) {
      throw new Error('Faltan datos');
    }

    if (req.user.company_type !== 'trainer') {
      throw new Error('Solo trainer');
    }

    // 🔥 VALIDAR PAQUETE
    const pkgRes = await client.query(
      `
      SELECT sessions_total
      FROM trainer_packages
      WHERE id = $1 AND company_id = $2
      `,
      [package_id, req.user.company_id]
    );

    if (pkgRes.rows.length === 0) {
      throw new Error('Paquete no existe');
    }

    const pkg = pkgRes.rows[0];

    // 🔥 DESACTIVAR PAQUETES ANTERIORES
    await client.query(
      `
      UPDATE trainer_client_packages
      SET status = 'cancelled'
      WHERE client_id = $1
        AND company_id = $2
        AND status = 'active'
      `,
      [client_id, req.user.company_id]
    );

    // 🔥 CREAR NUEVO
    const { rows } = await client.query(
      `
      INSERT INTO trainer_client_packages
      (
        company_id,
        client_id,
        package_id,
        sessions_total,
        sessions_used,
        status
      )
      VALUES ($1,$2,$3,$4,0,'active')
      RETURNING *
      `,
      [
        req.user.company_id,
        client_id,
        package_id,
        pkg.sessions_total
      ]
    );

    await client.query('COMMIT');

    res.json(rows[0]);

  } catch (err) {

    await client.query('ROLLBACK');

    res.status(400).json({
      error: err.message
    });

  } finally {
    client.release();
  }
};

// =============================
// 🔥 VER PAQUETES DE CLIENTE
// =============================
exports.getClientPackages = async (req, res) => {
  try {
    const clientId = req.params.id;

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rows } = await pool.query(
      `
      SELECT *
      FROM trainer_client_packages
      WHERE client_id = $1
        AND company_id = $2
      ORDER BY created_at DESC
      `,
      [clientId, req.user.company_id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo paquetes del cliente'
    });
  }
};

// =============================
// 👤 VER MIS PAQUETES (CLIENTE)
// =============================
exports.getMyPackages = async (req, res) => {
  try {

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rows } = await pool.query(
      `
      SELECT 
        tcp.*,
        tp.name,
        tp.price
      FROM trainer_client_packages tcp
      JOIN trainer_packages tp 
        ON tp.id = tcp.package_id
      WHERE tcp.client_id = $1
        AND tcp.company_id = $2
      ORDER BY tcp.created_at DESC
      `,
      [
        req.user.id,
        req.user.company_id
      ]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo mis paquetes'
    });
  }
};

// =============================
// ✏️ EDITAR PAQUETE
// =============================
exports.updatePackage = async (req, res) => {
  try {

    const { id } = req.params;
    const { name, sessions_total, price } = req.body;

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rows } = await pool.query(
      `
      UPDATE trainer_packages
      SET name = $1,
          sessions_total = $2,
          price = $3
      WHERE id = $4
        AND company_id = $5
      RETURNING *
      `,
      [
        name,
        sessions_total,
        price,
        id,
        req.user.company_id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Paquete no encontrado"
      });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error actualizando paquete'
    });
  }
};



// =============================
// 🗑 ELIMINAR PAQUETE
// =============================
exports.deletePackage = async (req, res) => {
  try {

    const { id } = req.params;

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rowCount } = await pool.query(
      `
      DELETE FROM trainer_packages
      WHERE id = $1
        AND company_id = $2
      `,
      [id, req.user.company_id]
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: "Paquete no encontrado"
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error eliminando paquete'
    });
  }
};