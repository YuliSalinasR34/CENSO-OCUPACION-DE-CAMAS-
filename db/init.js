// db/init.js
// Crea el esquema (si no existe) y siembra datos reales de IPS y usuarios
// contra una base de datos PostgreSQL (por ejemplo Neon.tech, gratis).
// Es idempotente: se puede ejecutar muchas veces sin duplicar datos.

const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { Pool, types } = require("pg");

// Evita que node-postgres convierta las columnas DATE a objetos Date de JS
// (lo cual produce fechas tipo "2026-09-01T00:00:00.000Z" al serializar a JSON).
// Las dejamos como el string plano "YYYY-MM-DD" que envía Postgres.
types.setTypeParser(1082, (val) => val);

if (!process.env.DATABASE_URL) {
  console.error("[db] Falta la variable de entorno DATABASE_URL (cadena de conexión de Postgres).");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // necesario para Neon / Render Postgres administrado
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ips (
      cod TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      regional TEXT,
      zonal TEXT,
      municipio TEXT,
      ambito TEXT,
      lider TEXT,
      activo BOOLEAN NOT NULL DEFAULT true,
      camas_habilitadas JSONB NOT NULL DEFAULT '{}'::jsonb,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      cargo TEXT,
      tdoc TEXT DEFAULT 'CC',
      doc TEXT NOT NULL,
      email TEXT,
      usuario TEXT UNIQUE NOT NULL,
      perfil TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      debe_cambiar_pass BOOLEAN NOT NULL DEFAULT true,
      activo BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS censos (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL,
      ips_cod TEXT NOT NULL REFERENCES ips(cod),
      ambito TEXT,
      lider TEXT,
      tipo_estancia TEXT NOT NULL,
      poblacion TEXT,
      camas_habilitadas NUMERIC NOT NULL DEFAULT 0,
      ocupacion_ips NUMERIC NOT NULL DEFAULT 0,
      ocupacion_famisanar NUMERIC NOT NULL DEFAULT 0,
      camas_disponibles NUMERIC NOT NULL DEFAULT 0,
      usuario_id INTEGER NOT NULL REFERENCES users(id),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Evita duplicar un registro para la misma fecha+IPS+tipo+poblacion.
    -- COALESCE normaliza NULL (Hospitalizacion/Observacion no llevan poblacion)
    -- para que tambien se detecten esos duplicados.
    CREATE UNIQUE INDEX IF NOT EXISTS ux_censos_dedup
      ON censos (fecha, ips_cod, tipo_estancia, COALESCE(poblacion, ''));

    CREATE INDEX IF NOT EXISTS idx_censos_fecha ON censos(fecha);
    CREATE INDEX IF NOT EXISTS idx_censos_ips ON censos(ips_cod);
    CREATE INDEX IF NOT EXISTS idx_censos_usuario ON censos(usuario_id);
  `);
}

async function seedIps() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM ips");
  if (rows[0].n > 0) {
    console.log(`[seed] IPS ya existentes (${rows[0].n}), no se vuelve a sembrar.`);
    return;
  }
  const seedIps = JSON.parse(fs.readFileSync(path.join(__dirname, "seed_ips.json"), "utf-8"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of seedIps) {
      await client.query(
        `INSERT INTO ips (cod, nombre, regional, zonal, municipio, ambito, lider, camas_habilitadas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [r.cod, r.nombre, r.regional, r.zonal, r.municipio, r.ambito || null, r.lider || null, JSON.stringify(r.camasHabilitadas || {})]
      );
    }
    await client.query("COMMIT");
    console.log(`[seed] ${seedIps.length} IPS cargadas.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function seedUsers() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if (rows[0].n > 0) {
    console.log(`[seed] Usuarios ya existentes (${rows[0].n}), no se vuelve a sembrar.`);
    return;
  }
  const seedUsers = JSON.parse(fs.readFileSync(path.join(__dirname, "seed_users.json"), "utf-8"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const u of seedUsers) {
      const initialPass = `${u.tdoc}${u.doc}_`;
      const hash = bcrypt.hashSync(initialPass, 10);
      await client.query(
        `INSERT INTO users (nombre, cargo, tdoc, doc, email, usuario, perfil, pass_hash, debe_cambiar_pass, activo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true)`,
        [u.nombre, u.cargo, u.tdoc, String(u.doc), u.email, u.usuario, u.perfil, hash]
      );
    }
    await client.query("COMMIT");
    console.log(`[seed] ${seedUsers.length} usuarios cargados. Password inicial: {TIPO_DOC}{DOCUMENTO}_ (ej: CC123456_)`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function ensureReady() {
  await initSchema();
  await seedIps();
  await seedUsers();
}

module.exports = { pool, ensureReady };

// Permite ejecutar `node db/init.js` manualmente para sembrar sin levantar el servidor.
if (require.main === module) {
  ensureReady()
    .then(() => { console.log("[seed] Base de datos lista."); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
