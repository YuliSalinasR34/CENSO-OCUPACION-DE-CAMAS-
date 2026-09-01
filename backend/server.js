// server.js
// Censo Ocupacion de Camas - Famisanar
// Backend Express + PostgreSQL, con autenticacion JWT y control de acceso por rol.
// Sirve tambien el frontend estatico (carpeta /public).

const path = require("path");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const XLSX = require("xlsx");
const { pool, ensureReady } = require("./db/init.js");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const JWT_SECRET = process.env.JWT_SECRET || "cambia-esta-clave-en-produccion-famisanar-2026";
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Perfiles y permisos ----------
const PERFILES = {
  CONSULTA: "1. Consulta",
  CONSULTA_REPORTES: "2. Consulta y Reportes",
  DIGITADOR: "3. Digitador / Auditor",
  COORDINADOR: "4. Coordinador / Supervisor",
  ADMIN: "5. Administrador"
};

function puedeEscribir(perfil) {
  return [PERFILES.DIGITADOR, PERFILES.COORDINADOR, PERFILES.ADMIN].includes(perfil);
}
function puedeEditarTodo(perfil) {
  return [PERFILES.COORDINADOR, PERFILES.ADMIN].includes(perfil);
}
function puedeEliminar(perfil) {
  return perfil === PERFILES.ADMIN;
}
function puedeAdministrarUsuarios(perfil) {
  return perfil === PERFILES.ADMIN;
}
function puedeDescargarReportes(perfil) {
  return [PERFILES.CONSULTA_REPORTES, PERFILES.COORDINADOR, PERFILES.ADMIN].includes(perfil);
}

// ---------- Middleware de autenticacion ----------
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1 AND activo = true", [payload.sub]);
    if (!rows[0]) return res.status(401).json({ error: "Usuario no valido o inactivo." });
    req.user = rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ error: "Sesion invalida o expirada." });
  }
}

function requireWrite(req, res, next) {
  if (!puedeEscribir(req.user.perfil)) return res.status(403).json({ error: "Tu perfil no tiene permiso de escritura." });
  next();
}
function requireAdmin(req, res, next) {
  if (!puedeAdministrarUsuarios(req.user.perfil)) return res.status(403).json({ error: "Solo un Administrador puede realizar esta accion." });
  next();
}
function requireEditorIps(req, res, next) {
  if (!puedeEditarTodo(req.user.perfil)) return res.status(403).json({ error: "Tu perfil no tiene permiso para actualizar la base de IPS." });
  next();
}

// pequeño helper para no repetir try/catch async en cada ruta
const h = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: "Error interno del servidor." });
});

// =========================================================
//  AUTH
// =========================================================
app.post("/api/auth/login", h(async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: "Usuario y contraseña son obligatorios." });

  const { rows } = await pool.query("SELECT * FROM users WHERE usuario = $1 AND activo = true", [usuario.trim().toLowerCase()]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos." });

  const ok = bcrypt.compareSync(password, user.pass_hash);
  if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos." });

  const token = jwt.sign({ sub: user.id, perfil: user.perfil }, JWT_SECRET, { expiresIn: "12h" });
  res.json({
    token,
    debeCambiarPass: !!user.debe_cambiar_pass,
    usuario: {
      id: user.id, nombre: user.nombre, usuario: user.usuario,
      perfil: user.perfil, email: user.email, cargo: user.cargo
    }
  });
}));

app.post("/api/auth/cambiar-password", authMiddleware, h(async (req, res) => {
  const { passwordActual, passwordNueva } = req.body || {};
  if (!passwordActual || !passwordNueva) return res.status(400).json({ error: "Datos incompletos." });
  if (passwordNueva.length < 8) return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres." });

  const ok = bcrypt.compareSync(passwordActual, req.user.pass_hash);
  if (!ok) return res.status(401).json({ error: "La contraseña actual no es correcta." });

  const hash = bcrypt.hashSync(passwordNueva, 10);
  await pool.query("UPDATE users SET pass_hash = $1, debe_cambiar_pass = false WHERE id = $2", [hash, req.user.id]);
  res.json({ ok: true });
}));

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const u = req.user;
  res.json({ id: u.id, nombre: u.nombre, usuario: u.usuario, perfil: u.perfil, email: u.email, cargo: u.cargo });
});

app.get("/api/auth/permisos", authMiddleware, (req, res) => {
  const p = req.user.perfil;
  res.json({
    perfil: p,
    puedeEscribir: puedeEscribir(p),
    puedeEditarTodo: puedeEditarTodo(p),
    puedeEliminar: puedeEliminar(p),
    puedeAdministrarUsuarios: puedeAdministrarUsuarios(p),
    puedeDescargarReportes: puedeDescargarReportes(p),
    puedeActualizarIps: puedeEditarTodo(p)
  });
});

// =========================================================
//  IPS (catalogo)
// =========================================================
app.get("/api/ips", authMiddleware, h(async (req, res) => {
  const incluirInactivas = req.query.incluirInactivas === "1" && puedeEditarTodo(req.user.perfil);
  const sql = incluirInactivas
    ? "SELECT * FROM ips ORDER BY nombre"
    : "SELECT * FROM ips WHERE activo = true ORDER BY nombre";
  const { rows } = await pool.query(sql);
  res.json(rows.map(r => ({ ...r, camas_habilitadas: r.camas_habilitadas || {} })));
}));

// =========================================================
//  CENSOS
// =========================================================
function calcularDisponibles(habilitadas, ocupacionIps) {
  const disp = habilitadas - ocupacionIps;
  return disp > 0 ? disp : 0;
}

// Extrae el número de camas habilitadas de la base maestra de IPS para un
// tipo de estancia + población dados. Esta es la ÚNICA fuente de verdad;
// nunca se acepta ese número escrito a mano desde el formulario.
function extraerHabilitadas(camasHabilitadasIps, tipoEstancia, poblacion) {
  const obj = camasHabilitadasIps || {};
  const grupo = obj[tipoEstancia] || {};
  if (tipoEstancia === "Hospitalizacion" || tipoEstancia === "Observacion") {
    return Number(grupo.General || 0);
  }
  return Number(grupo[poblacion] || 0);
}

app.post("/api/censos", authMiddleware, requireWrite, h(async (req, res) => {
  const { fecha, ipsCod, tipoEstancia, poblacion, ocupacionIps, ocupacionFamisanar } = req.body || {};

  if (!fecha || !ipsCod || !tipoEstancia) {
    return res.status(400).json({ error: "Fecha, IPS y tipo de estancia son obligatorios." });
  }
  if (ocupacionFamisanar > ocupacionIps) {
    return res.status(400).json({ error: "La Ocupación Famisanar no puede ser mayor que la Ocupación IPS." });
  }
  if (ocupacionIps < 0 || ocupacionFamisanar < 0) {
    return res.status(400).json({ error: "Los valores de ocupación no pueden ser negativos." });
  }

  const { rows: ipsRows } = await pool.query("SELECT ambito, lider, camas_habilitadas FROM ips WHERE cod = $1", [ipsCod]);
  if (!ipsRows[0]) return res.status(400).json({ error: "La IPS seleccionada no existe en la base." });
  const ipsRow = ipsRows[0];

  // Camas habilitadas SIEMPRE se toman de la base maestra de la IPS, nunca del formulario.
  const camasHabilitadas = extraerHabilitadas(ipsRow.camas_habilitadas, tipoEstancia, poblacion);
  const disponibles = calcularDisponibles(camasHabilitadas, Number(ocupacionIps));

  try {
    const { rows } = await pool.query(
      `INSERT INTO censos (fecha, ips_cod, tipo_estancia, poblacion, camas_habilitadas, ocupacion_ips, ocupacion_famisanar, camas_disponibles, usuario_id, ambito, lider)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [fecha, ipsCod, tipoEstancia, poblacion || null, camasHabilitadas, Number(ocupacionIps), Number(ocupacionFamisanar), disponibles, req.user.id, ipsRow.ambito || null, ipsRow.lider || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "Ya existe un registro para esta IPS, fecha, tipo de estancia y población." });
    }
    throw e;
  }
}));

app.get("/api/censos", authMiddleware, h(async (req, res) => {
  const { fechaInicio, fechaFin, ipsCod, regional, zonal, municipio, ambito, usuario } = req.query;

  let sql = `
    SELECT c.*, i.nombre AS ips_nombre, i.regional, i.zonal, i.municipio, u.nombre AS usuario_nombre
    FROM censos c
    JOIN ips i ON i.cod = c.ips_cod
    JOIN users u ON u.id = c.usuario_id
    WHERE 1=1
  `;
  const params = [];
  const add = (clause, val) => { params.push(val); sql += ` AND ${clause} $${params.length}`; };
  const addLike = (clause, val) => { params.push(`%${val}%`); sql += ` AND ${clause} ILIKE $${params.length}`; };

  if (fechaInicio) add("c.fecha >=", fechaInicio);
  if (fechaFin) add("c.fecha <=", fechaFin);
  if (ipsCod) add("c.ips_cod =", ipsCod);
  if (regional) add("i.regional =", regional);
  if (zonal) add("i.zonal =", zonal);
  if (municipio) add("i.municipio =", municipio);
  if (ambito) add("c.ambito =", ambito);
  if (usuario) addLike("u.nombre", usuario);
  if (req.user.perfil === PERFILES.DIGITADOR) add("c.usuario_id =", req.user.id);

  sql += " ORDER BY c.fecha DESC, i.nombre ASC";
  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

app.put("/api/censos/:id", authMiddleware, requireWrite, h(async (req, res) => {
  const id = Number(req.params.id);
  const { rows: existingRows } = await pool.query("SELECT * FROM censos WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Registro no encontrado." });

  if (req.user.perfil === PERFILES.DIGITADOR && existing.usuario_id !== req.user.id) {
    return res.status(403).json({ error: "Solo puedes editar tus propios registros." });
  }

  // Camas habilitadas NO se edita manualmente: siempre refleja la base maestra de la IPS.
  const { rows: ipsRows } = await pool.query("SELECT camas_habilitadas FROM ips WHERE cod = $1", [existing.ips_cod]);
  const camasHabilitadas = extraerHabilitadas(ipsRows[0]?.camas_habilitadas, existing.tipo_estancia, existing.poblacion);

  const { ocupacionIps, ocupacionFamisanar } = req.body || {};
  const ocuIps = ocupacionIps ?? existing.ocupacion_ips;
  const ocuFami = ocupacionFamisanar ?? existing.ocupacion_famisanar;

  if (ocuFami > ocuIps) {
    return res.status(400).json({ error: "La Ocupación Famisanar no puede ser mayor que la Ocupación IPS." });
  }
  const disponibles = calcularDisponibles(camasHabilitadas, Number(ocuIps));

  const { rows } = await pool.query(
    `UPDATE censos SET camas_habilitadas=$1, ocupacion_ips=$2, ocupacion_famisanar=$3, camas_disponibles=$4, actualizado_en=now()
     WHERE id=$5 RETURNING *`,
    [camasHabilitadas, Number(ocuIps), Number(ocuFami), disponibles, id]
  );
  res.json(rows[0]);
}));

app.delete("/api/censos/:id", authMiddleware, h(async (req, res) => {
  if (!puedeEliminar(req.user.perfil)) return res.status(403).json({ error: "Solo un Administrador puede eliminar registros." });
  const id = Number(req.params.id);
  const { rowCount } = await pool.query("DELETE FROM censos WHERE id = $1", [id]);
  if (rowCount === 0) return res.status(404).json({ error: "Registro no encontrado." });
  res.json({ ok: true });
}));

// =========================================================
//  DASHBOARD
// =========================================================
function rangoPeriodo(periodo, valor) {
  const base = valor ? new Date(valor + "T00:00:00") : new Date();
  if (periodo === "semana") {
    const dow = base.getDay() === 0 ? 7 : base.getDay(); // lunes=1..domingo=7
    const inicio = new Date(base); inicio.setDate(base.getDate() - (dow - 1));
    const fin = new Date(inicio); fin.setDate(inicio.getDate() + 6);
    return { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
  }
  if (periodo === "mes") {
    const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
    const fin = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
  }
  const d = base.toISOString().slice(0, 10);
  return { inicio: d, fin: d };
}

app.get("/api/dashboard/resumen", authMiddleware, h(async (req, res) => {
  const { periodo = "dia", valor, regional, zonal, municipio, ipsCod } = req.query;
  const { inicio, fin } = rangoPeriodo(periodo, valor);
  const hoy = new Date().toISOString().slice(0, 10);

  const filtros = [];
  const params = [inicio, fin];
  const addFiltro = (clause, val) => { params.push(val); filtros.push(`${clause} $${params.length}`); };
  if (regional) addFiltro("i.regional =", regional);
  if (zonal) addFiltro("i.zonal =", zonal);
  if (municipio) addFiltro("i.municipio =", municipio);
  if (ipsCod) addFiltro("i.cod =", ipsCod);
  const filtroSql = filtros.length ? " AND " + filtros.join(" AND ") : "";

  const baseWhere = `c.fecha BETWEEN $1 AND $2${filtroSql}`;

  // KPIs generales del periodo+filtros
  const kpis = (await pool.query(
    `SELECT
       SUM(c.camas_habilitadas) AS habilitadas,
       SUM(c.ocupacion_ips) AS ocupadas,
       SUM(c.camas_disponibles) AS disponibles,
       SUM(c.ocupacion_famisanar) AS ocupacion_famisanar
     FROM censos c JOIN ips i ON i.cod = c.ips_cod
     WHERE ${baseWhere}`,
    params
  )).rows[0];

  const habilitadas = Number(kpis.habilitadas || 0);
  const ocupadas = Number(kpis.ocupadas || 0);
  const ocupacionFamisanar = Number(kpis.ocupacion_famisanar || 0);
  const pctIps = habilitadas > 0 ? Math.round((ocupadas / habilitadas) * 1000) / 10 : 0;
  const pctFamisanar = habilitadas > 0 ? Math.round((ocupacionFamisanar / habilitadas) * 1000) / 10 : 0;

  // IPS registradas/faltantes: SIEMPRE hoy, sin importar filtros geográficos (según se pidió)
  const totalIpsActivas = (await pool.query("SELECT COUNT(*)::int AS n FROM ips WHERE activo = true")).rows[0].n;
  const ipsRegistradasHoy = (await pool.query(
    "SELECT COUNT(DISTINCT ips_cod)::int AS n FROM censos WHERE fecha = $1", [hoy]
  )).rows[0].n;

  const porRegional = (await pool.query(
    `SELECT i.regional AS etiqueta,
            COALESCE(SUM(c.camas_habilitadas),0) AS habilitadas,
            COALESCE(SUM(c.ocupacion_ips),0) AS ocupadas,
            COALESCE(SUM(c.ocupacion_famisanar),0) AS famisanar
     FROM censos c JOIN ips i ON i.cod = c.ips_cod
     WHERE ${baseWhere}
     GROUP BY i.regional ORDER BY i.regional`,
    params
  )).rows;

  const porTipoEstancia = (await pool.query(
    `SELECT c.tipo_estancia AS etiqueta,
            COALESCE(SUM(c.camas_habilitadas),0) AS habilitadas,
            COALESCE(SUM(c.ocupacion_ips),0) AS ocupadas,
            COALESCE(SUM(c.ocupacion_famisanar),0) AS famisanar
     FROM censos c JOIN ips i ON i.cod = c.ips_cod
     WHERE ${baseWhere}
     GROUP BY c.tipo_estancia ORDER BY c.tipo_estancia`,
    params
  )).rows;

  const porAmbito = (await pool.query(
    `SELECT COALESCE(c.ambito,'Sin ámbito') AS etiqueta,
            COALESCE(SUM(c.camas_habilitadas),0) AS habilitadas,
            COALESCE(SUM(c.ocupacion_ips),0) AS ocupadas,
            COALESCE(SUM(c.ocupacion_famisanar),0) AS famisanar
     FROM censos c JOIN ips i ON i.cod = c.ips_cod
     WHERE ${baseWhere}
     GROUP BY c.ambito ORDER BY c.ambito`,
    params
  )).rows;

  const serieTiempo = (await pool.query(
    `SELECT c.fecha,
            COALESCE(SUM(c.camas_habilitadas),0) AS habilitadas,
            COALESCE(SUM(c.ocupacion_ips),0) AS ocupadas,
            COALESCE(SUM(c.ocupacion_famisanar),0) AS famisanar
     FROM censos c JOIN ips i ON i.cod = c.ips_cod
     WHERE ${baseWhere}
     GROUP BY c.fecha ORDER BY c.fecha`,
    params
  )).rows;

  const porIps = (await pool.query(
    `SELECT i.nombre AS etiqueta,
            COALESCE(SUM(c.camas_habilitadas),0) AS habilitadas,
            COALESCE(SUM(c.ocupacion_ips),0) AS ocupadas,
            COALESCE(SUM(c.ocupacion_famisanar),0) AS famisanar
     FROM censos c JOIN ips i ON i.cod = c.ips_cod
     WHERE ${baseWhere}
     GROUP BY i.nombre HAVING SUM(c.camas_habilitadas) > 0`,
    params
  )).rows.map(r => ({ ...r, pct: Math.round((Number(r.ocupadas) / Number(r.habilitadas)) * 1000) / 10 }));

  const topMayor = [...porIps].sort((a, b) => b.pct - a.pct).slice(0, 8);
  const topMenor = [...porIps].sort((a, b) => a.pct - b.pct).slice(0, 8);

  const faltantesPorLider = (await pool.query(
    `SELECT COALESCE(i.lider, 'Sin líder asignado') AS lider, COUNT(*)::int AS faltantes
     FROM ips i
     WHERE i.activo = true
       AND i.cod NOT IN (SELECT DISTINCT ips_cod FROM censos WHERE fecha = $1)
     GROUP BY i.lider ORDER BY faltantes DESC`,
    [hoy]
  )).rows;

  const pct = (r) => ({
    etiqueta: r.etiqueta,
    pctIps: Number(r.habilitadas) > 0 ? Math.round((Number(r.ocupadas) / Number(r.habilitadas)) * 1000) / 10 : 0,
    pctFamisanar: Number(r.habilitadas) > 0 ? Math.round((Number(r.famisanar) / Number(r.habilitadas)) * 1000) / 10 : 0,
  });

  res.json({
    periodo, inicio, fin,
    kpis: {
      ipsRegistradasHoy, ipsFaltantesHoy: totalIpsActivas - ipsRegistradasHoy, totalIpsActivas,
      habilitadas, ocupadas, disponibles: Number(kpis.disponibles || 0),
      ocupacionFamisanar, pctIps, pctFamisanar,
    },
    porRegional: porRegional.map(pct),
    porTipoEstancia: porTipoEstancia.map(pct),
    porAmbito: porAmbito.map(pct),
    serieTiempo: serieTiempo.map(r => ({ fecha: r.fecha, ...pct(r) })),
    topMayor: topMayor.map(r => ({ etiqueta: r.etiqueta, pctIps: r.pct, pctFamisanar: Number(r.habilitadas) > 0 ? Math.round((Number(r.famisanar) / Number(r.habilitadas)) * 1000) / 10 : 0 })),
    topMenor: topMenor.map(r => ({ etiqueta: r.etiqueta, pctIps: r.pct, pctFamisanar: Number(r.habilitadas) > 0 ? Math.round((Number(r.famisanar) / Number(r.habilitadas)) * 1000) / 10 : 0 })),
    faltantesPorLider,
  });
}));

// =========================================================
//  ADMINISTRACION DE LA BASE DE IPS (Coordinador/Supervisor y Administrador)
// =========================================================
app.get("/api/admin/ips", authMiddleware, requireEditorIps, h(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM ips ORDER BY nombre");
  res.json(rows.map(r => ({ ...r, camas_habilitadas: r.camas_habilitadas || {} })));
}));

app.post("/api/admin/ips", authMiddleware, requireEditorIps, h(async (req, res) => {
  const { cod, nombre, regional, zonal, municipio, ambito, lider, camasHabilitadas } = req.body || {};
  if (!cod || !nombre) return res.status(400).json({ error: "Código y nombre son obligatorios." });
  try {
    await pool.query(
      `INSERT INTO ips (cod, nombre, regional, zonal, municipio, ambito, lider, camas_habilitadas, activo, actualizado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,now())`,
      [String(cod).trim(), nombre, regional || null, zonal || null, municipio || null, ambito || null, lider || null, JSON.stringify(camasHabilitadas || {})]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Ya existe una IPS con ese código." });
    throw e;
  }
}));

app.put("/api/admin/ips/:cod", authMiddleware, requireEditorIps, h(async (req, res) => {
  const cod = req.params.cod;
  const { rows: existingRows } = await pool.query("SELECT * FROM ips WHERE cod = $1", [cod]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "IPS no encontrada." });

  const { nombre, regional, zonal, municipio, ambito, lider, camasHabilitadas, activo } = req.body || {};
  await pool.query(
    `UPDATE ips SET nombre=$1, regional=$2, zonal=$3, municipio=$4, ambito=$5, lider=$6, camas_habilitadas=$7, activo=$8, actualizado_en=now()
     WHERE cod=$9`,
    [
      nombre ?? existing.nombre,
      regional ?? existing.regional,
      zonal ?? existing.zonal,
      municipio ?? existing.municipio,
      ambito ?? existing.ambito,
      lider ?? existing.lider,
      camasHabilitadas ? JSON.stringify(camasHabilitadas) : JSON.stringify(existing.camas_habilitadas),
      activo === undefined ? existing.activo : !!activo,
      cod
    ]
  );
  res.json({ ok: true });
}));

function leerPrimeraHoja(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

app.post("/api/admin/ips/importar-maestro", authMiddleware, requireEditorIps, upload.single("file"), h(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Debes adjuntar un archivo .xlsx." });
  let filas;
  try {
    filas = leerPrimeraHoja(req.file.buffer).slice(1);
  } catch (e) {
    return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un .xlsx válido?" });
  }

  const client = await pool.connect();
  let procesadas = 0, omitidas = 0;
  const vistos = new Set();
  try {
    await client.query("BEGIN");
    for (const r of filas) {
      const cod = r[0];
      if (cod === null || cod === undefined || String(cod).trim() === "") { omitidas++; continue; }
      const codStr = String(cod).trim();
      if (vistos.has(codStr)) continue;
      vistos.add(codStr);
      await client.query(
        `INSERT INTO ips (cod, nombre, regional, zonal, municipio, ambito, lider, camas_habilitadas, activo, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'{}'::jsonb,true,now())
         ON CONFLICT (cod) DO UPDATE SET
           nombre=EXCLUDED.nombre, regional=EXCLUDED.regional, zonal=EXCLUDED.zonal,
           municipio=EXCLUDED.municipio, ambito=EXCLUDED.ambito, lider=EXCLUDED.lider,
           actualizado_en=now()`,
        [codStr, (r[1] || "").toString().trim(), r[2] || null, r[3] || null, r[4] || null, r[5] || null, r[6] || null]
      );
      procesadas++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true, ipsActualizadas: procesadas, filasOmitidas: omitidas });
}));

app.post("/api/admin/ips/importar-camas", authMiddleware, requireEditorIps, upload.single("file"), h(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Debes adjuntar un archivo .xlsx." });
  let filas;
  try {
    filas = leerPrimeraHoja(req.file.buffer).slice(1);
  } catch (e) {
    return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un .xlsx válido?" });
  }

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };

  const client = await pool.connect();
  let actualizadas = 0, creadas = 0, omitidas = 0;
  const vistos = new Set();
  try {
    await client.query("BEGIN");
    for (const r of filas) {
      const cod = r[0];
      if (cod === null || cod === undefined || String(cod).trim() === "") { omitidas++; continue; }
      const codStr = String(cod).trim();
      if (vistos.has(codStr)) continue;
      vistos.add(codStr);

      const camas = {
        UCI: { Adulto: num(r[5]), Pediatrico: num(r[9]), Neonato: num(r[7]) },
        Intermedio: { Adulto: num(r[6]), Pediatrico: num(r[10]), Neonato: num(r[8]) },
        Hospitalizacion: { General: num(r[11]) },
        Observacion: { General: num(r[12]) }
      };

      const { rows: existing } = await client.query("SELECT cod FROM ips WHERE cod = $1", [codStr]);
      if (existing[0]) {
        await client.query("UPDATE ips SET camas_habilitadas=$1, actualizado_en=now() WHERE cod=$2", [JSON.stringify(camas), codStr]);
        actualizadas++;
      } else {
        await client.query(
          `INSERT INTO ips (cod, nombre, regional, zonal, municipio, camas_habilitadas, activo, actualizado_en)
           VALUES ($1,$2,$3,$4,$5,$6,true,now())`,
          [codStr, (r[4] || "").toString().trim(), r[1] || null, r[2] || null, r[3] || null, JSON.stringify(camas)]
        );
        creadas++;
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true, ipsActualizadas: actualizadas, ipsCreadas: creadas, filasOmitidas: omitidas });
}));

// =========================================================
//  ADMINISTRACION DE USUARIOS (solo Administrador)
// =========================================================
app.get("/api/admin/usuarios", authMiddleware, requireAdmin, h(async (req, res) => {
  const { rows } = await pool.query("SELECT id, nombre, cargo, tdoc, doc, email, usuario, perfil, activo, debe_cambiar_pass FROM users ORDER BY nombre");
  res.json(rows);
}));

app.post("/api/admin/usuarios", authMiddleware, requireAdmin, h(async (req, res) => {
  const { nombre, cargo, tdoc, doc, email, usuario, perfil } = req.body || {};
  if (!nombre || !doc || !usuario || !perfil) return res.status(400).json({ error: "Datos incompletos." });
  const initialPass = `${tdoc || "CC"}${doc}_`;
  const hash = bcrypt.hashSync(initialPass, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (nombre, cargo, tdoc, doc, email, usuario, perfil, pass_hash, debe_cambiar_pass, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true) RETURNING id`,
      [nombre, cargo || null, tdoc || "CC", String(doc), email || null, usuario.toLowerCase(), perfil, hash]
    );
    res.status(201).json({ id: rows[0].id, passwordInicial: initialPass });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "El usuario o documento ya existe." });
    throw e;
  }
}));

app.put("/api/admin/usuarios/:id", authMiddleware, requireAdmin, h(async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, cargo, email, perfil, activo } = req.body || {};
  const { rows: existingRows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Usuario no encontrado." });
  await pool.query(
    "UPDATE users SET nombre=$1, cargo=$2, email=$3, perfil=$4, activo=$5 WHERE id=$6",
    [nombre ?? existing.nombre, cargo ?? existing.cargo, email ?? existing.email, perfil ?? existing.perfil, activo === undefined ? existing.activo : !!activo, id]
  );
  res.json({ ok: true });
}));

app.post("/api/admin/usuarios/:id/resetear-password", authMiddleware, requireAdmin, h(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
  const initialPass = `${user.tdoc}${user.doc}_`;
  const hash = bcrypt.hashSync(initialPass, 10);
  await pool.query("UPDATE users SET pass_hash=$1, debe_cambiar_pass=true WHERE id=$2", [hash, id]);
  res.json({ ok: true, passwordInicial: initialPass });
}));

// =========================================================
//  Frontend estatico
// =========================================================
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "No encontrado." });
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =========================================================
//  Arranque: primero prepara/siembra la base de datos, luego escucha.
// =========================================================
ensureReady()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Censo Ocupacion de Camas escuchando en puerto ${PORT}`);
    });
  })
  .catch((e) => {
    console.error("No se pudo preparar la base de datos:", e);
    process.exit(1);
  });
