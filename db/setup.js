// Crea las tablas y carga datos de ejemplo.
// Uso manual:  npm run db:setup   (¡borra y recrea todo!)
// También se ejecuta solo al iniciar la app si la base está vacía.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const CURSOS = [
  // nombre, categoria, instructor, creditos, arte
  ['Cálculo I', 'Matemática', 'Dr. Helen Vance', 4, 'calculo'],
  ['Álgebra Lineal', 'Matemática', 'Prof. Marcus Lin', 4, 'algebra'],
  ['Sistemas de Bases de Datos', 'Tecnología', 'Ing. Roberto Gómez', 4, 'datos'],
  ['Contabilidad', 'Matemática', 'Dr. Helen Vance', 3, 'contabilidad'],
  ['Ajedrez y Estrategia', 'Lógica', 'Dr. Sarah Jenkins', 2, 'ajedrez'],
  ['Estadística Aplicada', 'Matemática', 'Dra. Alicia Mendoza', 4, 'estadistica'],
  ['Programación Web II', 'Tecnología', 'Mg. Alan García', 4, 'web'],
];

// Inscripciones del usuario demo: [indiceCurso, progreso, nota, estado]
const INSCRIPCIONES_DEMO = [
  [0, 82, 95.4, 'en_curso'],
  [1, 100, 91.2, 'completado'],
  [2, 45, 88.1, 'en_curso'],
  [3, 45, 88.1, 'en_curso'],
  [4, 0, null, 'no_iniciado'],
  [5, 90, 94.0, 'en_curso'],
  [6, 0, null, 'no_iniciado'],
];

// Compañeros para que el ranking tenga sentido
const COMPANEROS = [
  ['María Rodríguez', 93.2], ['Carlos Mendoza', 89.5], ['Ana Lucía Torres', 85.0],
  ['Roberto Gómez', 87.3], ['Juan Pérez', 80.1], ['Beatriz Paredes', 90.2],
  ['Luis Quispe', 78.4], ['Sofía Huamán', 84.6], ['Diego Rojas', 88.9],
  ['Valeria Castro', 76.5], ['Jorge Salazar', 82.0], ['Camila Flores', 86.1],
  ['Renato Vargas', 79.3], ['Lucía Chávez', 83.7], ['Mateo Ramos', 90.8],
  ['Andrea Silva', 81.2],
];

async function crearEstudiante(client, { nombre, email, hash, creditosPrevios = 0 }) {
  const { rows } = await client.query(
    `INSERT INTO usuarios (nombre, email, password_hash, creditos_previos)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [nombre, email, hash, creditosPrevios]
  );
  return rows[0].id;
}

async function setupDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

    // Cursos
    const cursoIds = [];
    for (const c of CURSOS) {
      const { rows } = await client.query(
        'INSERT INTO cursos (nombre, categoria, instructor, creditos, arte) VALUES ($1,$2,$3,$4,$5) RETURNING id', c
      );
      cursoIds.push(rows[0].id);
    }

    // Usuario demo
    const hash = await bcrypt.hash('123456', 10);
    const uid = await crearEstudiante(client, {
      nombre: 'Alan García', email: 'alan_garcia@usmp.pe', hash, creditosPrevios: 82,
    });

    for (const [i, progreso, nota, estado] of INSCRIPCIONES_DEMO) {
      await client.query(
        'INSERT INTO inscripciones (usuario_id, curso_id, progreso, nota, estado) VALUES ($1,$2,$3,$4,$5)',
        [uid, cursoIds[i], progreso, nota, estado]
      );
    }

    // Sesiones de estudio de los últimos 70 días (hoy queda libre para probar el cronómetro)
    const enCurso = INSCRIPCIONES_DEMO.filter(x => x[3] !== 'no_iniciado').map(x => cursoIds[x[0]]);
    for (let d = 1; d <= 70; d++) {
      const minutos = 60 + ((d * 37) % 180);
      await client.query(
        `INSERT INTO sesiones_estudio (usuario_id, curso_id, minutos, fecha)
         VALUES ($1, $2, $3, CURRENT_DATE - $4::int)`,
        [uid, enCurso[d % enCurso.length], minutos, d]
      );
    }

    // Actividades recientes
    const actividades = [
      ['estudio', 'Sesión de estudio de 45 min', 'Cálculo I', '20 hours'],
      ['certificado', 'Certificado de insignia "SQL Foundations" obtenido', 'Sistemas de Bases de Datos', '6 hours'],
      ['examen', 'Obtuviste 94% en el examen final', 'Estadística Aplicada', '4 hours'],
      ['entrega', 'Entrega de la tarea 4 (Álgebra Lineal)', 'Álgebra Lineal', '2 hours'],
    ];
    for (const [tipo, descripcion, detalle, hace] of actividades) {
      await client.query(
        `INSERT INTO actividades (usuario_id, tipo, descripcion, detalle, creado_en)
         VALUES ($1,$2,$3,$4, NOW() - $5::interval)`,
        [uid, tipo, descripcion, detalle, hace]
      );
    }

    for (const nombre of ['SQL Foundations', 'Álgebra Lineal', 'Excel Avanzado', 'Lógica Computacional']) {
      await client.query('INSERT INTO certificados (usuario_id, nombre) VALUES ($1,$2)', [uid, nombre]);
    }

    const ciclos = [['Ciclo I', 84.3], ['Ciclo II', 85.2], ['Ciclo III', 88.0], ['Ciclo IV', 88.6], ['Ciclo V', 89.4]];
    for (let i = 0; i < ciclos.length; i++) {
      await client.query(
        'INSERT INTO notas_ciclo (usuario_id, ciclo, orden, promedio) VALUES ($1,$2,$3,$4)',
        [uid, ciclos[i][0], i + 1, ciclos[i][1]]
      );
    }

    const metas = [
      ['Mantener promedio superior al 90%', '91.4% alcanzado', 100, true],
      ['Completar 18 créditos obligatorios', '12 de 18 en progreso', 67, false],
      ['Obtener certificación SQL Foundations', 'Obtenida', 100, true],
      ['Subir al Top 10% del ranking', 'Actualmente Top 12%', 80, false],
    ];
    for (const m of metas) {
      await client.query(
        'INSERT INTO metas (usuario_id, titulo, detalle, progreso, completada) VALUES ($1,$2,$3,$4,$5)',
        [uid, ...m]
      );
    }

    // Compañeros con notas (para el ranking)
    const offsets = [0.8, -0.6, 0.3, -0.5, 0];
    for (let k = 0; k < COMPANEROS.length; k++) {
      const [nombre, base] = COMPANEROS[k];
      const email = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_') + '@usmp.pe';
      const id = await crearEstudiante(client, { nombre, email, hash });
      for (let j = 0; j < 5; j++) {
        await client.query(
          `INSERT INTO inscripciones (usuario_id, curso_id, progreso, nota, estado)
           VALUES ($1,$2,$3,$4,'en_curso')`,
          [id, cursoIds[(j + k) % cursoIds.length], 50, Math.min(100, base + offsets[j])]
        );
      }
    }

    // Donaciones
    const donaciones = [
      ['Estudiante Anónimo', 1200, 'Para los servidores de todo el año.', true, '40 days'],
      ['Asociación Alumnos', 400, 'Con cariño de la promoción 2026.', false, '32 days'],
      ['Fundación Edu-Tech', 350, null, false, '25 days'],
      ['Beatriz Paredes', 280, 'Sigan así.', false, '18 days'],
      ['Roberto Gómez', 15, '¡Arriba MasterEstudio!', false, '10 days'],
      ['Ana Lucía Torres', 100, 'Increíble iniciativa para democratizar la educación en sistemas.', false, '6 days'],
      ['Carlos Mendoza', 25, null, false, '3 days'],
      ['María Rodríguez', 120, 'Un granito de arena para mantener vivos los servidores.', false, '1 day'],
      ['Juan Pérez', 50, '¡Gracias por la plataforma! Me ayudó mucho en mi ciclo de algoritmos.', false, '3 hours'],
    ];
    for (const [nombre, monto, mensaje, anonimo, hace] of donaciones) {
      await client.query(
        `INSERT INTO donaciones (nombre_donante, monto, mensaje, anonimo, creado_en)
         VALUES ($1,$2,$3,$4, NOW() - $5::interval)`,
        [nombre, monto, mensaje, anonimo, hace]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Si la base está vacía (primer despliegue), la prepara automáticamente
async function ensureDatabase() {
  const { rows } = await pool.query("SELECT to_regclass('public.usuarios') AS existe");
  if (!rows[0].existe) {
    console.log('🛠️  Base de datos vacía: creando tablas y datos de ejemplo…');
    await setupDatabase();
    console.log('✅ Base de datos lista (usuario demo: alan_garcia@usmp.pe / 123456)');
  }
}

module.exports = { setupDatabase, ensureDatabase };

if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('✅ Tablas creadas y datos cargados.');
      console.log('   Usuario demo: alan_garcia@usmp.pe  ·  Contraseña: 123456');
      return pool.end();
    })
    .catch((err) => {
      console.error('❌ Error preparando la base de datos:', err.message);
      process.exit(1);
    });
}
