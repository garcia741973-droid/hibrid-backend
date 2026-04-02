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

  router.put(
    '/admin/update-staff/:id',
    requireAuth,
    async (req, res) => {

      try {

        const { id } = req.params;

        const {
          name,
          last_name,
          phone,
          password
        } = req.body;

        const companyId = req.user.company_id;

        /// 🔒 SOLO GYM
        if (req.user.company_type !== 'gym') {
          return res.status(403).json({
            error: "No autorizado"
          });
        }

        let hashedPassword = null;

        if(password && password.length > 0){
          const bcrypt = require('bcrypt');
          hashedPassword = await bcrypt.hash(password, 10);
        }

        let query;
        let values;

        if(hashedPassword){

          query = `
            UPDATE users
            SET name=$1, last_name=$2, phone=$3, password=$4
            WHERE id=$5 AND company_id=$6
            RETURNING id,name,email
          `;

          values = [name, last_name, phone, hashedPassword, id, companyId];

        }else{

          query = `
            UPDATE users
            SET name=$1, last_name=$2, phone=$3
            WHERE id=$4 AND company_id=$5
            RETURNING id,name,email
          `;

          values = [name, last_name, phone, id, companyId];

        }

        const { rows } = await pool.query(query, values);

        res.json({
          message: "Staff actualizado",
          staff: rows[0]
        });

      } catch (err) {

        console.error(err);

        res.status(500).json({
          error: "Error actualizando staff"
        });

      }

  });

  router.get(
    '/admin/staff',
    requireAuth,
    async (req, res) => {

      try {

        const companyId = req.user.company_id;

        const { rows } = await pool.query(
          `
          SELECT id, name, last_name, email, phone
          FROM users
          WHERE role = 'staff'
          AND company_id = $1
          ORDER BY created_at DESC
          `,
          [companyId]
        );

        res.json(rows);

      } catch (err) {

        console.error(err);

        res.status(500).json({
          error: "Error obteniendo staff"
        });

      }

  });  

});