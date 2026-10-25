import mysql from 'mysql2/promise';
let pool: mysql.Pool | undefined;
export function db() { if (!pool) pool = mysql.createPool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'luckyTimesDB',waitForConnections:true,connectionLimit:8,dateStrings:true,decimalNumbers:true});return pool; }
