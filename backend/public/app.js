// app.js - Censo Ocupación de Camas (Famisanar)
// SPA en JS puro que consume la API REST del backend.

const state = {
  token: localStorage.getItem("censo_token") || null,
  usuario: JSON.parse(localStorage.getItem("censo_usuario") || "null"),
  permisos: null,
  vista: "registro",
  ipsList: [],
  censos: [],
};

const el = document.getElementById("app");

const TIPOS_ESTANCIA = [
  { key: "UCI", label: "UCI", poblaciones: true },
  { key: "Intermedio", label: "Intermedio", poblaciones: true },
  { key: "Hospitalizacion", label: "Hospitalización", poblaciones: false },
  { key: "Observacion", label: "Observación", poblaciones: false },
];
const POBLACIONES = ["Adulto", "Pediatrico", "Neonato"];

// ---------------- API helper ----------------
async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = "Bearer " + state.token;
  const res = await fetch("/api" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
  if (!res.ok) {
    if (res.status === 401) { logout(); }
    throw new Error((data && data.error) || "Error de red.");
  }
  return data;
}

function logout() {
  state.token = null;
  state.usuario = null;
  state.permisos = null;
  localStorage.removeItem("censo_token");
  localStorage.removeItem("censo_usuario");
  render();
}

// ---------------- Render root ----------------
async function render() {
  if (!state.token) { renderLogin(); return; }
  if (!state.permisos) {
    try { state.permisos = await api("/auth/permisos"); }
    catch (e) { logout(); return; }
  }
  renderShell();
}
render();

// ================= LOGIN =================
function renderLogin() {
  el.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <h1>Censo Ocupación de Camas</h1>
        <p class="subtitle">Famisanar · Red de 302 IPS</p>
        <div id="login-error"></div>
        <form id="login-form">
          <div class="field">
            <label>Usuario</label>
            <input type="text" id="login-usuario" autocomplete="username" required />
          </div>
          <div class="field">
            <label>Contraseña</label>
            <input type="password" id="login-password" autocomplete="current-password" required />
          </div>
          <button class="btn btn-primary" type="submit">Ingresar</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("login-usuario").value.trim();
    const password = document.getElementById("login-password").value;
    const errBox = document.getElementById("login-error");
    errBox.innerHTML = "";
    try {
      const data = await api("/auth/login", { method: "POST", body: { usuario, password } });
      state.token = data.token;
      state.usuario = data.usuario;
      localStorage.setItem("censo_token", state.token);
      localStorage.setItem("censo_usuario", JSON.stringify(state.usuario));
      if (data.debeCambiarPass) {
        renderCambiarPassword(true);
      } else {
        render();
      }
    } catch (err) {
      errBox.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

function renderCambiarPassword(obligatorio) {
  el.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <h1>Cambio de contraseña</h1>
        <p class="subtitle">${obligatorio ? "Este es tu primer ingreso. Debes definir una nueva contraseña." : "Actualiza tu contraseña."}</p>
        <div id="cp-msg"></div>
        <form id="cp-form">
          <div class="field">
            <label>Contraseña actual</label>
            <input type="password" id="cp-actual" required />
          </div>
          <div class="field">
            <label>Nueva contraseña (mínimo 8 caracteres)</label>
            <input type="password" id="cp-nueva" minlength="8" required />
          </div>
          <button class="btn btn-primary" type="submit">Guardar y continuar</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById("cp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const passwordActual = document.getElementById("cp-actual").value;
    const passwordNueva = document.getElementById("cp-nueva").value;
    const msg = document.getElementById("cp-msg");
    try {
      await api("/auth/cambiar-password", { method: "POST", body: { passwordActual, passwordNueva } });
      render();
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

// ================= SHELL (sidebar + main) =================
function renderShell() {
  const perfil = state.usuario.perfil;
  const items = [
    { key: "registro", label: "Registro de Ocupación", show: state.permisos.puedeEscribir },
    { key: "dashboard", label: "Dashboard", show: true },
    { key: "tabla", label: "Tabla de Ocupación", show: true },
    { key: "administracion", label: "Administración", show: state.permisos.puedeAdministrarUsuarios },
  ].filter(i => i.show);

  if (!items.find(i => i.key === state.vista)) state.vista = items[0].key;

  el.innerHTML = `
    <div class="app-shell">
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="brand">Censo Camas · Famisanar</div>
          <div class="role">${perfil}</div>
        </div>
        <div id="nav"></div>
        <div class="sidebar-footer">
          <button class="btn btn-outline" id="btn-manual" style="width:100%;color:white;border-color:rgba(255,255,255,0.3);margin-bottom:8px;">📘 Manual de uso</button>
          <div class="user-name">${state.usuario.nombre}</div>
          <div class="user-doc">@${state.usuario.usuario}</div>
          <button class="btn btn-outline" id="btn-logout" style="width:100%;color:white;border-color:rgba(255,255,255,0.3)">Cerrar sesión</button>
        </div>
      </div>
      <div class="main" id="main"></div>
    </div>
  `;

  const nav = document.getElementById("nav");
  items.forEach(i => {
    const div = document.createElement("div");
    div.className = "nav-item" + (state.vista === i.key ? " active" : "");
    div.textContent = i.label;
    div.addEventListener("click", () => { state.vista = i.key; renderShell(); });
    nav.appendChild(div);
  });

  document.getElementById("btn-logout").addEventListener("click", logout);
  document.getElementById("btn-manual").addEventListener("click", abrirManual);

  const main = document.getElementById("main");
  if (state.vista === "registro") renderRegistro(main);
  else if (state.vista === "dashboard") renderDashboard(main);
  else if (state.vista === "tabla") renderTabla(main);
  else if (state.vista === "administracion") renderAdministracion(main);
}

// ================= helper: cargar IPS =================
async function ensureIpsList() {
  if (state.ipsList.length === 0) {
    state.ipsList = await api("/ips");
  }
  return state.ipsList;
}

// ================= REGISTRO =================
async function renderRegistro(main) {
  main.innerHTML = `<div class="spinner">Cargando IPS…</div>`;
  const ipsList = await ensureIpsList();

  let ipsSeleccionada = null;
  let fecha = new Date().toISOString().slice(0, 10);
  let registradosHoy = [];

  const regionales = [...new Set(ipsList.map(i => i.regional).filter(Boolean))].sort();

  main.innerHTML = `
    <h2>Registro de Ocupación</h2>
    <p class="desc">Registra la ocupación diaria de camas por IPS y tipo de estancia.</p>
    <div id="reg-msg"></div>
    <div class="card">
      <div class="grid-3">
        <div class="field">
          <label>Fecha</label>
          <input type="date" id="reg-fecha" value="${fecha}" />
        </div>
        <div class="field">
          <label>Regional</label>
          <select id="reg-regional">
            <option value="">Selecciona...</option>
            ${regionales.map(r => `<option value="${r}">${r}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Zonal</label>
          <select id="reg-zonal"><option value="">Todas</option></select>
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Municipio</label>
          <select id="reg-municipio"><option value="">Todos</option></select>
        </div>
        <div class="field">
          <label>IPS</label>
          <select id="reg-ips">
            <option value="">Selecciona primero la regional…</option>
          </select>
        </div>
      </div>
      <div id="reg-checklist"></div>
    </div>
    <div class="card" id="reg-form-card" style="display:none;"></div>
  `;

  const selRegional = document.getElementById("reg-regional");
  const selZonal = document.getElementById("reg-zonal");
  const selMunicipio = document.getElementById("reg-municipio");
  const selIps = document.getElementById("reg-ips");

  function ipsFiltradas() {
    const r = selRegional.value, z = selZonal.value, m = selMunicipio.value;
    return ipsList.filter(i =>
      (!r || i.regional === r) && (!z || i.zonal === z) && (!m || i.municipio === m)
    );
  }

  function refrescarZonalYMunicipio(reset) {
    const r = selRegional.value;
    let base = ipsList.filter(i => !r || i.regional === r);
    if (!reset && selZonal.value) base = base.filter(i => i.zonal === selZonal.value);
    const zonalesBase = ipsList.filter(i => !r || i.regional === r);
    const zonales = [...new Set(zonalesBase.map(i => i.zonal).filter(Boolean))].sort();
    const municipiosBase = ipsList.filter(i => (!r || i.regional === r) && (!selZonal.value || i.zonal === selZonal.value));
    const municipios = [...new Set(municipiosBase.map(i => i.municipio).filter(Boolean))].sort();
    const zonalActual = selZonal.value;
    const munActual = selMunicipio.value;
    selZonal.innerHTML = `<option value="">Todas</option>` + zonales.map(z => `<option value="${z}" ${z === zonalActual ? "selected" : ""}>${z}</option>`).join("");
    selMunicipio.innerHTML = `<option value="">Todos</option>` + municipios.map(m => `<option value="${m}" ${m === munActual ? "selected" : ""}>${m}</option>`).join("");
  }

  function refrescarIps() {
    const filtradas = ipsFiltradas();
    if (!selRegional.value) {
      selIps.innerHTML = `<option value="">Selecciona primero la regional…</option>`;
      selIps.disabled = true;
    } else {
      selIps.disabled = false;
      selIps.innerHTML = `<option value="">Selecciona una IPS… (${filtradas.length})</option>` +
        filtradas.map(i => `<option value="${i.cod}">${i.nombre} (${i.municipio})</option>`).join("");
    }
  }

  selRegional.addEventListener("change", () => { refrescarZonalYMunicipio(true); refrescarIps(); });
  selZonal.addEventListener("change", () => { refrescarZonalYMunicipio(false); refrescarIps(); });
  selMunicipio.addEventListener("change", refrescarIps);
  refrescarIps();

  document.getElementById("reg-fecha").addEventListener("change", (e) => { fecha = e.target.value; cargarChecklist(); });
  selIps.addEventListener("change", (e) => {
    ipsSeleccionada = ipsList.find(i => i.cod === e.target.value) || null;
    cargarChecklist();
  });

  async function cargarChecklist() {
    const checklistBox = document.getElementById("reg-checklist");
    const formCard = document.getElementById("reg-form-card");
    if (!ipsSeleccionada) { checklistBox.innerHTML = ""; formCard.style.display = "none"; return; }

    registradosHoy = await api(`/censos?fechaInicio=${fecha}&fechaFin=${fecha}&ipsCod=${ipsSeleccionada.cod}`);

    const pendientes = [];
    TIPOS_ESTANCIA.forEach(t => {
      if (t.poblaciones) {
        POBLACIONES.forEach(p => {
          const hecho = registradosHoy.some(r => r.tipo_estancia === t.key && r.poblacion === p);
          pendientes.push({ key: t.key, label: `${t.label} · ${p}`, poblacion: p, hecho });
        });
      } else {
        const hecho = registradosHoy.some(r => r.tipo_estancia === t.key);
        pendientes.push({ key: t.key, label: t.label, poblacion: null, hecho });
      }
    });

    checklistBox.innerHTML = `
      <div class="checklist">
        ${pendientes.map(p => `<span class="chip ${p.hecho ? "done" : "pending"}">${p.hecho ? "✓ " : ""}${p.label}</span>`).join("")}
      </div>
    `;

    formCard.style.display = "block";
    renderFormularioCenso(formCard, ipsSeleccionada, fecha, pendientes);
  }
}

function renderFormularioCenso(card, ips, fecha, pendientes) {
  card.innerHTML = `
    <h3>Nuevo registro — ${ips.nombre}</h3>
    <div class="grid-3" style="margin-bottom:14px;">
      <div class="field"><label>Zonal</label><div style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">${ips.zonal || "—"}</div></div>
      <div class="field"><label>Ámbito</label><div style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">${ips.ambito || "—"}</div></div>
      <div class="field"><label>Líder</label><div style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">${ips.lider || "—"}</div></div>
    </div>
    <form id="censo-form">
      <div class="grid-2">
        <div class="field">
          <label>Tipo de estancia</label>
          <select id="c-tipo">
            ${TIPOS_ESTANCIA.map(t => `<option value="${t.key}">${t.label}</option>`).join("")}
          </select>
        </div>
        <div class="field" id="c-poblacion-wrap">
          <label>Población</label>
          <select id="c-poblacion">
            ${POBLACIONES.map(p => `<option value="${p}">${p}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="grid-3">
        <div class="field">
          <label>Camas habilitadas <span style="font-weight:400;color:var(--gris-600);">(base maestra)</span></label>
          <div id="c-habilitadas-display" style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:16px;font-weight:700;color:var(--azul-oscuro);">—</div>
        </div>
        <div class="field">
          <label>Ocupación IPS</label>
          <input type="number" min="0" id="c-ocupips" required />
        </div>
        <div class="field">
          <label>Ocupación Famisanar</label>
          <input type="number" min="0" id="c-ocupfami" required />
        </div>
      </div>
      <div class="grid-2" style="margin-bottom:14px;">
        <div class="field"><label>Camas disponibles</label><div id="c-disponibles-display" style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">—</div></div>
        <div class="field"><label>% Ocupación (IPS / Famisanar)</label><div id="c-pct-display" style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">—</div></div>
      </div>
      <div id="c-alerta"></div>
      <button class="btn btn-primary" type="submit">Guardar registro</button>
    </form>
  `;

  const tipoSel = document.getElementById("c-tipo");
  const poblacionSel = document.getElementById("c-poblacion");
  const poblacionWrap = document.getElementById("c-poblacion-wrap");
  const habilitadasDisplay = document.getElementById("c-habilitadas-display");
  const disponiblesDisplay = document.getElementById("c-disponibles-display");
  const pctDisplay = document.getElementById("c-pct-display");
  const ocupIpsInput = document.getElementById("c-ocupips");
  const ocupFamiInput = document.getElementById("c-ocupfami");
  const alertaBox = document.getElementById("c-alerta");

  function habilitadasActuales() {
    const tipo = tipoSel.value;
    const cama = ips.camas_habilitadas || {};
    const grupo = cama[tipo] || {};
    if (tipo === "Hospitalizacion" || tipo === "Observacion") return Number(grupo.General || 0);
    return Number(grupo[poblacionSel.value] || 0);
  }

  function recalcular() {
    const t = TIPOS_ESTANCIA.find(x => x.key === tipoSel.value);
    poblacionWrap.style.display = t.poblaciones ? "block" : "none";
    const habilitadas = habilitadasActuales();
    habilitadasDisplay.textContent = habilitadas;

    const ocupIps = Number(ocupIpsInput.value || 0);
    const ocupFami = Number(ocupFamiInput.value || 0);
    const disponibles = Math.max(habilitadas - ocupIps, 0);
    disponiblesDisplay.textContent = disponibles;
    const pctIps = habilitadas > 0 ? ((ocupIps / habilitadas) * 100).toFixed(1) : "0.0";
    const pctFami = habilitadas > 0 ? ((ocupFami / habilitadas) * 100).toFixed(1) : "0.0";
    pctDisplay.innerHTML = `<span class="badge badge-ips">${pctIps}%</span> / <span class="badge badge-famisanar">${pctFami}%</span>`;

    alertaBox.innerHTML = "";
    if (ocupIps > habilitadas) {
      alertaBox.innerHTML = `<div class="error-msg" style="margin-bottom:12px;">⚠ Sobreocupación: la Ocupación IPS (${ocupIps}) supera las camas habilitadas (${habilitadas}).</div>`;
    }
    if (ocupFami > ocupIps) {
      alertaBox.innerHTML += `<div class="error-msg" style="margin-bottom:12px;">La Ocupación Famisanar no puede ser mayor que la Ocupación IPS.</div>`;
    }
  }

  tipoSel.addEventListener("change", recalcular);
  poblacionSel.addEventListener("change", recalcular);
  ocupIpsInput.addEventListener("input", recalcular);
  ocupFamiInput.addEventListener("input", recalcular);
  recalcular();

  document.getElementById("censo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("reg-msg");
    const tipo = TIPOS_ESTANCIA.find(x => x.key === tipoSel.value);
    const body = {
      fecha,
      ipsCod: ips.cod,
      tipoEstancia: tipo.key,
      poblacion: tipo.poblaciones ? poblacionSel.value : null,
      ocupacionIps: Number(ocupIpsInput.value),
      ocupacionFamisanar: Number(ocupFamiInput.value),
    };
    try {
      await api("/censos", { method: "POST", body });
      msg.innerHTML = `<div class="ok-msg">Registro guardado correctamente.</div>`;
      renderRegistro(document.getElementById("main"));
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

// ================= TABLA =================
async function renderTabla(main) {
  main.innerHTML = `<div class="spinner">Cargando registros…</div>`;
  const ipsList = await ensureIpsList();
  let rows = await api("/censos");

  const regionales = [...new Set(ipsList.map(i => i.regional).filter(Boolean))].sort();
  const ambitos = [...new Set(ipsList.map(i => i.ambito).filter(Boolean))].sort();
  const hoy = new Date().toISOString().slice(0, 10);

  main.innerHTML = `
    <h2>Tabla de Ocupación</h2>
    <p class="desc">${state.permisos.puedeEditarTodo ? "Todos los registros de la red." : "Tus registros."}</p>
    <div id="tabla-msg"></div>
    <div class="card">
      <div class="toolbar">
        <input type="date" id="tf-desde" title="Desde" />
        <input type="date" id="tf-hasta" title="Hasta" value="${hoy}" />
        <select id="tf-regional"><option value="">Todas las regionales</option>${regionales.map(r => `<option value="${r}">${r}</option>`).join("")}</select>
        <select id="tf-zonal"><option value="">Todas las zonales</option></select>
        <select id="tf-municipio"><option value="">Todos los municipios</option></select>
      </div>
      <div class="toolbar">
        <select id="tf-ambito"><option value="">Todos los ámbitos</option>${ambitos.map(a => `<option value="${a}">${a}</option>`).join("")}</select>
        <select id="tf-tipo"><option value="">Todos los tipos</option>${TIPOS_ESTANCIA.map(t => `<option value="${t.key}">${t.label}</option>`).join("")}</select>
        <input type="text" id="tf-buscar" placeholder="Buscar IPS…" />
        <input type="text" id="tf-usuario" placeholder="Buscar usuario…" />
        <button class="btn btn-secondary" id="btn-filtrar">Filtrar</button>
        <button class="btn btn-outline" id="btn-csv">⬇ Descargar CSV</button>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>IPS</th><th>Regional</th><th>Ámbito</th><th>Tipo estancia</th><th>Población</th>
              <th>Habilitadas</th><th>Ocup. IPS</th><th>Ocup. Famisanar</th><th>Disponibles</th><th>Registrado por</th>
              ${(state.permisos.puedeEscribir || state.permisos.puedeEliminar) ? "<th>Acciones</th>" : ""}
            </tr>
          </thead>
          <tbody id="tabla-body"></tbody>
        </table>
      </div>
      <div id="tabla-empty"></div>
    </div>
  `;

  const selRegional = document.getElementById("tf-regional");
  const selZonal = document.getElementById("tf-zonal");
  const selMunicipio = document.getElementById("tf-municipio");

  function refrescarZonalMunicipio() {
    const r = selRegional.value;
    const base = ipsList.filter(i => !r || i.regional === r);
    const zonales = [...new Set(base.map(i => i.zonal).filter(Boolean))].sort();
    const baseM = base.filter(i => !selZonal.value || i.zonal === selZonal.value);
    const municipios = [...new Set(baseM.map(i => i.municipio).filter(Boolean))].sort();
    selZonal.innerHTML = `<option value="">Todas las zonales</option>` + zonales.map(z => `<option value="${z}">${z}</option>`).join("");
    selMunicipio.innerHTML = `<option value="">Todos los municipios</option>` + municipios.map(m => `<option value="${m}">${m}</option>`).join("");
  }
  selRegional.addEventListener("change", refrescarZonalMunicipio);
  selZonal.addEventListener("change", refrescarZonalMunicipio);

  document.getElementById("btn-filtrar").addEventListener("click", async () => {
    const params = new URLSearchParams();
    const desde = document.getElementById("tf-desde").value;
    const hasta = document.getElementById("tf-hasta").value;
    const regional = selRegional.value;
    const zonal = selZonal.value;
    const municipio = selMunicipio.value;
    const ambito = document.getElementById("tf-ambito").value;
    const usuario = document.getElementById("tf-usuario").value;
    if (desde) params.set("fechaInicio", desde);
    if (hasta) params.set("fechaFin", hasta);
    if (regional) params.set("regional", regional);
    if (zonal) params.set("zonal", zonal);
    if (municipio) params.set("municipio", municipio);
    if (ambito) params.set("ambito", ambito);
    if (usuario) params.set("usuario", usuario);
    rows = await api(`/censos?${params.toString()}`);
    const tipo = document.getElementById("tf-tipo").value;
    const q = document.getElementById("tf-buscar").value.toLowerCase();
    const filtradas = rows.filter(r => (!tipo || r.tipo_estancia === tipo) && (!q || r.ips_nombre.toLowerCase().includes(q)));
    pintarTabla(filtradas);
  });

  document.getElementById("btn-csv").addEventListener("click", () => descargarCSV(rows));

  pintarTabla(rows);

  function pintarTabla(data) {
  const tbody = document.getElementById("tabla-body");
  tbody.innerHTML = "";
  document.getElementById("tabla-empty").innerHTML = data.length === 0 ? `<div class="empty-state">No hay registros con esos filtros.</div>` : "";
  data.forEach(r => {
    const tr = document.createElement("tr");
    const sobreocupado = r.ocupacion_ips > r.camas_habilitadas;
    const puedeEditarFila = state.permisos.puedeEditarTodo || r.usuario_id === state.usuario.id;
    tr.innerHTML = `
      <td>${r.fecha}</td>
      <td>${r.ips_nombre}</td>
      <td>${r.regional || ""}</td>
      <td>${r.ambito || "—"}</td>
      <td>${r.tipo_estancia}</td>
      <td>${r.poblacion || "—"}</td>
      <td>${r.camas_habilitadas}</td>
      <td><span class="badge badge-ips">${r.ocupacion_ips}${sobreocupado ? " ⚠" : ""}</span></td>
      <td><span class="badge badge-famisanar">${r.ocupacion_famisanar}</span></td>
      <td>${r.camas_disponibles}</td>
      <td>${r.usuario_nombre}</td>
      ${(state.permisos.puedeEscribir || state.permisos.puedeEliminar) ? `
      <td class="actions-cell">
        ${puedeEditarFila && state.permisos.puedeEscribir ? `<button class="icon-btn" data-edit="${r.id}">Editar</button>` : ""}
        ${state.permisos.puedeEliminar ? `<button class="icon-btn danger" data-del="${r.id}">Eliminar</button>` : ""}
      </td>` : ""}
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = data.find(r => r.id === Number(btn.dataset.edit));
      abrirModalEdicion(row);
    });
  });
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
      try {
        await api(`/censos/${btn.dataset.del}`, { method: "DELETE" });
        renderTabla(main);
      } catch (err) {
        document.getElementById("tabla-msg").innerHTML = `<div class="error-msg">${err.message}</div>`;
      }
    });
  });
  } // fin pintarTabla
}

function descargarCSV(rows) {
  const headers = ["Fecha", "IPS", "Regional", "Ambito", "Tipo estancia", "Poblacion", "Camas habilitadas", "Ocupacion IPS", "Ocupacion Famisanar", "Camas disponibles", "Registrado por"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach(r => {
    lines.push([r.fecha, r.ips_nombre, r.regional, r.ambito, r.tipo_estancia, r.poblacion, r.camas_habilitadas, r.ocupacion_ips, r.ocupacion_famisanar, r.camas_disponibles, r.usuario_nombre].map(escape).join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `censo-ocupacion-camas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function abrirModalEdicion(row) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h3>Editar registro — ${row.ips_nombre}</h3>
      <div id="modal-msg"></div>
      <div class="field"><label>Camas habilitadas</label><input type="number" min="0" id="m-habilitadas" value="${row.camas_habilitadas}" /></div>
      <div class="field"><label>Ocupación IPS</label><input type="number" min="0" id="m-ocupips" value="${row.ocupacion_ips}" /></div>
      <div class="field"><label>Ocupación Famisanar</label><input type="number" min="0" id="m-ocupfami" value="${row.ocupacion_famisanar}" /></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancel">Cancelar</button>
        <button class="btn btn-primary" id="m-save">Guardar cambios</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.getElementById("m-cancel").addEventListener("click", () => backdrop.remove());
  document.getElementById("m-save").addEventListener("click", async () => {
    const body = {
      camasHabilitadas: Number(document.getElementById("m-habilitadas").value),
      ocupacionIps: Number(document.getElementById("m-ocupips").value),
      ocupacionFamisanar: Number(document.getElementById("m-ocupfami").value),
    };
    try {
      await api(`/censos/${row.id}`, { method: "PUT", body });
      backdrop.remove();
      renderTabla(document.getElementById("main"));
    } catch (err) {
      document.getElementById("modal-msg").innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

// ================= DASHBOARD =================
async function renderDashboard(main) {
  main.innerHTML = `<div class="spinner">Cargando dashboard…</div>`;
  const ipsList = await ensureIpsList();
  const regionales = [...new Set(ipsList.map(i => i.regional).filter(Boolean))].sort();
  const hoy = new Date().toISOString().slice(0, 10);

  const filtro = { periodo: "dia", valor: hoy, regional: "", zonal: "", municipio: "", ipsCod: "" };

  main.innerHTML = `
    <h2>Dashboard</h2>
    <p class="desc">Resumen visual de la ocupación de camas.</p>
    <div class="card">
      <div class="toolbar" style="align-items:center;">
        <div style="display:flex;gap:4px;">
          <button class="btn btn-primary" id="per-dia" style="padding:7px 14px;">Día</button>
          <button class="btn btn-outline" id="per-semana" style="padding:7px 14px;">Semana</button>
          <button class="btn btn-outline" id="per-mes" style="padding:7px 14px;">Mes</button>
        </div>
        <input type="date" id="db-fecha" value="${hoy}" />
        <select id="db-regional"><option value="">Todas las regionales</option>${regionales.map(r => `<option value="${r}">${r}</option>`).join("")}</select>
        <select id="db-zonal"><option value="">Todas las zonales</option></select>
        <select id="db-municipio"><option value="">Todos los municipios</option></select>
        <select id="db-ips"><option value="">Todas las IPS</option></select>
      </div>
    </div>
    <div id="db-content"><div class="spinner">Cargando…</div></div>
  `;

  const selRegional = document.getElementById("db-regional");
  const selZonal = document.getElementById("db-zonal");
  const selMunicipio = document.getElementById("db-municipio");
  const selIps = document.getElementById("db-ips");

  function refrescarSelects() {
    const base = ipsList.filter(i => !selRegional.value || i.regional === selRegional.value);
    const zonales = [...new Set(base.map(i => i.zonal).filter(Boolean))].sort();
    const baseM = base.filter(i => !selZonal.value || i.zonal === selZonal.value);
    const municipios = [...new Set(baseM.map(i => i.municipio).filter(Boolean))].sort();
    const baseI = baseM.filter(i => !selMunicipio.value || i.municipio === selMunicipio.value);
    selZonal.innerHTML = `<option value="">Todas las zonales</option>` + zonales.map(z => `<option value="${z}">${z}</option>`).join("");
    selMunicipio.innerHTML = `<option value="">Todos los municipios</option>` + municipios.map(m => `<option value="${m}">${m}</option>`).join("");
    selIps.innerHTML = `<option value="">Todas las IPS</option>` + baseI.map(i => `<option value="${i.cod}">${i.nombre}</option>`).join("");
  }
  refrescarSelects();

  async function cargar() {
    filtro.regional = selRegional.value;
    filtro.zonal = selZonal.value;
    filtro.municipio = selMunicipio.value;
    filtro.ipsCod = selIps.value;
    filtro.valor = document.getElementById("db-fecha").value || hoy;

    const params = new URLSearchParams();
    params.set("periodo", filtro.periodo);
    params.set("valor", filtro.valor);
    if (filtro.regional) params.set("regional", filtro.regional);
    if (filtro.zonal) params.set("zonal", filtro.zonal);
    if (filtro.municipio) params.set("municipio", filtro.municipio);
    if (filtro.ipsCod) params.set("ipsCod", filtro.ipsCod);

    document.getElementById("db-content").innerHTML = `<div class="spinner">Cargando…</div>`;
    const data = await api(`/dashboard/resumen?${params.toString()}`);
    pintarDashboard(document.getElementById("db-content"), data);
  }

  ["per-dia", "per-semana", "per-mes"].forEach(id => {
    document.getElementById(id).addEventListener("click", () => {
      filtro.periodo = id.replace("per-", "");
      ["per-dia", "per-semana", "per-mes"].forEach(i2 => {
        document.getElementById(i2).className = i2 === id ? "btn btn-primary" : "btn btn-outline";
        document.getElementById(i2).style.padding = "7px 14px";
      });
      cargar();
    });
  });
  document.getElementById("db-fecha").addEventListener("change", cargar);
  selRegional.addEventListener("change", () => { refrescarSelects(); cargar(); });
  selZonal.addEventListener("change", () => { refrescarSelects(); cargar(); });
  selMunicipio.addEventListener("change", () => { refrescarSelects(); cargar(); });
  selIps.addEventListener("change", cargar);

  cargar();
}

function pintarDashboard(box, data) {
  const k = data.kpis;
  const vbars = (rows) => `
    <div class="legend-row"><span><span class="legend-dot ips"></span>IPS</span><span><span class="legend-dot fami"></span>Famisanar</span></div>
    <div class="chart-vbars">
      ${rows.length === 0 ? `<div class="empty-state">Sin datos.</div>` : rows.map(r => `
        <div class="chart-vbar-group">
          <div class="chart-vbar-pair">
            <div style="display:flex;flex-direction:column;justify-content:flex-end;">
              <div class="chart-vbar-val">${r.pctIps}%</div>
              <div class="chart-vbar ips" style="height:${Math.min(r.pctIps, 100) * 1.5}px;"></div>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:flex-end;">
              <div class="chart-vbar-val">${r.pctFamisanar}%</div>
              <div class="chart-vbar fami" style="height:${Math.min(r.pctFamisanar, 100) * 1.5}px;"></div>
            </div>
          </div>
          <div class="chart-vbar-label">${r.etiqueta}</div>
        </div>
      `).join("")}
    </div>
  `;

  const hbars = (rows, claseFill = "") => `
    <div class="chart-hbars">
      ${rows.length === 0 ? `<div class="empty-state">Sin datos.</div>` : rows.map(r => `
        <div class="chart-hbar-row">
          <div class="chart-hbar-label" title="${r.etiqueta}">${r.etiqueta}</div>
          <div class="chart-hbar-track"><div class="chart-hbar-fill ${claseFill}" style="width:${Math.min(r.pctIps, 100)}%;"></div></div>
          <div class="chart-hbar-pct">${r.pctIps}%</div>
        </div>
      `).join("")}
    </div>
  `;

  const serieSvg = () => {
    const serie = data.serieTiempo;
    if (serie.length === 0) return `<div class="empty-state">Sin datos en el período.</div>`;
    const w = 600, h = 160, pad = 20;
    const maxPct = 100;
    const puntos = (campo) => serie.map((s, idx) => {
      const x = pad + (idx / Math.max(serie.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - (Math.min(s[campo], maxPct) / maxPct) * (h - pad * 2);
      return `${x},${y}`;
    }).join(" ");
    return `
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:180px;">
        <polyline points="${puntos("pctIps")}" fill="none" stroke="#2E9E6D" stroke-width="2.5" />
        <polyline points="${puntos("pctFamisanar")}" fill="none" stroke="#0F3460" stroke-width="2.5" />
        ${serie.map((s, idx) => {
          const x = pad + (idx / Math.max(serie.length - 1, 1)) * (w - pad * 2);
          return `<text x="${x}" y="${h - 2}" font-size="9" fill="#5B6472" text-anchor="middle">${s.fecha.slice(5)}</text>`;
        }).join("")}
      </svg>
    `;
  };

  box.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><div class="label">IPS registradas hoy</div><div class="value">${k.ipsRegistradasHoy} <span style="font-size:13px;color:var(--gris-600)">/ ${k.totalIpsActivas}</span></div></div>
      <div class="kpi"><div class="label">IPS faltantes por registrar hoy</div><div class="value" style="color:var(--rojo);">${k.ipsFaltantesHoy}</div></div>
      <div class="kpi"><div class="label">Camas habilitadas</div><div class="value">${k.habilitadas}</div></div>
      <div class="kpi"><div class="label">Camas disponibles</div><div class="value">${k.disponibles}</div></div>
    </div>
    <div class="kpi-row">
      <div class="kpi"><div class="label">% Ocupación general (IPS)</div><div class="value">${k.pctIps}%</div></div>
      <div class="kpi"><div class="label">% Ocupación Famisanar</div><div class="value verde">${k.pctFamisanar}%</div></div>
      <div class="kpi"><div class="label">Camas ocupadas (IPS)</div><div class="value">${k.ocupadas}</div></div>
      <div class="kpi"><div class="label">Camas ocupadas (Famisanar)</div><div class="value verde">${k.ocupacionFamisanar}</div></div>
    </div>

    <div class="card">
      <h3>Ocupación por regional — IPS vs Famisanar</h3>
      ${vbars(data.porRegional)}
    </div>
    <div class="card">
      <h3>Ocupación por tipo de estancia — IPS vs Famisanar</h3>
      ${vbars(data.porTipoEstancia)}
    </div>
    <div class="card">
      <h3>Ocupación por ámbito — IPS vs Famisanar</h3>
      ${vbars(data.porAmbito)}
    </div>
    <div class="card">
      <h3>Comportamiento de ocupación en el período</h3>
      <div class="legend-row"><span><span class="legend-dot ips"></span>IPS</span><span><span class="legend-dot fami"></span>Famisanar</span></div>
      ${serieSvg()}
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>IPS con mayor % de ocupación (top 8)</h3>
        ${hbars(data.topMayor)}
      </div>
      <div class="card">
        <h3>IPS con menor % de ocupación (top 8)</h3>
        ${hbars(data.topMenor)}
      </div>
    </div>
    <div class="card">
      <h3>IPS faltantes por registrar hoy, por líder</h3>
      <p class="desc" style="margin-bottom:12px;">Este dato es siempre del día de hoy y no depende de los filtros de arriba.</p>
      ${data.faltantesPorLider.length === 0 ? `<div class="empty-state">Todas las IPS ya registraron hoy 🎉</div>` : `
      <table>
        <thead><tr><th>Líder</th><th>IPS faltantes</th></tr></thead>
        <tbody>
          ${data.faltantesPorLider.map(f => `<tr><td>${f.lider}</td><td><span class="badge ${f.faltantes > 0 ? "badge-alerta" : "badge-ips"}">${f.faltantes}</span></td></tr>`).join("")}
        </tbody>
      </table>`}
    </div>
  `;
}

// ================= ADMINISTRACION =================
async function renderAdministracion(main) {
  state.adminTab = state.adminTab || "usuarios";
  main.innerHTML = `
    <h2>Administración</h2>
    <div class="toolbar" style="margin-bottom:18px;">
      <button class="btn ${state.adminTab === "usuarios" ? "btn-primary" : "btn-outline"}" id="tab-usuarios">Usuarios</button>
      ${state.permisos.puedeActualizarIps ? `<button class="btn ${state.adminTab === "ips" ? "btn-primary" : "btn-outline"}" id="tab-ips">Base de IPS</button>` : ""}
    </div>
    <div id="admin-content"></div>
  `;
  document.getElementById("tab-usuarios").addEventListener("click", () => { state.adminTab = "usuarios"; renderAdministracion(main); });
  const tabIps = document.getElementById("tab-ips");
  if (tabIps) tabIps.addEventListener("click", () => { state.adminTab = "ips"; renderAdministracion(main); });

  const content = document.getElementById("admin-content");
  if (state.adminTab === "ips" && state.permisos.puedeActualizarIps) {
    renderAdminIps(content);
  } else {
    renderAdminUsuarios(content);
  }
}

async function renderAdminUsuarios(main) {
  main.innerHTML = `<div class="spinner">Cargando usuarios…</div>`;
  const usuarios = await api("/admin/usuarios");

  main.innerHTML = `
    <p class="desc">Gestión de usuarios del sistema (${usuarios.length} usuarios).</p>
    <div id="admin-msg"></div>
    <div class="card">
      <div class="toolbar">
        <input type="text" id="admin-buscar" placeholder="Buscar por nombre o usuario…" />
        <select id="admin-filtro-perfil">
          <option value="">Todos los perfiles</option>
          <option value="1. Consulta">1. Consulta</option>
          <option value="2. Consulta y Reportes">2. Consulta y Reportes</option>
          <option value="3. Digitador / Auditor">3. Digitador / Auditor</option>
          <option value="4. Coordinador / Supervisor">4. Coordinador / Supervisor</option>
          <option value="5. Administrador">5. Administrador</option>
        </select>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Perfil</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="admin-body"></tbody>
        </table>
      </div>
    </div>
  `;

  function pintar() {
    const q = document.getElementById("admin-buscar").value.toLowerCase();
    const perfilFiltro = document.getElementById("admin-filtro-perfil").value;
    const body = document.getElementById("admin-body");
    body.innerHTML = "";
    usuarios
      .filter(u => (!q || u.nombre.toLowerCase().includes(q) || u.usuario.toLowerCase().includes(q)) && (!perfilFiltro || u.perfil === perfilFiltro))
      .forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.nombre}</td>
          <td>@${u.usuario}</td>
          <td>${u.perfil}</td>
          <td>${u.activo ? '<span class="badge badge-ips">Activo</span>' : '<span class="badge badge-alerta">Inactivo</span>'}</td>
          <td class="actions-cell">
            <button class="icon-btn" data-reset="${u.id}">Resetear clave</button>
            <button class="icon-btn" data-toggle="${u.id}">${u.activo ? "Desactivar" : "Activar"}</button>
          </td>
        `;
        body.appendChild(tr);
      });

    body.querySelectorAll("[data-reset]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const r = await api(`/admin/usuarios/${btn.dataset.reset}/resetear-password`, { method: "POST" });
        document.getElementById("admin-msg").innerHTML = `<div class="ok-msg">Contraseña reiniciada. Nueva contraseña temporal: <b>${r.passwordInicial}</b></div>`;
      });
    });
    body.querySelectorAll("[data-toggle]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const u = usuarios.find(x => x.id === Number(btn.dataset.toggle));
        await api(`/admin/usuarios/${u.id}`, { method: "PUT", body: { activo: !u.activo } });
        renderAdministracion(document.getElementById("main"));
      });
    });
  }

  document.getElementById("admin-buscar").addEventListener("input", pintar);
  document.getElementById("admin-filtro-perfil").addEventListener("change", pintar);
  pintar();
}

// ================= ADMINISTRACION DE IPS =================
async function renderAdminIps(main) {
  main.innerHTML = `<div class="spinner">Cargando base de IPS…</div>`;
  const ipsList = await api("/admin/ips");

  main.innerHTML = `
    <p class="desc">Base de IPS de la red (${ipsList.length} IPS). Los cambios los ven todos los usuarios de inmediato.</p>
    <div id="ips-msg"></div>

    <div class="card">
      <h3>Actualizar desde Excel</h3>
      <p class="desc" style="margin-bottom:14px;">
        Sube el archivo tal cual lo manejas hoy. Se actualizan las IPS existentes por código de habilitación
        y se agregan las que falten — no se borra ningún censo ya registrado.
      </p>
      <div class="grid-2">
        <div class="field">
          <label>Maestro de IPS (nombre, regional, zonal, municipio, ámbito, líder)</label>
          <input type="file" id="file-maestro" accept=".xlsx" />
          <button class="btn btn-primary" id="btn-importar-maestro" style="margin-top:8px;">Importar IPS_CON_AMBITO_Y_LIDER.xlsx</button>
        </div>
        <div class="field">
          <label>Camas habilitadas por IPS</label>
          <input type="file" id="file-camas" accept=".xlsx" />
          <button class="btn btn-primary" id="btn-importar-camas" style="margin-top:8px;">Importar CAMAS_HABILITADAS.xlsx</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="top-bar">
        <h3 style="margin:0;">IPS registradas</h3>
        <button class="btn btn-secondary" id="btn-nueva-ips">+ Nueva IPS manual</button>
      </div>
      <div class="toolbar">
        <input type="text" id="ips-buscar" placeholder="Buscar por nombre o código…" />
        <select id="ips-filtro-regional"><option value="">Todas las regionales</option></select>
        <select id="ips-filtro-estado">
          <option value="">Todos los estados</option>
          <option value="1">Activas</option>
          <option value="0">Inactivas</option>
        </select>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>Regional</th><th>Zonal</th><th>Municipio</th><th>Ámbito</th><th>Líder</th><th>UCI</th><th>Interm.</th><th>Hosp.</th><th>Obs.</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="ips-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const regionales = [...new Set(ipsList.map(i => i.regional).filter(Boolean))].sort();
  const selRegional = document.getElementById("ips-filtro-regional");
  regionales.forEach(r => { const o = document.createElement("option"); o.value = r; o.textContent = r; selRegional.appendChild(o); });

  document.getElementById("btn-importar-maestro").addEventListener("click", () => importarArchivo("file-maestro", "/admin/ips/importar-maestro", main));
  document.getElementById("btn-importar-camas").addEventListener("click", () => importarArchivo("file-camas", "/admin/ips/importar-camas", main));
  document.getElementById("btn-nueva-ips").addEventListener("click", () => abrirModalIps(null, main));

  function pintar() {
    const q = document.getElementById("ips-buscar").value.toLowerCase();
    const regionalF = document.getElementById("ips-filtro-regional").value;
    const estadoF = document.getElementById("ips-filtro-estado").value;
    const body = document.getElementById("ips-body");
    body.innerHTML = "";
    ipsList
      .filter(i =>
        (!q || i.nombre.toLowerCase().includes(q) || i.cod.includes(q)) &&
        (!regionalF || i.regional === regionalF) &&
        (estadoF === "" || String(i.activo) === estadoF)
      )
      .forEach(i => {
        const tr = document.createElement("tr");
        const cama = i.camas_habilitadas || {};
        const sumaUci = ["Adulto", "Pediatrico", "Neonato"].reduce((s, p) => s + Number((cama.UCI || {})[p] || 0), 0);
        const sumaInterm = ["Adulto", "Pediatrico", "Neonato"].reduce((s, p) => s + Number((cama.Intermedio || {})[p] || 0), 0);
        const hosp = Number((cama.Hospitalizacion || {}).General || 0);
        const obs = Number((cama.Observacion || {}).General || 0);
        tr.innerHTML = `
          <td>${i.cod}</td>
          <td>${i.nombre}</td>
          <td>${i.regional || ""}</td>
          <td>${i.zonal || ""}</td>
          <td>${i.municipio || ""}</td>
          <td>${i.ambito || "—"}</td>
          <td>${i.lider || "—"}</td>
          <td>${sumaUci}</td>
          <td>${sumaInterm}</td>
          <td>${hosp}</td>
          <td>${obs}</td>
          <td>${i.activo ? '<span class="badge badge-ips">Activa</span>' : '<span class="badge badge-alerta">Inactiva</span>'}</td>
          <td class="actions-cell">
            <button class="icon-btn" data-editar="${i.cod}">Editar</button>
            <button class="icon-btn" data-toggle="${i.cod}">${i.activo ? "Desactivar" : "Activar"}</button>
          </td>
        `;
        body.appendChild(tr);
      });

    body.querySelectorAll("[data-editar]").forEach(btn => {
      btn.addEventListener("click", () => {
        const ips = ipsList.find(x => x.cod === btn.dataset.editar);
        abrirModalIps(ips, main);
      });
    });
    body.querySelectorAll("[data-toggle]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const ips = ipsList.find(x => x.cod === btn.dataset.toggle);
        await api(`/admin/ips/${encodeURIComponent(ips.cod)}`, { method: "PUT", body: { activo: !ips.activo } });
        renderAdminIps(main);
      });
    });
  }

  document.getElementById("ips-buscar").addEventListener("input", pintar);
  document.getElementById("ips-filtro-regional").addEventListener("change", pintar);
  document.getElementById("ips-filtro-estado").addEventListener("change", pintar);
  pintar();
}

async function importarArchivo(inputId, endpoint, main) {
  const input = document.getElementById(inputId);
  const msg = document.getElementById("ips-msg");
  if (!input.files || input.files.length === 0) {
    msg.innerHTML = `<div class="error-msg">Selecciona un archivo .xlsx primero.</div>`;
    return;
  }
  const formData = new FormData();
  formData.append("file", input.files[0]);
  msg.innerHTML = `<div class="ok-msg">Importando…</div>`;
  try {
    const headers = {};
    if (state.token) headers.Authorization = "Bearer " + state.token;
    const res = await fetch("/api" + endpoint, { method: "POST", headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al importar.");
    const detalle = data.ipsCreadas !== undefined
      ? `${data.ipsActualizadas} IPS actualizadas, ${data.ipsCreadas} IPS nuevas creadas.`
      : `${data.ipsActualizadas} IPS actualizadas.`;
    msg.innerHTML = `<div class="ok-msg">Importación completada: ${detalle}</div>`;
    renderAdminIps(main);
  } catch (err) {
    msg.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

function abrirModalIps(ips, main) {
  const esNueva = !ips;
  const cama = (ips && ips.camas_habilitadas) || {};
  const val = (tipo, pob) => ((cama[tipo] || {})[pob] ?? 0);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="max-width:560px;max-height:85vh;overflow-y:auto;">
      <h3>${esNueva ? "Nueva IPS" : "Editar IPS — " + ips.nombre}</h3>
      <div id="ips-modal-msg"></div>
      <div class="field"><label>Código de habilitación</label><input type="text" id="im-cod" value="${ips ? ips.cod : ""}" ${esNueva ? "" : "disabled"} /></div>
      <div class="field"><label>Nombre</label><input type="text" id="im-nombre" value="${ips ? ips.nombre : ""}" /></div>
      <div class="grid-2">
        <div class="field"><label>Regional</label><input type="text" id="im-regional" value="${ips ? (ips.regional || "") : ""}" /></div>
        <div class="field"><label>Zonal</label><input type="text" id="im-zonal" value="${ips ? (ips.zonal || "") : ""}" /></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Municipio</label><input type="text" id="im-municipio" value="${ips ? (ips.municipio || "") : ""}" /></div>
        <div class="field"><label>Ámbito</label><input type="text" id="im-ambito" value="${ips ? (ips.ambito || "") : ""}" /></div>
      </div>
      <div class="field"><label>Líder</label><input type="text" id="im-lider" value="${ips ? (ips.lider || "") : ""}" /></div>

      <h3 style="margin-top:18px;font-size:14px;">Camas habilitadas por tipo de estancia</h3>
      <div class="grid-3">
        <div class="field"><label>UCI Adulto</label><input type="number" min="0" id="cam-uci-adulto" value="${val("UCI", "Adulto")}" /></div>
        <div class="field"><label>UCI Pediátrico</label><input type="number" min="0" id="cam-uci-pediatrico" value="${val("UCI", "Pediatrico")}" /></div>
        <div class="field"><label>UCI Neonato</label><input type="number" min="0" id="cam-uci-neonato" value="${val("UCI", "Neonato")}" /></div>
      </div>
      <div class="grid-3">
        <div class="field"><label>Interm. Adulto</label><input type="number" min="0" id="cam-int-adulto" value="${val("Intermedio", "Adulto")}" /></div>
        <div class="field"><label>Interm. Pediátrico</label><input type="number" min="0" id="cam-int-pediatrico" value="${val("Intermedio", "Pediatrico")}" /></div>
        <div class="field"><label>Interm. Neonato</label><input type="number" min="0" id="cam-int-neonato" value="${val("Intermedio", "Neonato")}" /></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Hospitalización</label><input type="number" min="0" id="cam-hosp" value="${(cama.Hospitalizacion || {}).General ?? 0}" /></div>
        <div class="field"><label>Observación</label><input type="number" min="0" id="cam-obs" value="${(cama.Observacion || {}).General ?? 0}" /></div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" id="im-cancel">Cancelar</button>
        <button class="btn btn-primary" id="im-save">${esNueva ? "Crear IPS" : "Guardar cambios"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.getElementById("im-cancel").addEventListener("click", () => backdrop.remove());
  document.getElementById("im-save").addEventListener("click", async () => {
    const n = (id) => Number(document.getElementById(id).value || 0);
    const body = {
      nombre: document.getElementById("im-nombre").value.trim(),
      regional: document.getElementById("im-regional").value.trim(),
      zonal: document.getElementById("im-zonal").value.trim(),
      municipio: document.getElementById("im-municipio").value.trim(),
      ambito: document.getElementById("im-ambito").value.trim(),
      lider: document.getElementById("im-lider").value.trim(),
      camasHabilitadas: {
        UCI: { Adulto: n("cam-uci-adulto"), Pediatrico: n("cam-uci-pediatrico"), Neonato: n("cam-uci-neonato") },
        Intermedio: { Adulto: n("cam-int-adulto"), Pediatrico: n("cam-int-pediatrico"), Neonato: n("cam-int-neonato") },
        Hospitalizacion: { General: n("cam-hosp") },
        Observacion: { General: n("cam-obs") },
      },
    };
    const msg = document.getElementById("ips-modal-msg");
    try {
      if (esNueva) {
        body.cod = document.getElementById("im-cod").value.trim();
        if (!body.cod) { msg.innerHTML = `<div class="error-msg">El código es obligatorio.</div>`; return; }
        await api("/admin/ips", { method: "POST", body });
      } else {
        await api(`/admin/ips/${encodeURIComponent(ips.cod)}`, { method: "PUT", body });
      }
      backdrop.remove();
      renderAdminIps(main);
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

// ================= MANUAL DE USO =================
const MANUAL_TABS = [
  { key: "modulos", label: "Módulos" },
  { key: "campos", label: "Campos" },
  { key: "registro", label: "Cómo registrar" },
  { key: "perfiles", label: "Perfiles" },
];

const MANUAL_CONTENT = {
  modulos: `
    <div style="margin-bottom:14px;"><p style="font-weight:600;color:var(--gris-800);margin:0 0 4px;">Registro de Ocupación</p>
    <p style="margin:0;">Aquí el auditor digita el censo diario: selecciona Regional, luego la IPS, y el sistema completa automáticamente Zonal, Ámbito y Líder. Después elige el Tipo de estancia y, si aplica, la Población. Finalmente ingresa cuántas camas ocupa la IPS y cuántas corresponden a pacientes Famisanar.</p></div>
    <div style="margin-bottom:14px;"><p style="font-weight:600;color:var(--gris-800);margin:0 0 4px;">Tabla de Ocupación</p>
    <p style="margin:0;">Lista todos los registros guardados, con filtros por fecha, regional, tipo de estancia y búsqueda por IPS. Desde aquí se pueden editar o eliminar registros (según el perfil) y descargar el reporte en CSV.</p></div>
    <div style="margin-bottom:14px;"><p style="font-weight:600;color:var(--gris-800);margin:0 0 4px;">Dashboard</p>
    <p style="margin:0;">Resume la información en tarjetas: cuántas camas habilitadas/ocupadas/disponibles hay, el % de ocupación de la IPS y de Famisanar, y el detalle por tipo de estancia y regional para el día consultado.</p></div>
    <div><p style="font-weight:600;color:var(--gris-800);margin:0 0 4px;">Administración</p>
    <p style="margin:0;">Permite gestionar usuarios (restablecer contraseñas, activar/desactivar) y actualizar la base maestra de IPS, ya sea subiendo los Excel oficiales o editando una IPS manualmente. Solo visible para Coordinador/Supervisor y Administrador.</p></div>
  `,
  campos: `
    <p><b>Regional / Zonal / Municipio:</b> división geográfica y administrativa de las IPS dentro de la red Famisanar.</p>
    <p><b>Ámbito:</b> clasificación de la IPS según su tipo de atención (Hospitalización, Urgencias, Crónico o Salud Mental). Viene precargado desde la base maestra de IPS.</p>
    <p><b>Líder:</b> persona de Famisanar responsable de la gestión en salud de esa IPS. Se asigna automáticamente según la IPS.</p>
    <p><b>Tipo de estancia:</b> UCI, Intermedio, Hospitalización u Observación.</p>
    <p><b>Población:</b> solo aplica a UCI e Intermedio: Adulto, Pediátrico o Neonato.</p>
    <p><b>Camas habilitadas:</b> capacidad instalada de la IPS para ese tipo de estancia y población.</p>
    <p><b>Ocupación IPS:</b> total de camas ocupadas en la IPS para ese tipo de estancia, sin importar la EPS del paciente. Puede ser igual o mayor a las camas habilitadas (sobreocupación).</p>
    <p><b>Ocupación Famisanar:</b> de esas camas ocupadas, cuántas corresponden a pacientes afiliados a Famisanar. Nunca puede ser mayor a la Ocupación IPS.</p>
    <p><b>Camas disponibles:</b> camas habilitadas menos la ocupación de la IPS. Nunca se muestra en negativo: si hay sobreocupación, queda en 0.</p>
  `,
  registro: `
    <ol style="padding-left:18px;margin:0;">
      <li style="margin-bottom:6px;">Selecciona la Regional.</li>
      <li style="margin-bottom:6px;">Opcionalmente filtra por Zonal o Municipio para encontrar la IPS más rápido.</li>
      <li style="margin-bottom:6px;">Busca y selecciona la IPS. Zonal, Ámbito y Líder se completan solos.</li>
      <li style="margin-bottom:6px;">Un panel muestra el progreso de esa IPS para el día: qué tipos de estancia y población ya se registraron y cuáles faltan.</li>
      <li style="margin-bottom:6px;">Elige el Tipo de estancia y, si aplica, la Población.</li>
      <li style="margin-bottom:6px;">Ingresa las camas habilitadas, la Ocupación IPS y la Ocupación Famisanar. El sistema calcula las camas disponibles.</li>
      <li style="margin-bottom:6px;">Guarda. Si intentas registrar la misma IPS, tipo de estancia y población dos veces el mismo día, el sistema lo bloquea.</li>
    </ol>
  `,
  perfiles: `
    <p><b>1. Consulta:</b> puede visualizar información, pero no modificarla ni descargar reportes.</p>
    <p><b>2. Consulta y Reportes:</b> puede consultar información y descargar el CSV de la Tabla.</p>
    <p><b>3. Digitador / Auditor:</b> puede registrar información y editar sus propios registros.</p>
    <p><b>4. Coordinador / Supervisor:</b> puede ver y editar todos los registros, y actualizar la base de IPS.</p>
    <p><b>5. Administrador:</b> control total — incluye eliminar registros y administrar usuarios.</p>
  `,
};

function abrirManual() {
  let tabActiva = "modulos";
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="max-width:640px;max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;">Manual de uso — Censo Ocupación de Camas</h3>
        <button class="icon-btn" id="manual-cerrar">✕</button>
      </div>
      <div id="manual-tabs" style="display:flex;gap:4px;border-bottom:1px solid var(--gris-200);margin-bottom:14px;overflow-x:auto;"></div>
      <div id="manual-body" style="overflow-y:auto;font-size:13px;color:var(--gris-600);line-height:1.6;"></div>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.getElementById("manual-cerrar").addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });

  function pintarManual() {
    const tabsBox = document.getElementById("manual-tabs");
    tabsBox.innerHTML = MANUAL_TABS.map(t => `
      <button class="btn ${tabActiva === t.key ? "btn-primary" : "btn-outline"}" data-tab="${t.key}" style="font-size:12px;padding:7px 12px;white-space:nowrap;">${t.label}</button>
    `).join("");
    tabsBox.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => { tabActiva = btn.dataset.tab; pintarManual(); });
    });
    document.getElementById("manual-body").innerHTML = MANUAL_CONTENT[tabActiva];
  }
  pintarManual();
}
