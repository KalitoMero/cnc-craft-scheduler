const express = require('express');
const { query } = require('../config/database');
const { z } = require('zod');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Settings by key
router.get('/settings/:key', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM settings WHERE setting_key = $1', [req.params.key]);
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  setting_key: z.string(),
  setting_value: z.any(),
  description: z.string().optional().nullable(),
});

router.put('/settings', validate(upsertSchema), async (req, res, next) => {
  try {
    const { setting_key, setting_value, description = null } = req.body;
    await query('BEGIN');
    await query('DELETE FROM settings WHERE setting_key = $1', [setting_key]);
    const { rows } = await query(
      'INSERT INTO settings (setting_key, setting_value, description) VALUES ($1, $2, $3) RETURNING *',
      [setting_key, setting_value, description]
    );
    await query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

// Excel column mappings
router.get('/excel-column-mappings', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM excel_column_mappings ORDER BY column_number ASC', []);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

const mappingSchema = z.object({
  id: z.string().uuid().optional(),
  column_name: z.string(),
  column_number: z.number().int().nonnegative(),
  is_article_number: z.boolean().optional().default(false),
  is_ba_number: z.boolean().optional().default(false),
  is_internal_completion_date: z.boolean().optional().default(false),
});

router.put('/excel-column-mappings', validate(z.array(mappingSchema)), async (req, res, next) => {
  try {
    const mappings = req.body;
    await query('BEGIN');
    await query('DELETE FROM excel_column_mappings', []);
    for (const m of mappings) {
      await query(
        'INSERT INTO excel_column_mappings (column_name, column_number, is_article_number, is_ba_number, is_internal_completion_date) VALUES ($1, $2, $3, $4, $5)',
        [m.column_name, m.column_number, m.is_article_number ?? false, m.is_ba_number ?? false, m.is_internal_completion_date ?? false]
      );
    }
    await query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

// Machine Excel mappings
router.get('/machine-excel-mappings', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM machine_excel_mappings ORDER BY created_at', []);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

const memSchema = z.object({
  machine_id: z.string().uuid(),
  excel_designation: z.string(),
  column_numbers: z.array(z.number().int().nonnegative()).default([]),
});

router.put('/machine-excel-mappings', validate(z.array(memSchema)), async (req, res, next) => {
  try {
    const mappings = req.body;
    await query('BEGIN');
    await query('DELETE FROM machine_excel_mappings', []);
    for (const m of mappings) {
      await query(
        'INSERT INTO machine_excel_mappings (machine_id, excel_designation, column_numbers) VALUES ($1, $2, $3)',
        [m.machine_id, m.excel_designation, m.column_numbers]
      );
    }
    await query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

module.exports = router;
