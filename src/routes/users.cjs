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

    // CREACION DE STAFF POR ADMIN

  router.post(
    '/admin/create-staff',
    requireAuth,
    async (req, res) => {

      try {

        const {
          name,
          last_name,
          email,
          password,
          phone
        } = req.body;

        /// 🔒 SOLO GYM
        if (req.user.company_type !== 'gym') {
          return res.status(403).json({
            error: "Solo gimnasios pueden crear staff"
          });
        }

        if (!name || !email || !password) {
          return res.status(400).json({
            error: "Faltan datos obligatorios"
          });
        }

        /// 🔥 HASH PASSWORD
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);

        const { rows } = await pool.query(
          `
          INSERT INTO users
          (
            name,
            last_name,
            email,
            password,
            phone,
            role,
            company_id,
            created_at
          )
          VALUES
          ($1,$2,$3,$4,$5,'staff',$6,NOW())
          RETURNING id,name,email,role
          `,
          [
            name,
            last_name || '',
            email,
            hashedPassword,
            phone || '',
            req.user.company_id
          ]
        );

        res.json({
          message: "Staff creado",
          staff: rows[0]
        });

      } catch (error) {

        console.error(error);

        res.status(500).json({
          error: "Error creando staff"
        });

      }

  });

});