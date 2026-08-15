<template>
  <div class="publish-page">
    <!-- ─── 页头 ───────────────────────────────────────────── -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">发布列表</h1>
        <p class="page-sub">所有 AI 改写后的草稿 · 草稿保留 10 天 · 可继续编辑</p>
      </div>
      <a-input-search
        v-model:value="searchText"
        placeholder="搜索标题、内容、标签…"
        class="search-input"
        allow-clear
      />
    </div>

    <!-- ─── 筛选栏 ──────────────────────────────────────────── -->
    <div class="filter-bar">
      <div class="tab-group">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="tab-dot" :class="tab.key" />
          {{ tab.label }}
          <span class="tab-count">{{ tab.count }}</span>
        </button>
      </div>
      <div class="bar-right">
        <a-button size="small" @click="router.push({ name: 'ai-rewrite' })">
          <PlusOutlined /> 新建改写
        </a-button>
      </div>
    </div>

    <!-- ─── 卡片网格 ─────────────────────────────────────────── -->
    <div v-if="filteredDrafts.length" class="card-grid">
      <div
        v-for="draft in filteredDrafts"
        :key="draft.id"
        class="draft-card"
      >
        <!-- 封面图区 -->
        <div class="card-cover-wrap">
          <!-- 图片 / 占位 -->
          <template v-if="getCoverUrl(draft)">
            <img
              :src="getCoverUrl(draft)"
              class="card-cover-img"
              @error="onImgError($event)"
            />
          </template>
          <div v-else class="card-cover-placeholder">
            <PictureOutlined />
          </div>

          <!-- 左上角 AI 徽章 -->
          <span v-if="getAiCount(draft) > 0" class="badge-ai">
            AI {{ getAiCount(draft) }}/{{ draft.images?.length ?? 0 }}
          </span>

          <!-- 右上角图片数 -->
          <span v-if="draft.images?.length" class="badge-img-count">
            {{ draft.images.length }} 图
          </span>

          <!-- hover 操作 -->
          <div class="card-actions-overlay">
            <a-tooltip title="继续编辑">
              <button class="cover-action-btn" @click.stop="editDraft(draft)">
                <EditOutlined />
              </button>
            </a-tooltip>
            <a-tooltip title="复制内容">
              <button class="cover-action-btn" @click.stop="copyDraft(draft)">
                <CopyOutlined />
              </button>
            </a-tooltip>
            <a-tooltip title="删除草稿">
              <button class="cover-action-btn danger" @click.stop="confirmDelete(draft)">
                <DeleteOutlined />
              </button>
            </a-tooltip>
          </div>
        </div>

        <!-- 文字区 -->
        <div class="card-body">
          <div class="card-title">{{ draft.title || '（无标题）' }}</div>
          <div class="card-meta">
            <div class="card-tags" v-if="draft.tags?.length">
              <span v-for="(t, ti) in draft.tags.slice(0, 3)" :key="ti" class="card-tag">#{{ t }}</span>
            </div>
            <span class="card-time">{{ formatTime(draft.savedAt) }}</span>
          </div>
          <!-- 过期提醒 -->
          <div v-if="isExpiringSoon(draft)" class="expire-warn">
            <ClockCircleOutlined /> 即将过期
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon"><FileTextOutlined /></div>
      <div class="empty-title">{{ searchText ? '未找到匹配的草稿' : '暂无草稿' }}</div>
      <div class="empty-sub">{{ searchText ? '换个关键词试试' : '在改写页保存后，草稿会出现在这里' }}</div>
      <a-button v-if="!searchText" type="primary" class="empty-btn" @click="router.push({ name: 'ai-rewrite' })">
        去改写一篇
      </a-button>
    </div>

    <!-- 删除确认 Modal -->
    <a-modal
      v-model:open="deleteModal.visible"
      title="删除草稿"
      ok-text="确认删除"
      cancel-text="取消"
      ok-type="danger"
      :confirm-loading="deleteModal.loading"
      @ok="doDelete"
    >
      <p>确定要删除「{{ deleteModal.draft?.title || '（无标题）' }}」吗？此操作不可撤销。</p>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  PlusOutlined, PictureOutlined, EditOutlined, CopyOutlined, DeleteOutlined,
  ClockCircleOutlined, FileTextOutlined,
} from '@ant-design/icons-vue'
import { loadDrafts, deleteDraft, getDraft } from '@/utils/draftStorage'

const router = useRouter()

// ─── 数据 ────────────────────────────────────────────────
const allDrafts  = ref([])
const searchText = ref('')
const activeTab  = ref('all')

onMounted(() => refresh())

function refresh() {
  allDrafts.value = loadDrafts()
}

// ─── 草稿状态计算 ─────────────────────────────────────────
function draftStatus(draft) {
  const imgs = draft.images ?? []
  if (!imgs.length) return 'no-image'
  if (imgs.some(i => i.status === 'error')) return 'failed'
  if (imgs.every(i => i.aiUrl)) return 'done'
  if (imgs.some(i => i.aiUrl)) return 'partial'
  return 'pending'
}

function getAiCount(draft) {
  return (draft.images ?? []).filter(i => i.aiUrl).length
}

function getCoverUrl(draft) {
  // 优先 AI 图，其次原图（可能加载失败，有 onerror 处理）
  const imgs = draft.images ?? []
  const ai = imgs.find(i => i.aiUrl)
  if (ai) return ai.aiUrl
  return imgs[0]?.src ?? ''
}

function onImgError(e) {
  // 原图 CDN 防外链加载失败 → 隐藏 img，显示父元素的占位
  e.target.style.display = 'none'
  const wrap = e.target.parentElement
  if (wrap && !wrap.querySelector('.img-err-placeholder')) {
    const ph = document.createElement('div')
    ph.className = 'img-err-placeholder'
    ph.innerHTML = '<span style="font-size:28px;color:#d1d5db">🖼️</span>'
    wrap.appendChild(ph)
  }
}

// ─── Tabs ─────────────────────────────────────────────────
const tabDefs = [
  { key: 'all',     label: '全部' },
  { key: 'pending', label: '待生成' },
  { key: 'partial', label: '部分完成' },
  { key: 'done',    label: '生成完成' },
  { key: 'failed',  label: '失败' },
]

const tabs = computed(() => tabDefs.map(t => ({
  ...t,
  count: t.key === 'all'
    ? allDrafts.value.length
    : allDrafts.value.filter(d => draftStatus(d) === t.key).length,
})))

// ─── 筛选 ────────────────────────────────────────────────
const filteredDrafts = computed(() => {
  let list = allDrafts.value
  if (activeTab.value !== 'all') {
    list = list.filter(d => draftStatus(d) === activeTab.value)
  }
  if (searchText.value.trim()) {
    const kw = searchText.value.trim().toLowerCase()
    list = list.filter(d =>
      (d.title ?? '').toLowerCase().includes(kw) ||
      (d.content ?? '').toLowerCase().includes(kw) ||
      (d.tags ?? []).some(t => t.toLowerCase().includes(kw))
    )
  }
  return list
})

// ─── 时间格式化 ──────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return `今天 ${hm}`
  if (diffDays === 1) return `昨天 ${hm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function isExpiringSoon(draft) {
  if (!draft.expiresAt) return false
  return new Date(draft.expiresAt) - Date.now() < 2 * 24 * 60 * 60 * 1000   // 不足 2 天
}

// ─── 操作 ────────────────────────────────────────────────
function editDraft(draft) {
  sessionStorage.setItem('xhs_rewrite_draft', JSON.stringify({
    draftId: draft.id,
    sourceUrl: draft.sourceUrl,
    title: draft.title,
    content: draft.content,
    images: draft.images,   // [{src, aiUrl, status}] → RewriteEdit 已兼容
  }))
  router.push({ name: 'ai-rewrite-edit' })
}

async function copyDraft(draft) {
  try {
    const tagStr = (draft.tags ?? []).map(t => `#${t}`).join(' ')
    await navigator.clipboard.writeText(`${draft.title}\n\n${draft.content}\n\n${tagStr}`.trim())
    message.success('已复制标题 + 正文 + 标签')
  } catch { message.error('复制失败') }
}

const deleteModal = ref({ visible: false, draft: null, loading: false })

function confirmDelete(draft) {
  deleteModal.value = { visible: true, draft, loading: false }
}

async function doDelete() {
  deleteModal.value.loading = true
  deleteDraft(deleteModal.value.draft.id)
  refresh()
  deleteModal.value = { visible: false, draft: null, loading: false }
  message.success('已删除')
}
</script>

<style scoped>
/* ─── 页面 ──────────────────────────────────────────────── */
.publish-page {
  padding: 24px 32px 48px;
  max-width: 1300px;
  margin: 0 auto;
}

/* ─── 页头 ──────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.header-left { min-width: 0; }

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 6px;
}

.page-sub { font-size: 14px; color: #6b7280; margin: 0; }

.search-input {
  width: 280px;
  flex-shrink: 0;
}

/* ─── 筛选栏 ────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.tab-group { display: flex; gap: 8px; flex-wrap: wrap; }

.tab-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1.5px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all .15s;
}
.tab-btn:hover { border-color: #d1d5db; color: #374151; }
.tab-btn.active { background: #1f2937; border-color: #1f2937; color: #fff; }

.tab-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #d1d5db;
}
.tab-dot.pending  { background: #faad14; }
.tab-dot.partial  { background: #1677ff; }
.tab-dot.done     { background: #52c41a; }
.tab-dot.failed   { background: #ff4d4f; }
.tab-btn.active .tab-dot { background: rgba(255,255,255,.6); }

.tab-count {
  font-size: 12px;
  opacity: .75;
}

.bar-right { flex-shrink: 0; }

/* ─── 卡片网格 ──────────────────────────────────────────── */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

/* ─── 单张卡片 ──────────────────────────────────────────── */
.draft-card {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow .2s, border-color .2s;
}
.draft-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,.1);
  border-color: #d1d5db;
}

/* 封面图区 */
.card-cover-wrap {
  position: relative;
  aspect-ratio: 3 / 4;
  background: #f5f6f7;
  overflow: hidden;
}

.card-cover-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}

.card-cover-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 36px; color: #d1d5db;
}

:deep(.img-err-placeholder) {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: #f5f6f7;
}

/* 徽章 */
.badge-ai {
  position: absolute; top: 8px; left: 8px;
  background: rgba(22,119,255,.85);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  backdrop-filter: blur(2px);
}

.badge-img-count {
  position: absolute; top: 8px; right: 8px;
  background: rgba(0,0,0,.4);
  color: #fff;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
}

/* hover 操作栏 */
.card-actions-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 8px;
  background: linear-gradient(transparent, rgba(0,0,0,.55));
  opacity: 0;
  transition: opacity .2s;
}
.draft-card:hover .card-actions-overlay { opacity: 1; }

.cover-action-btn {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,.9);
  color: #374151;
  font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.cover-action-btn:hover { background: #fff; color: #1677ff; }
.cover-action-btn.danger:hover { color: #ff4d4f; }

/* 文字区 */
.card-body { padding: 12px 14px; }

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
  min-height: 42px;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.card-tags { display: flex; gap: 4px; flex-wrap: wrap; min-width: 0; }
.card-tag { font-size: 11px; color: #ff2442; white-space: nowrap; }

.card-time { font-size: 11px; color: #9ca3af; flex-shrink: 0; }

.expire-warn {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #f59e0b;
}

/* ─── 空状态 ─────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 12px;
}

.empty-icon { font-size: 48px; color: #e5e7eb; }
.empty-title { font-size: 16px; font-weight: 500; color: #374151; }
.empty-sub { font-size: 14px; color: #9ca3af; }
.empty-btn { margin-top: 8px; background: #ff2442; border-color: #ff2442; }
</style>
