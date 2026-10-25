import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import type {RowDataPacket} from 'mysql2';
export const runtime='nodejs';
type Daily=RowDataPacket&{day:string;total:number};
type Recent=RowDataPacket&{id:number;total:number;date:string};
export async function GET(){try{
 const [daily]=await db().query<Daily[]>(`SELECT DATE_FORMAT(fecha_tiquete,'%Y-%m-%d') AS day, COALESCE(SUM(total),0) AS total FROM tiquete WHERE fecha_tiquete >= CURDATE()-INTERVAL 6 DAY AND (revertido IS NULL OR revertido='No') GROUP BY DATE(fecha_tiquete) ORDER BY day`);
 const [recent]=await db().query<Recent[]>(`SELECT id_tiquete AS id, total, fecha_tiquete AS date FROM tiquete WHERE revertido IS NULL OR revertido='No' ORDER BY fecha_tiquete DESC LIMIT 5`);
 const sums=new Map(daily.map(row=>[row.day,Number(row.total)]));
 const days=Array.from({length:7},(_,i)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-6+i);const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');return {day,total:sums.get(day)??0}});
 return NextResponse.json({daily:days,recent:recent.map(t=>({id:Number(t.id),total:Number(t.total),date:t.date}))});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error al consultar actividad'},{status:500})}}
