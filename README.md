# LuckyTimes Modern V3 — MySQL / XAMPP

Este proyecto es la primera integración **real con MySQL**, basada en las ocho tablas del archivo `luckyTimes.sql` original. No utiliza localStorage ni registros de ejemplo.

## 1. Iniciar XAMPP

En XAMPP, inicia **MySQL**. Abre phpMyAdmin e importa `database/luckyTimesDB-safe.sql` usando la pestaña **Importar** (o copia el SQL en la pestaña SQL). El script crea `luckyTimesDB` y las ocho tablas **sin borrar datos existentes**. Si ya importaste tu SQL original, NO vuelvas a importar una copia destructiva.

## 2. Configurar Next.js

1. Instala Node.js 20 o superior.
2. Abre la carpeta en VS Code.
3. Copia `.env.example` a `.env.local`.
4. Ajusta usuario, contraseña, puerto y nombre de MySQL; XAMPP suele usar root y contraseña vacía **solo en desarrollo local**.
5. Ejecuta:

```bash
npm install
npm run dev
```

6. Abre http://localhost:3000.

**Next.js NO se copia a htdocs.** XAMPP se utiliza solo como servidor MySQL. Next.js corre con Node en el puerto 3000.

## Qué funciona con datos persistentes

- CRUD MySQL de usuarios, sorteos, parametrización y programación (borrado protegido por relaciones; usuarios y sorteos se desactivan).
- Emisión de tiquete con detalle en una transacción de MySQL. Solo admite programaciones activas cuya hora de cierre no haya pasado.
- Registro y consulta de números ganadores, con prevención de doble registro por programación desde la API.
- Consulta de tiquete mediante enlace/QR y comparación básica de números; **no calcula premios ni autoriza pagos**.
- Reporte de movimientos existentes en `reporte_cobro` en modo lectura.
- Dashboard con totales reales calculados desde la base.

## Límites importantes

- **NO publicar en internet ni usar con dinero real.** No hay autenticación ni autorización de servidor. Los endpoints están abiertos en tu entorno local.
- Los nuevos passwords se guardan con scrypt, pero todavía no hay login. Si importas datos viejos, sus contraseñas siguen con el formato heredado: migrarlas antes de activar autenticación.
- `reporte_cobro` es solo lectura hasta revisar el cálculo de saldo, comisión y premios del PHP original.
- La coincidencia de un número NO equivale a un premio calculado. El QR contiene un enlace de consulta, no una credencial de cobro.
- `tiquete` + `detalle_tiquete` se guardan juntos. No se permiten ediciones ni borrados libres de transacciones.
- El esquema se ha conservado fiel al original; no se añadieron restricciones UNIQUE ni tablas de pagos que puedan alterar la lógica sin verificar.
- Para pruebas usa una base nueva y datos ficticios. Haz copia de seguridad antes de importar o modificar datos.

## Diagnóstico rápido

- `ECONNREFUSED`: XAMPP MySQL no iniciado o puerto equivocado.
- `ER_BAD_DB_ERROR`: importa el SQL o corrige `DB_NAME`.
- `ER_ACCESS_DENIED_ERROR`: revisa credenciales en `.env.local`.
- Errores de claves foráneas: selecciona primero un usuario y un sorteo existentes.

## Próxima fase

Autenticación con roles, validación de premios según parametrización original, cobros idempotentes, reversión auditable, límites de venta y conciliación de caja. Todo eso necesita revisar y probar reglas de negocio antes de habilitarlo.

## Cambios V5: parametrización automática
- Al crear un **Puesto** se generan parametrizaciones para todos los sorteos existentes.
- Al crear un **Sorteo** se generan parametrizaciones para todos los puestos existentes.
- Se copia una parametrización previa del mismo sorteo (para puesto nuevo) o del mismo puesto (para sorteo nuevo); si no hay plantilla, se usan valores provisionales: comisión 10, paga_calle 80, reventado 0, restricción 0, arranque 0, límite 2500, premios 75/8/7, generar y mostrar Si.
- La operación se realiza en una transacción. Las configuraciones existentes nunca se sobreescriben.
- **Sincronizar parametrizaciones** completa las combinaciones faltantes para puestos existentes. Haz una copia de seguridad antes de usarlo.
- **Programar Sorteos** abre directamente el modal con etiquetas de sorteos activos, permite quitar con ×, configurar fecha, restringidos y estado; no hay botón «Cargar Sorteos».
- El sistema sigue siendo un prototipo de pruebas locales **sin login ni autorización**. No exponer a Internet ni usar con dinero real.

## V6: Centro de tiquetes
- Generar tiquetes de varias líneas (repetidos permitidos) desde puestos con sorteos programados activos.
- Consultar por fecha y sorteo; detalle e impresión de recibo térmico con QR de consulta.
- Verificar todas las jugadas frente al número ganador registrado.
- Validación de restricciones en transacción: bloqueo por programación, acumulado por puesto/programación/número y rechazo de líneas que excedan el tope; el resto se guarda.

**Limitaciones importantes antes de producción:** La tabla original no guarda el límite exacto individual de cada número restringido. Temporalmente se usa `parametizacion_sorteo.limite_venta` como límite por número restringido. Confirmar esta interpretación con la lógica PHP original antes de vender. La verificación QR por ID no está protegida contra enumeración y no debe publicarse sin un token firmado e inicio de sesión/autorización para operaciones sensibles. No hay módulo de pagos de premios ni cálculo definitivo de premios; una coincidencia no implica premio pagado. No usar con dinero real hasta completar autenticación, auditoría, reglas de premios, reversión y seguridad.
