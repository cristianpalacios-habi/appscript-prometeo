/**
 * Constantes y lectura de Script Properties.
 */

// Mientras el proyecto esta en pruebas, SOLO se responden correos de este remitente.
// Al pasar a produccion real, este filtro se ajustara en un milestone futuro.
const REMITENTE_PRUEBA = "palacibelrose431@gmail.com";

// Etiqueta de Gmail para marcar hilos ya respondidos y no responder dos veces.
const ETIQUETA_PROCESADO = "phishing-procesado";

// Modelo de Gemini a usar. Alias mantenido por Google que apunta al flash mas reciente.
const GEMINI_MODELO = "gemini-flash-latest";

/**
 * Lee la API key de Gemini desde Script Properties.
 * Se configura en: Configuracion del proyecto > Propiedades de secuencia de comandos.
 */
function getGeminiApiKey() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "Falta la propiedad GEMINI_API_KEY. Configurala en Configuracion del proyecto > Propiedades de secuencia de comandos."
    );
  }
  return apiKey;
}
