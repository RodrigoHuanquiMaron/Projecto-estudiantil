-- ===========================================
--  MasterEstudio · Esquema de base de datos
-- ===========================================
DROP TABLE IF EXISTS donaciones, metas, notas_ciclo, certificados, actividades,
  sesiones_estudio, inscripciones, cursos, usuarios CASCADE;

CREATE TABLE usuarios (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL,
  email            VARCHAR(150) NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  carrera          VARCHAR(150) NOT NULL DEFAULT 'Estudiante de Computación y Sistemas',
  ciclo            VARCHAR(20)  NOT NULL DEFAULT 'Ciclo VI',
  creditos_previos INT NOT NULL DEFAULT 0,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cursos (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(120) NOT NULL,
  categoria   VARCHAR(50)  NOT NULL,
  instructor  VARCHAR(120) NOT NULL,
  creditos    INT NOT NULL DEFAULT 4,
  arte        VARCHAR(30) NOT NULL DEFAULT 'web'
);

CREATE TABLE inscripciones (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  curso_id    INT NOT NULL REFERENCES cursos(id)   ON DELETE CASCADE,
  progreso    INT NOT NULL DEFAULT 0 CHECK (progreso BETWEEN 0 AND 100),
  nota        NUMERIC(5,2) CHECK (nota BETWEEN 0 AND 100),
  estado      VARCHAR(20) NOT NULL DEFAULT 'no_iniciado'
              CHECK (estado IN ('en_curso','completado','no_iniciado')),
  UNIQUE (usuario_id, curso_id)
);

CREATE TABLE sesiones_estudio (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  curso_id    INT REFERENCES cursos(id) ON DELETE SET NULL,
  minutos     INT NOT NULL CHECK (minutos > 0),
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE actividades (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        VARCHAR(30) NOT NULL,
  descripcion TEXT NOT NULL,
  detalle     TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE certificados (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      VARCHAR(150) NOT NULL,
  emitido_en  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE notas_ciclo (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ciclo       VARCHAR(20) NOT NULL,
  orden       INT NOT NULL,
  promedio    NUMERIC(5,2) NOT NULL
);

CREATE TABLE metas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo      VARCHAR(150) NOT NULL,
  detalle     VARCHAR(150),
  progreso    INT NOT NULL DEFAULT 0,
  completada  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE donaciones (
  id             SERIAL PRIMARY KEY,
  usuario_id     INT REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_donante VARCHAR(120) NOT NULL,
  monto          NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  mensaje        VARCHAR(200),
  anonimo        BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sesiones_usuario_fecha ON sesiones_estudio (usuario_id, fecha);
CREATE INDEX idx_actividades_usuario ON actividades (usuario_id, creado_en DESC);
CREATE INDEX idx_donaciones_fecha ON donaciones (creado_en DESC);
