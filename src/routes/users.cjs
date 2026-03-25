router.post(
  '/admin/create-client',
  requireAuth,
  async (req, res) => {

  try {

    const {
      name,
      last_name,
      email,
      phone,
      gender,
      birth_date,
      emergency_contact_name,
      emergency_contact_phone
    } = req.body;

      if (!req.company_id) {
        return res.status(400).json({
          error: "Usuario sin empresa"
        });
      }


    const { rows } = await pool.query(
      `
      INSERT INTO users
      (
        name,
        last_name,
        email,
        phone,
        gender,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone,
        role,
        company_id,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,'client',$9,NOW())
      RETURNING *
      `,
      [
        name,
        last_name,
        email,
        phone,
        gender,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone,
        req.user.company_id // 🔥 CLAVE
      ]
    );

    res.json({
      message: "Cliente creado",
      client: rows[0]
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error creando cliente"
    });

  }

});