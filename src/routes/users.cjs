router.post('/admin/create-client', async (req, res) => {

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
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,'client',NOW())
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
        emergency_contact_phone
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