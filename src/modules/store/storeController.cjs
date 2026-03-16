const { pool } = require('../../config/db');


// obtener productos
exports.getProducts = async (req, res) => {
  try {

    const { rows } = await pool.query(`
      SELECT id,name,price,stock,image_url
      FROM products
      WHERE is_active = true
      ORDER BY name
    `);

    res.json(rows);

    }catch(err){

    console.error("ERROR PRODUCTS:", err);

    res.status(500).json({
        error:'Error obteniendo productos',
        details: err.message
    });

    }
};


// crear producto
exports.createProduct = async (req, res) => {

  try {

    const {
      name,
      description,
      cost_price,
      price,
      stock,
      image_url
    } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO products
      (name,description,cost_price,price,stock,image_url)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [name, description, cost_price, price, stock, image_url]
    );

    res.json(rows[0]);

  } catch (err) {

    res.status(500).json({ error: 'Error creando producto' });

  }

};

exports.createSale = async (req,res)=>{

  const client = await pool.connect();

  try{

    await client.query('BEGIN');

    const staffId = req.user.id;
    const { items } = req.body;

    let total = 0;

    const sale = await client.query(
      `INSERT INTO sales (staff_id,total)
       VALUES ($1,0)
       RETURNING id`,
      [staffId]
    );

    const saleId = sale.rows[0].id;

    for(const item of items){

      const product = await client.query(
        `SELECT stock,is_active
         FROM products
         WHERE id=$1`,
        [item.product_id]
      );

      if(product.rows.length===0)
        throw new Error('Producto no existe');

      const p = product.rows[0];

      if(!p.is_active)
        throw new Error('Producto inactivo');

      if(p.stock < item.quantity)
        throw new Error('Stock insuficiente');

      const subtotal = item.quantity * item.unit_price;

      total += subtotal;

      await client.query(
        `
        INSERT INTO sale_items
        (sale_id,product_id,quantity,unit_price,subtotal)
        VALUES ($1,$2,$3,$4,$5)
        `,
        [saleId,item.product_id,item.quantity,item.unit_price,subtotal]
      );

      await client.query(
        `
        UPDATE products
        SET stock = stock - $1
        WHERE id=$2
        `,
        [item.quantity,item.product_id]
      );

    }

    await client.query(
      `
      UPDATE sales
      SET total=$1
      WHERE id=$2
      `,
      [total,saleId]
    );

    await client.query(
      `
      INSERT INTO cash_movements
      (type,reference_type,reference_id,amount,staff_id)
      VALUES ('income','sale',$1,$2,$3)
      `,
      [saleId,total,staffId]
    );

    await client.query('COMMIT');

    res.json({
      success:true,
      sale_id:saleId,
      total
    });

  }catch(err){

    await client.query('ROLLBACK');

    res.status(400).json({
      error:err.message
    });

  }finally{
    client.release();
  }

};

exports.cancelSale = async (req,res)=>{

  const client = await pool.connect();

  try{

    await client.query('BEGIN');

    const saleId = req.params.id;

    const items = await client.query(
      `
      SELECT product_id,quantity
      FROM sale_items
      WHERE sale_id=$1
      `,
      [saleId]
    );

    for(const item of items.rows){

      await client.query(
        `
        UPDATE products
        SET stock = stock + $1
        WHERE id=$2
        `,
        [item.quantity,item.product_id]
      );

    }

    await client.query(
      `
      UPDATE sales
      SET status='cancelled'
      WHERE id=$1
      `,
      [saleId]
    );

    await client.query('COMMIT');

    res.json({success:true});

  }catch(err){

    await client.query('ROLLBACK');

    res.status(400).json({error:err.message});

  }finally{
    client.release();
  }

};