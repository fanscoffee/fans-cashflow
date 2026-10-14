# Guía de compartir cupones por WhatsApp

Fans Cashflow genera el cupón cuando un encargo pasa a estado **Entregado**. El envío se hace manualmente desde la aplicación; no se utiliza Vercel Cron ni la API de WhatsApp de Meta.

## Flujo operativo

1. Marca el encargo como **Entregado**.
2. El sistema genera un código único en estado **Pendiente de compartir**.
   El código tiene exactamente cuatro caracteres alfanuméricos en mayúsculas.
3. Un usuario **ADMIN** o **SOCIO** lo verá con el código en `/cupones` y en el botón de notificaciones.
4. Pulsa **Compartir código**.
5. En móvil, selecciona WhatsApp desde la hoja de compartir.
6. Si el dispositivo no ofrece compartir, copia el mensaje, pégalo en WhatsApp y pulsa **Marcar como compartido**.
7. Después de confirmar el compartir, el cupón pasa a **Compartido** y queda activo durante 15 días.

El cupón no puede validarse ni canjearse antes de compartirlo. El código contiene el descuento configurado y el nombre del cliente aparece también en el mensaje.

Todos los usuarios autenticados pueden comprobar un código desde el verificador. Los usuarios **EMPLOYEE** solo reciben en la campana un aviso y el número de cupones pendientes; no pueden ver códigos, activarlos ni compartirlos.

## Requisitos

- Sesión iniciada con rol `ADMIN` o `SOCIO` para compartir cupones.
- `COUPON_DISCOUNT_PERCENTAGE` opcional; por defecto es `10`.
- No hace falta configurar `CRON_SECRET`, tokens de Meta ni plantillas de WhatsApp.

## Prueba completa

1. Inicia la aplicación con `pnpm dev`.
2. Crea un encargo con nombre y teléfono.
3. Marca el encargo como **Entregado**.
4. Abre `/cupones` o el botón de notificaciones.
5. Comparte el código y confirma la acción.
6. Comprueba que el estado cambia a **Cupón compartido**.
7. Introduce el código en el verificador y pulsa **Comprobar**.
8. Pulsa **Marcar como usado** para probar el canje atómico.

## Comportamiento esperado

- Marcar como entregado genera un solo cupón por encargo.
- Repetir la actualización del encargo no crea otro código.
- Compartir dos veces el mismo cupón es seguro y conserva la primera activación válida.
- Un cupón no compartido devuelve el estado **Pendiente** en el verificador.
- Un cupón compartido caduca 15 días después de la activación.
- Solo `ADMIN` y `SOCIO` pueden consultar la lista pendiente, activar un cupón o compartirlo.
- `EMPLOYEE` puede comprobar códigos y recibe un aviso de pendientes sin acceder a los códigos.

## Solución de problemas

| Síntoma | Solución |
|---|---|
| No aparece el botón de notificaciones | Comprueba que haya un encargo próximo o un cupón pendiente y recarga la página. |
| No aparece un cupón | Verifica que el encargo esté marcado como **Entregado** y que la sesión sea `ADMIN` o `SOCIO`. |
| El navegador no ofrece compartir | Copia el mensaje y utiliza **Marcar como compartido** después de pegarlo en WhatsApp. |
| El cupón sigue pendiente | La activación solo ocurre tras completar la hoja de compartir o confirmar manualmente el copiado. |
| El código no es válido | Comprueba que se haya compartido y que no hayan pasado 15 días. |

## Seguridad

- El código se genera en el servidor y es único.
- La activación se realiza en un endpoint protegido y de forma atómica.
- Los tokens de Meta o WhatsApp no deben añadirse al proyecto porque este flujo no los necesita.
