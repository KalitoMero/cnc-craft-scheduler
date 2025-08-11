const express = require('express');
const router = express.Router();

// Media is served from /uploads statically in server.js
router.get('/media/ping', (_req, res) => res.json({ success: true }));

module.exports = router;
