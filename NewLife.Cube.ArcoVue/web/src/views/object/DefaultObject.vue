<template>
  <div class="default-object">
    <div class="obj-layout">
      <!-- 左侧：配置页列表；多分组对象（如魔方设置）的分组作为其子菜单管理 -->
      <aside class="obj-side">
        <div class="obj-side__head">配置项</div>
        <a-spin :loading="pagesLoading" class="obj-side__spin">
          <a-menu
            :selected-keys="[activeKey]"
            :open-keys="openKeys"
            @menu-item-click="onMenuClick"
            @update:open-keys="(ks: string[]) => (openKeys = ks)"
          >
            <template v-for="p in objectPages" :key="p.type">
              <a-sub-menu
                v-if="p.type === currentType && isMultiCategory"
                :key="'grp-' + p.type"
                :title="p.name"
              >
                <a-menu-item v-for="c in categories" :key="p.type + '#' + c">
                  {{ c }}
                </a-menu-item>
              </a-sub-menu>
              <a-menu-item v-else :key="p.type">{{ p.name }}</a-menu-item>
            </template>
            <a-menu-item-group v-if="moreLinks.length" title="更多">
              <a-menu-item v-for="link in moreLinks" :key="'more:' + link.path">
                {{ link.title }}
              </a-menu-item>
            </a-menu-item-group>
          </a-menu>
        </a-spin>
      </aside>

      <!-- 右侧：配置表单面板；分组由左侧菜单承担，保存在表单 Footer -->
      <main class="obj-main">
        <div class="obj-surface">
          <div class="obj-header">
            <h2>{{ title }}</h2>
          </div>
          <a-alert v-if="loadError" type="warning" show-icon class="obj-alert">
            {{ loadError }}
          </a-alert>
          <a-spin :loading="loading" style="display: block">
            <a-empty v-if="!loading && !loadError && !fields.length" description="无字段" />
            <template v-else-if="!loading">
              <a-form :model="form" layout="vertical" class="obj-form">
                <div class="form-groups">
                  <template v-for="g in visibleGroups" :key="g.category">
                    <!-- 分组名由左侧菜单承担；字段直接铺在表单面板内 -->
                    <a-row
                      v-for="f in g.fields"
                      :key="f.name"
                      :gutter="16"
                      justify="center"
                    >
                      <a-col :span="isFullWidthControl(resolveControl(f)) ? 24 : 12">
                        <a-form-item
                          :label="f.displayName || f.name"
                          :tooltip="f.description || undefined"
                        >
                          <FieldInput
                            :field="f"
                            :model-value="form[f.name]"
                            :disabled="!canUpdate"
                            :type-path="currentType"
                            @update:model-value="form[f.name] = $event"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </template>
                </div>
                <div v-if="canUpdate && !loadError" class="obj-form__footer">
                  <a-button type="primary" :loading="saving" @click="save">保存</a-button>
                </div>
              </a-form>
            </template>
          </a-spin>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DefaultObject — 通用 ObjectController 配置中心（OSC-2608139feb 魔方设置优化）
 * 契约：GET type + GetFields + FieldInput + PUT；左列表（自动注入 Object 页）右配置；
 * 多分组对象的 Category 作为左子菜单管理；右侧不再重复分组标题与外框，字段流式布局（6/12）；
 * description 经 form-item tooltip 展示；保存按钮在表单 Footer。
 */
import FieldInput from '@/components/FieldInput.vue';
import { isFullWidthControl, resolveControl } from '@/core/utils/fieldControl';
import { useDefaultObject } from './useDefaultObject';

const props = defineProps<{
  type: string;
  authId?: number;
}>();

const {
  currentType,
  objectPages,
  moreLinks,
  onMoreLink,
  pagesLoading,
  loading,
  loadError,
  fields,
  categories,
  isMultiCategory,
  visibleGroups,
  activeKey,
  openKeys,
  form,
  canUpdate,
  saving,
  title,
  onSelectPage,
  onSelectCategory,
  save,
} = useDefaultObject(props);

/** 菜单点击：key 含 # 为「对象#分组」切分组，否则切配置页 */
function onMenuClick(key: string) {
  if (key.startsWith('more:')) {
    onMoreLink(key.slice('more:'.length));
    return;
  }
  const idx = key.indexOf('#');
  if (idx >= 0) {
    const type = key.slice(0, idx);
    if (type === currentType.value) onSelectCategory(key.slice(idx + 1));
    else onSelectPage(type);
  } else {
    onSelectPage(key);
  }
}
</script>

<style scoped>
.default-object {
  padding: 0 4px;
}
.obj-layout {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.obj-side {
  flex: 0 0 200px;
  padding: 12px 8px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
  min-height: 200px;
}
.obj-side__head {
  padding: 0 12px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-3);
}
.obj-side__spin {
  display: block;
}
.obj-side :deep(.arco-menu) {
  width: 100%;
  background: transparent;
}
.obj-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* 主题表面：与默认列表视图 list-surface 同源的主题变量外壳 */
.obj-surface {
  padding: 16px 0 0;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
}
.obj-header {
  margin: 0 16px 16px;
}
.obj-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}
.obj-alert {
  margin: 0 16px 16px;
}
.obj-form {
  width: 100%;
}
.form-groups {
  display: flex;
  flex-direction: column;
  padding: 0 16px 4px;
}
/* 表单 Footer：与配置项同一面板，保存右对齐 */
.obj-form__footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border-2);
}
</style>
