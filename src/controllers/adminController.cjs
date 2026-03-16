const { pool } = require("../config/db");
const bcrypt = require("bcrypt");

    exports.createClient = async (req, res) => {

    try {

    const {
    name,
    last_name,
    email,
    phone,
    gender,
    birth_date,
    emergency_contact_name,
    emergency_contact_phone,
    photo_url
    } = req.body;

    const password = "123456";

    const hashedPassword = await bcrypt.hash(password,10);

    const result = await pool.query(
    `
    INSERT INTO users
    (
        name,
        last_name,
        email,
        password,
        role,
        phone,
        gender,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone,
        photo_url,
        created_at
    )
    VALUES
    ($1,$2,$3,$4,'client',$5,$6,$7,$8,$9,$10,NOW())
    RETURNING id,name,email
    `,
    [
        name,
        last_name,
        email,
        hashedPassword,
        phone,
        gender,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone,
        photo_url
    ]
    );

    const user = result.rows[0];

    const qrCode = `HIBRID-USER-${user.id}`;

    await pool.query(
    `UPDATE users SET qr_code=$1 WHERE id=$2`,
    [qrCode,user.id]
    );

    res.json({
    message:"Cliente creado",
    user,
    qr:qrCode
    });

    } catch(error){

    console.error(error);

    res.status(500).json({
    error:"Error creando cliente"
    });

    }

    };

exports.getClients = async (req, res) => {

 try {

  const result = await pool.query(
   `
    SELECT
    id,
    name,
    last_name,
    email,
    phone,
    gender,
    photo_url,
    membership_start,
    membership_end,
    qr_code
    FROM users
   WHERE role='client'
   ORDER BY id DESC
   `
  );

  res.json(result.rows);

 } catch(error){

  console.error(error);

  res.status(500).json({
   error:"Error obteniendo clientes"
  });

 }

    exports.updateClient = async (req,res) => {

    try {

    const id = req.params.id;

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

    await pool.query(
    `
    UPDATE users
    SET
        name=$1,
        last_name=$2,
        email=$3,
        phone=$4,
        gender=$5,
        birth_date=$6,
        emergency_contact_name=$7,
        emergency_contact_phone=$8
    WHERE id=$9
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
        id
    ]
    );

    res.json({message:"Cliente actualizado"});

    } catch(error){

    console.error(error);

    res.status(500).json({error:"Error actualizando cliente"});

    }

    };


};