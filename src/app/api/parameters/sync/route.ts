import {NextResponse} from 'next/server';
import {db} from '@/lib/db';import {syncDefaults} from '@/lib/parameter-defaults';
export const runtime='nodejs';
// SECURITY: This administrative endpoint must be protected by server-side authorization before public use.
export async function POST(){const conn=await db().getConnection();try{await conn.beginTransaction();const created=await syncDefaults(conn);await conn.commit();return NextResponse.json({created});}catch(e){await conn.rollback();return NextResponse.json({error:e instanceof Error?e.message:'Error de MySQL'},{status:500})}finally{conn.release()}}
