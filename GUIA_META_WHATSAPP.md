# Configuración de WhatsApp Business

Esta guía explica cómo conectar Fans Cashflow con la WhatsApp Business Cloud API de Meta desde cero.

La aplicación no utiliza WhatsApp Web ni controla el WhatsApp personal de un móvil. Envía plantillas oficiales mediante la API de Meta.

## Qué necesitas

- Una cuenta de Meta/Facebook con permisos de administrador.
- Un Business Portfolio, antes llamado Business Manager.
- Un número de teléfono para WhatsApp Business.
- Acceso al proyecto de Fans Cashflow en Vercel.
- Un teléfono personal para recibir mensajes de prueba.

### Sobre el número emisor

El número real que se registre en Meta no puede estar activo simultáneamente en la aplicación normal de WhatsApp o en WhatsApp Business del móvil.

Para empezar se puede utilizar el número de prueba que proporciona Meta. Para producción se recomienda un número exclusivo del negocio.

## 1. Crear la aplicación de Meta

1. Abre [Meta for Developers](https://developers.facebook.com/).
2. Inicia sesión con la cuenta que administra el negocio.
3. Entra en **My Apps** o **Mis aplicaciones**.
4. Pulsa **Create App**.
5. Selecciona un caso de uso relacionado con negocio o comunicación, si Meta lo pregunta.
6. Selecciona el tipo **Business** cuando aparezca esa opción.
7. Escribe un nombre, por ejemplo `Fans Cashflow WhatsApp`.
8. Selecciona el Business Portfolio correcto.
9. Acepta las condiciones y crea la aplicación.

Los nombres del panel pueden variar según el idioma y la versión de Meta. El resultado debe ser una aplicación de tipo **Business** vinculada al Business Portfolio correcto.

## 2. Añadir WhatsApp a la aplicación

1. Dentro de la aplicación busca **Add products**, **Añadir productos** o **Configuración del producto**.
2. Localiza **WhatsApp**.
3. Pulsa **Set up** o **Configurar**.
4. Selecciona o crea el Business Portfolio si Meta lo solicita.
5. Selecciona o crea una **WhatsApp Business Account**, también llamada WABA.
6. Completa el asistente inicial.

Al terminar deberías ver una pantalla llamada **API Setup** o **Configuración de la API**. Esa pantalla contiene el número de prueba, el Phone number ID y un token temporal.

## 3. Probar con el número de Meta

1. Entra en **WhatsApp > API Setup**.
2. Localiza el número de teléfono de prueba de Meta.
3. Busca el campo **To** o **Destinatario**.
4. Añade el número personal que recibirá la prueba.
5. Confirma el código que Meta envía al teléfono.
6. Guarda temporalmente estos datos:
   - **Phone number ID**: identificador numérico del número emisor.
   - **Temporary access token**: token temporal.
   - Nombre de la plantilla de prueba, si Meta proporciona una.

El **Phone number ID** no es el **WhatsApp Business Account ID**. La aplicación necesita el primero.

El token de esta pantalla suele caducar pronto. Sirve para una prueba inicial, pero no debe utilizarse en producción.

## 4. Registrar el número real

Cuando la prueba inicial funcione, registra el número real del negocio.

1. Abre **WhatsApp Manager** desde el Business Portfolio.
2. Entra en **Phone numbers**, **Números de teléfono** o **Configuración**.
3. Pulsa **Add phone number**.
4. Introduce los datos legales del negocio.
5. Selecciona el nombre visible que verán los clientes.
6. Introduce un número capaz de recibir SMS o llamadas.
7. Completa la verificación con el código recibido.
8. Espera la revisión del nombre visible si Meta la solicita.
9. Vuelve a **API Setup** y copia el **Phone number ID** del número real.

Ese identificador será el valor de `WHATSAPP_PHONE_NUMBER_ID`.

Si el número ya está vinculado a WhatsApp normal o WhatsApp Business, Meta puede pedir que se elimine la cuenta existente o que se realice una migración. Comprueba antes qué conversaciones y datos dependen de ese número.

## 5. Crear un token permanente

El token temporal no sirve para producción. Utiliza un token de un **System User**.

1. Abre [Meta Business Settings](https://business.facebook.com/settings).
2. Selecciona el Business Portfolio correcto.
3. Entra en **Users > System Users**.
4. Pulsa **Add**.
5. Crea un usuario, por ejemplo `Fans Cashflow API`.
6. Abre el usuario de sistema recién creado.
7. Pulsa **Add Assets** o **Añadir activos**.
8. Asigna la aplicación `Fans Cashflow WhatsApp`.
9. Asigna la WhatsApp Business Account.
10. Concede permisos suficientes para enviar mensajes y administrar la cuenta.
11. Pulsa **Generate New Token**.
12. Selecciona la aplicación de Meta.
13. Selecciona estos permisos si aparecen:
    - `whatsapp_business_messaging`
    - `whatsapp_business_management`
14. Genera el token.
15. Cópialo inmediatamente y guárdalo en un gestor de contraseñas.

Meta normalmente no vuelve a mostrar el token completo. Si se pierde, revócalo y genera otro.

## 6. Crear la plantilla del mensaje

Los mensajes promocionales enviados fuera de una conversación reciente deben utilizar una plantilla aprobada por Meta.

1. Abre [WhatsApp Manager](https://business.facebook.com/).
2. Selecciona la WhatsApp Business Account correcta.
3. Busca **Message Templates**, **Plantillas de mensajes** o **Account tools > Message templates**.
4. Pulsa **Create template**.
5. Selecciona la categoría **Marketing**, porque el mensaje contiene un descuento.
6. Usa un nombre técnico en minúsculas y con guiones bajos: `promo_tarta`.
7. Selecciona **Spanish (Spain)**, cuyo código normalmente es `es_ES`.
8. Añade el cuerpo del mensaje.
9. Solicita la revisión de Meta.
10. Espera a que el estado sea **Approved** o **Aprobada**.

### Texto recomendado

La aplicación envía tres variables en este orden:

- `{{1}}`: nombre del cliente.
- `{{2}}`: código del cupón.
- `{{3}}`: fecha de caducidad.

Puedes utilizar este texto:

```text
Hola {{1}}. Gracias por confiar en Fans. Tienes un 15% de descuento para tu próxima compra. Usa el código {{2}} antes del {{3}}. ¡Te esperamos!
```

La aplicación utiliza `COUPON_DISCOUNT_PERCENTAGE=15` por defecto. Si se cambia ese porcentaje, también hay que cambiar el texto de la plantilla.

### Ejemplos que pide Meta

| Variable | Valor de ejemplo |
|---|---|
| `{{1}}` | `Juan` |
| `{{2}}` | `TARTA15-JUAN-ABC123` |
| `{{3}}` | `27/10/2026` |

Estos valores solo sirven para la revisión de Meta.

### Recomendaciones para la aprobación

- Explica claramente por qué el cliente recibe el mensaje.
- No utilices afirmaciones engañosas.
- Incluye el nombre del negocio.
- Mantén el texto breve.
- Utiliza Marketing para una promoción.
- No cambies el orden de las variables después de configurar la aplicación.

## 7. Configurar Fans Cashflow

### Desarrollo local

Añade estos valores al archivo `.env` local. No subas ese archivo al repositorio.

```env
CRON_SECRET=crea-un-secreto-largo-y-aleatorio
COUPON_DELAY_HOURS=24
COUPON_DISCOUNT_PERCENTAGE=15
APP_TIME_ZONE=Europe/Madrid
WHATSAPP_API_VERSION=v23.0
WHATSAPP_ACCESS_TOKEN=token-del-system-user
WHATSAPP_PHONE_NUMBER_ID=phone-number-id
WHATSAPP_TEMPLATE_NAME=promo_tarta
WHATSAPP_TEMPLATE_LANGUAGE=es_ES
WHATSAPP_DEFAULT_COUNTRY_CODE=34
```

Genera `CRON_SECRET` con macOS o Linux:

```bash
openssl rand -hex 32
```

No utilices el prefijo `NEXT_PUBLIC_` en ninguna variable de WhatsApp. El token solo debe existir en el servidor.

### Teléfono del pedido

Introduce el teléfono preferentemente en formato internacional:

```text
+34 600 123 456
```

La aplicación elimina espacios y el signo `+`. Para números españoles de nueve cifras que empiezan por `6`, `7`, `8` o `9`, añade automáticamente `34`. Para otros países, utiliza directamente el formato internacional.

### Vercel

1. Abre el proyecto en Vercel.
2. Entra en **Settings > Environment Variables**.
3. Crea todas las variables anteriores.
4. Selecciona **Production**.
5. Selecciona también **Preview** si quieres probar desde una URL de preview.
6. Guarda los cambios.
7. Haz un nuevo deploy.

El proyecto ya contiene `vercel.json` con un cron cada 15 minutos:

```json
{
  "crons": [
    {
      "path": "/api/cupones/procesar",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Vercel enviará la cabecera `Authorization: Bearer <CRON_SECRET>` cuando `CRON_SECRET` esté configurado.

## 8. Probar primero Meta

Antes de probar los pedidos, comprueba por separado el token, el número y la plantilla.

Con las variables definidas en una terminal, ejecuta:

```bash
curl -i -X POST \
  "https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "34600123456",
    "type": "template",
    "template": {
      "name": "promo_tarta",
      "language": { "code": "es_ES" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Juan" },
            { "type": "text", "text": "TARTA15-JUAN-ABC123" },
            { "type": "text", "text": "27/10/2026" }
          ]
        }
      ]
    }
  }'
```

Sustituye `34600123456` por el destinatario autorizado en Meta. Escríbelo sin `+`, espacios ni guiones.

Una respuesta correcta debe devolver HTTP `200` y un identificador parecido a `wamid...` dentro de `messages`.

Si esta llamada falla, corrige Meta antes de probar Fans Cashflow.

## 9. Probar el flujo completo

1. Inicia la aplicación con `pnpm dev` o utiliza el deploy de prueba.
2. Entra en **Encargos**.
3. Crea un pedido con nombre, teléfono internacional, fecha y hora.
4. Abre las acciones del pedido.
5. Pulsa **Entregado**.
6. La aplicación crea un cupón único en estado pendiente.
7. El envío queda programado para 24 horas después.
8. El cron ejecuta `/api/cupones/procesar` cada 15 minutos.
9. Meta recibe la plantilla y el cupón pasa a estado enviado.
10. La caducidad se calcula 15 días después de la confirmación de Meta.
11. Entra en `/cupones`.
12. Introduce el código recibido y pulsa **Comprobar**.
13. Cuando se aplique el descuento, pulsa **Marcar como usado**.
14. Comprueba el código otra vez. Debe aparecer **Este código ya ha sido utilizado**.

### Prueba sin esperar 24 horas

Solo en desarrollo, cambia temporalmente:

```env
COUPON_DELAY_HOURS=1
```

Reinicia la aplicación y crea un pedido nuevo después del cambio. Para producción vuelve a:

```env
COUPON_DELAY_HOURS=24
```

El procesador se puede ejecutar manualmente cuando exista un cupón cuya fecha programada ya haya llegado:

```bash
curl -i -X POST \
  "http://localhost:3000/api/cupones/procesar" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

La respuesta indica el resultado:

```json
{
  "considered": 1,
  "sent": 1,
  "failed": 0,
  "skipped": 0
}
```

## 10. Errores y reintentos

La aplicación no marca el cupón como enviado hasta que Meta devuelve correctamente un identificador de mensaje.

Si Meta rechaza el envío:

- El cupón queda en estado de error.
- Se guarda el último error.
- Se programa un reintento automático.
- El cupón no aparece como válido en `/cupones`.

Revisa los logs de la función `/api/cupones/procesar` en Vercel.

## Problemas habituales

| Síntoma | Solución |
|---|---|
| Falta una variable `WHATSAPP_*` | Revisa las variables de Vercel y haz un nuevo deploy. |
| Error HTTP 401 o 403 | Genera un token de System User y asigna la aplicación y la WABA. |
| Phone number ID no válido | Copia el identificador numérico del número, no el WABA ID. |
| Plantilla no encontrada | Comprueba exactamente el nombre y el idioma `es_ES`. |
| No llega el mensaje de prueba | Autoriza el teléfono destinatario en Meta y usa formato internacional. |
| Plantilla pendiente | Espera el estado Approved antes de enviar. |
| Cupón pendiente | Todavía no han pasado 24 horas o el cron no se ha ejecutado. |
| Cupón en error | Revisa el error guardado y los logs; el sistema reintentará. |
| Meta rechaza la plantilla | Usa la categoría Marketing y explica claramente el descuento. |

## Seguridad y mantenimiento

- No subas el token a GitHub.
- Si el token aparece públicamente, revócalo y genera uno nuevo.
- Usa un token de System User en producción.
- Cambia `CRON_SECRET` si alguien lo conoce.
- No uses `NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN`.
- Revisa periódicamente el estado de la plantilla.
- Revisa los logs después del primer deploy.
- Mantén el mismo nombre e idioma de plantilla configurados en la aplicación.

## Migración de base de datos

La migración de cupones ya se ha aplicado a la base de datos del proyecto:

```text
20261011000000_add_coupons
```

En futuras instalaciones o entornos nuevos se puede ejecutar:

```bash
pnpm prisma migrate deploy
```

## Enlaces oficiales

- [Meta for Developers](https://developers.facebook.com/)
- [WhatsApp Cloud API: Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Meta Business Settings](https://business.facebook.com/settings)
