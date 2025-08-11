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

module.exports = router;
