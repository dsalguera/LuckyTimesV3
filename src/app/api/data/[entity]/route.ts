import { scryptSync, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  createDefaultsForUser,
  createDefaultsForDraw,
} from "@/lib/parameter-defaults";
import { entities, isEntity } from "@/lib/entities";

import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";

export const runtime = "nodejs";

// ======================================================
// TYPES
// ======================================================

type RouteContext = {
  params: Promise<{
    entity: string;
  }>;
};

type RequestBody = Record<string, unknown>;

type DatabaseValue =
  | string
  | number
  | boolean
  | Date
  | null;

// ======================================================
// HELPERS
// ======================================================

const fail = (error: unknown) => {
  console.error("LuckyTimes API error:", error);

  return NextResponse.json(
    {
      error:
        process.env.NODE_ENV === "production"
          ? "Error interno del servidor"
          : error instanceof Error
            ? error.message
            : "Error desconocido",
    },
    { status: 500 }
  );
};

const bad = (error: string, status = 400) => {
  return NextResponse.json(
    { error },
    { status }
  );
};

const parse = (
  body: RequestBody,
  allowed: readonly string[]
): RequestBody => {
  return Object.fromEntries(
    allowed
      .filter((key) => body[key] !== undefined)
      .map((key) => [
        key,
        body[key] === "" ? null : body[key],
      ])
  );
};

/**
 * Convierte valores recibidos desde JSON en parámetros
 * compatibles con mysql2.
 *
 * Rechaza objetos y arreglos inesperados.
 */
const toDatabaseValues = (
  values: unknown[]
): DatabaseValue[] => {
  return values.map((value) => {
    if (value === null) {
      return null;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      if (
        typeof value === "number" &&
        !Number.isFinite(value)
      ) {
        throw new Error("Valor numérico inválido");
      }

      return value;
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new Error("Fecha inválida");
      }

      return value;
    }

    throw new Error(
      "Se recibió un valor no compatible con MySQL"
    );
  });
};

/**
 * Valida que los nombres de columnas y tablas
 * provengan de identificadores SQL seguros.
 */
const sqlIdentifier = (value: string): string => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error("Identificador SQL inválido");
  }

  return `\`${value}\``;
};

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");

  const hash = scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  return `scrypt:${salt}:${hash}`;
};

// ======================================================
// GET
// Obtener registros
// ======================================================

export async function GET(
  _req: NextRequest,
  ctx: RouteContext
) {
  const { entity } = await ctx.params;

  if (!isEntity(entity)) {
    return bad("Módulo no válido", 404);
  }

  const config = entities[entity];

  try {
    const table = sqlIdentifier(config.table);
    const primaryKey = sqlIdentifier(config.pk);

    const sql = `
      SELECT *
      FROM ${table}
      ORDER BY ${primaryKey} DESC
      LIMIT 2000
    `;

    const [rows] = await db().query<RowDataPacket[]>(
      sql
    );

    // ----------------------------------------------
    // TIQUETES
    // ----------------------------------------------

    if (entity === "tiquetes") {
      const [details] =
        await db().query<RowDataPacket[]>(
          `
            SELECT *
            FROM detalle_tiquete
            ORDER BY id_detalle_tiquete
          `
        );

      return NextResponse.json({
        rows,
        details,
      });
    }

    // ----------------------------------------------
    // USUARIOS
    // No devolver contraseñas
    // ----------------------------------------------

    if (entity === "usuarios") {
      const safeRows = rows.map((row) => {
        const { contrasena, ...user } = row;

        void contrasena;

        return user;
      });

      return NextResponse.json({
        rows: safeRows,
      });
    }

    return NextResponse.json({
      rows,
    });
  } catch (error) {
    return fail(error);
  }
}

// ======================================================
// POST
// Crear registros
// ======================================================

export async function POST(
  req: NextRequest,
  ctx: RouteContext
) {
  const { entity } = await ctx.params;

  if (!isEntity(entity)) {
    return bad("Módulo no válido", 404);
  }

  // Los tiquetes utilizan su propia API.
  if (entity === "tiquetes") {
    return bad(
      "Utiliza /api/tickets para emitir tiquetes."
    );
  }

  const config = entities[entity];

  try {
    const body =
      (await req.json()) as RequestBody;

    const data = parse(
      body,
      config.fields
    );

    // ----------------------------------------------
    // VALIDAR CAMPOS OBLIGATORIOS
    // ----------------------------------------------

    for (const field of config.required) {
      if (
        data[field] === null ||
        data[field] === undefined
      ) {
        return bad(
          `Campo obligatorio: ${field}`
        );
      }
    }

    // ----------------------------------------------
    // USUARIOS
    // ----------------------------------------------

    if (
      entity === "usuarios" &&
      !data.contrasena
    ) {
      return bad(
        "Se requiere contraseña para crear usuario"
      );
    }

    if (
      entity === "usuarios" &&
      data.contrasena
    ) {
      data.contrasena = hashPassword(
        String(data.contrasena)
      );
    }

    // ----------------------------------------------
    // PARAMETRIZACIONES
    // Evitar duplicados
    // ----------------------------------------------

    if (entity === "parametros") {
      const [existing] =
        await db().execute<RowDataPacket[]>(
          `
            SELECT id_parametizacion_sorteo
            FROM parametizacion_sorteo
            WHERE id_usuario = ?
              AND id_sorteo = ?
            LIMIT 1
          `,
          toDatabaseValues([
            data.id_usuario,
            data.id_sorteo,
          ])
        );

      if (existing.length > 0) {
        return bad(
          "Ya existe una parametrización para este usuario y sorteo"
        );
      }
    }

    // ----------------------------------------------
    // NÚMEROS GANADORES
    // Evitar resultados duplicados
    // ----------------------------------------------

    if (entity === "ganadores") {
      const [existing] =
        await db().execute<RowDataPacket[]>(
          `
            SELECT id_numero_ganador
            FROM numero_ganador
            WHERE id_programacion = ?
            LIMIT 1
          `,
          toDatabaseValues([
            data.id_programacion,
          ])
        );

      if (existing.length > 0) {
        return bad(
          "Esta programación ya tiene un resultado registrado"
        );
      }
    }

    // ----------------------------------------------
    // REPORTES
    // ----------------------------------------------

    if (entity === "reportes") {
      return bad(
        "Los movimientos requieren flujo de caja verificado; no se pueden crear desde el CRUD genérico."
      );
    }

    // ----------------------------------------------
    // PREPARAR INSERT
    // ----------------------------------------------

    const columns = Object.keys(data);

    if (columns.length === 0) {
      return bad("Sin campos");
    }

    const table = sqlIdentifier(config.table);

    const columnNames = columns
      .map(sqlIdentifier)
      .join(", ");

    const placeholders = columns
      .map(() => "?")
      .join(", ");

    const sql = `
      INSERT INTO ${table}
      (${columnNames})
      VALUES (${placeholders})
    `;

    // Corrección principal del error de TypeScript.
    const values: DatabaseValue[] =
      toDatabaseValues(
        Object.values(data)
      );

    // ----------------------------------------------
    // TRANSACCIÓN MYSQL
    // ----------------------------------------------

    const connection =
      await db().getConnection();

    try {
      await connection.beginTransaction();

      const [result] =
        await connection.execute<ResultSetHeader>(
          sql,
          values
        );

      // ------------------------------------------
      // CREAR PARAMETRIZACIONES PARA NUEVO PUESTO
      // ------------------------------------------

      if (
        entity === "usuarios" &&
        String(data.rol || "").toLowerCase() ===
          "puesto"
      ) {
        await createDefaultsForUser(
          connection,
          result.insertId
        );
      }

      // ------------------------------------------
      // CREAR PARAMETRIZACIONES PARA NUEVO SORTEO
      // ------------------------------------------

      if (entity === "sorteos") {
        await createDefaultsForDraw(
          connection,
          result.insertId
        );
      }

      await connection.commit();

      return NextResponse.json(
        {
          id: result.insertId,
        },
        {
          status: 201,
        }
      );
    } catch (error) {
      await connection.rollback();

      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return fail(error);
  }
}

// ======================================================
// PUT
// Actualizar registros
// ======================================================

export async function PUT(
  req: NextRequest,
  ctx: RouteContext
) {
  const { entity } = await ctx.params;

  if (!isEntity(entity)) {
    return bad("Módulo no válido", 404);
  }

  // Proteger registros históricos.
  if (
    ["tiquetes", "ganadores", "reportes"].includes(
      entity
    )
  ) {
    return bad(
      "Estos registros no admiten edición libre"
    );
  }

  const config = entities[entity];

  try {
    const body =
      (await req.json()) as RequestBody;

    const id = Number(body.id);

    if (
      !Number.isSafeInteger(id) ||
      id < 1
    ) {
      return bad("ID inválido");
    }

    const data = parse(
      body,
      config.fields
    );

    // ----------------------------------------------
    // USUARIOS
    // ----------------------------------------------

    if (entity === "usuarios") {
      if (!data.contrasena) {
        delete data.contrasena;
      } else {
        data.contrasena = hashPassword(
          String(data.contrasena)
        );
      }
    }

    // ----------------------------------------------
    // VALIDAR PARAMETRIZACIONES DUPLICADAS
    // ----------------------------------------------

    if (
      entity === "parametros" &&
      data.id_usuario &&
      data.id_sorteo
    ) {
      const [rows] =
        await db().execute<RowDataPacket[]>(
          `
            SELECT id_parametizacion_sorteo
            FROM parametizacion_sorteo
            WHERE id_usuario = ?
              AND id_sorteo = ?
              AND id_parametizacion_sorteo <> ?
            LIMIT 1
          `,
          toDatabaseValues([
            data.id_usuario,
            data.id_sorteo,
            id,
          ])
        );

      if (rows.length > 0) {
        return bad(
          "La parametrización ya existe"
        );
      }
    }

    // ----------------------------------------------
    // PREPARAR UPDATE
    // ----------------------------------------------

    const columns = Object.keys(data);

    if (columns.length === 0) {
      return bad("No hay cambios");
    }

    const table = sqlIdentifier(config.table);

    const primaryKey = sqlIdentifier(
      config.pk
    );

    const setClause = columns
      .map(
        (column) =>
          `${sqlIdentifier(column)} = ?`
      )
      .join(", ");

    const sql = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${primaryKey} = ?
    `;

    const values: DatabaseValue[] =
      toDatabaseValues([
        ...Object.values(data),
        id,
      ]);

    const [result] =
      await db().execute<ResultSetHeader>(
        sql,
        values
      );

    return NextResponse.json({
      updated: result.affectedRows,
    });
  } catch (error) {
    return fail(error);
  }
}

// ======================================================
// DELETE
// Eliminar o desactivar registros
// ======================================================

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext
) {
  const { entity } = await ctx.params;

  if (!isEntity(entity)) {
    return bad("Módulo no válido", 404);
  }

  // Proteger registros históricos.
  if (
    ["tiquetes", "ganadores", "reportes"].includes(
      entity
    )
  ) {
    return bad(
      "Los registros históricos no se eliminan"
    );
  }

  const config = entities[entity];

  const url = new URL(req.url);

  const id = Number(
    url.searchParams.get("id")
  );

  if (
    !Number.isSafeInteger(id) ||
    id < 1
  ) {
    return bad("ID inválido");
  }

  try {
    const table = sqlIdentifier(config.table);

    const primaryKey = sqlIdentifier(
      config.pk
    );

    // ----------------------------------------------
    // DESACTIVAR USUARIOS Y SORTEOS
    // ----------------------------------------------

    if (
      entity === "usuarios" ||
      entity === "sorteos"
    ) {
      const sql = `
        UPDATE ${table}
        SET estado = 'Inactivo'
        WHERE ${primaryKey} = ?
      `;

      const [result] =
        await db().execute<ResultSetHeader>(
          sql,
          [id]
        );

      return NextResponse.json({
        deactivated: result.affectedRows,
      });
    }

    // ----------------------------------------------
    // ELIMINAR OTROS REGISTROS
    // ----------------------------------------------

    const sql = `
      DELETE FROM ${table}
      WHERE ${primaryKey} = ?
    `;

    const [result] =
      await db().execute<ResultSetHeader>(
        sql,
        [id]
      );

    return NextResponse.json({
      deleted: result.affectedRows,
    });
  } catch (error) {
    return fail(error);
  }
}