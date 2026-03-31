import React from 'react';
import { AppSettings } from '../../shared/types';

interface Props {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onSelectOutputFolder: () => void;
}

const AVAILABLE_SPEEDS = [1.25, 1.5, 1.75, 2.0];
const BITRATE_OPTIONS = [128, 192, 256, 320];

export default function SettingsPanel({ settings, onChange, onSelectOutputFolder }: Props) {
  const update = (partial: Partial<AppSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const toggleSpeed = (speed: number) => {
    const current = settings.speeds;
    const next = current.includes(speed)
      ? current.filter((s) => s !== speed)
      : [...current, speed].sort();
    update({ speeds: next });
  };

  return (
    <div className="settings-panel">
      <h2>変換設定</h2>

      {/* 基本設定 */}
      <div className="settings-group">
        <div className="settings-group-title">基本</div>

        <div className="setting-row">
          <span className="setting-label">出力形式</span>
          <span className="setting-label" style={{ fontWeight: 600 }}>MP3</span>
        </div>

        <div className="setting-row">
          <span className="setting-label">ビットレート</span>
          <select
            className="setting-select"
            value={settings.bitrate}
            onChange={(e) => update({ bitrate: Number(e.target.value) })}
          >
            {BITRATE_OPTIONS.map((b) => (
              <option key={b} value={b}>{b} kbps</option>
            ))}
          </select>
        </div>
      </div>

      {/* 音量均一化 */}
      <div className="settings-group">
        <div className="settings-group-title">音量均一化</div>
        <div className="setting-row">
          <span className="setting-label">有効にする</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.normalize}
              onChange={(e) => update({ normalize: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        {settings.normalize && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            loudnorm フィルタで音量を -16 LUFS に統一します
          </div>
        )}
      </div>

      {/* 無音カット */}
      <div className="settings-group">
        <div className="settings-group-title">無音カット</div>
        <div className="setting-row">
          <span className="setting-label">有効にする</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.silenceRemove}
              onChange={(e) => update({ silenceRemove: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        {settings.silenceRemove && (
          <>
            <div className="setting-row">
              <span className="setting-label">閾値 (dB)</span>
              <input
                className="setting-input"
                type="number"
                value={settings.silenceThreshold}
                onChange={(e) => update({ silenceThreshold: Number(e.target.value) })}
                min={-60}
                max={0}
                step={1}
              />
            </div>
            <div className="setting-row">
              <span className="setting-label">最小無音秒数</span>
              <input
                className="setting-input"
                type="number"
                value={settings.silenceMinDuration}
                onChange={(e) => update({ silenceMinDuration: Number(e.target.value) })}
                min={0.1}
                max={5}
                step={0.1}
              />
            </div>
          </>
        )}
      </div>

      {/* 倍速生成 */}
      <div className="settings-group">
        <div className="settings-group-title">倍速版生成</div>
        <div className="setting-row">
          <span className="setting-label">有効にする</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.speedUp}
              onChange={(e) => update({ speedUp: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        {settings.speedUp && (
          <div className="speed-options">
            {AVAILABLE_SPEEDS.map((speed) => (
              <label key={speed} className="speed-option">
                <input
                  type="checkbox"
                  checked={settings.speeds.includes(speed)}
                  onChange={() => toggleSpeed(speed)}
                />
                {speed}x
              </label>
            ))}
          </div>
        )}
        {settings.speedUp && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
            通常速度版 + 選択した倍速版を同時生成します
          </div>
        )}
      </div>

      {/* 出力先 */}
      <div className="settings-group">
        <div className="settings-group-title">出力先</div>
        <div className="setting-row">
          <span className="setting-label">元ファイルと同じ場所</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.outputToSameDir}
              onChange={(e) => update({ outputToSameDir: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        {!settings.outputToSameDir && (
          <div className="output-dir-row">
            <span className="output-dir-path">
              {settings.outputDir || '未指定（元ファイルと同じ場所）'}
            </span>
            <button className="btn btn-sm btn-outline" onClick={onSelectOutputFolder}>
              選択
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
