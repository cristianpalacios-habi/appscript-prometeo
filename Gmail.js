/**
 * Lectura y respuesta de correos en Gmail.
 */

/**
 * Busca hilos nuevos de reportes de phishing que aun no han sido respondidos.
 * Por ahora limitado al remitente de prueba (ver Config.js).
 */
function buscarReportesNuevos() {
  const consulta =
    "in:inbox from:" + REMITENTE_PRUEBA + " -label:" + ETIQUETA_PROCESADO;
  return GmailApp.search(consulta, 0, 10);
}

/**
 * Extrae el nombre del remitente del encabezado "From".
 * Ejemplos: "Luis Perez <luis@x.com>" -> "Luis Perez"; "luis@x.com" -> "luis".
 */
function extraerNombreRemitente(mensaje) {
  const from = mensaje.getFrom();
  const conNombre = from.match(/^"?([^"<]+?)"?\s*</);
  if (conNombre && conNombre[1].trim()) {
    return conNombre[1].trim();
  }
  // Sin nombre visible: usar la parte antes del @ del correo.
  const soloCorreo = from.replace(/[<>]/g, "").trim();
  return soloCorreo.split("@")[0];
}

/**
 * Extrae las imagenes adjuntas del mensaje (maximo 3, hasta 4 MB cada una)
 * en el formato que espera la API de Gemini.
 */
function extraerImagenes(mensaje) {
  return mensaje
    .getAttachments()
    .filter(function (adjunto) {
      return (
        adjunto.getContentType().indexOf("image/") === 0 &&
        adjunto.getSize() <= 4 * 1024 * 1024
      );
    })
    .slice(0, 3)
    .map(function (adjunto) {
      return {
        mimeType: adjunto.getContentType(),
        datosBase64: Utilities.base64Encode(adjunto.getBytes()),
      };
    });
}

/**
 * Extrae la direccion de correo real del encabezado "From".
 * Ejemplo: "Rosa Palaci <palacibelrose431@gmail.com>" -> "palacibelrose431@gmail.com".
 */
function extraerCorreoRemitente(mensaje) {
  const from = mensaje.getFrom();
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].trim() : from.trim();
}

/**
 * Envia la respuesta directamente a la direccion que envio el reporte.
 * No usamos mensaje.reply() porque responde al encabezado Reply-To, que en un
 * correo de phishing puede ser una direccion controlada por el atacante.
 */
function enviarRespuesta(mensaje, textoRespuesta) {
  const destinatario = extraerCorreoRemitente(mensaje);
  const asunto = mensaje.getSubject() || "";
  GmailApp.sendEmail(
    destinatario,
    asunto.match(/^re:/i) ? asunto : "Re: " + asunto,
    textoRespuesta
  );
  return destinatario;
}

/**
 * Marca el hilo con la etiqueta de procesado (la crea si no existe).
 */
function marcarProcesado(hilo) {
  const etiqueta =
    GmailApp.getUserLabelByName(ETIQUETA_PROCESADO) ||
    GmailApp.createLabel(ETIQUETA_PROCESADO);
  hilo.addLabel(etiqueta);
}
