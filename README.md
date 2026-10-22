# wallet-demo

Una wallet multidivisa simulada que he creado para practicar desarrollo full-stack con Ionic React, TypeScript, Express y MongoDB.

Mi objetivo es construir una aplicación que resulte sencilla de usar y aprender a gestionar lo que ocurre detrás de cada operación: validar datos, proteger las cuentas y mantener los saldos coherentes.

> Todo el dinero es simulado. No se realizan pagos bancarios ni inversiones reales.

## Qué puedes probar

- Consultar saldos en EUR, USD y BRL.
- Cambiar dinero entre tus cuentas.
- Enviar dinero a los contactos disponibles.
- Consultar el historial de movimientos.
- Comprar y vender activos simulados desde la cuenta USD.
- Ver el valor de la cartera y su ganancia o pérdida.

Los ingresos manuales están desactivados en esta demo.

## Cuenta de demostración

Puedes entrar con esta cuenta pública:

| Usuario | Correo | Contraseña |
| --- | --- | --- |
| William S. | william.demo@gmail.com | Password108! |

La cuenta es compartida, por lo que el saldo y el historial pueden cambiar cuando otras personas la utilizan.

Si te he facilitado una cuenta personalizada, utiliza las credenciales que te haya enviado directamente.

## Un recorrido rápido

1. Inicia sesión y consulta tus cuentas.
2. Prueba un cambio de moneda.
3. Elige un contacto en Quick Transfer y realiza un envío.
4. Compra un activo con saldo USD.
5. Vende una parte o toda la posición y consulta el movimiento.

Las cotizaciones pueden estar actualizadas, almacenadas en caché o ser precios de ejemplo. La aplicación indica su procedencia.

## Cómo lo he construido

| Parte | Tecnologías |
| --- | --- |
| Frontend | Ionic, React, TypeScript y TanStack Query |
| Backend | Node.js, Express y TypeScript |
| Base de datos | MongoDB Atlas y Mongoose |
| Pruebas | Vitest y Supertest |
| Android | Capacitor |

He prestado especial atención a tres puntos:

- Guardar el dinero en céntimos enteros para controlar los redondeos.
- Utilizar transacciones para que una operación se complete entera o no se aplique.
- Evitar movimientos duplicados cuando se reintenta una petición.

## Sobre el proyecto

Este es un proyecto de aprendizaje y portfolio, no un servicio financiero preparado para producción.

Los retratos se han generado con IA. Las marcas y los comercios aparecen como ejemplos, sin afiliación con las empresas representadas.

Estoy desarrollándolo para afianzar mis conocimientos y poder explicar tanto lo que funciona como las decisiones que hay detrás.

## Autor

Wellington · Desarrollador junior full-stack

[Mi perfil de GitHub](https://github.com/william-fulldev)
