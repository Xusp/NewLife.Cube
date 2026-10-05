/**
 * 大树懒加载（树表增强）：请求判定与行标记识别。
 *
 * 协议：前端在「树视图 + 树实体 + 无任何查询条件」时给 GetList 带 `treeLazy=1`；
 * 后端按规模决策——全表不超过阈值（CubeSetting.TreeLazyThreshold，默认 3000）时回退「命中行扩子孙」一次加载完整，
 * 超过阈值则返回「根层」行（`parentId` 缺省=0）并给行写扩展 `__treeLazy=1`、有可见子级的行写 `children=true`；
 * 展开节点时前端再拉该节点直接子级（同样 treeLazy=1 + parentId=N）经 VTable setRecordChildren 装配。
 */

/** 行是否携带后端懒加载标记（行扩展 __treeLazy；全大小写不敏感，兼容 JSON 序列化形态差异） */
export function isTreeLazyRow(row: Record<string, unknown> | null | undefined): boolean {
  if (!row || typeof row !== 'object') return false;
  let value: unknown;
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === '__treelazy') {
      value = row[key];
      break;
    }
  }
  return value === 1 || value === '1' || value === true || value === 'true';
}

/** 行集是否为懒加载数据（任一行带标记）：懒加载行不能本地组装树（children 为 true 占位） */
export function isLazyTreeRows(rows: readonly Record<string, unknown>[]): boolean {
  return rows.length > 0 && rows.some((row) => isTreeLazyRow(row as Record<string, unknown>));
}

/** 是否应发起树懒加载请求：树视图 + 树实体 + 无搜索条件 + 无条件筛选 */
export function shouldUseTreeLazy(input: {
  viewKind: string;
  isTreeEntity?: boolean | null;
  search?: Record<string, unknown> | null;
  hasFilter?: boolean;
}): boolean {
  if (input.viewKind !== 'tree') return false;
  if (input.isTreeEntity !== true) return false;
  if (input.hasFilter) return false;
  return Object.keys(input.search ?? {}).length === 0;
}
