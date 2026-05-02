import Database from 'better-sqlite3';
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

let db: Database.Database | null = null;

export function initDb(userDataDir: string): Database.Database {
  if (db) return db;
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  const file = path.join(userDataDir, 'uber-eats-analyzer.db');
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
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
  return db;
}

function ensure(): Database.Database {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function listShifts(filter: ShiftFilter = {}): Shift[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.from) {
    where.push('date >= @from');
    params.from = filter.from;
  }
  if (filter.to) {
    where.push('date <= @to');
    params.to = filter.to;
  }
  if (filter.area) {
    where.push('area = @area');
    params.area = filter.area;
  }
  if (filter.weather) {
    where.push('weather = @weather');
    params.weather = filter.weather;
  }
  const sql = `SELECT * FROM shifts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date DESC, start_time DESC`;
  return ensure().prepare(sql).all(params) as Shift[];
}

export function insertShift(input: ShiftInput): Shift {
  const stmt = ensure().prepare(`
    INSERT INTO shifts (date, start_time, end_time, duration_minutes, earnings, delivery_count, distance_km, area, weather, memo, source)
    VALUES (@date, @start_time, @end_time, @duration_minutes, @earnings, @delivery_count, @distance_km, @area, @weather, @memo, @source)
  `);
  const info = stmt.run({
    ...input,
    area: input.area ?? null,
    weather: input.weather ?? null,
    memo: input.memo ?? null,
    source: input.source ?? 'manual',
  });
  const row = ensure().prepare('SELECT * FROM shifts WHERE id = ?').get(info.lastInsertRowid) as Shift;
  return row;
}

export function updateShift(id: number, input: ShiftInput): Shift {
  ensure()
    .prepare(`
      UPDATE shifts SET
        date = @date,
        start_time = @start_time,
        end_time = @end_time,
        duration_minutes = @duration_minutes,
        earnings = @earnings,
        delivery_count = @delivery_count,
        distance_km = @distance_km,
        area = @area,
        weather = @weather,
        memo = @memo,
        updated_at = datetime('now','localtime')
      WHERE id = @id
    `)
    .run({
      id,
      ...input,
      area: input.area ?? null,
      weather: input.weather ?? null,
      memo: input.memo ?? null,
    });
  return ensure().prepare('SELECT * FROM shifts WHERE id = ?').get(id) as Shift;
}

export function deleteShift(id: number): void {
  ensure().prepare('DELETE FROM shifts WHERE id = ?').run(id);
}

export function bulkInsertShifts(rows: ShiftInput[]): number {
  const stmt = ensure().prepare(`
    INSERT INTO shifts (date, start_time, end_time, duration_minutes, earnings, delivery_count, distance_km, area, weather, memo, source)
    VALUES (@date, @start_time, @end_time, @duration_minutes, @earnings, @delivery_count, @distance_km, @area, @weather, @memo, @source)
  `);
  const tx = ensure().transaction((items: ShiftInput[]) => {
    let n = 0;
    for (const r of items) {
      stmt.run({
        ...r,
        area: r.area ?? null,
        weather: r.weather ?? null,
        memo: r.memo ?? null,
        source: r.source ?? 'csv',
      });
      n++;
    }
    return n;
  });
  return tx(rows);
}
