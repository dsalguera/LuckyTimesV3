import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import type {RowDataPacket} from 'mysql2';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const id=Number(req.nextUrl.searchParams.get('id_programacion'));
  if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Programación inválida'},{status:400});
  const [rows]=await db().execute<RowDataPacket[]>(`SELECT LPAD(d.numero,2,'0') AS numero,COALESCE(SUM(d.monto),0) AS total FROM detalle_tiquete d JOIN tiquete t ON t.id_tiquete=d.id_tiquete WHERE t.id_programacion=? AND t.revertido IS NULL GROUP BY LPAD(d.numero,2,'0')`,[id]);
  const [income]=await db().execute<RowDataPacket[]>(`SELECT COALESCE(SUM(t.total),0) AS total FROM tiquete t WHERE t.id_programacion=? AND t.revertido IS NULL`,[id]);
  const map=new Map(rows.map(r=>[String(r.numero),Number(r.total)]));
  const numbers=Array.from({length:100},(_,n)=>{const numero=String(n).padStart(2,'0');return {numero,total:map.get(numero)||0}});
  return NextResponse.json({numbers,totalIncome:Number(income[0]?.total||0)});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error de MySQL'},{status:500})}
}
