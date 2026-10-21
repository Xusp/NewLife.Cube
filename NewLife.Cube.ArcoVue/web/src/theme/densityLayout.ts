import { ref } from 'vue';

/** applyTheme 写入密度 class 后递增，供 canvas 表格重建行高（CSS 变量进不了 VTable） */
export const densityRevision = ref(0);

export function notifyDensityApplied(): void {
  densityRevision.value += 1;
}

export interface DensityLayout {
  rowHeight: number;
  padY: number;
  padX: number;
}

const FALLBACK: DensityLayout = { rowHeight: 48, padY: 12, padX: 12 };

function px(el: Element, name: string, fallback: number): number {
  const inline = el instanceof HTMLElement ? parseFloat(el.style.getPropertyValue(name)) : NaN;
  if (Number.isFinite(inline) && inline > 0) return inline;
  const fromCss = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(fromCss) && fromCss > 0 ? fromCss : fallback;
}

/** 读取 html 上的密度变量。默认档行更高、内边距更大；紧凑档相反。 */
export function readDensityLayout(root?: Element | null): DensityLayout {
  const el = root ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (!el) return FALLBACK;
  return {
    rowHeight: px(el, '--cube-density-row-height', FALLBACK.rowHeight),
    padY: px(el, '--cube-density-cell-pad-y', FALLBACK.padY),
    padX: px(el, '--cube-density-cell-pad-x', FALLBACK.padX),
  };
}
