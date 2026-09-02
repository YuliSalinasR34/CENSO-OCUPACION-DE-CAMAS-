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

function logout(motivo) {
  state.token = null;
  state.usuario = null;
  state.permisos = null;
  localStorage.removeItem("censo_token");
  localStorage.removeItem("censo_usuario");
  render();
  if (motivo === "inactividad") {
    setTimeout(() => {
      const errBox = document.getElementById("login-error");
      if (errBox) errBox.innerHTML = `<div class="error-msg">Tu sesión se cerró automáticamente por inactividad (10 minutos). Ingresa de nuevo.</div>`;
    }, 50);
  }
}

// ---------------- Cierre de sesión automático por inactividad (10 minutos) ----------------
const TIEMPO_INACTIVIDAD_MS = 10 * 60 * 1000;
let temporizadorInactividad = null;
function reiniciarTemporizadorInactividad() {
  if (!state.token) return;
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  temporizadorInactividad = setTimeout(() => {
    if (state.token) logout("inactividad");
  }, TIEMPO_INACTIVIDAD_MS);
}
["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(evento => {
  document.addEventListener(evento, reiniciarTemporizadorInactividad, { passive: true });
});

// ---------------- Render root ----------------
async function render() {
  if (!state.token) { renderLogin(); return; }
  if (!state.permisos) {
    try { state.permisos = await api("/auth/permisos"); }
    catch (e) { logout(); return; }
  }
  reiniciarTemporizadorInactividad();
  renderShell();
}
render();

// ================= LOGIN =================
function renderLogin() {
  const usuarioGuardado = localStorage.getItem("censo_usuario_recordado") || "";

  el.innerHTML = `
    <div class="login-screen">
      <svg class="login-bg-icon" style="top:40px;left:60px;width:90px;" viewBox="0 0 100 100" fill="none">
        <path d="M20 20 v20 a15 15 0 0 0 30 0 v-15" stroke="white" stroke-width="3" stroke-linecap="round" fill="none"/>
        <circle cx="50" cy="20" r="6" stroke="white" stroke-width="3" fill="none"/>
      </svg>
      <svg class="login-bg-icon" style="top:60px;right:70px;width:100px;" viewBox="0 0 120 80" fill="none">
        <rect x="10" y="30" width="100" height="35" rx="4" stroke="white" stroke-width="3" fill="none"/>
        <rect x="10" y="15" width="35" height="20" rx="3" stroke="white" stroke-width="3" fill="none"/>
        <line x1="10" y1="65" x2="10" y2="75" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <line x1="110" y1="65" x2="110" y2="75" stroke="white" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <svg class="login-bg-icon" style="bottom:70px;left:90px;width:70px;" viewBox="0 0 60 80" fill="none">
        <rect x="6" y="6" width="48" height="68" rx="5" stroke="white" stroke-width="3" fill="none"/>
        <rect x="20" y="2" width="20" height="10" rx="2" fill="white"/>
        <path d="M20 40 L27 47 L40 32" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
      <svg class="login-bg-icon" style="bottom:60px;right:90px;width:100px;" viewBox="0 0 120 50" fill="none">
        <polyline points="0,25 25,25 32,8 42,42 50,25 120,25" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg class="login-bg-line" viewBox="0 0 1000 60" preserveAspectRatio="none">
        <polyline points="0,30 280,30 320,8 360,52 400,30 1000,30" stroke="white" stroke-width="2" fill="none"/>
      </svg>

      <div class="login-header">
        <div class="login-logo">Famisanar</div>
        <h1>Censo Ocupación de Camas</h1>
        <p class="subtitle">Auditoría Concurrente en las IPS · Famisanar</p>
      </div>
      <div class="login-card">
        <div id="login-error"></div>
        <form id="login-form">
          <div class="field">
            <label>Usuario</label>
            <input type="text" id="login-usuario" autocomplete="username" value="${usuarioGuardado}" required />
          </div>
          <div class="field">
            <label>Contraseña</label>
            <div style="position:relative;">
              <input type="password" id="login-password" autocomplete="current-password" required style="padding-right:38px;" />
              <button type="button" id="toggle-password" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:var(--gris-600);">👁</button>
            </div>
          </div>
          <div class="field" style="display:flex;align-items:center;gap:7px;">
            <input type="checkbox" id="login-recordar" ${usuarioGuardado ? "checked" : ""} style="width:auto;" />
            <label for="login-recordar" style="margin:0;font-weight:400;font-size:12px;">Recordar mi usuario en este dispositivo</label>
          </div>
          <button class="btn btn-primary" type="submit">Iniciar sesión</button>
        </form>
        <p class="login-helper">Usa tu usuario corporativo. Si es tu primer ingreso, se te pedirá crear una contraseña nueva.</p>
      </div>
    </div>
  `;

  document.getElementById("toggle-password").addEventListener("click", () => {
    const inp = document.getElementById("login-password");
    inp.type = inp.type === "password" ? "text" : "password";
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("login-usuario").value.trim();
    const password = document.getElementById("login-password").value;
    const recordar = document.getElementById("login-recordar").checked;
    const errBox = document.getElementById("login-error");
    errBox.innerHTML = "";
    try {
      const data = await api("/auth/login", { method: "POST", body: { usuario, password } });
      state.token = data.token;
      state.usuario = data.usuario;
      localStorage.setItem("censo_token", state.token);
      localStorage.setItem("censo_usuario", JSON.stringify(state.usuario));
      if (recordar) {
        localStorage.setItem("censo_usuario_recordado", usuario);
      } else {
        localStorage.removeItem("censo_usuario_recordado");
      }
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
  const hoyIso = new Date().toISOString().slice(0, 10);
  let fecha = hoyIso;
  let registradosHoy = [];
  const esAdmin = state.usuario.perfil === "5. Administrador";

  const regionales = [...new Set(ipsList.map(i => i.regional).filter(Boolean))].sort();
  const horaActual = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  main.innerHTML = `
    <h2>Registro de Ocupación</h2>
    <p class="desc">Registra la ocupación diaria de camas por IPS y tipo de estancia.</p>
    ${esAdmin ? `
    <div class="card" id="card-historico">
      <h3>📅 Cargar histórico completo (meses anteriores)</h3>
      <p class="desc" style="margin-bottom:14px;">
        Solo Administrador. Sube el Excel amplio con una fila por IPS por día (formato "OCUPACION_CAMAS_POR_REGIONAL"),
        y el sistema genera automáticamente todos los registros de censo y de pacientes por referencia para cada fecha
        que traiga el archivo. Se puede repetir sin duplicar nada. Para archivos grandes, el sistema los divide en partes
        automáticamente y los sube por partes, así no se corta por límite de tiempo del servidor.
      </p>
      <input type="file" id="file-historico" accept=".xlsx" />
      <button class="btn btn-primary" id="btn-importar-historico" style="margin-top:8px;">Importar histórico completo</button>
      <div id="historico-progreso" style="margin-top:12px;"></div>
    </div>
    ` : ""}
    <div id="reg-msg"></div>
    <div class="card">
      <div class="grid-3">
        <div class="field">
          <label>Fecha ${esAdmin ? "" : "y hora"}</label>
          ${esAdmin
            ? `<input type="date" id="reg-fecha" value="${fecha}" /><div class="desc" style="margin-top:4px;font-size:11px;">Como Administrador puedes registrar fechas pasadas (carga retroactiva).</div>`
            : `<div style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">${fecha} · ${horaActual}</div><div class="desc" style="margin-top:4px;font-size:11px;">Se registra automáticamente con la fecha y hora de hoy.</div>`
          }
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
    <div class="card" id="reg-referencia-card" style="display:none;"></div>
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

  if (esAdmin) {
    document.getElementById("reg-fecha").addEventListener("change", (e) => { fecha = e.target.value; cargarChecklist(); });
    document.getElementById("btn-importar-historico").addEventListener("click", importarHistoricoPorMes);
  }
  selIps.addEventListener("change", (e) => {
    ipsSeleccionada = ipsList.find(i => i.cod === e.target.value) || null;
    cargarChecklist();
  });

  async function cargarChecklist() {
    const checklistBox = document.getElementById("reg-checklist");
    const formCard = document.getElementById("reg-form-card");
    if (!ipsSeleccionada) { checklistBox.innerHTML = ""; formCard.style.display = "none"; return; }

    registradosHoy = await api(`/censos?fechaInicio=${fecha}&fechaFin=${fecha}&ipsCod=${ipsSeleccionada.cod}`);

    const cama = ipsSeleccionada.camas_habilitadas || {};
    const habilitadasDe = (tipo, poblacion) => {
      const grupo = cama[tipo] || {};
      if (tipo === "Hospitalizacion" || tipo === "Observacion") return Number(grupo.General || 0);
      return Number(grupo[poblacion] || 0);
    };

    const pendientes = [];
    TIPOS_ESTANCIA.forEach(t => {
      if (t.poblaciones) {
        POBLACIONES.forEach(p => {
          if (habilitadasDe(t.key, p) <= 0) return; // solo lo que la IPS realmente tiene habilitado
          const hecho = registradosHoy.some(r => r.tipo_estancia === t.key && r.poblacion === p);
          pendientes.push({ key: t.key, label: `${t.label} · ${p}`, poblacion: p, hecho });
        });
      } else {
        if (habilitadasDe(t.key, null) <= 0) return;
        const hecho = registradosHoy.some(r => r.tipo_estancia === t.key);
        pendientes.push({ key: t.key, label: t.label, poblacion: null, hecho });
      }
    });

    if (pendientes.length === 0) {
      checklistBox.innerHTML = `<div class="empty-state">Esta IPS no tiene camas habilitadas registradas en la base maestra.</div>`;
      formCard.style.display = "none";
      document.getElementById("reg-referencia-card").style.display = "none";
      return;
    }

    checklistBox.innerHTML = `
      <div class="checklist">
        ${pendientes.map(p => `<span class="chip ${p.hecho ? "done" : "pending"}">${p.hecho ? "✓ " : ""}${p.label}</span>`).join("")}
      </div>
    `;

    formCard.style.display = "block";
    renderFormularioCenso(formCard, ipsSeleccionada, fecha, pendientes, cargarChecklist);

    const refCard = document.getElementById("reg-referencia-card");
    refCard.style.display = "block";
    const referenciaExistente = await api(`/referencias?fecha=${fecha}&ipsCod=${ipsSeleccionada.cod}`);
    renderFormularioReferencia(refCard, ipsSeleccionada, fecha, referenciaExistente);
  }
}

function renderFormularioReferencia(card, ips, fecha, referencia) {
  card.innerHTML = `
    <h3>Pacientes por referencia — ${ips.nombre}</h3>
    <p class="desc" style="margin-top:-8px;margin-bottom:14px;">No es obligatorio diligenciarlo, pero queda visible para quien lo necesite.</p>
    <div id="ref-msg"></div>
    <div class="grid-3">
      <div class="field">
        <label>Pacientes presentados por referencia</label>
        <input type="number" min="0" id="ref-presentados" value="${referencia ? referencia.pacientes_presentados : ""}" />
      </div>
      <div class="field">
        <label>Pacientes aceptados IPS</label>
        <input type="number" min="0" id="ref-aceptados" value="${referencia ? referencia.pacientes_aceptados : ""}" />
      </div>
      <div class="field">
        <label>% Aceptación</label>
        <div id="ref-pct-display" style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:16px;font-weight:700;color:var(--azul-oscuro);">${referencia ? referencia.pct_aceptacion : "0"}%</div>
      </div>
    </div>
    <div class="field">
      <label>Observaciones</label>
      <textarea id="ref-observaciones" rows="2" style="width:100%;padding:10px 12px;border:1px solid var(--gris-200);border-radius:8px;font-size:14px;font-family:inherit;">${referencia && referencia.observaciones ? referencia.observaciones : ""}</textarea>
    </div>
    <button class="btn btn-secondary" id="btn-guardar-referencia">Guardar referencia</button>
  `;

  const presentadosInput = document.getElementById("ref-presentados");
  const aceptadosInput = document.getElementById("ref-aceptados");
  const pctDisplay = document.getElementById("ref-pct-display");

  function recalcularPct() {
    const presentados = Number(presentadosInput.value || 0);
    const aceptados = Number(aceptadosInput.value || 0);
    const pct = presentados > 0 ? ((aceptados / presentados) * 100).toFixed(1) : "0.0";
    pctDisplay.textContent = pct + "%";
  }
  presentadosInput.addEventListener("input", recalcularPct);
  aceptadosInput.addEventListener("input", recalcularPct);

  document.getElementById("btn-guardar-referencia").addEventListener("click", async () => {
    const msg = document.getElementById("ref-msg");
    const body = {
      fecha, ipsCod: ips.cod,
      pacientesPresentados: Number(presentadosInput.value || 0),
      pacientesAceptados: Number(aceptadosInput.value || 0),
      observaciones: document.getElementById("ref-observaciones").value,
    };
    try {
      await api("/referencias", { method: "POST", body });
      msg.innerHTML = `<div class="ok-msg">Referencia guardada correctamente.</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

function renderFormularioCenso(card, ips, fecha, pendientes, onGuardado) {
  const tiposDisponibles = [...new Set(pendientes.map(p => p.key))];
  const poblacionesPorTipo = {};
  pendientes.forEach(p => {
    if (!poblacionesPorTipo[p.key]) poblacionesPorTipo[p.key] = [];
    if (p.poblacion) poblacionesPorTipo[p.key].push(p.poblacion);
  });

  card.innerHTML = `
    <h3>Nuevo registro — ${ips.nombre}</h3>
    <div class="grid-2" style="margin-bottom:14px;">
      <div class="field"><label>Ámbito</label><div style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">${ips.ambito || "—"}</div></div>
      <div class="field"><label>Líder</label><div style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">${ips.lider || "—"}</div></div>
    </div>
    <form id="censo-form">
      <div class="grid-2">
        <div class="field">
          <label>Tipo de estancia</label>
          <select id="c-tipo">
            ${tiposDisponibles.map(key => {
              const t = TIPOS_ESTANCIA.find(x => x.key === key);
              return `<option value="${key}">${t.label}</option>`;
            }).join("")}
          </select>
        </div>
        <div class="field" id="c-poblacion-wrap">
          <label>Población</label>
          <select id="c-poblacion"></select>
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

  function repoblarPoblacion() {
    const tipo = tipoSel.value;
    const pobs = poblacionesPorTipo[tipo] || [];
    if (pobs.length === 0) {
      poblacionWrap.style.display = "none";
    } else {
      poblacionWrap.style.display = "block";
      poblacionSel.innerHTML = pobs.map(p => `<option value="${p}">${p}</option>`).join("");
    }
  }

  function habilitadasActuales() {
    const tipo = tipoSel.value;
    const cama = ips.camas_habilitadas || {};
    const grupo = cama[tipo] || {};
    if (tipo === "Hospitalizacion" || tipo === "Observacion") return Number(grupo.General || 0);
    return Number(grupo[poblacionSel.value] || 0);
  }

  function recalcular() {
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

  tipoSel.addEventListener("change", () => { repoblarPoblacion(); recalcular(); });
  poblacionSel.addEventListener("change", recalcular);
  ocupIpsInput.addEventListener("input", recalcular);
  ocupFamiInput.addEventListener("input", recalcular);
  repoblarPoblacion();
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
      msg.innerHTML = `<div class="ok-msg">Registro guardado correctamente. Sigue con el resto de tipos de estancia — la IPS queda seleccionada.</div>`;
      if (onGuardado) onGuardado(); // refresca el checklist y el formulario, sin perder la IPS seleccionada
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
        <button class="btn btn-outline" id="btn-csv">⬇ Descargar Excel</button>
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

  document.getElementById("btn-csv").addEventListener("click", () => descargarExcel(rows));

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

function descargarExcel(rows) {
  const datos = rows.map(r => ({
    "Fecha": r.fecha,
    "IPS": r.ips_nombre,
    "Regional": r.regional,
    "Ámbito": r.ambito,
    "Tipo estancia": r.tipo_estancia,
    "Población": r.poblacion || "",
    "Camas habilitadas": Number(r.camas_habilitadas),
    "Ocupación IPS": Number(r.ocupacion_ips),
    "Ocupación Famisanar": Number(r.ocupacion_famisanar),
    "Camas disponibles": Number(r.camas_disponibles),
    "Registrado por": r.usuario_nombre,
  }));
  const ws = XLSX.utils.json_to_sheet(datos);
  ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Censo de Ocupación");
  XLSX.writeFile(wb, `censo-ocupacion-camas-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function etiquetaMes(m) { const [y, mm] = m.split("-"); return `${NOMBRES_MES[Number(mm) - 1]} ${y}`; }

async function renderDashboard(main) {
  main.innerHTML = `<div class="spinner">Cargando dashboard…</div>`;
  const ipsList = await ensureIpsList();
  const regionales = [...new Set(ipsList.map(i => i.regional).filter(Boolean))].sort();
  const hoy = new Date().toISOString().slice(0, 10);
  const mesesDisponibles = await api("/dashboard/meses-disponibles").catch(() => []);

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
        ${mesesDisponibles.length > 0 ? `
        <select id="db-mes-rapido">
          <option value="">Ir a un mes con datos…</option>
          ${mesesDisponibles.map(m => `<option value="${m}">${etiquetaMes(m)}</option>`).join("")}
        </select>
        ` : ""}
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

  function refrescarSelects(resetZonal, resetMunicipio) {
    const zonalPrev = resetZonal ? "" : selZonal.value;
    const municipioPrev = resetMunicipio ? "" : selMunicipio.value;
    const ipsPrev = selIps.value;

    const base = ipsList.filter(i => !selRegional.value || i.regional === selRegional.value);
    const zonales = [...new Set(base.map(i => i.zonal).filter(Boolean))].sort();
    const baseM = base.filter(i => !zonalPrev || i.zonal === zonalPrev);
    const municipios = [...new Set(baseM.map(i => i.municipio).filter(Boolean))].sort();
    const baseI = baseM.filter(i => !municipioPrev || i.municipio === municipioPrev);

    selZonal.innerHTML = `<option value="">Todas las zonales</option>` + zonales.map(z => `<option value="${z}" ${z === zonalPrev ? "selected" : ""}>${z}</option>`).join("");
    selMunicipio.innerHTML = `<option value="">Todos los municipios</option>` + municipios.map(m => `<option value="${m}" ${m === municipioPrev ? "selected" : ""}>${m}</option>`).join("");
    selIps.innerHTML = `<option value="">Todas las IPS</option>` + baseI.map(i => `<option value="${i.cod}" ${i.cod === ipsPrev ? "selected" : ""}>${i.nombre}</option>`).join("");
  }
  refrescarSelects(true, true);

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
    const esHoy = filtro.periodo === "dia" && filtro.valor === hoy;
    pintarDashboard(document.getElementById("db-content"), data, esHoy, filtro.periodo);
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
  const selMesRapido = document.getElementById("db-mes-rapido");
  if (selMesRapido) {
    selMesRapido.addEventListener("change", () => {
      if (!selMesRapido.value) return;
      filtro.periodo = "mes";
      document.getElementById("db-fecha").value = selMesRapido.value + "-01";
      ["per-dia", "per-semana", "per-mes"].forEach(i2 => {
        document.getElementById(i2).className = i2 === "per-mes" ? "btn btn-primary" : "btn btn-outline";
        document.getElementById(i2).style.padding = "7px 14px";
      });
      cargar();
    });
  }
  selRegional.addEventListener("change", () => { refrescarSelects(true, true); cargar(); });
  selZonal.addEventListener("change", () => { refrescarSelects(false, true); cargar(); });
  selMunicipio.addEventListener("change", () => { refrescarSelects(false, false); cargar(); });
  selIps.addEventListener("change", cargar);

  cargar();
}

function pintarDashboard(box, data, esHoy, periodo) {
  const k = data.kpis;

  const vbars = (rows) => `
    <div class="legend-row"><span><span class="legend-dot ips"></span>IPS</span><span><span class="legend-dot fami"></span>Famisanar</span></div>
    <div class="chart-vbars">
      ${rows.length === 0 ? `<div class="empty-state">Sin datos.</div>` : rows.map(r => `
        <div class="chart-vbar-group">
          <div class="chart-vbar-pair">
            <div style="display:flex;flex-direction:column;justify-content:flex-end;" title="${r.etiqueta} · IPS: ${r.pctIps}%">
              <div class="chart-vbar-val">${r.pctIps}%</div>
              <div class="chart-vbar ips" style="height:${Math.min(r.pctIps, 100) * 1.5}px;"></div>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:flex-end;" title="${r.etiqueta} · Famisanar: ${r.pctFamisanar}%">
              <div class="chart-vbar-val">${r.pctFamisanar}%</div>
              <div class="chart-vbar fami" style="height:${Math.min(r.pctFamisanar, 100) * 1.5}px;"></div>
            </div>
          </div>
          <div class="chart-vbar-label">${r.etiqueta}</div>
        </div>
      `).join("")}
    </div>
  `;

  // Barras horizontales dobles (IPS + Famisanar) para los rankings top 8.
  const hbarsDoble = (rows) => `
    <div class="legend-row"><span><span class="legend-dot ips"></span>IPS</span><span><span class="legend-dot fami"></span>Famisanar</span></div>
    <div class="chart-hbars">
      ${rows.length === 0 ? `<div class="empty-state">Sin datos.</div>` : rows.map(r => `
        <div>
          <div style="font-size:11px;color:var(--gris-800);font-weight:600;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.etiqueta}">${r.etiqueta}</div>
          <div class="chart-hbar-row" style="margin-bottom:3px;" title="IPS: ${r.pctIps}%">
            <div class="chart-hbar-track"><div class="chart-hbar-fill" style="width:${Math.min(r.pctIps, 100)}%;"></div></div>
            <div class="chart-hbar-pct">${r.pctIps}%</div>
          </div>
          <div class="chart-hbar-row" title="Famisanar: ${r.pctFamisanar}%">
            <div class="chart-hbar-track"><div class="chart-hbar-fill fami" style="width:${Math.min(r.pctFamisanar, 100)}%;"></div></div>
            <div class="chart-hbar-pct">${r.pctFamisanar}%</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  const serieSvg = () => {
    const esMensual = periodo === "mes";
    const serie = esMensual ? data.serieTiempoMensual : data.serieTiempo;
    if (!serie || serie.length === 0) return `<div class="empty-state">Sin datos en el período.</div>`;
    const w = 600, h = 170, pad = 24;
    const maxPct = 100;
    const puntoXY = (campo, idx) => {
      const x = pad + (idx / Math.max(serie.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - (Math.min(serie[idx][campo], maxPct) / maxPct) * (h - pad * 2);
      return [x, y];
    };
    const linea = (campo) => serie.map((s, idx) => puntoXY(campo, idx).join(",")).join(" ");
    const etiquetaEje = (s) => esMensual ? etiquetaMes(s.mes) : s.fecha.slice(5);
    const etiquetaTooltip = (s) => esMensual ? etiquetaMes(s.mes) : s.fecha;
    return `
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:190px;">
        <polyline points="${linea("pctIps")}" fill="none" stroke="#2E9E6D" stroke-width="2.5" />
        <polyline points="${linea("pctFamisanar")}" fill="none" stroke="#0F3460" stroke-width="2.5" />
        ${serie.map((s, idx) => {
          const [xi, yi] = puntoXY("pctIps", idx);
          const [xf, yf] = puntoXY("pctFamisanar", idx);
          return `
            <circle cx="${xi}" cy="${yi}" r="3.5" fill="#2E9E6D"><title>${etiquetaTooltip(s)} · IPS: ${s.pctIps}%</title></circle>
            <circle cx="${xf}" cy="${yf}" r="3.5" fill="#0F3460"><title>${etiquetaTooltip(s)} · Famisanar: ${s.pctFamisanar}%</title></circle>
            <text x="${xi}" y="${h - 4}" font-size="9" fill="#5B6472" text-anchor="middle">${etiquetaEje(s)}</text>
          `;
        }).join("")}
      </svg>
    `;
  };

  // Gráfico circular (dona) de IPS faltantes por regional, en SVG puro.
  const pieColores = ["#0B5FA8", "#2E9E6D", "#C0392B", "#F5A623", "#8E44AD", "#16A2B8"];
  const pieChart = () => {
    const rows = data.faltantesPorRegional.filter(r => r.faltantes > 0);
    const total = rows.reduce((s, r) => s + r.faltantes, 0);
    if (total === 0) return `<div class="empty-state">Todas las IPS ya registraron hoy 🎉</div>`;
    const cx = 90, cy = 90, r = 80;
    let anguloActual = -90;
    const segmentos = rows.map((row, idx) => {
      const porcion = row.faltantes / total;
      const anguloFinal = anguloActual + porcion * 360;
      const x1 = cx + r * Math.cos(anguloActual * Math.PI / 180);
      const y1 = cy + r * Math.sin(anguloActual * Math.PI / 180);
      const x2 = cx + r * Math.cos(anguloFinal * Math.PI / 180);
      const y2 = cy + r * Math.sin(anguloFinal * Math.PI / 180);
      const grandeArco = (anguloFinal - anguloActual) > 180 ? 1 : 0;
      const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${grandeArco} 1 ${x2},${y2} Z`;
      const color = pieColores[idx % pieColores.length];
      anguloActual = anguloFinal;
      const pct = Math.round(porcion * 1000) / 10;
      return `<path d="${path}" fill="${color}"><title>${row.regional}: ${row.faltantes} IPS (${pct}%)</title></path>`;
    }).join("");
    const leyenda = rows.map((row, idx) => `
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:5px;">
        <span style="width:10px;height:10px;border-radius:3px;background:${pieColores[idx % pieColores.length]};display:inline-block;"></span>
        <span style="flex:1;">${row.regional}</span>
        <b>${row.faltantes}</b>
      </div>
    `).join("");
    return `
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
        <svg viewBox="0 0 180 180" style="width:180px;height:180px;flex-shrink:0;">${segmentos}</svg>
        <div style="flex:1;min-width:160px;">${leyenda}</div>
      </div>
    `;
  };

  box.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>Detalle censo IPS</h3>
        <div class="grid-2">
          <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">IPS registradas hoy</div><div class="value" style="font-size:22px;">${k.ipsRegistradasHoy} <span style="font-size:12px;color:var(--gris-600)">/ ${k.totalIpsActivas}</span></div></div>
          <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">IPS faltantes por registrar</div><div class="value" style="font-size:22px;color:var(--rojo);">${k.ipsFaltantesHoy}</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Camas</h3>
        <div class="grid-3">
          <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">Habilitadas</div><div class="value" style="font-size:20px;">${k.habilitadas}</div></div>
          <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">Ocupadas</div><div class="value" style="font-size:20px;">${k.ocupadas}</div></div>
          <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">Disponibles</div><div class="value" style="font-size:20px;">${k.disponibles}</div></div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>% Ocupación de camas</h3>
        <div class="chart-hbar-row" style="margin-bottom:10px;">
          <div class="chart-hbar-label" style="width:90px;">General (IPS)</div>
          <div class="chart-hbar-track" style="height:20px;"><div class="chart-hbar-fill" style="width:${Math.min(k.pctIps, 100)}%;"></div></div>
          <div class="chart-hbar-pct">${k.pctIps}%</div>
        </div>
        <div class="chart-hbar-row">
          <div class="chart-hbar-label" style="width:90px;">Famisanar</div>
          <div class="chart-hbar-track" style="height:20px;"><div class="chart-hbar-fill fami" style="width:${Math.min(k.pctFamisanar, 100)}%;"></div></div>
          <div class="chart-hbar-pct">${k.pctFamisanar}%</div>
        </div>
      </div>
      <div class="card">
        <h3>🔷 Ocupación Famisanar</h3>
        <div class="grid-3">
          <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">Camas ocupadas</div><div class="value verde" style="font-size:20px;">${k.ocupacionFamisanar}</div></div>
          <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">IPS con pacientes</div><div class="value" style="font-size:20px;">${k.ipsConFamisanar}</div></div>
          <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">IPS sin pacientes</div><div class="value" style="font-size:20px;color:var(--gris-600);">${k.ipsSinFamisanar}</div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>📨 Pacientes por referencia</h3>
      <div class="grid-3">
        <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">Presentados</div><div class="value" style="font-size:20px;">${k.referenciasPresentados}</div></div>
        <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">Aceptados IPS</div><div class="value verde" style="font-size:20px;">${k.referenciasAceptados}</div></div>
        <div class="kpi" style="box-shadow:none;padding:10px;"><div class="label">% Aceptación</div><div class="value" style="font-size:20px;">${k.referenciasPct}%</div></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Ocupación por regional — IPS vs Famisanar</h3>
        ${vbars(data.porRegional)}
      </div>
      <div class="card">
        <h3>Ocupación por tipo de estancia — IPS vs Famisanar</h3>
        ${vbars(data.porTipoEstancia)}
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Ocupación por ámbito — IPS vs Famisanar</h3>
        ${vbars(data.porAmbito)}
      </div>
      <div class="card">
        <h3>Comportamiento de ocupación en el período</h3>
        <div class="legend-row"><span><span class="legend-dot ips"></span>IPS</span><span><span class="legend-dot fami"></span>Famisanar</span></div>
        ${serieSvg()}
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>IPS con mayor % de ocupación (top 8)</h3>
        ${hbarsDoble(data.topMayor)}
      </div>
      <div class="card">
        <h3>IPS con menor % de ocupación (top 8)</h3>
        ${hbarsDoble(data.topMenor)}
      </div>
    </div>

    ${esHoy ? `
    <div class="card">
      <h3>📍 IPS faltantes por registrar hoy</h3>
      <p class="desc" style="margin-bottom:12px;">Este dato es siempre del día de hoy y no depende de los filtros de arriba.</p>
      <div class="grid-2">
        <div>
          <h3 style="font-size:13px;">Por regional</h3>
          ${pieChart()}
        </div>
        <div>
          <h3 style="font-size:13px;">Por líder</h3>
          ${data.faltantesPorLider.length === 0 ? `<div class="empty-state">Todas las IPS ya registraron hoy 🎉</div>` : `
          <table>
            <thead><tr><th>Líder</th><th>IPS faltantes</th></tr></thead>
            <tbody>
              ${data.faltantesPorLider.map(f => `<tr><td>${f.lider}</td><td><span class="badge ${f.faltantes > 0 ? "badge-alerta" : "badge-ips"}">${f.faltantes}</span></td></tr>`).join("")}
            </tbody>
          </table>`}
        </div>
      </div>
    </div>
    ` : `
    <div class="card">
      <p class="desc" style="margin:0;">📍 Las tarjetas "IPS faltantes por registrar hoy" (por regional y por líder) solo se muestran cuando el filtro está en "Día" con la fecha de hoy — no aplican para meses o fechas pasadas.</p>
    </div>
    `}
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
      <div class="top-bar">
        <h3 style="margin:0;">Agregar usuarios</h3>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Un usuario nuevo</label>
          <button class="btn btn-secondary" id="btn-nuevo-usuario" style="width:100%;">+ Nuevo usuario manual</button>
        </div>
        <div class="field">
          <label>Carga masiva desde Excel (nombre, cargo, tdoc, doc, email, usuario, perfil)</label>
          <input type="file" id="file-usuarios" accept=".xlsx" />
          <button class="btn btn-primary" id="btn-importar-usuarios" style="margin-top:8px;width:100%;">Importar Excel de usuarios</button>
        </div>
      </div>
    </div>
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

  document.getElementById("btn-nuevo-usuario").addEventListener("click", () => abrirModalUsuario(main));
  document.getElementById("btn-importar-usuarios").addEventListener("click", async () => {
    const input = document.getElementById("file-usuarios");
    const msg = document.getElementById("admin-msg");
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
      const res = await fetch("/api/admin/usuarios/importar", { method: "POST", headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al importar.");
      msg.innerHTML = `<div class="ok-msg">${data.usuariosCreados} usuarios creados/actualizados, ${data.filasOmitidas} filas omitidas.${data.errores.length ? "<br>" + data.errores.join("<br>") : ""}</div>`;
      renderAdministracion(main);
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });

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

function abrirModalUsuario(main) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="max-width:460px;">
      <h3>Nuevo usuario</h3>
      <div id="um-msg"></div>
      <div class="field"><label>Nombre completo</label><input type="text" id="um-nombre" /></div>
      <div class="field"><label>Cargo</label><input type="text" id="um-cargo" /></div>
      <div class="grid-2">
        <div class="field"><label>Tipo documento</label>
          <select id="um-tdoc"><option value="CC">CC</option><option value="CE">CE</option><option value="TI">TI</option></select>
        </div>
        <div class="field"><label>Número documento</label><input type="text" id="um-doc" /></div>
      </div>
      <div class="field"><label>Correo</label><input type="email" id="um-email" /></div>
      <div class="field"><label>Usuario (para iniciar sesión)</label><input type="text" id="um-usuario" placeholder="ej: jperez" /></div>
      <div class="field"><label>Perfil</label>
        <select id="um-perfil">
          <option value="1. Consulta">1. Consulta</option>
          <option value="2. Consulta y Reportes">2. Consulta y Reportes</option>
          <option value="3. Digitador / Auditor">3. Digitador / Auditor</option>
          <option value="4. Coordinador / Supervisor">4. Coordinador / Supervisor</option>
          <option value="5. Administrador">5. Administrador</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="um-cancel">Cancelar</button>
        <button class="btn btn-primary" id="um-save">Crear usuario</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.getElementById("um-cancel").addEventListener("click", () => backdrop.remove());
  document.getElementById("um-save").addEventListener("click", async () => {
    const body = {
      nombre: document.getElementById("um-nombre").value.trim(),
      cargo: document.getElementById("um-cargo").value.trim(),
      tdoc: document.getElementById("um-tdoc").value,
      doc: document.getElementById("um-doc").value.trim(),
      email: document.getElementById("um-email").value.trim(),
      usuario: document.getElementById("um-usuario").value.trim(),
      perfil: document.getElementById("um-perfil").value,
    };
    const msg = document.getElementById("um-msg");
    if (!body.nombre || !body.doc || !body.usuario) {
      msg.innerHTML = `<div class="error-msg">Nombre, documento y usuario son obligatorios.</div>`;
      return;
    }
    try {
      const r = await api("/admin/usuarios", { method: "POST", body });
      msg.innerHTML = `<div class="ok-msg">Usuario creado. Contraseña inicial: <b>${r.passwordInicial}</b></div>`;
      setTimeout(() => { backdrop.remove(); renderAdministracion(main); }, 1800);
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
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
      ${esNueva ? `
      <div class="grid-2">
        <div class="field"><label>Regional</label><input type="text" id="im-regional" value="" /></div>
        <div class="field"><label>Zonal</label><input type="text" id="im-zonal" value="" /></div>
      </div>
      ` : `
      <div class="grid-2">
        <div class="field"><label>Regional</label><div style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">${ips.regional || "—"}</div></div>
        <div class="field"><label>Zonal</label><div style="padding:10px 12px;background:var(--gris-100);border-radius:8px;font-size:14px;">${ips.zonal || "—"}</div></div>
      </div>
      <p class="desc" style="margin:-4px 0 10px;">Regional y Zonal solo se actualizan subiendo el Excel de camas habilitadas (trae esos datos oficiales).</p>
      `}
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
    const elRegional = document.getElementById("im-regional");
    const elZonal = document.getElementById("im-zonal");
    const body = {
      nombre: document.getElementById("im-nombre").value.trim(),
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
        body.regional = elRegional.value.trim();
        body.zonal = elZonal.value.trim();
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
const MANUAL_MODULOS = [
  { key: "registro", icon: "📝", titulo: "Registro de Ocupación", requiere: "puedeEscribir",
    texto: "Aquí digitas el censo diario: selecciona Regional, luego la IPS, y el sistema completa automáticamente Zonal, Ámbito y Líder. Después elige el Tipo de estancia y, si aplica, la Población. Las camas habilitadas se muestran automáticas (vienen de la base maestra) — solo ingresas la Ocupación IPS y la Ocupación Famisanar." },
  { key: "dashboard", icon: "📊", titulo: "Dashboard", requiere: null,
    texto: "Resume la información en tarjetas y gráficas: cuántas IPS han registrado, camas habilitadas/ocupadas/disponibles, % de ocupación de la IPS y de Famisanar, comparativos por regional, tipo de estancia y ámbito, y ranking de IPS con mayor/menor ocupación. Todo se puede filtrar por Día, Semana o Mes, y por regional/zonal/municipio/IPS." },
  { key: "tabla", icon: "📋", titulo: "Tabla de Ocupación", requiere: null,
    texto: "Lista todos los registros guardados, con filtros por fecha, regional, ámbito, tipo de estancia y búsqueda por IPS o usuario. Desde aquí se pueden editar o eliminar registros (según tu perfil) y descargar el reporte en Excel." },
  { key: "administracion", icon: "⚙️", titulo: "Administración", requiere: "puedeAdministrarUsuarios",
    texto: "Permite gestionar usuarios (crear, restablecer contraseñas, activar/desactivar, carga masiva por Excel) y actualizar la base maestra de IPS subiendo el Excel oficial de camas habilitadas." },
];

const MANUAL_CAMPOS = `
    <p><b>Regional / Zonal / Municipio:</b> división geográfica y administrativa de las IPS dentro de la red Famisanar.</p>
    <p><b>Ámbito:</b> clasificación de la IPS según su tipo de atención (Hospitalización, Urgencias, Crónico o Salud Mental). Viene precargado desde la base maestra de IPS.</p>
    <p><b>Líder:</b> persona de Famisanar responsable de la gestión en salud de esa IPS. Se asigna automáticamente según la IPS.</p>
    <p><b>Tipo de estancia:</b> UCI, Intermedio, Hospitalización u Observación.</p>
    <p><b>Población:</b> solo aplica a UCI e Intermedio: Adulto, Pediátrico o Neonato.</p>
    <p><b>Camas habilitadas:</b> capacidad instalada de la IPS para ese tipo de estancia y población. Se toma automáticamente de la base maestra, no se escribe a mano.</p>
    <p><b>Ocupación IPS:</b> total de camas ocupadas en la IPS para ese tipo de estancia, sin importar la EPS del paciente. Puede ser igual o mayor a las camas habilitadas (sobreocupación).</p>
    <p><b>Ocupación Famisanar:</b> de esas camas ocupadas, cuántas corresponden a pacientes afiliados a Famisanar. Nunca puede ser mayor a la Ocupación IPS.</p>
    <p><b>Camas disponibles:</b> camas habilitadas menos la ocupación de la IPS. Nunca se muestra en negativo.</p>
`;

const DESCRIPCION_PERFIL = {
  "1. Consulta": "Puedes visualizar toda la información (Tabla y Dashboard), pero no puedes registrar, editar, eliminar, ni descargar reportes.",
  "2. Consulta y Reportes": "Puedes consultar toda la información y descargar el Excel de la Tabla de Ocupación. No puedes registrar ni editar.",
  "3. Digitador / Auditor": "Puedes registrar la ocupación diaria y editar únicamente tus propios registros. En la Tabla solo ves lo que tú mismo registraste.",
  "4. Coordinador / Supervisor": "Puedes registrar y editar todos los registros de la red (no solo los tuyos), y actualizar la base maestra de IPS subiendo el Excel oficial.",
  "5. Administrador": "Tienes control total: registrar, editar y eliminar cualquier registro, administrar usuarios (crear, resetear claves, carga masiva), y actualizar la base de IPS. Eres el único perfil que puede registrar fechas retroactivas (carga histórica).",
};

function abrirManual() {
  const modulosVisibles = MANUAL_MODULOS.filter(m => !m.requiere || state.permisos[m.requiere]);
  const tabs = [
    ...modulosVisibles.map(m => ({ key: m.key, label: m.icon + " " + m.titulo })),
    { key: "campos", label: "📖 Campos" },
    { key: "miperfil", label: "👤 Mi perfil" },
  ];
  let tabActiva = tabs[0].key;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" style="max-width:640px;max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <h3 style="margin:0;">📘 Manual de uso</h3>
        <button class="icon-btn" id="manual-cerrar">✕</button>
      </div>
      <p class="desc" style="margin:0 0 14px;">Solo se muestra lo que aplica a tu perfil: <b>${state.usuario.perfil}</b></p>
      <div id="manual-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="manual-body" style="overflow-y:auto;font-size:13px;color:var(--gris-600);line-height:1.7;"></div>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.getElementById("manual-cerrar").addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });

  function contenidoPara(key) {
    if (key === "campos") return MANUAL_CAMPOS;
    if (key === "miperfil") return `<p style="font-size:15px;font-weight:700;color:var(--azul-oscuro);margin-bottom:10px;">${state.usuario.perfil}</p><p>${DESCRIPCION_PERFIL[state.usuario.perfil] || ""}</p>`;
    const m = MANUAL_MODULOS.find(x => x.key === key);
    return `<p style="font-size:15px;font-weight:700;color:var(--azul-oscuro);margin-bottom:10px;">${m.icon} ${m.titulo}</p><p>${m.texto}</p>`;
  }

  function pintarManual() {
    const tabsBox = document.getElementById("manual-tabs");
    tabsBox.innerHTML = tabs.map(t => `
      <button class="btn ${tabActiva === t.key ? "btn-primary" : "btn-outline"}" data-tab="${t.key}" style="font-size:12px;padding:8px 14px;white-space:nowrap;">${t.label}</button>
    `).join("");
    tabsBox.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => { tabActiva = btn.dataset.tab; pintarManual(); });
    });
    document.getElementById("manual-body").innerHTML = contenidoPara(tabActiva);
  }
  pintarManual();
}

// ================= CARGA HISTÓRICA MASIVA (dividida por mes en el navegador) =================
// El archivo puede traer varios meses de datos (ej: enero a agosto). Para que no se corte por
// el límite de tiempo del servidor gratuito, lo partimos por mes AQUÍ, en el navegador, usando
// la columna "fecha de diligenciamineto", y subimos un archivo pequeño por cada mes, uno detrás
// del otro. Así cada solicitud es rápida aunque el archivo original sea enorme.
async function despertarServidor(progreso) {
  progreso.innerHTML = `<div class="ok-msg">Despertando el servidor… (puede tardar hasta 1 minuto si estaba inactivo)</div>`;
  for (let intento = 0; intento < 20; intento++) {
    try {
      const headers = {};
      if (state.token) headers.Authorization = "Bearer " + state.token;
      const res = await fetch("/api/ips", { headers });
      if (res.ok) return true;
    } catch (e) { /* sigue intentando */ }
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}

async function subirLoteConReintentos(header, filasLote, etiqueta, progreso, intentosMax = 3) {
  for (let intento = 1; intento <= intentosMax; intento++) {
    try {
      const wsLote = XLSX.utils.aoa_to_sheet([header, ...filasLote]);
      const wbLote = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wbLote, wsLote, "ocupacion");
      const arrayBuf = XLSX.write(wbLote, { type: "array", bookType: "xlsx" });
      const blob = new Blob([arrayBuf], { type: "application/octet-stream" });

      const formData = new FormData();
      formData.append("file", blob, `historico-parte.xlsx`);

      const headers = {};
      if (state.token) headers.Authorization = "Bearer " + state.token;
      const res = await fetch("/api/admin/importar-historico", { method: "POST", headers, body: formData });

      const textoBruto = await res.text();
      let data;
      try { data = JSON.parse(textoBruto); }
      catch (e) {
        throw new Error(`Respuesta no válida del servidor (HTTP ${res.status}): ${textoBruto.slice(0, 150)}`);
      }
      if (!res.ok) throw new Error(data.error || "error desconocido");
      return data;
    } catch (err) {
      if (intento === intentosMax) throw new Error(`${etiqueta}: ${err.message} (falló tras ${intentosMax} intentos)`);
      progreso.innerHTML = `<div class="ok-msg">${etiqueta}: intento ${intento} falló (${err.message}). Reintentando…</div>`;
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

async function importarHistoricoPorMes() {
  const input = document.getElementById("file-historico");
  const btn = document.getElementById("btn-importar-historico");
  const progreso = document.getElementById("historico-progreso");
  if (!input.files || input.files.length === 0) {
    progreso.innerHTML = `<div class="error-msg">Selecciona un archivo .xlsx primero.</div>`;
    return;
  }

  btn.disabled = true;

  try {
    const despierto = await despertarServidor(progreso);
    if (!despierto) throw new Error("El servidor no respondió tras esperar 1 minuto. Intenta de nuevo en unos minutos.");

    progreso.innerHTML = `<div class="ok-msg">Leyendo el archivo…</div>`;
    const buffer = await input.files[0].arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    const header = filas[0];
    const datos = filas.slice(1);

    // Trozos livianos por cantidad de filas — simple y rápido.
    const TAMANO_LOTE = 300;
    const lotes = [];
    for (let i = 0; i < datos.length; i += TAMANO_LOTE) {
      lotes.push(datos.slice(i, i + TAMANO_LOTE));
    }

    let totales = { ipsAseguradas: 0, censosInsertados: 0, referenciasInsertadas: 0, filasOmitidas: 0 };
    for (let i = 0; i < lotes.length; i++) {
      const etiqueta = `Parte ${i + 1} de ${lotes.length}`;
      progreso.innerHTML = `<div class="ok-msg">${etiqueta}… no cierres esta pantalla.</div>`;
      const data = await subirLoteConReintentos(header, lotes[i], etiqueta, progreso);
      totales.ipsAseguradas = Math.max(totales.ipsAseguradas, data.ipsAseguradas);
      totales.censosInsertados += data.censosInsertados;
      totales.referenciasInsertadas += data.referenciasInsertadas;
      totales.filasOmitidas += data.filasOmitidas;
    }

    progreso.innerHTML = `<div class="ok-msg">✅ Carga histórica completa: ${lotes.length} partes procesadas. ${totales.censosInsertados} registros de censo, ${totales.referenciasInsertadas} registros de referencias, ${totales.filasOmitidas} filas omitidas.</div>`;
  } catch (err) {
    progreso.innerHTML = `<div class="error-msg">${err.message}<br><br>Puedes darle a "Importar histórico completo" de nuevo — no duplica nada, solo actualiza lo que falte.</div>`;
  } finally {
    btn.disabled = false;
  }
}
