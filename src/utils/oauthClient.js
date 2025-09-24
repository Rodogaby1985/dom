// src/utils/oauthClient.js v2.0 (MODIFICADO)
'use strict'; // Añadimos 'use strict' por buena práctica

const axios = require('axios');
// --- IMPORTAMOS NUESTRO NUEVO CEREBRO DE CONFIGURACIÓN ---
const config = require('../config');
const { TIENDA_NUBE_AUTH_URL, TIENDA_NUBE_TOKEN_URL } = require('./constants');
const logger = require('./logger');

// --- VALIDACIÓN TEMPRANA ---
// Nos aseguramos de que la configuración esencial exista al iniciar la app.
if (!config.tiendaNube.clientId || !config.tiendaNube.clientSecret || !config.publicApiUrl) {
    logger.error('Falta configuración crítica (APP_ID, CLIENT_SECRET o PUBLIC_API_URL) en las variables de entorno.');
    // Detenemos la aplicación si la configuración no es válida para evitar errores inesperados.
    throw new Error('Credenciales o URL pública de Tienda Nube no configuradas.');
}

/**
 * Genera la URL de autorización de Tienda Nube.
 * Ya no necesita recibir `clientId` ni `publicApiUrl`, los toma de la config.
 * @param {string} state - Un valor aleatorio para protección CSRF.
 * @returns {string} La URL completa de autorización de Tienda Nube.
 */
const getAuthorizationUrl = (state) => {
    // La 'redirect_uri' ahora es consistente y se construye desde la config.
    const redirectUri = `${config.publicApiUrl}/oauth_callback`; // Corregido a /auth/callback como en tus rutas
     
    const scopes = ["read_products", "write_products", "read_orders", "read_shipping", "edit_shipping", "read_logistics", "write_logistics"]; 
     
    const params = new URLSearchParams({
        client_id: config.tiendaNube.clientId, // Usa el ID desde la config
        scope: scopes.join(' '),
        redirect_uri: redirectUri,
        response_type: 'code',
        state: state
    }).toString();

    const authUrl = `${TIENDA_NUBE_AUTH_URL}?${params}`;
    logger.info(`URL de autorización generada: ${authUrl}`);
    return authUrl;
};

/**
 * Intercambia el código de autorización por un token de acceso.
 * Ya no necesita recibir las credenciales, las toma de la config.
 * @param {string} code - El código de autorización recibido de Tienda Nube.
 * @returns {Promise<object>} Una promesa que resuelve con los datos del token.
 * @throws {Error} Si falla la solicitud.
 */
// --- REEMPLAZA LA FUNCIÓN COMPLETA POR ESTA ---
const exchangeCodeForToken = async (code) => {
    const redirectUri = `${config.publicApiUrl}/oauth_callback`;
    
    // --- CAMBIO CLAVE: CONSTRUIR UN OBJETO JAVASCRIPT SIMPLE, NO URLSearchParams ---
    const postData = {
        client_id: config.tiendaNube.clientId,
        client_secret: config.tiendaNube.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
    };

    logger.info(`[DEBUG] Intercambiando código por token...`);
    
    try {
        // --- CAMBIO CLAVE: ENVIAR EL OBJETO DIRECTAMENTE. AXIOS LO CONVERTIRÁ A JSON ---
        const response = await axios.post(TIENDA_NUBE_TOKEN_URL, postData, {
            headers: {
                // Axios pondrá 'application/json' por defecto, pero lo hacemos explícito por claridad.
                'Content-Type': 'application/json' 
            }
        });
        
        // --- AÑADIMOS UNA VALIDACIÓN EXTRA ---
        if (response.data.error) {
             logger.error(`Error en la respuesta de Tienda Nube: ${JSON.stringify(response.data)}`);
             throw new Error(response.data.error_description || 'Error desconocido de Tienda Nube');
        }

        logger.info(`Token de acceso recibido para la tienda: ${response.data.user_id}`);
        return response.data;
    } catch (error) {
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        logger.error(`Error al intercambiar código por token: ${errorMsg}`);
        
        // Propagamos el error para que la ruta que llama lo maneje
        if (error.response && error.response.data) {
            return error.response.data;
        }
        throw new Error(`Fallo al obtener el token de acceso: ${errorMsg}`);
    }
};

module.exports = {
    getAuthorizationUrl,
    exchangeCodeForToken
};

