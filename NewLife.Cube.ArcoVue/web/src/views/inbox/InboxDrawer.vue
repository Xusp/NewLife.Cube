<template>
  <a-drawer
    :visible="visible"
    :width="420"
    :footer="false"
    unmount-on-close
    title="站内通知"
    placement="right"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="inbox-toolbar">
      <span class="inbox-toolbar__meta">
        共 {{ total }} 条
        <template v-if="unreadCount"> · {{ unreadCount }} 未读</template>
      </span>
      <a-button
        type="text"
        size="mini"
        :loading="marking"
        :disabled="!unreadCount"
        @click="markAllRead"
      >
        全部已读
      </a-button>
    </div>

    <a-spin :loading="loading" class="inbox-spin">
      <a-empty v-if="!groups.length" description="暂无消息" />
      <a-timeline v-else class="inbox-tl">
        <a-timeline-item v-for="g in groups" :key="g.key">
          <template #dot>
            <span class="inbox-group-dot">
              <icon-park :type="INBOX_BUCKET_ICONS[g.key]" />
            </span>
          </template>
          <div class="inbox-group">
            <div class="inbox-group__title">{{ g.label }}</div>
            <a-timeline class="inbox-sub-tl">
              <a-timeline-item v-for="(m, i) in g.items" :key="m.id">
                <template #dot>
                  <a-tooltip :content="inboxTypeLabel(m.action)">
                    <span class="inbox-badge" :class="{ 'inbox-badge--read': m.read }">{{
                      inboxTypeInitial(m.action)
                    }}</span>
                  </a-tooltip>
                </template>
                <div
                  class="inbox-item"
                  :class="{ 'inbox-item--unread': !m.read }"
                  role="button"
                  tabindex="0"
                  @click="onItemClick(m)"
                  @keydown.enter="onItemClick(m)"
                >
                  <a-tooltip
                    v-if="m.timeText"
                    :content="m.timeText"
                    :disabled="
                      inboxAxisLabel(m.timeText, inboxAxisFirstOfDay(g.items[i - 1]?.timeText, m.timeText)) ===
                      m.timeText
                    "
                  >
                    <time class="inbox-item__time">{{
                      inboxAxisLabel(m.timeText, inboxAxisFirstOfDay(g.items[i - 1]?.timeText, m.timeText))
                    }}</time>
                  </a-tooltip>
                  <a-tooltip
                    :content="m.title || '（无标题）'"
                    :disabled="(m.title || '').length <= 18"
                  >
                    <div class="inbox-item__title">{{ m.title || '（无标题）' }}</div>
                  </a-tooltip>
                  <a-tooltip v-if="m.content" :content="m.content" :disabled="m.content.length <= 36">
                    <div class="inbox-item__content">{{ m.content }}</div>
                  </a-tooltip>
                </div>
              </a-timeline-item>
            </a-timeline>
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { inboxAxisFirstOfDay, inboxAxisLabel, inboxTypeInitial, inboxTypeLabel } from '@/core/utils/inboxBucket';
import { INBOX_BUCKET_ICONS } from '@/core/utils/iconRegistry';
import { useInboxDrawer } from './useInboxDrawer';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ 'update:visible': [boolean] }>();

const visibleRef = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
});

const { loading, marking, groups, unreadCount, total, markAllRead, onItemClick } = useInboxDrawer(
  visibleRef,
);

defineExpose({ unreadCount });
</script>

<style scoped>
.inbox-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: -4px 0 8px;
}
.inbox-toolbar__meta {
  font-size: var(--cube-font-size-meta);
  color: var(--color-text-3);
}
.inbox-spin {
  width: 100%;
  min-height: 120px;
}
.inbox-tl {
  padding-left: 0;
}
.inbox-tl :deep(.arco-timeline-item) {
  min-height: 0;
}
.inbox-group-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  color: rgb(var(--primary-6));
}
.inbox-sub-tl {
  margin-top: 4px;
  /* 外层圆点列 6px + 内容左距 16px，拉回后内层轴线与分组图标重合 */
  margin-left: -22px;
}
.inbox-sub-tl :deep(.arco-timeline-item) {
  min-height: 0;
  padding-bottom: 0;
}
.inbox-sub-tl :deep(.arco-timeline-item-content) {
  min-width: 0;
  margin-bottom: 2px;
}
.inbox-sub-tl :deep(.arco-timeline-item-dot-custom) {
  background: transparent;
}
.inbox-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary-light-1);
  color: rgb(var(--primary-6));
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}
.inbox-badge--read {
  opacity: 0.55;
}
.inbox-group__title {
  font-size: var(--cube-font-size-body);
  font-weight: var(--cube-font-weight-medium);
  line-height: 22px;
  color: var(--color-text-1);
}
.inbox-item {
  min-width: 0;
  margin: 0 0 2px;
  padding: 0 8px 2px 0;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
}
.inbox-item__time {
  display: block;
  margin-bottom: 2px;
  font-size: var(--cube-font-size-meta);
  line-height: 18px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
}
.inbox-item:hover,
.inbox-item:focus-visible {
  background: var(--color-fill-2);
}
.inbox-group .inbox-item:last-child {
  margin-bottom: 0;
}
.inbox-item__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--cube-font-size-body);
  font-weight: var(--cube-font-weight-medium);
  line-height: 22px;
  color: var(--color-text-1);
}
.inbox-item:not(.inbox-item--unread) .inbox-item__title {
  font-weight: 400;
  color: var(--color-text-2);
}
.inbox-item__content {
  margin-top: 2px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: var(--cube-font-size-meta);
  line-height: 20px;
  color: var(--color-text-3);
  word-break: break-word;
}
</style>
