// src/config.js
'use strict';

// Cargar variables de entorno desde .env (para desarrollo local)
require('dotenv').config();

/// Determinar la URL pública de forma inteligente.
let publicApiUrl = process.env.DOKKU_APP_SSL_URL || process.env.PUBLIC_API_URL;

// En producción, nos aseguramos de que siempre use https
if (publicApiUrl && !publicApiUrl.startsWith('http')) {
  publicApiUrl = `https://${publicApiUrl}`;
}

const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  modality: process.env.MODALIDAD || 'sucursal',
  publicApiUrl: publicApiUrl,
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
  // --- AGREGADO: Configuración para Redis ---
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  tiendaNube: {
    clientId: process.env.APP_ID,
    clientSecret: process.env.CLIENT_SECRET,
  },
  google: {
    sheetId: process.env.GOOGLE_SHEET_ID,
  }
};

module.exports = config;
