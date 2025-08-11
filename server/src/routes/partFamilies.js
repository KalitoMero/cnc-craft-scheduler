const express = require('express');
const { query } = require('../config/database');
const { z } = require('zod');
const { validate } = require('../middleware/validate');

const router = express.Router();

// List families
router.get('/part-families', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name, description, created_at FROM part_families ORDER BY created_at DESC', []);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// List family items
router.get('/part-family-items', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT id, family_id, part_value, position FROM part_family_items ORDER BY position ASC', []);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

const createFamilySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

router.post('/part-families', validate(createFamilySchema), async (req, res, next) => {
  try {
    const { name, description = null } = req.body;
    const { rows } = await query('INSERT INTO part_families (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at', [name, description]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

const updateFamilySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

router.put('/part-families/:id', validate(updateFamilySchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description = null } = req.body;
    const { rows } = await query('UPDATE part_families SET name = $1, description = $2, updated_at = now() WHERE id = $3 RETURNING id, name, description, created_at', [name, description, id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Replace items for a family
const itemsSchema = z.object({
  items: z.array(z.string().min(1)),
});

router.put('/part-families/:id/items', validate(itemsSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    await query('BEGIN');
    await query('DELETE FROM part_family_items WHERE family_id = $1', [id]);
    if (items.length) {
      for (let i = 0; i < items.length; i++) {
        await query('INSERT INTO part_family_items (family_id, part_value, position) VALUES ($1, $2, $3)', [id, items[i], i]);
      }
    }
    await query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

module.exports = router;
