// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readDensityLayout } from './densityLayout';

describe('readDensityLayout', () => {
  it('默认档行高与内边距大于紧凑档', () => {
    const el = document.createElement('div');
    el.style.setProperty('--cube-density-row-height', '48px');
    el.style.setProperty('--cube-density-cell-pad-y', '12px');
    el.style.setProperty('--cube-density-cell-pad-x', '12px');
    const loose = readDensityLayout(el);

    el.style.setProperty('--cube-density-row-height', '32px');
    el.style.setProperty('--cube-density-cell-pad-y', '4px');
    el.style.setProperty('--cube-density-cell-pad-x', '8px');
    const tight = readDensityLayout(el);

    expect(loose.rowHeight).toBeGreaterThan(tight.rowHeight);
    expect(loose.padY).toBeGreaterThan(tight.padY);
    expect(loose).toEqual({ rowHeight: 48, padY: 12, padX: 12 });
    expect(tight).toEqual({ rowHeight: 32, padY: 4, padX: 8 });
  });
});
