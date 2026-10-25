export const entities = {
 usuarios:{table:'usuario',pk:'id_usuario',fields:['nombre_usuario','contrasena','rol','estado','tiempo_sistema','permite_eliminar','limite_credito','comision_parley','comision_tripleta','monto_limite_parley'],required:['nombre_usuario']},
 sorteos:{table:'sorteo',pk:'id_sorteo',fields:['nombre_sorteo','hora_cierre','hora_sorteo','cantidad_ganadores','se_paga_3','sorteo_reventado','estado'],required:['nombre_sorteo','hora_cierre','hora_sorteo']},
 parametros:{table:'parametizacion_sorteo',pk:'id_parametizacion_sorteo',fields:['id_usuario','id_sorteo','comision','paga_calle','paga_reventado','porcentaje_restriccion','monto_arranque','limite_venta','aplica_devolucion','paga_a_los_3','pago_primero','pago_segundo','pago_tercero','incluir_generar','mostrar_venta'],required:['id_usuario','id_sorteo']},
 programacion:{table:'programacion',pk:'id_programacion',fields:['id_usuario','id_sorteo','fecha_cierre','fecha_sorteo','numeros_restringidos','estado'],required:['id_usuario','id_sorteo','fecha_cierre','fecha_sorteo']},
 tiquetes:{table:'tiquete',pk:'id_tiquete',fields:['id_programacion','nombre_comprador','total','fecha_tiquete','revertido','fecha_reversion'],required:['id_programacion']},
 ganadores:{table:'numero_ganador',pk:'id_numero_ganador',fields:['id_programacion','numero_ganador','bolita_reventada'],required:['id_programacion','numero_ganador']},
 reportes:{table:'reporte_cobro',pk:'id_reporte_cobro',fields:['id_usuario','evento','fecha_evento','tipo','importe','comision','premio','balance','descripcion','fecha_transaccion','generado'],required:['id_usuario','tipo','importe']}
} as const;
export type Entity = keyof typeof entities;
export function isEntity(v:string):v is Entity{return Object.prototype.hasOwnProperty.call(entities,v)}
