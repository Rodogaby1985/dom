// src/services/googleSheetsService.js V5.7 Variante DOMICILIO (mínima)
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const logger = require('../utils/logger');
const path = require('path');

let sheetsClient = null;
let sheetDataCache = {};

const POSTAL_CODES_SHEET_NAME = "CODIGOS POSTALES";
const RATE_SHEET_NAMES = [
  "ANDREANI DOM",
  "CA DOM",
  "OCA DOM",
  "URBANO",
  "ANDREANI BIGGER A DOM"
];

const getSheetsClient = async () => {
  if (sheetsClient) return sheetsClient;
  
// --- Inicio del Bloque Mejorado ---

function getCredentials() {
  if (process.env.GCP_CREDENTIALS_JSON) {
    // En producción (Coolify), leemos las credenciales desde la variable de entorno.
    try {
      return JSON.parse(process.env.GCP_CREDENTIALS_JSON);
    } catch (e) {
      console.error("Error al parsear GCP_CREDENTIALS_JSON:", e);
      throw new Error("Las credenciales de GCP_CREDENTIALS_JSON no son un JSON válido.");
    }
  }
  if (process.env.GCP_CREDENTIALS_PATH) {
    // Para desarrollo local, seguimos usando la ruta al archivo.
    try {
      return require(process.env.GCP_CREDENTIALS_PATH);
    } catch (e) {
      console.error(`Error al cargar credenciales desde la ruta: ${process.env.GCP_CREDENTIALS_PATH}`, e);
      throw new Error("No se pudo cargar el archivo de credenciales en la ruta especificada.");
    }
  }
  // Si no se encuentra ninguna, lanzamos un error claro.
  throw new Error('Credenciales de Google Cloud no encontradas. Define GCP_CREDENTIALS_JSON o GCP_CREDENTIALS_PATH en tus variables de entorno.');
}

const auth = new GoogleAuth({
  credentials: getCredentials(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// --- Fin del Bloque Mejorado ---
  
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
};

const loadAllSheetDataIntoCache = async () => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Códigos postales
    const postalCodesRange = `${POSTAL_CODES_SHEET_NAME}!A:C`;
    const postalCodesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: postalCodesRange });
    sheetDataCache[POSTAL_CODES_SHEET_NAME] = postalCodesResponse.data.values;

    for (const sheetName of RATE_SHEET_NAMES) {
      const ratesRange = `${sheetName}!A:Z`;
      const ratesResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: ratesRange });
      sheetDataCache[sheetName] = ratesResponse.data.values;
    }
  } catch (e) {
    logger.error("Error cargando cache Sheets (DOMICILIO): " + e.message);
  }
};

const getProvinceFromPostalCode = (postalCode) => {
  const rows = sheetDataCache[POSTAL_CODES_SHEET_NAME];
  if (!rows) return null;
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const iCP = headers.findIndex(h => h.trim().toUpperCase() === 'CP');
  const iProv = headers.findIndex(h => h.trim().toUpperCase() === 'PROVINCIA');
  if (iCP === -1 || iProv === -1) return null;
  const found = dataRows.find(r => r[iCP] === postalCode);
  return found ? found[iProv] : null;
};

const getShippingRatesFromSheet = (sheetName, weightKg, postalCode) => {
  if (!postalCode) return [];
  const rows = sheetDataCache[sheetName];
  if (!rows) return [];
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const idxMin = headers.findIndex(h => h.trim().toUpperCase() === 'PESO MIN');
  const idxMax = headers.findIndex(h => h.trim().toUpperCase() === 'PESO MAX');
  const idxPrecio = headers.findIndex(h => h.trim().toUpperCase() === 'PRECIO');
  let idxTitulo = headers.findIndex(h => h.trim().toUpperCase() === 'TÍTULO');
  if (idxTitulo === -1) idxTitulo = headers.findIndex(h => h.trim().toUpperCase() === 'TITULO');
  const idxProv = headers.findIndex(h => h.trim().toUpperCase() === 'PROVINCIA');
  if ([idxMin, idxMax, idxPrecio, idxTitulo, idxProv].some(i => i === -1)) return [];

  const province = getProvinceFromPostalCode(postalCode);
  if (!province) return [];

  const matches = dataRows.filter(r => {
    const prov = r[idxProv];
    const min = parseFloat(r[idxMin] || 0);
    const max = parseFloat(r[idxMax] || 9999999);
    return prov && prov.toUpperCase() === province.toUpperCase() && weightKg >= min && weightKg <= max;
  }).map(r => ({
    name: r[idxTitulo],
    cost: parseFloat(r[idxPrecio] || 0),
    delivery_type: 'ship'
  }));

  return matches.length ? [matches[0]] : [];
};

module.exports = {
  loadAllSheetDataIntoCache,
  getShippingRatesFromSheet,
  getSheetsClient
};



