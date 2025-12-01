const express = require('express');
const { query } = require('../config/database');
const { z } = require('zod');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Schemas
const createOrderSchema = z.object({
  machine_id: z.string().uuid(),
  order_number: z.string().min(1).optional(),
  part_number: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().int().nonnegative().optional(),
  sequence_order: z.number().int().nonnegative().default(0),
  excel_data: z.record(z.any()).optional(),
  priority: z.number().int().optional(),
});

// List orders (optionally by machine)
router.get('/orders', async (req, res, next) => {
  try {
    const { machine_id } = req.query;
    const base = 'SELECT * FROM orders';
    const { rows } = machine_id
      ? await query(base + ' WHERE machine_id = $1 ORDER BY sequence_order ASC, created_at ASC', [machine_id])
      : await query(base + ' ORDER BY created_at DESC', []);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// Create order
router.post('/orders', validate(createOrderSchema), async (req, res, next) => {
  try {
    const fields = [
      'machine_id',
      'order_number',
      'part_number',
      'description',
      'quantity',
      'sequence_order',
      'excel_data',
      'priority',
    ];
    const values = fields.map((f) => (req.body[f] ?? null));
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await query(
      `INSERT INTO orders (${fields.join(',')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Bulk delete by machine
router.delete('/orders/by-machine/:machineId', async (req, res, next) => {
  try {
    const { machineId } = req.params;
    await query('DELETE FROM orders WHERE machine_id = $1', [machineId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Reorder sequence: expects [{id, sequence_order}]
router.put('/orders/reorder', async (req, res, next) => {
  try {
    const updates = Array.isArray(req.body) ? req.body : [];
    if (!updates.length) return res.status(400).json({ success: false, error: 'No updates' });
    await query('BEGIN');
    for (const u of updates) {
      await query('UPDATE orders SET sequence_order = $1, updated_at = now() WHERE id = $2', [
        u.sequence_order,
        u.id,
      ]);
    }
    await query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});
// Delete single order
router.delete('/orders/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Bulk import orders with duplicate check by base order number and optional sync mode
router.post('/orders/bulk-import', async (req, res, next) => {
  try {
    const { filename, file_path = null, orders, syncMode = false } = req.body || {};
    if (!Array.isArray(orders) || !filename) {
      return res.status(400).json({ success: false, error: 'filename and orders[] required' });
    }

    const baseOf = (num) => {
      if (!num) return '';
      const s = String(num);
      if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length >= 2) return parts.slice(0, -1).join('.');
      }
      // fallback: first 9 digits before dot+two digits
      const m = s.match(/^(\d{9})\.(\d{2})$/);
      if (m) return m[1];
      return s;
    };

    // Get existing order numbers for upsert logic
    const orderNumbers = orders.map(o => o.order_number).filter(Boolean);
    let existingOrders = new Map();
    if (orderNumbers.length) {
      const placeholders = orderNumbers.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await query(`SELECT id, order_number, sequence_order, priority FROM orders WHERE order_number IN (${placeholders})`, orderNumbers);
      existingOrders = new Map(rows.map(r => [r.order_number, r]));
    }

    // Get affected machine IDs for sync mode
    const affectedMachines = [...new Set(orders.map(o => o.machine_id))];
    let deletedCount = 0;

    await query('BEGIN');

    // If sync mode is enabled, delete orders not in the new list
    if (syncMode && affectedMachines.length) {
      const newOrderNumbers = new Set(orders.map(o => o.order_number));
      
      for (const machineId of affectedMachines) {
        // Get existing orders for this machine
        const { rows: existingOrders } = await query(
          'SELECT id, order_number FROM orders WHERE machine_id = $1', 
          [machineId]
        );
        
        // Find orders to delete (not in new list)
        const ordersToDelete = existingOrders.filter(order => 
          !newOrderNumbers.has(order.order_number)
        );
        
        // Delete obsolete orders
        for (const orderToDelete of ordersToDelete) {
          await query('DELETE FROM orders WHERE id = $1', [orderToDelete.id]);
          deletedCount++;
        }
        
        // Resequence remaining orders for this machine
        const { rows: remainingOrders } = await query(
          'SELECT id FROM orders WHERE machine_id = $1 ORDER BY sequence_order ASC, created_at ASC',
          [machineId]
        );
        
        for (let i = 0; i < remainingOrders.length; i++) {
          await query(
            'UPDATE orders SET sequence_order = $1, updated_at = now() WHERE id = $2',
            [i, remainingOrders[i].id]
          );
        }
      }
    }

    const { rows: importRows } = await query(
      'INSERT INTO excel_imports (filename, file_path, row_count, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [filename, file_path, orders.length, 'completed']
    );
    const importId = importRows[0].id;

    let insertedCount = 0;
    let updatedCount = 0;

    for (const o of orders) {
      const existing = existingOrders.get(o.order_number);
      
      if (existing) {
        // Update existing order: update excel_data, part_number, machine_id, but keep sequence_order and priority
        await query(
          'UPDATE orders SET excel_data = $1, part_number = $2, machine_id = $3, updated_at = now() WHERE id = $4',
          [o.excel_data || {}, o.part_number || null, o.machine_id, existing.id]
        );
        updatedCount++;
      } else {
        // Insert new order with values from frontend (priority, sequence_order)
        await query(
          'INSERT INTO orders (machine_id, order_number, part_number, excel_import_id, excel_data, status, priority, sequence_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [o.machine_id, o.order_number, o.part_number || null, importId, o.excel_data || {}, 'pending', o.priority ?? 0, o.sequence_order ?? 0]
        );
        insertedCount++;
      }
    }
    await query('COMMIT');

    res.json({ 
      success: true, 
      insertedCount,
      updatedCount,
      deletedCount 
    });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

module.exports = router;
