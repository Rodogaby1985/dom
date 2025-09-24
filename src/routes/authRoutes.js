// src/routes/authRoutes.js v3.1 (VARIANTE DOMICILIO) con logs de depuración de sesión
const express = require('express');
const router = express.Router();
const oauthClient = require('../utils/oauthClient');
const tiendaNubeService = require('../services/tiendaNubeService');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// --- RUTA DE INICIO DE INSTALACIÓN ---
router.get('/install', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauth_state = state;

  req.session.save((err) => {
    if (err) {
      logger.error('Error al guardar la sesión antes de redirigir:', err);
      return res.status(500).send('No se pudo iniciar el proceso de autorización.');
    }

    // --- LOGS DE DEPURACIÓN ---
    logger.info('--- RUTA /install (INICIO) ---');
    logger.info(`ID de Sesión: ${req.sessionID}`);
    logger.info(`Session Object Guardado: ${JSON.stringify(req.session)}`);
    // --- FIN LOGS ---

    const redirectUri = `${config.publicApiUrl}/oauth_callback`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.tiendaNube.clientId,
      redirect_uri: redirectUri,
      state: state
    });

    const baseUrl = `https://www.tiendanube.com/apps/${config.tiendaNube.clientId}/authorize`;
    const finalUrl = `${baseUrl}?${params.toString()}`;
    res.redirect(finalUrl);
  });
});

// --- RUTA DE CALLBACK DE OAUTH ---
router.get('/oauth_callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;

    // --- LOGS DE DEPURACIÓN ---
    logger.info('--- RUTA /oauth_callback (LLEGADA) ---');
    logger.info(`Cookies recibidas del navegador: ${req.headers.cookie || 'NINGUNA'}`);
    logger.info(`ID de Sesión: ${req.sessionID}`);
    logger.info(`Session Object Recibido: ${JSON.stringify(req.session)}`);
    logger.info(`Estado CSRF esperado (de la sesión): ${req.session.oauth_state}`);
    logger.info(`Estado CSRF recibido (de la URL): ${state}`);
    // --- FIN LOGS ---

    if (!state || state !== req.session.oauth_state) {
      logger.error(`Fallo de verificación CSRF. Esperado: ${req.session.oauth_state}, Recibido: ${state}`);
      return res.status(400).send("Estado inválido (protección CSRF fallida)");
    }

    req.session.oauth_state = null;

    const tokenData = await oauthClient.exchangeCodeForToken(code);

    if (tokenData.error) {
      logger.error(`Error recibido de la API de Tienda Nube: ${tokenData.error_description}`);
      return res.status(400).send(`Error de Tienda Nube: ${tokenData.error_description}`);
    }

    const accessToken = tokenData.access_token;
    const storeId = tokenData.user_id;

    logger.info(`Token obtenido para la tienda ID: ${storeId}`);

    const carrierName = "Mobapp Domicilio";
    const carrierInfo = await tiendaNubeService.registerShippingCarrier(
      storeId,
      accessToken,
      config.publicApiUrl,
      carrierName
    );
    const carrierId = carrierInfo.id;

    const options = [
      { code: "ANDREANI_DOM", name: "ANDREANI A DOMICILIO" },
      { code: "CA_DOM", name: "CORREO ARGENTINO A DOMICILIO" },
      { code: "OCA_DOM", name: "OCA A DOMICILIO" },
      { code: "URBANO_DOM", name: "URBANO A DOMICILIO" },
      { code: "ANDREANI_BIGGER_DOM", name: "ANDREANI BIGGER A DOM" }
    ];

    for (const opt of options) {
      await tiendaNubeService.createCarrierOption(storeId, accessToken, carrierId, {
        code: opt.code,
        name: opt.name,
        types: 'ship',
        additional_days: 0,
        additional_cost: 0,
        allow_free_shipping: true,
        active: true
      });
    }

    res.send("¡Aplicación de Domicilio instalada y configurada con éxito!");

  } catch (error) {
    next(error);
  }
});

// Ruta principal para la página de bienvenida
router.get('/', (req, res) => {
  res.send(`
    <h1>Aplicación de Envíos</h1>
    <p>Para instalar la aplicación en tu Tienda Nube, hacé clic en el siguiente enlace:</p>
    <a href="/install">Instalar Aplicación</a>
  `);
});

module.exports = router;

