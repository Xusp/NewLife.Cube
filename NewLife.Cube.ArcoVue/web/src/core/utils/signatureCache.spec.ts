import { describe, expect, it } from 'vitest';
import { createSignatureCache } from './signatureCache';

describe('createSignatureCache', () => {
  it('存取与未命中', () => {
    const cache = createSignatureCache<string>();
    expect(cache.get('a')).toBeNull();
    cache.set('a', 'va');
    expect(cache.get('a')).toBe('va');
    expect(cache.size).toBe(1);
  });

  it('同 key 覆盖并刷新时间戳', () => {
    let tick = 0;
    const cache = createSignatureCache<string>({ ttl: 100, now: () => tick });
    cache.set('a', 'v1');
    tick = 90;
    cache.set('a', 'v2');
    tick = 150; // (150-90) < 100：仍有效
    expect(cache.get('a')).toBe('v2');
  });

  it('超过 TTL 过期并清除', () => {
    let tick = 0;
    const cache = createSignatureCache<string>({ ttl: 100, now: () => tick });
    cache.set('a', 'va');
    tick = 101;
    expect(cache.get('a')).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('ttl<=0 表示不过期', () => {
    let tick = 0;
    const cache = createSignatureCache<string>({ ttl: 0, now: () => tick });
    cache.set('a', 'va');
    tick = 10_000_000;
    expect(cache.get('a')).toBe('va');
  });

  it('LRU：超限淘汰最旧，命中会刷新顺序', () => {
    const cache = createSignatureCache<number>({ max: 2, ttl: 0 });
    cache.set('a', 1);
    cache.set('b', 2);
    // 命中 a → b 变为最旧
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.size).toBe(2);
  });

  it('clear 清空全部', () => {
    const cache = createSignatureCache<string>();
    cache.set('a', 'va');
    cache.set('b', 'vb');
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.size).toBe(0);
  });
});
