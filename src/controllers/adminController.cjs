const { pool } = require("../config/db");
const bcrypt = require("bcrypt");

exports.createClient = async (req, res) => {

 try {

  const { name,email,phone,membership_days } = req.body;

  const password = "123456";

  const hashedPassword = await bcrypt.hash(password,10);

  const startDate = new Date();

  const endDate = new Date();
  endDate.setDate(startDate.getDate() + membership_days);

  const result = await pool.query(
   `
   INSERT INTO users
   (name,email,password,role,phone,membership_start,membership_end)
   VALUES ($1,$2,$3,'client',$4,$5,$6)
   RETURNING id,name,email
   `,
   [name,email,hashedPassword,phone,startDate,endDate]
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

  res.status(500).json({error:error.message});

 }

};