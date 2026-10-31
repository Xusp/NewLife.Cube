/**
 * 页面种类探测纯函数（OSC-2608139feb）。
 *
 * DynamicPage 按 typePath 探测后端契约种类：
 * - home：Admin/Index 短路（主页仪表盘，不请求任何探测）
 * - custom：Admin/Db、Admin/File、Admin/Lov，以及 Auth/Sso/Mfa/AI/Automation/CubeController 等服务控制器
 *   （菜单可挂在任意 Area，如 /vTest1/Auth；无 GetPage）
 * - entity：/meta 返回 list/search/addForm 数组 → DefaultList
 * - object：/meta 返回 form 数组且无 list → DefaultObject（ObjectController 单对象配置页，如 魔方设置）
 * - unknown：全部失败 → a-empty
 *
 * 注：master 起 ObjectController 用 `GET {type}/meta` 下发 `{entity,setting,form}`，并移除了
 * `GET {type}/GetFields`，因此对象页必须由 meta 的 form 直接判定，不能再依赖 GetFields 双探。
 */

import { isServiceControllerPath } from './servicePage';

export type PageKind = 'home' | 'custom' | 'entity' | 'object' | 'unknown';

/** 探测注入点：便于单测替代真实网络请求 */
export interface PageKindProbes {
  /** GetPage 探测（失败抛错或返回非法形） */
  getPage(typePath: string): Promise<unknown>;
  /** Object 双探：GetFields 原始值与 GET type 原始值（均未解包） */
  getObjectProbe(typePath: string): Promise<{ fields: unknown; body: unknown }>;
}

const HOME_TYPES: ReadonlySet<string> = new Set(['admin/index']);
const CUSTOM_TYPES: ReadonlySet<string> = new Set(['admin/db', 'admin/file', 'admin/lov']);

function normalizePath(typePath: string): string {
  return typePath.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

/** 是否为纯对象（非数组、非 null） */
function isPlainObjectLike(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 有效实体元数据判定（design §2.2 真值表）：
 * 非 null 对象且 list / search / addForm 至少一项为数组。
 * 兼容旧形态：仅带 setting（无 form）的对象仍按实体页处理。
 * 字符串 / 数组根 / `code`+`message` 且无 data 结构 → 假。
 */
export function isValidEntityPageMeta(meta: unknown): boolean {
  if (!isPlainObjectLike(meta)) return false;
  if (Array.isArray(meta.list) || Array.isArray(meta.search) || Array.isArray(meta.addForm)) {
    return true;
  }
  return isPlainObjectLike(meta.setting) && !Array.isArray(meta.form);
}

/**
 * 单对象配置页判定（ObjectController / ConfigController）。
 *
 * 后端 `GET {type}/meta` 对单对象页只下发 `entity + setting + form`（无 list/search/addForm），
 * 因此 form 数组即为对象页的正向标记；且其 setting 对象不能被当成实体页证据。
 */
export function isObjectPageMeta(meta: unknown): boolean {
  if (!isPlainObjectLike(meta)) return false;
  if (!Array.isArray(meta.form)) return false;
  return (
    !Array.isArray(meta.list) && !Array.isArray(meta.search) && !Array.isArray(meta.addForm)
  );
}

/** 分页列表形：`{ data: any[], page: object }`（GET 实体控制器） */
function isPagedListShape(body: unknown): boolean {
  if (!isPlainObjectLike(body)) return false;
  const data = body.data ?? body;
  return Array.isArray(data) && isPlainObjectLike(body.page);
}

/** 从可能被 `{data}` 包裹的值中解包 */
function unwrap(v: unknown): unknown {
  if (isPlainObjectLike(v) && 'data' in v) return (v as Record<string, unknown>).data;
  return v;
}

/**
 * 探测页面种类（design §2.2 真值表 + 本号新增 custom 行）。
 * @param typePath 类型路径，如 Admin/User
 * @param probes 注入的网络探测
 */
export async function detectPageKind(typePath: string, probes: PageKindProbes): Promise<PageKind> {
  const p = normalizePath(typePath);
  if (HOME_TYPES.has(p)) return 'home';
  if (CUSTOM_TYPES.has(p) || isServiceControllerPath(typePath)) return 'custom';

  let page: unknown = null;
  try {
    page = await probes.getPage(typePath);
  } catch {
    page = null;
  }
  if (isValidEntityPageMeta(unwrap(page))) return 'entity';
  if (isObjectPageMeta(unwrap(page))) return 'object';

  try {
    const { fields, body } = await probes.getObjectProbe(typePath);
    const f = unwrap(fields);
    const b = unwrap(body);
    if (Array.isArray(f) && isPlainObjectLike(b) && !isPagedListShape(b)) return 'object';
  } catch {
    /* ignore */
  }

  return 'unknown';
}
