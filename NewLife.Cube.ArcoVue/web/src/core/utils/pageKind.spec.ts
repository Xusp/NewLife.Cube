import { describe, expect, it } from 'vitest';
import { expandPageMeta } from '@newlifex/cube';
import { detectPageKind, isObjectPageMeta, isValidEntityPageMeta } from './pageKind';
import type { PageKindProbes } from './pageKind';

function probes(over: Partial<PageKindProbes> = {}): PageKindProbes {
  return {
    getPage: async () => {
      throw new Error('no GetPage');
    },
    getObjectProbe: async () => ({ fields: null, body: null }),
    ...over,
  };
}

describe('isValidEntityPageMeta', () => {
  it('list / search / addForm 数组 → true', () => {
    expect(isValidEntityPageMeta({ list: [] })).toBe(true);
    expect(isValidEntityPageMeta({ search: [] })).toBe(true);
    expect(isValidEntityPageMeta({ addForm: [] })).toBe(true);
  });

  it('仅 setting（历史形态，无 form）→ true；带 form 的单对象页 → false', () => {
    expect(isValidEntityPageMeta({ setting: {} })).toBe(true);
    expect(isValidEntityPageMeta({ setting: {}, form: [] })).toBe(false);
    expect(isValidEntityPageMeta({ entity: {}, setting: {}, form: [{ name: 'X' }] })).toBe(false);
  });

  it('字符串 / 数组根 / code+message 无 data → false', () => {
    expect(isValidEntityPageMeta('html')).toBe(false);
    expect(isValidEntityPageMeta([])).toBe(false);
    expect(isValidEntityPageMeta({ code: 404, message: 'not found' })).toBe(false);
    expect(isValidEntityPageMeta(null)).toBe(false);
    expect(isValidEntityPageMeta({})).toBe(false);
  });
});

describe('isObjectPageMeta', () => {
  it('ObjectController /meta 形态（entity+setting+form，无 list）→ true', () => {
    expect(isObjectPageMeta({ entity: {}, setting: {}, form: [{ name: 'Debug' }] })).toBe(true);
    expect(isObjectPageMeta({ setting: {}, form: [] })).toBe(true);
  });

  it('实体元数据（带 list/search/addForm）→ false', () => {
    expect(isObjectPageMeta({ setting: {}, form: [], list: [] })).toBe(false);
    expect(isObjectPageMeta({ setting: {}, form: [], addForm: [] })).toBe(false);
    expect(isObjectPageMeta({ setting: {}, form: [], search: [] })).toBe(false);
  });

  it('无 form / 非对象 → false', () => {
    expect(isObjectPageMeta({ setting: {} })).toBe(false);
    expect(isObjectPageMeta({ list: [] })).toBe(false);
    expect(isObjectPageMeta('html')).toBe(false);
    expect(isObjectPageMeta(null)).toBe(false);
  });

  it('expandPageMeta 展开后的对象页（pageKind=object，form 已摊成 addForm）→ true', () => {
    expect(
      isObjectPageMeta({
        setting: {},
        entity: {},
        pageKind: 'object',
        form: [{ name: 'Title' }],
        addForm: [{ name: 'Title' }],
        editForm: [{ name: 'Title' }],
        detail: [{ name: 'Title' }],
      }),
    ).toBe(true);
  });
});

describe('detectPageKind · /meta 形态', () => {
  it('原始对象页 meta（entity+setting+form）→ object', async () => {
    const p = probes({
      getPage: async () => ({ data: { entity: {}, setting: {}, form: [{ name: 'Title' }] } }),
    });
    expect(await detectPageKind('/Admin/Cube', p)).toBe('object');
  });

  it('api 层展开后的对象页（pageKind=object + addForm 数组）→ object，不误判实体', async () => {
    const p = probes({
      getPage: async () => ({
        data: {
          entity: {},
          setting: {},
          pageKind: 'object',
          form: [{ name: 'Title' }],
          addForm: [{ name: 'Title' }],
          editForm: [{ name: 'Title' }],
          detail: [{ name: 'Title' }],
        },
      }),
    });
    expect(await detectPageKind('/Admin/Cube', p)).toBe('object');
  });

  it('真实链路：后端 /api/Admin/Cube/meta 原始响应经 @newlifex/cube expandPageMeta 后仍判定为 object', async () => {
    // 2026-10-31 从本机 /api/Admin/Cube/meta 抓到的真实结构（字段已裁剪）
    const raw = {
      entity: { name: 'CubeSetting', displayName: '魔方设置' },
      setting: { enableNavbar: false, enableToolbar: true, isReadOnly: false, menuId: 24 },
      form: [
        { name: 'Debug', displayName: 'Debug', category: 'General', typeName: 'Boolean', required: false, virtual: true },
        { name: 'Title', displayName: '标题', category: 'General', typeName: 'String', required: true, virtual: true },
        { name: 'SpaSkin', displayName: 'SPA 皮肤', category: 'UI', typeName: 'String', required: false, virtual: true },
      ],
    };
    const expanded = expandPageMeta(raw)!;
    // 展开后 form 被摊成 addForm/editForm/detail，必须靠 pageKind 标记区分
    expect(Array.isArray(expanded.addForm)).toBe(true);
    const p = probes({ getPage: async () => ({ code: 0, data: expanded }) });
    expect(await detectPageKind('/Admin/Cube', p)).toBe('object');
  });
});

describe('detectPageKind', () => {
  it('Admin/Index → home（短路，不请求探测）', async () => {
    let called = false;
    const p = probes({
      getPage: async () => {
        called = true;
        return null;
      },
    });
    expect(await detectPageKind('/Admin/Index', p)).toBe('home');
    expect(called).toBe(false);
  });

  it('Admin/Db、Admin/File、Admin/Lov → custom', async () => {
    expect(await detectPageKind('/Admin/Db', probes())).toBe('custom');
    expect(await detectPageKind('admin/file', probes())).toBe('custom');
    expect(await detectPageKind('/Admin/Lov', probes())).toBe('custom');
  });

  it('服务控制器（含 vTest1 前缀）→ custom，不发探测', async () => {
    let called = false;
    const p = probes({
      getPage: async () => {
        called = true;
        return null;
      },
    });
    expect(await detectPageKind('/vTest1/Auth', p)).toBe('custom');
    expect(await detectPageKind('/vTest1/Cube', p)).toBe('custom');
    expect(await detectPageKind('/vTest1/Mfa', p)).toBe('custom');
    expect(await detectPageKind('/vTest1/Sso', p)).toBe('custom');
    expect(await detectPageKind('/vTest1/Ai', p)).toBe('custom');
    expect(await detectPageKind('/vTest1/Automation', p)).toBe('custom');
    expect(called).toBe(false);
  });

  it('Admin/Cube 不走服务控制器短路，继续探测', async () => {
    let called = false;
    const p = probes({
      getPage: async () => {
        called = true;
        throw new Error('404');
      },
    });
    expect(await detectPageKind('/Admin/Cube', p)).toBe('unknown');
    expect(called).toBe(true);
  });

  it('GetPage 有效元数据 → entity', async () => {
    const p = probes({ getPage: async () => ({ data: { list: [], setting: {} } }) });
    expect(await detectPageKind('/Admin/User', p)).toBe('entity');
  });

  it('GetPage 返回单对象元数据（entity+setting+form，无 list）→ object，不再双探', async () => {
    let probed = false;
    const p = probes({
      getPage: async () => ({
        data: {
          entity: { name: 'CubeSetting' },
          setting: { enableNavbar: false },
          form: [{ name: 'Title' }, { name: 'SpaSkin' }],
        },
      }),
      getObjectProbe: async () => {
        probed = true;
        return { fields: null, body: null };
      },
    });
    expect(await detectPageKind('/Admin/Cube', p)).toBe('object');
    expect(probed).toBe(false);
  });

  it('GetPage 失败 + 对象 GET → object', async () => {
    const p = probes({
      getPage: async () => {
        throw new Error('404');
      },
      getObjectProbe: async () => ({
        fields: [{ name: 'Debug', typeName: 'Boolean' }],
        body: { Debug: false },
      }),
    });
    expect(await detectPageKind('/Admin/Cube', p)).toBe('object');
  });

  it('GetPage 失败 + 分页列表形 GET → unknown', async () => {
    const p = probes({
      getPage: async () => {
        throw new Error('404');
      },
      getObjectProbe: async () => ({
        fields: [],
        body: { data: [{ id: 1 }], page: { totalCount: 1 } },
      }),
    });
    expect(await detectPageKind('/Admin/Unknown', p)).toBe('unknown');
  });
});
