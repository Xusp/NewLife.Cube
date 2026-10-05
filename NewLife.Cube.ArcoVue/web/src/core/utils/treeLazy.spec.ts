import { describe, expect, it } from 'vitest';
import { isLazyTreeRows, isTreeLazyRow, shouldUseTreeLazy } from './treeLazy';

describe('treeLazy 判定（大树懒加载）', () => {
  it('行标记识别：1/"1"/true 命中；缺失/0/null 不命中；大小写不敏感', () => {
    expect(isTreeLazyRow({ __treeLazy: 1 })).toBe(true);
    expect(isTreeLazyRow({ __treeLazy: '1' })).toBe(true);
    expect(isTreeLazyRow({ __treelazy: true })).toBe(true);
    expect(isTreeLazyRow({ __treeLazy: 0 })).toBe(false);
    expect(isTreeLazyRow({})).toBe(false);
    expect(isTreeLazyRow(null)).toBe(false);
    expect(isTreeLazyRow(undefined)).toBe(false);
  });

  it('行集判定：任一行带标记', () => {
    expect(isLazyTreeRows([{ id: 1 }, { id: 2, __treeLazy: 1 }])).toBe(true);
    expect(isLazyTreeRows([{ id: 1 }, { id: 2 }])).toBe(false);
    expect(isLazyTreeRows([])).toBe(false);
  });

  it('请求判定：树视图 + 树实体 + 无查询才启用', () => {
    const base = { viewKind: 'tree', isTreeEntity: true, search: {}, hasFilter: false };
    expect(shouldUseTreeLazy(base)).toBe(true);
    expect(shouldUseTreeLazy({ ...base, viewKind: 'table' })).toBe(false);
    expect(shouldUseTreeLazy({ ...base, isTreeEntity: false })).toBe(false);
    expect(shouldUseTreeLazy({ ...base, isTreeEntity: undefined })).toBe(false);
    expect(shouldUseTreeLazy({ ...base, search: { Q: 'x' } })).toBe(false);
    expect(shouldUseTreeLazy({ ...base, hasFilter: true })).toBe(false);
  });
});
