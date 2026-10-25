import type {PoolConnection, RowDataPacket} from 'mysql2/promise';
// Los valores son provisionales hasta que el administrador edite cada combinación.
// Se prefieren los valores de una parametrización ya existente para el sorteo o puesto.
const cols=['comision','paga_calle','paga_reventado','porcentaje_restriccion','monto_arranque','limite_venta','aplica_devolucion','paga_a_los_3','pago_primero','pago_segundo','pago_tercero','incluir_generar','mostrar_venta'] as const;
const fallback=[10,80,0,0,0,2500,'No','No',75,8,7,'Si','Si'];
async function add(conn:PoolConnection,user:number,draw:number,template:RowDataPacket|undefined){
 const [exists]=await conn.execute<RowDataPacket[]>('SELECT id_parametizacion_sorteo FROM parametizacion_sorteo WHERE id_usuario=? AND id_sorteo=? LIMIT 1',[user,draw]);
 if(exists.length)return false;
 const values=cols.map((col,i)=>template?.[col]??fallback[i]);
 await conn.execute(`INSERT INTO parametizacion_sorteo (id_usuario,id_sorteo,${cols.join(',')}) VALUES (${Array(2+cols.length).fill('?').join(',')})`,[user,draw,...values]);return true;
}
export async function createDefaultsForUser(conn:PoolConnection,user:number){
 const [draws]=await conn.query<RowDataPacket[]>('SELECT id_sorteo FROM sorteo ORDER BY id_sorteo');let count=0;
 for(const d of draws){const [templates]=await conn.execute<RowDataPacket[]>('SELECT * FROM parametizacion_sorteo WHERE id_sorteo=? ORDER BY id_parametizacion_sorteo LIMIT 1',[d.id_sorteo]);if(await add(conn,user,d.id_sorteo,templates[0]))count++;}return count;
}
export async function createDefaultsForDraw(conn:PoolConnection,draw:number){
 const [users]=await conn.query<RowDataPacket[]>("SELECT id_usuario FROM usuario WHERE LOWER(rol)='puesto' ORDER BY id_usuario");let count=0;
 for(const u of users){const [templates]=await conn.execute<RowDataPacket[]>('SELECT * FROM parametizacion_sorteo WHERE id_usuario=? ORDER BY id_parametizacion_sorteo LIMIT 1',[u.id_usuario]);if(await add(conn,u.id_usuario,draw,templates[0]))count++;}return count;
}
export async function syncDefaults(conn:PoolConnection){
 const [users]=await conn.query<RowDataPacket[]>("SELECT id_usuario FROM usuario WHERE LOWER(rol)='puesto' ORDER BY id_usuario");let count=0;
 for(const u of users)count+=await createDefaultsForUser(conn,u.id_usuario);
 return count;
}
