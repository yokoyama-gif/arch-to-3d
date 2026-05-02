import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';

export type Shift = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  earnings: number;
  delivery_count: number;
  distance_km: number;
  area: string | null;
  weather: string | null;
  memo: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type ShiftInput = Omit<Shift, 'id' | 'created_at' | 'updated_at' | 'source'> & {
  source?: string;
};

export type ShiftFilter = {
  from?: string;
  to?: string;
  area?: string;
  weather?: string;
};

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
let dbFile = '';

function locateWasm(file: string): string {
  // dev:   <project>/node_modules/sql.js/dist/sql-wasm.wasm
  // prod:  app.asar.unpacked/node_modules/... or copied alongside main
  // __dirname at runtime: dist-electron/main
  const candidates = [
    path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file),
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    path.join(__dirname, file),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

export async function initDb(userDataDir: string): Promise<void> {
  if (db) return;
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  dbFile = path.join(userDataDir, 'uber-eats-analyzer.db');

  SQL = await initSqlJs({ locateFile: (f: string) => locateWasm(f) });

  if (fs.existsSync(dbFile)) {
    const bytes = fs.readFileSync(dbFile);
    db = new SQL.Database(new Uint8Array(bytes));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      date              TEXT    NOT NULL,
      start_time        TEXT    NOT NULL,
      end_time          TEXT    NOT NULL,
      duration_minutes  INTEGER NOT NULL,
      earnings          INTEGER NOT NULL,
      delivery_count    INTEGER NOT NULL,
      distance_km       REAL    NOT NULL,
      area              TEXT,
      weather           TEXT,
      memo              TEXT,
      source            TEXT    NOT NULL DEFAULT 'manual',
      created_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
    CREATE INDEX IF NOT EXISTS idx_shifts_area ON shifts(area);
  `);
  saveToDisk();
}

function ensure(): Database {
  if (!db) throw new Error('DB not initialized');
  return db;
}

function saveToDisk(): void {
  if (!db) return;
  const bytes = db.export();
  fs.writeFileSync(dbFile, Buffer.from(bytes));
}

function rowsAsObjects<T>(sql: string, params?: Record<string, unknown> | unknown[]): T[] {
  const stmt = ensure().prepare(sql);
  if (params) stmt.bind(params as never);
  const out: T[] = [];
  while (stmt.step()) out.push(stmt.getAsObject() as T);
  stmt.free();
  return out;
}

function execRun(sql: string, params?: Record<string, unknown> | unknown[]): void {
  const stmt = ensure().prepare(sql);
  if (params) stmt.bind(params as never);
  stmt.step();
  stmt.free();
}

function lastInsertRowId(): number {
  const stmt = ensure().prepare('SELECT last_insert_rowid() AS id');
  stmt.step();
  const v = stmt.getAsObject() as { id: number };
  stmt.free();
  return v.id;
}

export function listShifts(filter: ShiftFilter = {}): Shift[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.from) {
    where.push('date >= $from');
    params.$from = filter.from;
  }
  if (filter.to) {
    where.push('date <= $to');
    params.$to = filter.to;
  }
  if (filter.area) {
    where.push('area = $area');
    params.$area = filter.area;
  }
  if (filter.weather) {
    where.push('weather = $weather');
    params.$weather = filter.weather;
  }
  const sql = `SELECT * FROM shifts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date DESC, start_time DESC`;
  return rowsAsObjects<Shift>(sql, params);
}

function toBindParams(input: ShiftInput): Record<string, unknown> {
  return {
    $date: input.date,
    $start_time: input.start_time,
    $end_time: input.end_time,
    $duration_minutes: input.duration_minutes,
    $earnings: input.earnings,
    $delivery_count: input.delivery_count,
    $distance_km: input.distance_km,
    $area: input.area ?? null,
    $weather: input.weather ?? null,
    $memo: input.memo ?? null,
    $source: input.source ?? 'manual',
  };
}

export function insertShift(input: ShiftInput): Shift {
  execRun(
    `INSERT INTO shifts (date, start_time, end_time, duration_minutes, earnings, delivery_count, distance_km, area, weather, memo, source)
     VALUES ($date, $start_time, $end_time, $duration_minutes, $earnings, $delivery_count, $distance_km, $area, $weather, $memo, $source)`,
    toBindParams(input),
  );
  const id = lastInsertRowId();
  saveToDisk();
  return rowsAsObjects<Shift>('SELECT * FROM shifts WHERE id = $id', { $id: id })[0];
}

export function updateShift(id: number, input: ShiftInput): Shift {
  execRun(
    `UPDATE shifts SET
        date = $date,
        start_time = $start_time,
        end_time = $end_time,
        duration_minutes = $duration_minutes,
        earnings = $earnings,
        delivery_count = $delivery_count,
        distance_km = $distance_km,
        area = $area,
        weather = $weather,
        memo = $memo,
        updated_at = datetime('now','localtime')
      WHERE id = $id`,
    { ...toBindParams(input), $id: id },
  );
  saveToDisk();
  return rowsAsObjects<Shift>('SELECT * FROM shifts WHERE id = $id', { $id: id })[0];
}

export function deleteShift(id: number): void {
  execRun('DELETE FROM shifts WHERE id = $id', { $id: id });
  saveToDisk();
}

export function bulkInsertShifts(rows: ShiftInput[]): number {
  ensure().run('BEGIN');
  try {
    for (const r of rows) {
      execRun(
        `INSERT INTO shifts (date, start_time, end_time, duration_minutes, earnings, delivery_count, distance_km, area, weather, memo, source)
         VALUES ($date, $start_time, $end_time, $duration_minutes, $earnings, $delivery_count, $distance_km, $area, $weather, $memo, $source)`,
        toBindParams({ ...r, source: r.source ?? 'csv' }),
      );
    }
    ensure().run('COMMIT');
  } catch (e) {
    ensure().run('ROLLBACK');
    throw e;
  }
  saveToDisk();
  return rows.length;
}
