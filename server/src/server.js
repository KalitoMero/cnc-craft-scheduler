require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { requestLogger, logger } = require('./config/logger');

// Routes
const excelRoutes = require('./routes/excel');
const ordersRoutes = require('./routes/orders');
const settingsRoutes = require('./routes/settings');
const mediaRoutes = require('./routes/media');
const machinesRoutes = require('./routes/machines');
const departmentsRoutes = require('./routes/departments');
const additionalInfosRoutes = require('./routes/additionalInfos');
const partFamiliesRoutes = require('./routes/partFamilies');

const app = express();
const PORT = process.env.PORT || 3006;

// Create uploads dir
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(helmet());
app.use(requestLogger);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\\d+)?$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\\d+)?$/.test(origin))
        return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', excelRoutes);
app.use('/api', ordersRoutes);
app.use('/api', settingsRoutes);
app.use('/api', mediaRoutes);
app.use('/api', machinesRoutes);
app.use('/api', departmentsRoutes);
app.use('/api', additionalInfosRoutes);
app.use('/api', partFamiliesRoutes);

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// 404
app.use('*', (_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🌍 Network access enabled - accessible from other devices`);
});

module.exports = app;
