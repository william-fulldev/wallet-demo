// Importo mi aplicación ya configurada, con sus rutas.
// Escribo ".js" aunque el archivo sea app.ts, porque Node ejecutará el JavaScript resultante.
import { app } from "./app.js";

// Importo la función que conecta con MongoDB.
import { connectDatabase } from "./config/database.js";

// Importo mi configuración validada.
// Si algún valor es incorrecto, mi API se detiene aquí antes de hacer nada más.
import { env } from "./config/env.js";

// Agrupo el arranque en una función para controlar el orden de los pasos.
async function startServer(): Promise<void> {
  // Primero me conecto a la base de datos y espero a que responda.
  // Si falla, se lanza un error y no llego a abrir el puerto.
  await connectDatabase();

  // Solo después pongo mi API a escuchar peticiones.
  app.listen(env.port, (error) => {
    // Si no puedo usar el puerto (por ejemplo, porque ya está ocupado), me detengo.
    if (error) {
      console.error(`No pude abrir el puerto ${env.port}: ${error.message}`);
      process.exit(1);
    }

    // Si todo va bien, me muestro la dirección para probarla.
    console.log(`API escuchando en http://localhost:${env.port}`);
  });
}

// Ejecuto el arranque y recojo cualquier error que ocurra antes de que mi API esté lista.
startServer().catch((error: unknown) => {
  // Muestro solo el mensaje, no el objeto entero, para no volcar detalles de la conexión.
  const message = error instanceof Error ? error.message : "Error desconocido";
  console.error(`No se pudo arrancar la API: ${message}`);

  // Salgo con código 1, que indica que el programa terminó con un fallo.
  process.exit(1);
});
