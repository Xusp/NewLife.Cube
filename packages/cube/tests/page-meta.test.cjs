// meta 展开与缓存单测（node:test + 已构建 dist）
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPageApi, clearPageMetaCache, expandPageMeta } = require('../dist/index.cjs');

const field = (name, extra = {}) => ({ name, displayName: name, typeName: 'String', ...extra });

test('expandPageMeta: 各视图直接展开字段数组', () => {
  const meta = expandPageMeta({
    entity: { name: 'Student', displayName: '学生', primaryKey: 'Id' },
    setting: { enableAdd: true },
    list: [field('Id', { primaryKey: true }), field('Name'), field('Remark', { visible: false })],
    form: [field('Name', { required: true })],
    search: [{ name: 'q', kind: 'keyword', displayName: '关键字', typeName: 'String' }, field('Name')],
    toolbar: [{ name: 'Refresh', kind: 'request', action: 'Refresh', include: ['keys'] }],
    ui: { density: 'compact' },
  });

  assert.equal(meta.entity.primaryKey, 'Id');
  assert.deepEqual(meta.list.map((f) => f.name), ['Id', 'Name', 'Remark']);
  assert.equal(meta.list[2].visible, false);
  assert.equal(meta.editForm[0].required, true);
  assert.deepEqual(meta.addForm.map((f) => f.name), ['Name']);
  assert.deepEqual(meta.detail.map((f) => f.name), ['Name']);
  assert.equal(meta.search[0].kind, 'keyword');
  assert.equal(meta.toolbar[0].action, 'Refresh');
  assert.equal(meta.ui.density, 'compact');
});

test('expandPageMeta: add/detail 省略时回退 form', () => {
  const meta = expandPageMeta({ form: [field('Name')] });

  assert.deepEqual(meta.addForm.map((f) => f.name), ['Name']);
  assert.deepEqual(meta.detail.map((f) => f.name), ['Name']);
});

test('expandPageMeta: 单对象页（无 list/search）标记 pageKind=object 并保留 form', () => {
  const form = [field('Title'), field('SpaSkin', { category: 'UI' })];
  const meta = expandPageMeta({ entity: { name: 'CubeSetting' }, setting: {}, form });

  // 对象页展开后 addForm/editForm 都是同一个 form，用数组判据已无法区分实体页，
  // 因此必须显式打 pageKind 标记，前端据此渲染 DefaultObject
  assert.equal(meta.pageKind, 'object');
  assert.equal(meta.form, form);
  assert.equal(meta.editForm, form);
  assert.equal(meta.addForm, form);
  assert.equal(meta.list, undefined);
  assert.equal(meta.search, undefined);
});

test('expandPageMeta: 实体页不打 pageKind 标记', () => {
  const meta = expandPageMeta({
    entity: { name: 'User' },
    list: [field('Id')],
    form: [field('Name')],
    search: [field('Name')],
  });

  assert.equal(meta.pageKind, undefined);
  assert.equal(meta.form, undefined);
});

test('expandPageMeta: 旧服务端数组响应原样返回', () => {
  const legacy = { setting: {}, list: [field('Name')], editForm: [field('Name')] };
  assert.equal(expandPageMeta(legacy), legacy);
});

test('getPage: scope 隔离缓存，refresh 强制请求', async () => {
  clearPageMetaCache();

  let calls = 0;
  let scope = 'u1';
  const request = async () => {
    calls++;
    return { code: 0, data: { form: { fields: [field('Name')] } } };
  };
  const api = createPageApi(request, undefined, () => scope);

  await api.getPage('/Admin/Log');
  await api.getPage('/Admin/Log');
  assert.equal(calls, 1, '同一 scope 命中缓存');

  scope = 'u2';
  await api.getPage('/Admin/Log');
  assert.equal(calls, 2, '换 scope 应重新请求');

  await api.getPage('/Admin/Log', { refresh: true });
  assert.equal(calls, 3, 'refresh 应强制请求');
});

test('updateObject: 单对象页走 PUT {type}，不需要主键', async () => {
  const calls = [];
  const request = async (options) => {
    calls.push(options);
    return { code: 0, data: options.data };
  };
  const api = createPageApi(request);

  await api.updateObject('/Admin/Core', { language: 'en' });

  assert.equal(calls[0].url, '/Admin/Core');
  assert.equal(calls[0].method, 'put');
  assert.deepEqual(calls[0].data, { language: 'en' });
});

test('update: 实体按主键 PUT，缺主键直接报错（对象页须改用 updateObject）', async () => {
  const calls = [];
  const request = async (options) => {
    calls.push(options);
    return { code: 0 };
  };
  const api = createPageApi(request);

  await api.update('/Admin/User', { Id: 7, Name: 'a' });
  assert.equal(calls[0].url, '/Admin/User/7');

  await assert.rejects(() => api.update('/Admin/User', { Name: 'a' }), /缺少主键/);
});