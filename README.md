# MasterEstudio · Plataforma de rendimiento estudiantil

Proyecto hecho con **Node.js + Express**, **PostgreSQL**, **Redis**, **WebSockets (Socket.IO)**,
autenticación con **sesiones y cookies**, mensajes **TempData (flash)**, **Git/GitHub** y despliegue en **Render**.

Usuario de prueba: `alan_garcia@usmp.pe` · contraseña `123456`

---

## Guía paso a paso (desde cero)

> Sigan los pasos **en este orden**. El plan gratis de Render permite **una sola base de datos
> PostgreSQL gratuita**, por eso primero la creamos en Render y luego la usamos también desde VS Code.

### Paso 1. Instalar los programas (una sola vez)

1. **Node.js** versión LTS → https://nodejs.org (siguiente, siguiente, finalizar).
2. **Git** → https://git-scm.com (deja todas las opciones por defecto).
3. **VS Code** → https://code.visualstudio.com
4. Crea cuentas en **GitHub** (https://github.com) y **Render** (https://render.com, entra con tu cuenta de GitHub).

Comprueba que todo quedó instalado. En VS Code abre la terminal con **Ctrl + ñ**
(o menú *Terminal → Nuevo terminal*) y escribe:

```bash
node -v
npm -v
git --version
```

Si alguno dice *"no se reconoce como comando"*, cierra VS Code por completo y vuelve a abrirlo
(o reinicia la PC).

### Paso 2. Abrir el proyecto en VS Code

1. Descomprime `masterestudio.zip` en una carpeta fácil, por ejemplo `Documentos/masterestudio`.
2. En VS Code: *Archivo → Abrir carpeta…* → elige la carpeta `masterestudio`.
3. Abre la terminal (**Ctrl + ñ**) e instala las librerías:

```bash
npm install
```

Se creará la carpeta `node_modules`. No la toques ni la subas a GitHub (ya está en `.gitignore`).

### Paso 3. Subir el código a GitHub

1. En GitHub: botón **New repository** → nombre `masterestudio` → **Create repository**
   (no marques "Add a README").
2. En la terminal de VS Code (cambia `TU_USUARIO`):

```bash
git init
git add .
git commit -m "Primera version de MasterEstudio"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/masterestudio.git
git push -u origin main
```

La primera vez te pedirá iniciar sesión en GitHub desde el navegador.

**Para el equipo:** los demás integrantes solo hacen `git clone https://github.com/TU_USUARIO/masterestudio.git`,
luego `npm install`, y crean su propio archivo `.env` (paso 5).
Agrégalos como colaboradores en GitHub: *Settings → Collaborators*.

### Paso 4. Crear todo en Render (web + PostgreSQL + Redis) de una vez

El archivo `render.yaml` (Blueprint) ya describe los 3 servicios.

1. En https://dashboard.render.com → **New +** → **Blueprint**.
2. Conecta tu repositorio `masterestudio` → **Apply**.
3. Render crea:
   - `masterestudio` → el Web Service (tu página)
   - `masterestudio-db` → PostgreSQL
   - `masterestudio-redis` → Key Value (Redis)
4. Espera a que el deploy termine (el primer arranque crea las tablas y los datos de ejemplo solo).
5. Abre la URL `https://masterestudio-xxxx.onrender.com` e inicia sesión con el usuario demo.

Desde ahora, **cada `git push` vuelve a desplegar la página automáticamente**.

> En el plan gratis, la web "se duerme" tras unos minutos sin visitas: la primera carga puede
> tardar ~1 minuto. La base de datos gratuita de Render caduca a los 30 días (suficiente para el trabajo).

### Paso 5. Conectar VS Code a la base de datos (para trabajar en tu PC)

1. En Render abre `masterestudio-db` → sección **Connections** → copia la **External Database URL**.
2. En VS Code, duplica el archivo `.env.example` y renombra la copia a **`.env`**.
3. Pega la URL en `DATABASE_URL=` (todo en una línea, sin comillas):

```env
DATABASE_URL=postgresql://masterestudio:xxxxxxxx@dpg-xxxxx.oregon-postgres.render.com/masterestudio
```

4. Deja `REDIS_URL` vacío: en tu PC la app funciona sin Redis (guarda las sesiones en memoria).
   En Render sí usa Redis de verdad.

> **Opción sin internet:** instala PostgreSQL en tu PC (https://www.postgresql.org/download/),
> crea una base llamada `masterestudio` con pgAdmin y usa
> `DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/masterestudio`

### Paso 6. Ejecutar la página en tu PC

```bash
npm run dev
```

Abre **http://localhost:3000** en el navegador. `nodemon` reinicia el servidor solo cada vez que guardas un archivo.

Comandos útiles:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia en modo desarrollo (se reinicia al guardar) |
| `npm start` | Inicia normal (así lo corre Render) |
| `npm run db:setup` | **Borra y recrea** tablas y datos de ejemplo |
| `Ctrl + C` | Detiene el servidor |

### Paso 7. Probar cada requisito del profesor

1. **Autenticación:** entra con una contraseña incorrecta → sale un mensaje rojo. Entra bien → mensaje verde.
2. **Cookies:** marca *Recordarme*, cierra sesión y vuelve a `/login`: tu correo aparece escrito.
   Revisa las cookies en el navegador: *F12 → Application → Cookies* (`masterestudio.sid` y `recordar_email`).
3. **TempData:** en *Mis cursos → Ver curso → Guardar avance* aparece un mensaje que se muestra una sola vez.
4. **WebSockets:** abre la página en **dos navegadores** (por ejemplo, Chrome y Edge, o uno en incógnito).
   Haz una donación en uno → aparece al instante en el otro, sin recargar. El contador "en línea" también cambia.
5. **Tiempo real + base de datos:** *Panel → Iniciar estudio* → Iniciar → espera unos segundos → Guardar.
   La actividad aparece en vivo y las horas se guardan en PostgreSQL.
6. **Redis (caché):** en Render, el Panel, Desempeño y Donaciones guardan cálculos en Redis
   (`panel:stats:ID`, `desempeno:ID`, `donaciones:stats`, `donaciones:honor`). Las sesiones se guardan con el prefijo `sess:`.

---

## Dónde está cada herramienta en el código

| Requisito | Archivo(s) |
|---|---|
| Node.js + Express (servidor) | `app.js`, carpeta `routes/` |
| PostgreSQL (tablas y conexión) | `db/schema.sql`, `db/pool.js`, `db/setup.js` |
| Redis: sesiones | `app.js` (`RedisStore`), `config/redis.js` |
| Redis: caché | `utils/cache.js` (usado en `routes/panel.js`, `desempeno.js`, `donaciones.js`) |
| Autenticación (bcrypt, login, registro, logout) | `routes/auth.js`, `middleware/auth.js` |
| Cookies | cookie de sesión en `app.js`; cookie `recordar_email` en `routes/auth.js` |
| TempData (flash) | `connect-flash` en `app.js`, mensajes en las rutas, `views/partials/flash.ejs` |
| WebSockets | `sockets/index.js` (servidor), `public/js/app.js` y `public/js/estudio.js` (navegador) |
| Render | `render.yaml` |
| Git/GitHub | `.gitignore` (evita subir `node_modules` y `.env`) |

## Estructura

```
masterestudio/
├── app.js                 servidor principal
├── render.yaml            infraestructura para Render
├── config/redis.js        conexión a Redis
├── db/                    esquema, conexión y datos de ejemplo
├── middleware/auth.js     protege las páginas privadas
├── routes/                auth, panel, cursos, desempeno, donaciones, estudio
├── services/              lógica compartida (actividades en vivo)
├── sockets/index.js       eventos de WebSocket
├── utils/                 caché y funciones de ayuda
├── views/                 pantallas EJS (HTML + datos)
└── public/                CSS, JavaScript del navegador e imágenes
```

**Imagen del login:** guarda la foto de su Figma como `public/img/login-hero.jpg` y aparecerá sola.

## Problemas comunes

| Error | Solución |
|---|---|
| `Falta DATABASE_URL` | No creaste el archivo `.env` o está vacío (paso 5). |
| `password authentication failed` | La URL está mal copiada. Cópiala otra vez desde Render. |
| `ENOTFOUND` / `ECONNREFUSED` | Usaste la *Internal* URL en tu PC. En tu PC va la **External**. |
| `EADDRINUSE :3000` | Ya tienes el servidor abierto en otra terminal. Ciérrala o usa `Ctrl + C`. |
| `Cannot find module …` | Te faltó `npm install`. |
| El deploy en Render falla | Abre el servicio en Render → **Logs** y lee la última línea roja. |
| El login funciona pero se sale solo en Render | Revisa que `masterestudio-redis` esté en estado *Available*. |
