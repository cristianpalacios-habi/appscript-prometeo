/**
 * Punto de entrada del proyecto.
 */

/**
 * Procesa los reportes de phishing pendientes: busca correos nuevos del
 * remitente autorizado, detecta el genero del remitente con Gemini y
 * responde con el acuse de recibo personalizado.
 */
function procesarReportesPhishing() {
  const hilos = buscarReportesNuevos();
  if (hilos.length === 0) {
    Logger.log("Sin reportes nuevos que procesar.");
    return;
  }

  Logger.log("Reportes por procesar: " + hilos.length);

  hilos.forEach(function (hilo) {
    const mensajes = hilo.getMessages();
    const mensaje = mensajes[mensajes.length - 1];
    const nombre = extraerNombreRemitente(mensaje);

    const analisis = analizarYRedactarRespuesta(
      nombre,
      mensaje.getSubject(),
      mensaje.getPlainBody(),
      extraerImagenes(mensaje)
    );

    const destinatario = enviarRespuesta(mensaje, analisis.respuesta);
    marcarProcesado(hilo);

    Logger.log(
      "Respondido a %s (nombre: %s, genero: %s)",
      destinatario,
      analisis.nombre,
      analisis.genero
    );
  });
}

/**
 * Activa la revision automatica de la bandeja cada 5 minutos.
 * Ejecutar UNA sola vez (si ya existe el trigger, lo reemplaza, no lo duplica).
 */
function activarEnvioAutomatico() {
  eliminarEnvioAutomatico();
  ScriptApp.newTrigger("procesarReportesPhishing")
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log("Listo: la bandeja se revisara automaticamente cada 5 minutos.");
}

/**
 * Apaga la revision automatica (elimina el trigger).
 */
function eliminarEnvioAutomatico() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "procesarReportesPhishing") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/**
 * Envia un correo de prueba "Hello email" a tu propia cuenta.
 * Sirve como smoke test del permiso de envio de correos.
 */
function helloEmail() {
  const destinatario = Session.getActiveUser().getEmail();
  MailApp.sendEmail(destinatario, "Hello email", "Hello email desde Apps Script!");
  Logger.log("Correo 'Hello email' enviado a " + destinatario);
}
