/**
 * 泛型签名缓存：按「完整请求签名」缓存已加载数据，TTL + LRU 双限。
 *
 * 使用场景（2026-10-05 性能修复）：实体列表在多个视图间切换时（表格/树/地图等），
 * 若新视图的完整请求签名与历史某次请求一致，直接复用其结果，避免重复请求后端。
 * 树表扩子孙（OSC-26100514b7）单次响应可达数 MB、地图分层数据需多次请求，
 * 切换复用收益显著。
 *
 * 注意：数据变更（增删改/导入等）后调用方应 clear()，避免切回其它视图读到旧数据。
 */
export interface SignatureCacheOptions {
  /** 最多保留条目数（默认 4），超限淘汰最旧 */
  max?: number;
  /** 条目有效期（毫秒，默认 60000）；<=0 表示不过期 */
  ttl?: number;
  /** 时钟注入（测试用） */
  now?: () => number;
}

export interface SignatureCache<T> {
  /** 读取（过期条目自动清除；命中刷新 LRU 顺序） */
  get(key: string): T | null;
  /** 写入（同 key 覆盖并刷新时间戳；超限淘汰最旧） */
  set(key: string, value: T): void;
  /** 清空全部（数据变更后调用） */
  clear(): void;
  /** 当前条目数（测试/诊断用） */
  readonly size: number;
}

export function createSignatureCache<T>(options: SignatureCacheOptions = {}): SignatureCache<T> {
  const max = Math.max(1, options.max ?? 4);
  const ttl = options.ttl ?? 60_000;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, { value: T; ts: number }>();

  return {
    get(key: string): T | null {
      const hit = entries.get(key);
      if (!hit) return null;
      if (ttl > 0 && now() - hit.ts > ttl) {
        entries.delete(key);
        return null;
      }
      // LRU：命中后移到末尾（Map 迭代序 = 插入序）
      entries.delete(key);
      entries.set(key, hit);
      return hit.value;
    },
    set(key: string, value: T): void {
      entries.delete(key);
      entries.set(key, { value, ts: now() });
      while (entries.size > max) {
        const oldest = entries.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear(): void {
      entries.clear();
    },
    get size(): number {
      return entries.size;
    },
  };
}
