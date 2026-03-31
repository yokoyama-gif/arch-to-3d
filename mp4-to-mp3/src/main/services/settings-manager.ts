import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types';

export class SettingsManager {
  private filePath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'settings.json');
  }

  load(): AppSettings {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { ...DEFAULT_SETTINGS };
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      // デフォルト値とマージ（新しい設定キーが追加された場合の互換性）
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  save(settings: AppSettings): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('設定保存に失敗:', err);
    }
  }
}
