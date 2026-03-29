import { useState, useEffect, useCallback } from "react";

type Props = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  style?: React.CSSProperties;
};

/**
 * 数値入力コンポーネント
 * - ローカルstateで入力中の値を保持し、blur/Enterで確定する
 * - 直接stateバインドによる「数字が入力できない」問題を解消
 */
export function NumberInput({ value, onChange, min, max, step, style }: Props) {
  const [localValue, setLocalValue] = useState(String(value));

  // 外部から値が変わったらローカルも同期（ただしフォーカス中は上書きしない）
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const commit = useCallback(() => {
    let num = Number(localValue);
    if (isNaN(num)) {
      // 不正値なら元に戻す
      setLocalValue(String(value));
      return;
    }
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    setLocalValue(String(num));
    onChange(num);
  }, [localValue, value, min, max, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commit();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="number"
      value={localValue}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      style={style}
    />
  );
}
