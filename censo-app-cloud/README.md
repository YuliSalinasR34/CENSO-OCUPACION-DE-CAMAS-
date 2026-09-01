# Censo Ocupación de Camas · Famisanar

Versión lista para hospedar en la nube, **100% gratis y sin tarjeta**:
- La base de datos vive en **Neon** (PostgreSQL gratuito, permanente).
- La aplicación vive en **Render** (hosting gratuito).
- El código se sube a través de **GitHub** (gratis, solo necesitas un correo).

No necesitas instalar Docker, ni tocar virtualización, ni depender de que tu
computador esté siempre encendido.

Trae precargadas **288 IPS reales** (con ámbito y líder) y **127 usuarios reales**.

---

## Paso 1 — Crear la base de datos en Neon (5 minutos)

1. Ve a **https://neon.tech** y crea una cuenta gratis (con tu correo de Famisanar o el que prefieras — no pide tarjeta).
2. Crea un proyecto nuevo. Ponle de nombre, por ejemplo, `censo-camas`.
3. Cuando termine de crearse, busca el botón **"Connection string"** (cadena de conexión). Cópiala completa — se ve algo así:
   ```
   postgresql://usuario:contraseña@ep-algo-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Guarda esa cadena en un lugar seguro (un Notepad, por ejemplo). La vamos a necesitar en el Paso 3.

---

## Paso 2 — Subir el código a GitHub (10 minutos, sin instalar nada)

1. Ve a **https://github.com** y crea una cuenta gratis (solo pide correo, usuario y contraseña — sin tarjeta).
2. Una vez dentro, haz clic en el botón verde **"New"** (o entra directo a github.com/new) para crear un repositorio nuevo.
3. Ponle de nombre `censo-ocupacion-camas`. Déjalo en **Public** o **Private** (cualquiera funciona). Haz clic en **"Create repository"**.
4. En la página del repositorio recién creado, busca el enlace que dice algo como *"uploading an existing file"* (subir un archivo existente).
5. Descomprime en tu computador la carpeta `censo-app-cloud/backend` que te entregué, y **arrastra todos sus archivos y carpetas** (Dockerfile, package.json, server.js, la carpeta `db/`, la carpeta `public/`) a esa página de GitHub.
6. Baja hasta el final de la página y haz clic en **"Commit changes"** (guardar cambios).

Ya tienes el código en GitHub. No necesitas saber usar Git ni la terminal para esto — todo fue arrastrar y soltar en el navegador.

---

## Paso 3 — Desplegar en Render (10 minutos)

1. Ve a **https://render.com** y crea una cuenta gratis. Te va a pedir conectar tu cuenta de GitHub — acéptalo (esto es normal y seguro, es cómo Render sabe de dónde traer tu código).
2. En el panel de Render, haz clic en **"New +"** → **"Web Service"**.
3. Selecciona el repositorio `censo-ocupacion-camas` que acabas de subir.
4. Render va a detectar automáticamente el `Dockerfile` — déjalo así (no cambies el "Root Directory" ni el "Runtime").
5. Baja hasta **"Instance Type"** y elige el plan **Free**.
6. Baja hasta **"Environment Variables"** y agrega estas dos:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | (pega aquí la cadena de conexión que copiaste de Neon en el Paso 1) |
   | `JWT_SECRET` | (inventa una frase larga y única, sin espacios — por ejemplo `famisanar-censo-camas-2026-clave-secreta`) |

7. Haz clic en **"Create Web Service"**.

Render va a construir la aplicación (tarda 2-5 minutos la primera vez). Cuando termine, verás un mensaje verde de "Live" y una URL arriba, algo como:

```
https://censo-ocupacion-camas.onrender.com
```

**Esa es la dirección que vas a compartir con los 127 usuarios.**

---

## Paso 4 — Probar que funciona

1. Abre la URL que te dio Render en el navegador.
2. Inicia sesión con cualquier usuario real, usando la contraseña inicial:
   ```
   {TIPO_DOC}{NUMERO_DOCUMENTO}_
   ```
   Ejemplo: cédula `1030615476` → contraseña `CC1030615476_`
3. El sistema te pedirá cambiarla de inmediato — es el comportamiento esperado.
4. Prueba crear un registro en **Registro de Ocupación** y verifica que aparece en **Tabla de Ocupación** y en el **Dashboard**.

---

## Importante: el plan gratis de Render "se duerme"

En el plan gratuito, si nadie usa la aplicación durante 15 minutos, Render la
"duerme" para ahorrar recursos. **Esto no borra ningún dato** (la base de
datos vive aparte, en Neon, y esa nunca se duerme ni se borra). Lo único que
pasa es que el primer usuario que entre después de un rato de inactividad
va a esperar unos 20-30 segundos mientras la aplicación "despierta". Después
de eso, funciona con normalidad hasta que vuelva a quedar inactiva.

Si más adelante esto se vuelve molesto para el equipo, Render tiene un plan
pago (desde ~$7 USD/mes) que elimina ese tiempo de espera — pero no es
necesario para empezar.

---

## Actualizar la base de IPS

Una vez desplegada, entra como Administrador o Coordinador/Supervisor →
**Administración → Base de IPS**, y sube ahí los mismos Excel
(`IPS_CON_AMBITO_Y_LIDER.xlsx` y `CAMAS_HABILITADAS_JULIO.xlsx`) cuando
cambien. No hace falta volver a tocar Render ni GitHub para eso.

---

## Si necesitas actualizar el código más adelante

Cuando yo te entregue una versión nueva de la aplicación:
1. Repite el Paso 2 (sube los archivos nuevos a ese mismo repositorio de GitHub, reemplazando los anteriores).
2. Render detecta el cambio automáticamente y vuelve a desplegar solo — no tienes que hacer nada en Render.

---

## Estructura del proyecto

```
censo-app-cloud/
├── README.md              ← este archivo
└── backend/
    ├── Dockerfile
    ├── package.json
    ├── server.js             ← API REST + reglas de negocio + roles (PostgreSQL)
    ├── db/
    │   ├── init.js             ← crea tablas y siembra datos reales (solo la 1a vez)
    │   ├── seed_ips.json        ← 288 IPS con ámbito, líder y camas habilitadas
    │   └── seed_users.json      ← 127 usuarios reales con su perfil
    └── public/                 ← frontend (login, registro, tabla, dashboard, administración)
        ├── index.html
        ├── app.js
        └── styles.css
```

## Roles y permisos

| Perfil                      | Ver | Registrar | Editar               | Eliminar | Administrar usuarios | Actualizar IPS |
|------------------------------|:---:|:---------:|:---------------------:|:--------:|:---------------------:|:---:|
| 1. Consulta                  | ✅  | ❌        | ❌                     | ❌       | ❌                     | ❌ |
| 2. Consulta y Reportes       | ✅  | ❌        | ❌                     | ❌       | ❌                     | ❌ |
| 3. Digitador / Auditor       | ✅ (solo lo propio) | ✅ | ✅ (solo lo propio) | ❌ | ❌ | ❌ |
| 4. Coordinador / Supervisor  | ✅  | ✅        | ✅ (todo)              | ❌       | ❌                     | ✅ |
| 5. Administrador             | ✅  | ✅        | ✅ (todo)              | ✅       | ✅                     | ✅ |

Reglas de ocupación aplicadas en el servidor:
- Ocupación IPS puede ser mayor o igual a camas habilitadas (sobreocupación).
- Ocupación Famisanar siempre debe ser ≤ Ocupación IPS.
- Camas disponibles nunca es negativo.
- No se permite duplicar un registro para la misma fecha + IPS + tipo de estancia + población.
