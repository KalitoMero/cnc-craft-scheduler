const express = require('express');
const { query } = require('../config/database');
const { z } = require('zod');
const { validate } = require('../middleware/validate');

const router = express.Router();

const machineSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  display_order: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

router.get('/machines', async (_req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM machines WHERE is_active = true ORDER BY display_order, created_at',
      []
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/machines', validate(machineSchema), async (req, res, next) => {
  try {
    const { name, description, display_order = 0, is_active = true } = req.body;
    const { rows } = await query(
      'INSERT INTO machines (name, description, display_order, is_active) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, description ?? null, display_order, is_active]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/machines/:id', validate(machineSchema.partial()), async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'display_order', 'is_active'];
    const sets = [];
    const values = [];
    fields.forEach((f) => {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        sets.push(`${f} = $${values.length + 1}`);
        values.push(req.body[f]);
      }
    });
    values.push(id);
    const sql = `UPDATE machines SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`;
    const { rows } = await query(sql, values);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/machines/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      'UPDATE machines SET is_active = false, updated_at = now() WHERE id = $1 RETURNING *',
      [id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
