import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import type {RowDataPacket,ResultSetHeader} from 'mysql2';
export const runtime='nodejs';
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s);
const normalized=(v:unknown)=>String(v??'').padStart(2,'0');
export async function GET(req:NextRequest){
 try{
  const date=req.nextUrl.searchParams.get('date');const id=req.nextUrl.searchParams.get('id');
  if(id){const n=Number(id);if(!Number.isSafeInteger(n)||n<1)return fail('ID inválido');const [tickets]=await db().execute<RowDataPacket[]>(`SELECT t.*,p.id_usuario,p.id_sorteo,p.fecha_sorteo,s.nombre_sorteo,u.nombre_usuario,ps.paga_calle,ng.numero_ganador FROM tiquete t JOIN programacion p ON p.id_programacion=t.id_programacion JOIN sorteo s ON s.id_sorteo=p.id_sorteo JOIN usuario u ON u.id_usuario=p.id_usuario LEFT JOIN parametizacion_sorteo ps ON ps.id_usuario=p.id_usuario AND ps.id_sorteo=p.id_sorteo LEFT JOIN numero_ganador ng ON ng.id_programacion=p.id_programacion WHERE t.id_tiquete=? LIMIT 1`,[n]);if(!tickets.length)return fail('Tiquete no encontrado',404);const [details]=await db().execute<RowDataPacket[]>('SELECT id_detalle_tiquete,numero,monto,reventado FROM detalle_tiquete WHERE id_tiquete=? ORDER BY id_detalle_tiquete',[n]);return NextResponse.json({ticket:tickets[0],details});}
  if(!date||!validDate(date))return fail('Fecha inválida');
  const [draws]=await db().execute<RowDataPacket[]>(`SELECT DISTINCT s.id_sorteo,s.nombre_sorteo FROM programacion p JOIN sorteo s ON s.id_sorteo=p.id_sorteo WHERE DATE(p.fecha_sorteo)=? ORDER BY s.nombre_sorteo`,[date]);
  const [tickets]=await db().execute<RowDataPacket[]>(`SELECT t.id_tiquete,t.nombre_comprador,t.total,t.fecha_tiquete,t.revertido,t.fecha_reversion,p.id_sorteo,s.nombre_sorteo,u.nombre_usuario,GROUP_CONCAT(d.numero ORDER BY d.id_detalle_tiquete SEPARATOR ',') AS numeros FROM tiquete t JOIN programacion p ON p.id_programacion=t.id_programacion JOIN sorteo s ON s.id_sorteo=p.id_sorteo JOIN usuario u ON u.id_usuario=p.id_usuario LEFT JOIN detalle_tiquete d ON d.id_tiquete=t.id_tiquete WHERE DATE(p.fecha_sorteo)=? GROUP BY t.id_tiquete,t.nombre_comprador,t.total,t.fecha_tiquete,t.revertido,t.fecha_reversion,p.id_sorteo,s.nombre_sorteo,u.nombre_usuario ORDER BY t.id_tiquete DESC LIMIT 3000`,[date]);
  return NextResponse.json({draws,tickets});
 }catch(e){return fail(e instanceof Error?e.message:'Error de MySQL',500)}
}
export async function POST(req:NextRequest){
 let conn;try{
  const body=await req.json() as {id_programacion:number;nombre_comprador?:string;lines?:{numero:string;monto:number;reventado?:number}[]};
  const prog=Number(body.id_programacion),lines=body.lines;
  if(!Number.isSafeInteger(prog)||prog<1||!Array.isArray(lines)||!lines.length||lines.length>300)return fail('Programación o jugadas inválidas');
  if(lines.some(l=>!/^(\d{1,2})$/.test(String(l.numero))||Number(l.numero)>99||!Number.isSafeInteger(Number(l.monto))||Number(l.monto)<50||!Number.isSafeInteger(Number(l.reventado||0))||Number(l.reventado||0)<0))return fail('Los números deben ser 00–99 y cada monto normal debe ser al menos ₡50');
  conn=await db().getConnection();await conn.beginTransaction();
  const [p]=await conn.execute<RowDataPacket[]>(`SELECT p.*,ps.limite_venta,ps.monto_arranque,ps.porcentaje_restriccion,ps.paga_reventado,s.sorteo_reventado FROM programacion p JOIN sorteo s ON s.id_sorteo=p.id_sorteo LEFT JOIN parametizacion_sorteo ps ON ps.id_usuario=p.id_usuario AND ps.id_sorteo=p.id_sorteo WHERE p.id_programacion=? FOR UPDATE`,[prog]);
  if(!p.length||p[0].estado!=='Activo')throw Error('El sorteo está inactivo');
  const [clock]=await conn.execute<RowDataPacket[]>('SELECT fecha_cierre > NOW() AS abierto FROM programacion WHERE id_programacion=?',[prog]);
  if(!Number(clock[0]?.abierto))throw Error('El sorteo ya cerró');
  if(lines.some(l=>Number(l.reventado||0)>0)&&p[0].sorteo_reventado!=='Si')throw Error('Este sorteo no permite monto reventado');
  if(lines.some(l=>Number(l.reventado||0)>Number(l.monto)))throw Error('El monto reventado no puede superar el monto normal');
  const restricted=new Set(String(p[0].numeros_restringidos||'').split(',').map(x=>x.trim().padStart(2,'0')).filter(x=>/^\d{2}$/.test(x)));
  // Equivalencia de select_permitidos.php: restringidos usan monto_arranque +
  // porcentaje del total vendido; los demás usan limite_venta. Se conserva
  // la validación secuencial para apuestas repetidas.
  const [sales]=await conn.execute<RowDataPacket[]>(`SELECT LPAD(d.numero,2,'0') numero,COALESCE(SUM(d.monto),0) vendido FROM detalle_tiquete d JOIN tiquete t ON t.id_tiquete=d.id_tiquete WHERE t.id_programacion=? AND t.revertido IS NULL GROUP BY LPAD(d.numero,2,'0')`,[prog]);
  const [totals]=await conn.execute<RowDataPacket[]>(`SELECT COALESCE(SUM(total),0) total FROM tiquete WHERE id_programacion=? AND revertido IS NULL`,[prog]);
  const sold=new Map<string,number>(sales.map(x=>[String(x.numero),Number(x.vendido)]));
  let drawTotal=Number(totals[0]?.total||0);
  const start=Number(p[0].monto_arranque||0),percent=Number(p[0].porcentaje_restriccion||0),limit=Number(p[0].limite_venta||0);
  const accepted:typeof lines=[];const rejected:{numero:string;monto:number;disponible:number}[]=[];
  for(const l of lines){
   const num=normalized(l.numero),amount=Number(l.monto),rev=Number(l.reventado||0);
   const already=sold.get(num)||0;
   const raw=restricted.has(num)?start-already+Math.max(0,drawTotal*percent/100-start):limit-already;
   const remaining=Math.max(0,Math.trunc(raw));
   if(amount>remaining){rejected.push({numero:num,monto:amount,disponible:remaining});continue;}
   accepted.push({numero:num,monto:amount,reventado:rev});sold.set(num,already+amount);
   drawTotal+=amount+rev;
  }
  if(!accepted.length){await conn.rollback();return NextResponse.json({error:'Ninguna jugada cabe en el límite disponible',rejected},{status:409})}
  const total=accepted.reduce((sum,l)=>sum+Number(l.monto)+Number(l.reventado||0),0);
  const [result]=await conn.execute<ResultSetHeader>("INSERT INTO tiquete(id_programacion,nombre_comprador,total,fecha_tiquete,revertido) VALUES(?,?,?,NOW(),NULL)",[prog,String(body.nombre_comprador||'CLIENTE CONTADO').slice(0,150),total]);
  for(const l of accepted)await conn.execute('INSERT INTO detalle_tiquete(id_tiquete,numero,monto,reventado) VALUES(?,?,?,?)',[result.insertId,l.numero,l.monto,l.reventado||0]);
  await conn.commit();return NextResponse.json({id:result.insertId,total,accepted,rejected},{status:201});
 }catch(e){if(conn)await conn.rollback();return fail(e instanceof Error?e.message:'Error de MySQL',500)}finally{conn?.release()}
}
