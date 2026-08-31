const { pool } = require('../../config/db');


// =====================================================
// OBTENER PRODUCTOS HSTORE
// PROPIOS + HIBRID PARTNERS
// =====================================================

exports.getProducts = async (req, res) => {

  try {

    const companyId =
      req.user.company_id;


    const { rows } =
      await pool.query(
        `
        SELECT

          p.id,

          CASE
            WHEN p.inventory_source = 'partner'
              THEN pc.name
            ELSE p.name
          END AS name,


          CASE
            WHEN p.inventory_source = 'partner'
              THEN pc.description
            ELSE p.description
          END AS description,


          CASE
            WHEN p.inventory_source = 'partner'
              THEN pc.price
            ELSE p.price
          END AS price,


          CASE
            WHEN p.inventory_source = 'partner'
              THEN pc.stock
            ELSE p.stock
          END AS stock,


          CASE
            WHEN p.inventory_source = 'partner'
              THEN pc.image_url
            ELSE p.image_url
          END AS image_url,


          p.inventory_source,

          p.partner_catalog_id,


          CASE
            WHEN p.inventory_source = 'partner'
              THEN TRUE
            ELSE FALSE
          END AS is_partner


        FROM products p


        LEFT JOIN partner_catalog_products pc
          ON pc.id = p.partner_catalog_id


        WHERE
          p.company_id = $1

          AND p.is_active = TRUE

          AND (
            p.inventory_source = 'owned'

            OR (
              p.inventory_source = 'partner'
              AND pc.id IS NOT NULL
              AND pc.is_active = TRUE
            )
          )


        ORDER BY
          CASE
            WHEN p.inventory_source = 'partner'
              THEN pc.name
            ELSE p.name
          END
        `,
        [
          companyId
        ]
      );


    return res.json(
      rows
    );


  } catch (err) {

    console.error(
      "ERROR PRODUCTS:",
      err
    );


    return res
      .status(500)
      .json({
        error:
          'Error obteniendo productos',

        details:
          err.message
      });
  }
};


// crear producto
exports.createProduct = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const {
      name,
      description,
      cost_price,
      price,
      stock,
      image_url
    } = req.body;

    const companyId = req.user.company_id;
    const staffId = req.user.id;

    // =============================
    // 1️⃣ VALIDAR DATOS
    // =============================

    if (!name || !name.toString().trim()) {
      throw new Error(
        "Nombre del producto obligatorio"
      );
    }

    const costPrice = Number(cost_price);
    const salePrice = Number(price);
    const initialStock = Number.parseInt(
      stock ?? 0,
      10
    );

    if (
      !Number.isFinite(costPrice) ||
      costPrice < 0
    ) {
      throw new Error(
        "Costo inválido"
      );
    }

    if (
      !Number.isFinite(salePrice) ||
      salePrice < 0
    ) {
      throw new Error(
        "Precio inválido"
      );
    }

    if (
      !Number.isInteger(initialStock) ||
      initialStock < 0
    ) {
      throw new Error(
        "Stock inicial inválido"
      );
    }

    // =============================
    // 2️⃣ CREAR PRODUCTO
    // =============================
    const productResult = await client.query(
      `
      INSERT INTO products
      (
        name,
        description,
        cost_price,
        price,
        stock,
        image_url,
        company_id
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        name.toString().trim(),
        description || '',
        costPrice,
        salePrice,
        initialStock,
        image_url || null,
        companyId
      ]
    );

    const product = productResult.rows[0];

    // =============================
    // 3️⃣ REGISTRAR STOCK INICIAL
    // =============================
    if (initialStock > 0) {

    // =============================
    // 3️⃣ REGISTRAR COMPRA INICIAL
    // =============================
    const movementResult = await client.query(
      `
      INSERT INTO stock_movements
      (
        product_id,
        type,
        quantity,
        cost_price,
        staff_id,
        company_id,
        reference_type
      )
      VALUES
      ($1,'IN',$2,$3,$4,$5,'purchase')
      RETURNING id
      `,
      [
        product.id,
        initialStock,
        costPrice,
        staffId,
        companyId
      ]
    );

    const movementId = movementResult.rows[0].id;

    // =============================
    // 4️⃣ REGISTRAR EGRESO EN CAJA
    // =============================
    const totalCost = initialStock * costPrice;

    await client.query(
      `
      INSERT INTO cash_movements
      (
        type,
        reference_type,
        reference_id,
        amount,
        staff_id,
        company_id
      )
      VALUES
      ('expense','stock',$1,$2,$3,$4)
      `,
      [
        movementId,
        totalCost,
        staffId,
        companyId
      ]
    );
  }


    await client.query('COMMIT');

    return res.json(product);

  } catch (err) {

    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error(
      "❌ ERROR CREANDO PRODUCTO:",
      err
    );

    return res.status(400).json({
      error: err.message
    });

  } finally {

    client.release();

  }
};

exports.createSale = async (req, res) => {

  const client =
    await pool.connect();


  try {

    await client.query(
      'BEGIN'
    );


    const staffId =
      req.user.id;


    const companyId =
      req.user.company_id;


    const { items } =
      req.body;


    // =============================================
    // 1. VALIDAR VENTA
    // =============================================

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {

      throw new Error(
        'La venta no contiene productos'
      );
    }


    const roundMoney =
      value =>
        Math.round(
          (
            Number(value) +
            Number.EPSILON
          ) * 100
        ) / 100;


    let total =
      0;


    let partnerSettlementTotal =
      0;


    let partnerCommissionTotal =
      0;


    // =============================================
    // 2. CREAR CABECERA
    // =============================================

    const sale =
      await client.query(
        `
        INSERT INTO sales
        (
          staff_id,
          total,
          company_id
        )
        VALUES
        (
          $1,
          0,
          $2
        )
        RETURNING id
        `,
        [
          staffId,
          companyId
        ]
      );


    if (
      sale.rows.length === 0
    ) {

      throw new Error(
        'Error creando venta'
      );
    }


    const saleId =
      sale.rows[0].id;


    // =============================================
    // 3. PROCESAR PRODUCTOS
    // =============================================

    for (
      const item of items
    ) {

      const productId =
        Number.parseInt(
          item.product_id,
          10
        );


      const quantity =
        Number.parseInt(
          item.quantity,
          10
        );


      if (
        !Number.isInteger(
          productId
        ) ||
        productId <= 0
      ) {

        throw new Error(
          'Producto inválido'
        );
      }


      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity <= 0
      ) {

        throw new Error(
          'Cantidad inválida'
        );
      }


      // ===========================================
      // 4. BLOQUEAR PRODUCTO LOCAL
      // ===========================================

      const product =
        await client.query(
          `
          SELECT
            id,
            name,
            stock,
            price,
            cost_price,
            is_active,
            inventory_source,
            partner_catalog_id
          FROM products
          WHERE id = $1
            AND company_id = $2
          FOR UPDATE
          `,
          [
            productId,
            companyId
          ]
        );


      if (
        product.rows.length === 0
      ) {

        throw new Error(
          'Producto no existe'
        );
      }


      const p =
        product.rows[0];


      if (
        !p.is_active
      ) {

        throw new Error(
          `Producto inactivo: ${p.name}`
        );
      }


      const inventorySource =
        p.inventory_source ||
        'owned';


      // ===========================================
      // PRODUCTO PROPIO
      // ===========================================

      if (
        inventorySource ===
        'owned'
      ) {

        if (
          Number(p.stock) <
          quantity
        ) {

          throw new Error(
            `Stock insuficiente: ${p.name}`
          );
        }


        const unitPrice =
          Number(
            p.price
          );


        const costPrice =
          Number(
            p.cost_price || 0
          );


        if (
          !Number.isFinite(
            unitPrice
          ) ||
          unitPrice < 0
        ) {

          throw new Error(
            `Precio inválido: ${p.name}`
          );
        }


        if (
          !Number.isFinite(
            costPrice
          ) ||
          costPrice < 0
        ) {

          throw new Error(
            `Costo inválido: ${p.name}`
          );
        }


        const subtotal =
          roundMoney(
            quantity *
            unitPrice
          );


        total =
          roundMoney(
            total +
            subtotal
          );


        // =========================================
        // DETALLE VENTA OWNED
        // =========================================

        await client.query(
          `
          INSERT INTO sale_items
          (
            sale_id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            company_id
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          `,
          [
            saleId,
            productId,
            quantity,
            unitPrice,
            subtotal,
            companyId
          ]
        );


        // =========================================
        // DESCONTAR STOCK LOCAL
        // =========================================

        const update =
          await client.query(
            `
            UPDATE products
            SET stock =
              stock - $1
            WHERE id = $2
              AND company_id = $3
              AND stock >= $1
            RETURNING stock
            `,
            [
              quantity,
              productId,
              companyId
            ]
          );


        if (
          update.rows.length === 0
        ) {

          throw new Error(
            `Stock insuficiente: ${p.name}`
          );
        }


        // =========================================
        // MOVIMIENTO INVENTARIO LOCAL
        // =========================================

        await client.query(
          `
          INSERT INTO stock_movements
          (
            product_id,
            type,
            quantity,
            cost_price,
            staff_id,
            company_id,
            reference_type,
            reference_id
          )
          VALUES
          (
            $1,
            'OUT',
            $2,
            $3,
            $4,
            $5,
            'sale',
            $6
          )
          `,
          [
            productId,
            quantity,
            costPrice,
            staffId,
            companyId,
            saleId
          ]
        );


        continue;
      }


      // ===========================================
      // PRODUCTO HIBRID PARTNER
      // ===========================================

      if (
        inventorySource ===
        'partner'
      ) {

        const partnerCatalogId =
          Number.parseInt(
            p.partner_catalog_id,
            10
          );


        if (
          !Number.isInteger(
            partnerCatalogId
          ) ||
          partnerCatalogId <= 0
        ) {

          throw new Error(
            `Producto Partner sin catálogo asociado: ${p.name}`
          );
        }


        // =========================================
        // BLOQUEAR STOCK CENTRAL
        // =========================================

        const partnerProduct =
          await client.query(
            `
            SELECT
              id,
              name,
              settlement_price,
              price,
              stock,
              is_active
            FROM partner_catalog_products
            WHERE id = $1
            FOR UPDATE
            `,
            [
              partnerCatalogId
            ]
          );


        if (
          partnerProduct.rows.length ===
          0
        ) {

          throw new Error(
            `Producto Partner no encontrado: ${p.name}`
          );
        }


        const pc =
          partnerProduct.rows[0];


        if (
          !pc.is_active
        ) {

          throw new Error(
            `Producto Partner inactivo: ${pc.name}`
          );
        }


        if (
          Number(pc.stock) <
          quantity
        ) {

          throw new Error(
            `Stock central insuficiente: ${pc.name}`
          );
        }


        // =========================================
        // PRECIOS AUTORITATIVOS CENTRALES
        // =========================================

        const unitPrice =
          Number(
            pc.price
          );


        const settlementUnitPrice =
          Number(
            pc.settlement_price
          );


        if (
          !Number.isFinite(
            unitPrice
          ) ||
          unitPrice < 0
        ) {

          throw new Error(
            `Precio Partner inválido: ${pc.name}`
          );
        }


        if (
          !Number.isFinite(
            settlementUnitPrice
          ) ||
          settlementUnitPrice < 0
        ) {

          throw new Error(
            `Monto MLM inválido: ${pc.name}`
          );
        }


        if (
          unitPrice <
          settlementUnitPrice
        ) {

          throw new Error(
            `Precio Partner menor al monto MLM: ${pc.name}`
          );
        }


        const subtotal =
          roundMoney(
            quantity *
            unitPrice
          );


        const settlementAmount =
          roundMoney(
            quantity *
            settlementUnitPrice
          );


        const commissionAmount =
          roundMoney(
            subtotal -
            settlementAmount
          );


        total =
          roundMoney(
            total +
            subtotal
          );


        partnerSettlementTotal =
          roundMoney(
            partnerSettlementTotal +
            settlementAmount
          );


        partnerCommissionTotal =
          roundMoney(
            partnerCommissionTotal +
            commissionAmount
          );


        // =========================================
        // DETALLE VENTA PARTNER
        // NECESITAMOS sale_item_id
        // =========================================

        const saleItem =
          await client.query(
            `
            INSERT INTO sale_items
            (
              sale_id,
              product_id,
              quantity,
              unit_price,
              subtotal,
              company_id
            )
            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6
            )
            RETURNING id
            `,
            [
              saleId,
              productId,
              quantity,
              unitPrice,
              subtotal,
              companyId
            ]
          );


        if (
          saleItem.rows.length ===
          0
        ) {

          throw new Error(
            `No se pudo crear detalle Partner: ${pc.name}`
          );
        }


        const saleItemId =
          saleItem.rows[0].id;


        // =========================================
        // DESCONTAR STOCK CENTRAL
        // NO TOCAR products.stock
        // =========================================

        const partnerStockUpdate =
          await client.query(
            `
            UPDATE partner_catalog_products
            SET
              stock =
                stock - $1,
              updated_at =
                NOW()
            WHERE id = $2
              AND stock >= $1
            RETURNING stock
            `,
            [
              quantity,
              partnerCatalogId
            ]
          );


        if (
          partnerStockUpdate.rows.length ===
          0
        ) {

          throw new Error(
            `Stock central insuficiente: ${pc.name}`
          );
        }


        // =========================================
        // MOVIMIENTO STOCK CENTRAL
        // =========================================

        await client.query(
          `
          INSERT INTO partner_stock_movements
          (
            partner_catalog_id,
            type,
            quantity,
            settlement_price,
            company_id,
            reference_type,
            reference_id
          )
          VALUES
          (
            $1,
            'OUT',
            $2,
            $3,
            $4,
            'sale',
            $5
          )
          `,
          [
            partnerCatalogId,
            quantity,
            settlementUnitPrice,
            companyId,
            saleId
          ]
        );


        // =========================================
        // DISTRIBUCIÓN ECONÓMICA PARTNER
        // =========================================

        await client.query(
          `
          INSERT INTO partner_sale_allocations
          (
            sale_id,
            sale_item_id,
            product_id,
            partner_catalog_id,
            company_id,
            quantity,
            unit_price,
            settlement_unit_price,
            gross_amount,
            settlement_amount,
            commission_amount,
            status
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            'pending'
          )
          `,
          [
            saleId,
            saleItemId,
            productId,
            partnerCatalogId,
            companyId,
            quantity,
            unitPrice,
            settlementUnitPrice,
            subtotal,
            settlementAmount,
            commissionAmount
          ]
        );


        continue;
      }


      // ===========================================
      // FUENTE DESCONOCIDA
      // ===========================================

      throw new Error(
        `Tipo de inventario inválido: ${p.name}`
      );
    }


    // =============================================
    // 5. TOTAL DEFINITIVO
    // =============================================

    await client.query(
      `
      UPDATE sales
      SET total = $1
      WHERE id = $2
        AND company_id = $3
      `,
      [
        total,
        saleId,
        companyId
      ]
    );


    // =============================================
    // 6. INGRESO REAL EN CAJA
    // TODO LO COBRADO AL CLIENTE ENTRA A CAJA
    // =============================================

    await client.query(
      `
      INSERT INTO cash_movements
      (
        type,
        reference_type,
        reference_id,
        amount,
        staff_id,
        company_id
      )
      VALUES
      (
        'income',
        'sale',
        $1,
        $2,
        $3,
        $4
      )
      `,
      [
        saleId,
        total,
        staffId,
        companyId
      ]
    );


    // =============================================
    // 7. TODO CORRECTO
    // =============================================

    await client.query(
      'COMMIT'
    );


    return res.json({
      success:
        true,

      sale_id:
        saleId,

      total:
        total,

      partner_settlement_total:
        partnerSettlementTotal,

      partner_commission_total:
        partnerCommissionTotal
    });


  } catch (err) {

    try {

      await client.query(
        'ROLLBACK'
      );

    } catch (_) {}


    console.error(
      '❌ ERROR CREANDO VENTA:',
      err
    );


    return res
      .status(400)
      .json({
        error:
          err.message
      });


  } finally {

    client.release();
  }
};

exports.cancelSale = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const saleId = Number.parseInt(req.params.id, 10);
    const companyId = req.user.company_id;
    const staffId = req.user.id;

    // =============================
    // 1️⃣ VALIDAR ID
    // =============================
    if (
      !Number.isInteger(saleId) ||
      saleId <= 0
    ) {
      throw new Error("Venta inválida");
    }

    // =============================
    // 2️⃣ BUSCAR Y BLOQUEAR VENTA
    // =============================
    const saleResult = await client.query(
      `
      SELECT
        id,
        total,
        status
      FROM sales
      WHERE id = $1
        AND company_id = $2
      FOR UPDATE
      `,
      [
        saleId,
        companyId
      ]
    );

    if (saleResult.rows.length === 0) {

      await client.query('ROLLBACK');

      return res.status(404).json({
        error: "Venta no encontrada o no autorizada"
      });
    }

    const sale = saleResult.rows[0];

    // =============================
    // 3️⃣ EVITAR DOBLE ANULACIÓN
    // =============================
    if (sale.status === 'cancelled') {

      await client.query('ROLLBACK');

      return res.status(400).json({
        error: "La venta ya fue anulada"
      });
    }

    // =============================
    // 4️⃣ OBTENER PRODUCTOS AGRUPADOS
    //
    // IMPORTANTE:
    // Si el mismo producto aparece varias veces
    // en la venta, devolvemos el TOTAL una sola vez.
    // =============================
    const items = await client.query(
      `
      SELECT
        si.product_id,

        SUM(si.quantity) AS quantity,

        COALESCE(
          (
            SELECT
              SUM(sm.quantity * sm.cost_price)
              /
              NULLIF(SUM(sm.quantity), 0)

            FROM stock_movements sm

            WHERE sm.reference_type = 'sale'
              AND sm.reference_id = si.sale_id
              AND sm.product_id = si.product_id
              AND sm.type = 'OUT'
              AND sm.company_id = si.company_id
          ),
          p.cost_price,
          0
        ) AS cost_price

      FROM sale_items si

      LEFT JOIN products p
        ON p.id = si.product_id
       AND p.company_id = si.company_id

      WHERE si.sale_id = $1
        AND si.company_id = $2

      GROUP BY
        si.product_id,
        si.sale_id,
        si.company_id,
        p.cost_price
      `,
      [
        saleId,
        companyId
      ]
    );

    if (items.rows.length === 0) {
      throw new Error(
        "La venta no contiene productos"
      );
    }

    // =============================
    // 5️⃣ DEVOLVER INVENTARIO
    // =============================
    for (const item of items.rows) {

      const quantity = Number(item.quantity);
      const costPrice = Number(item.cost_price || 0);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          `Cantidad inválida para producto ${item.product_id}`
        );
      }

      if (
        !Number.isFinite(costPrice) ||
        costPrice < 0
      ) {
        throw new Error(
          `Costo inválido para producto ${item.product_id}`
        );
      }

      const productUpdate = await client.query(
        `
        UPDATE products
        SET stock = stock + $1
        WHERE id = $2
          AND company_id = $3
        RETURNING stock
        `,
        [
          quantity,
          item.product_id,
          companyId
        ]
      );

      if (productUpdate.rows.length === 0) {
        throw new Error(
          `Producto ${item.product_id} no encontrado`
        );
      }

      // =============================
      // 6️⃣ REGISTRAR DEVOLUCIÓN
      // =============================
      await client.query(
        `
        INSERT INTO stock_movements
        (
          product_id,
          type,
          quantity,
          cost_price,
          staff_id,
          company_id,
          reference_type,
          reference_id
        )
        VALUES
        ($1,'IN',$2,$3,$4,$5,'sale_cancel',$6)
        `,
        [
          item.product_id,
          quantity,
          costPrice,
          staffId,
          companyId,
          saleId
        ]
      );
    }

    // =============================
    // 7️⃣ MARCAR VENTA CANCELADA
    // =============================
    const cancelResult = await client.query(
      `
      UPDATE sales
      SET status = 'cancelled'
      WHERE id = $1
        AND company_id = $2
        AND status IS DISTINCT FROM 'cancelled'
      RETURNING id
      `,
      [
        saleId,
        companyId
      ]
    );

    if (cancelResult.rows.length === 0) {
      throw new Error(
        "No se pudo anular la venta"
      );
    }

    // =============================
    // 8️⃣ REVERSAR INGRESO DE CAJA
    // =============================
    const saleTotal = Number(sale.total);

    if (
      !Number.isFinite(saleTotal) ||
      saleTotal < 0
    ) {
      throw new Error(
        "Total de venta inválido"
      );
    }

    await client.query(
      `
      INSERT INTO cash_movements
      (
        type,
        reference_type,
        reference_id,
        amount,
        staff_id,
        company_id
      )
      VALUES
      ('expense','sale_cancel',$1,$2,$3,$4)
      `,
      [
        saleId,
        saleTotal,
        staffId,
        companyId
      ]
    );

    // =============================
    // 9️⃣ TODO OK
    // =============================
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: "Venta anulada correctamente"
    });

  } catch (err) {

    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error(
      "❌ ERROR ANULANDO VENTA:",
      err
    );

    return res.status(400).json({
      error: err.message
    });

  } finally {

    client.release();

  }
};

exports.updateProduct = async (req, res) => {

  try {

    const { id } = req.params;

    const {
      name,
      cost_price,
      price,
      image_url
    } = req.body;

    const companyId = req.user.company_id;

    // =============================
    // 1️⃣ VALIDACIONES
    // =============================
    const costPrice = Number(cost_price);
    const salePrice = Number(price);

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Nombre del producto obligatorio"
      });
    }

    if (
      !Number.isFinite(costPrice) ||
      costPrice < 0
    ) {
      return res.status(400).json({
        error: "Costo inválido"
      });
    }

    if (
      !Number.isFinite(salePrice) ||
      salePrice < 0
    ) {
      return res.status(400).json({
        error: "Precio inválido"
      });
    }

    // =============================
    // 2️⃣ ACTUALIZAR PRODUCTO
    // STOCK NO SE MODIFICA AQUÍ
    // =============================
    const { rows } = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        cost_price = $2,
        price = $3,
        image_url = $4
      WHERE id = $5
        AND company_id = $6
      RETURNING *
      `,
      [
        name.trim(),
        costPrice,
        salePrice,
        image_url || null,
        id,
        companyId
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Producto no encontrado o no autorizado"
      });
    }

    return res.json(rows[0]);

  } catch (err) {

    console.error(
      "❌ ERROR ACTUALIZANDO PRODUCTO:",
      err
    );

    return res.status(500).json({
      error: "Error actualizando producto"
    });

  }

};

exports.deleteProduct = async (req, res) => {

  try {

    const productId = Number.parseInt(
      req.params.id,
      10
    );

    const companyId =
      req.user.company_id;

    // =============================
    // VALIDAR ID
    // =============================
    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return res.status(400).json({
        error: "Producto inválido"
      });
    }

    // =============================
    // SOFT DELETE
    // =============================
    const { rows } = await pool.query(
      `
      UPDATE products
      SET is_active = false
      WHERE id = $1
        AND company_id = $2
        AND is_active = true
      RETURNING
        id,
        name,
        stock
      `,
      [
        productId,
        companyId
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Producto no encontrado"
      });
    }

    return res.json({
      success: true,
      message: "Producto eliminado",
      product: rows[0]
    });

  } catch (err) {

    console.error(
      "❌ ERROR ELIMINANDO PRODUCTO:",
      err
    );

    return res.status(500).json({
      error: "Error eliminando producto"
    });
  }
};

exports.addStock = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const { product_id, quantity, cost_price } = req.body;

    const staffId = req.user.id;
    const companyId = req.user.company_id;

    // =============================
    // 1️⃣ VALIDAR DATOS
    // =============================
    const productId = Number.parseInt(product_id, 10);
    const qty = Number.parseInt(quantity, 10);
    const costPrice = Number(cost_price);

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      throw new Error("Producto inválido");
    }

    if (
      !Number.isInteger(qty) ||
      qty <= 0
    ) {
      throw new Error(
        "La cantidad debe ser mayor a cero"
      );
    }

    if (
      !Number.isFinite(costPrice) ||
      costPrice < 0
    ) {
      throw new Error(
        "Costo de compra inválido"
      );
    }

    // =============================
    // 2️⃣ VALIDAR Y BLOQUEAR PRODUCTO
    // =============================
    const product = await client.query(
      `
      SELECT
        id,
        stock,
        cost_price,
        is_active
      FROM products
      WHERE id = $1
        AND company_id = $2
      FOR UPDATE
      `,
      [
        productId,
        companyId
      ]
    );

    if (product.rows.length === 0) {
      throw new Error(
        "Producto no existe o no autorizado"
      );
    }

    if (!product.rows[0].is_active) {
      throw new Error(
        "No se puede ingresar stock a un producto inactivo"
      );
    }

    // =============================
    // 3️⃣ ACTUALIZAR STOCK Y COSTO
    // =============================
    await client.query(
      `
      UPDATE products
      SET
        stock = stock + $1,
        cost_price = $2
      WHERE id = $3
        AND company_id = $4
      `,
      [
        qty,
        costPrice,
        productId,
        companyId
      ]
    );

    // =============================
    // 4️⃣ REGISTRAR ENTRADA
    // =============================
    const movementResult = await client.query(
      `
      INSERT INTO stock_movements
      (
        product_id,
        type,
        quantity,
        cost_price,
        staff_id,
        company_id,
        reference_type
      )
      VALUES
      ($1,'IN',$2,$3,$4,$5,'purchase')
      RETURNING id
      `,
      [
        productId,
        qty,
        costPrice,
        staffId,
        companyId
      ]
    );

    const movementId =
      movementResult.rows[0].id;

    // =============================
    // 5️⃣ REGISTRAR EGRESO EN CAJA
    // =============================
    const totalCost = qty * costPrice;

    await client.query(
      `
      INSERT INTO cash_movements
      (
        type,
        reference_type,
        reference_id,
        amount,
        staff_id,
        company_id
      )
      VALUES
      ('expense','stock',$1,$2,$3,$4)
      `,
      [
        movementId,
        totalCost,
        staffId,
        companyId
      ]
    );

    // =============================
    // 6️⃣ TODO OK
    // =============================
    await client.query('COMMIT');

    return res.json({
      success: true,
      stock_added: qty,
      cost_price: costPrice,
      total_cost: totalCost
    });

  } catch (err) {

    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error(
      "❌ ERROR AGREGANDO STOCK:",
      err
    );

    return res.status(400).json({
      error: err.message
    });

  } finally {

    client.release();

  }

};

exports.getProductHistory = async (req, res) => {

  try {

    const { id } = req.params;
    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `
      SELECT 
        sm.id,
        sm.type,
        sm.quantity,
        sm.cost_price,
        sm.reference_type,
        sm.reference_id,
        sm.created_at,
        u.name AS staff_name,

        CASE
          WHEN sm.type = 'OUT'
          AND sm.reference_type = 'sale'
          THEN (
            SELECT
              SUM(si.subtotal) / NULLIF(SUM(si.quantity), 0)
            FROM sale_items si
            WHERE si.sale_id = sm.reference_id
              AND si.product_id = sm.product_id
              AND si.company_id = sm.company_id
          )
          ELSE NULL
        END AS sale_unit_price

      FROM stock_movements sm
      LEFT JOIN users u
        ON u.id = sm.staff_id
      WHERE sm.product_id = $1
        AND sm.company_id = $2
      ORDER BY sm.created_at ASC, sm.id ASC
      `,
      [id, companyId]
    );

    let stock = 0;
    let totalCost = 0;

    const history = rows.map((r) => {

      const quantity = Number(r.quantity);
      const movementCost = Number(r.cost_price || 0);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          `Movimiento ${r.id} con cantidad inválida`
        );
      }

      // =============================
      // ENTRADA
      // =============================
      if (r.type === 'IN') {

        stock += quantity;
        totalCost += quantity * movementCost;

      }

      // =============================
      // SALIDA
      // =============================
      if (r.type === 'OUT') {

        if (quantity > stock) {
          throw new Error(
            `Movimiento ${r.id} deja stock negativo`
          );
        }

        // 🔥 El costo promedio se calcula
        // ANTES de descontar la salida.
        const avgBefore =
          stock > 0
            ? totalCost / stock
            : 0;

        stock -= quantity;
        totalCost -= avgBefore * quantity;

        // Evita residuos decimales cuando stock llega a 0
        if (stock === 0) {
          totalCost = 0;
        }
      }

      const avgCost =
        stock > 0
          ? totalCost / stock
          : 0;

      return {
        ...r,
        quantity,
        cost_price: movementCost,
        stock_after: stock,
        avg_cost: Number(avgCost.toFixed(2)),
      };
    });

    return res.json(history);

  } catch (err) {

    console.error(
      "❌ PRODUCT HISTORY ERROR:",
      err
    );

    return res.status(500).json({
      error: "Error obteniendo historial"
    });

  }

};

// ===============================
// 📊 INVENTORY REPORT
// ===============================
exports.getInventoryReport = async (req, res) => {

  try {

    const companyId = req.user.company_id;
    const { from, to } = req.query;

    const { rows } = await pool.query(
      `
      SELECT 
        sm.type,
        sm.quantity,
        sm.cost_price,
        sm.reference_type,
        sm.created_at,
        p.name as product_name,
        u.name as staff_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.staff_id
      WHERE sm.company_id = $1
      AND sm.created_at BETWEEN $2 AND $3
      ORDER BY sm.created_at DESC
      `,
      [companyId, from, to]
    );

    let total_in_qty = 0;
    let total_out_qty = 0;
    let total_in_bs = 0;
    let total_out_bs = 0;

    const movements = rows.map(r => {

      const total = (r.quantity || 0) * (r.cost_price || 0);

      if (r.type === 'IN') {
        total_in_qty += r.quantity;
        total_in_bs += total;
      }

      if (r.type === 'OUT') {
        total_out_qty += r.quantity;
        total_out_bs += total;
      }

      return {
        ...r,
        total
      };

    });

    res.json({
      total_in_qty,
      total_out_qty,
      total_in_bs,
      total_out_bs,
      movements
    });

  } catch (err) {

    console.error("INVENTORY REPORT ERROR:", err);

    res.status(500).json({
      error: "Error generando reporte inventario"
    });

  }
};

// desargar a excel 

const ExcelJS = require('exceljs');

exports.exportInventoryExcel = async (req, res) => {

  try {

    const { from, to } = req.query;
    const companyId = req.user.company_id;

    // ============================================
    // 🔥 TRAER MOVIMIENTOS
    // ============================================
    const { rows } = await pool.query(
      `
      SELECT 
        sm.created_at,
        sm.product_id,
        p.name as product_name,
        sm.type,
        sm.quantity,
        sm.cost_price,
        p.price,
        u.name as staff_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.staff_id
      WHERE sm.company_id = $1
      AND sm.created_at BETWEEN $2 AND $3
      ORDER BY p.name ASC, sm.created_at ASC
      `,
      [companyId, from, to]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario');

    // ============================================
    // 🔥 HEADERS
    // ============================================
    sheet.columns = [
      { header: 'Fecha', key: 'date', width: 20 },
      { header: 'Producto', key: 'product', width: 25 },
      { header: 'Tipo', key: 'type', width: 10 },
      { header: 'Cantidad', key: 'qty', width: 10 },
      { header: 'Costo', key: 'cost', width: 12 },
      { header: 'Precio', key: 'price', width: 12 },
      { header: 'Stock', key: 'stock_after', width: 10 },
      { header: 'Costo Promedio', key: 'avg_cost', width: 15 },
      { header: 'Usuario', key: 'user', width: 20 },
    ];

    // ============================================
    // 🔥 AGRUPAR POR PRODUCTO
    // ============================================
    const grouped = {};

    rows.forEach(r => {
      if (!grouped[r.product_id]) {
        grouped[r.product_id] = {
          name: r.product_name,
          movements: []
        };
      }
      grouped[r.product_id].movements.push(r);
    });

    // ============================================
    // 🔥 PROCESAR CADA PRODUCTO
    // ============================================
    for (const productId in grouped) {

      const product = grouped[productId];

      let stock = 0;
      let totalCost = 0;

      // ============================================
      // 🔥 SALDO INICIAL POR PRODUCTO
      // ============================================
      const initialData = await pool.query(
        `
        SELECT type, quantity, cost_price
        FROM stock_movements
        WHERE company_id = $1
        AND product_id = $2
        AND created_at < $3
        `,
        [companyId, productId, from]
      );

      initialData.rows.forEach(r => {

        if (r.type === 'IN') {
          stock += r.quantity;
          totalCost += r.quantity * (r.cost_price || 0);
        }

        if (r.type === 'OUT') {
          const avg = stock > 0 ? totalCost / stock : 0;
          stock -= r.quantity;
          totalCost -= avg * r.quantity;
        }

      });

      const initialAvg = stock > 0 ? totalCost / stock : 0;

      // 🔥 FILA SALDO INICIAL
      sheet.addRow({
        date: '',
        product: `SALDO INICIAL - ${product.name}`,
        type: '',
        qty: '',
        cost: '',
        price: '',
        stock_after: stock,
        avg_cost: initialAvg.toFixed(2),
        user: '',
      });

      // ============================================
      // 🔥 MOVIMIENTOS DEL PRODUCTO
      // ============================================
      product.movements.forEach(r => {

        if (r.type === 'IN') {
          stock += r.quantity;
          totalCost += r.quantity * (r.cost_price || 0);
        }

        if (r.type === 'OUT') {
          const avg = stock > 0 ? totalCost / stock : 0;
          stock -= r.quantity;
          totalCost -= avg * r.quantity;
        }

        const avgCost = stock > 0 ? totalCost / stock : 0;

        sheet.addRow({
          date: r.created_at,
          product: product.name,
          type: r.type,
          qty: r.quantity,
          cost: r.cost_price || 0,
          price: r.price || 0,
          stock_after: stock,
          avg_cost: avgCost.toFixed(2),
          user: r.staff_name || '',
        });

      });

      // 🔥 ESPACIO ENTRE PRODUCTOS
      sheet.addRow({});

    }

    // ============================================
    // 🔥 RESPONSE
    // ============================================
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=inventory_report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {

    console.error("EXPORT INVENTORY ERROR:", err);

    res.status(500).json({
      error: "Error exportando inventario"
    });

  }

};