import { describe, expect, it } from 'vitest';
import {
  getRotatedSize,
  isRectInside,
  rectanglesIntersect,
  rotateLocalSide,
} from './rect';

describe('rect geometry', () => {
  it('detects rectangle intersection', () => {
    expect(
      rectanglesIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 80, y: 80, width: 100, height: 100 },
      ),
    ).toBe(true);
    expect(
      rectanglesIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100, y: 100, width: 50, height: 50 },
      ),
    ).toBe(false);
  });

  it('checks room containment', () => {
    expect(
      isRectInside(
        { x: 100, y: 100, width: 200, height: 200 },
        { x: 0, y: 0, width: 1000, height: 1000 },
      ),
    ).toBe(true);
    expect(
      isRectInside(
        { x: -10, y: 100, width: 200, height: 200 },
        { x: 0, y: 0, width: 1000, height: 1000 },
      ),
    ).toBe(false);
  });

  it('rotates size and local side in 90 degree increments', () => {
    expect(getRotatedSize(1400, 700, 90)).toEqual({ width: 700, height: 1400 });
    expect(rotateLocalSide('bottom', 90)).toBe('left');
  });
});
