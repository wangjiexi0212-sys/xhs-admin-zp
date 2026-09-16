<template>
  <div class="ai-content-assets">
    <div class="assets-toolbar">
      <a-radio-group v-model:value="activeStatus" button-style="solid" size="small" @change="loadNotes">
        <a-radio-button value="">全部</a-radio-button>
        <a-radio-button value="draft">草稿</a-radio-button>
        <a-radio-button value="completed">已完成</a-radio-button>
        <a-radio-button value="pending_publish">待发布</a-radio-button>
        <a-radio-button value="published">已发布</a-radio-button>
        <a-radio-button value="discarded">已废弃</a-radio-button>
      </a-radio-group>
      <a-button size="small" :loading="loading" @click="loadNotes">刷新</a-button>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!notes.length && !loading" description="暂无笔记资产" />
      <div v-else class="notes-list">
        <a-card
          v-for="note in notes"
          :key="note.id"
          size="small"
          class="note-asset-card"
          :bordered="false"
        >
          <template #title>
            <div class="asset-card-title">
              <a-tag :color="statusColor(note.status)">{{ statusLabel(note.status) }}</a-tag>
              <span>{{ note.title || '未命名笔记' }}</span>
            </div>
          </template>
          <template #extra>
            <a-space>
              <a-select
                :value="note.status"
                size="small"
                style="width: 110px"
                @change="val => changeStatus(note, val)"
              >
                <a-select-option value="draft">草稿</a-select-option>
                <a-select-option value="completed">已完成</a-select-option>
                <a-select-option value="pending_publish">待发布</a-select-option>
                <a-select-option value="published">已发布</a-select-option>
                <a-select-option value="discarded">废弃</a-select-option>
              </a-select>
              <a-button size="small" @click="openDetail(note)">详情</a-button>
              <a-button size="small" @click="openScripts(note)">图片脚本</a-button>
            </a-space>
          </template>

          <div class="asset-meta-row">
            <span class="muted">{{ formatTime(note.created_at) }}</span>
            <a-tag v-if="note.style">{{ note.style }}</a-tag>
            <a-tag v-if="note.word_count">{{ note.word_count }}字</a-tag>
            <span v-if="imageCountMap[note.id]" class="muted">{{ imageCountMap[note.id] }}张图</span>
          </div>

          <div v-if="note.content" class="asset-content-preview">
            {{ note.content.slice(0, 120) }}{{ note.content.length > 120 ? '…' : '' }}
          </div>

          <div v-if="parseTags(note.tags_json).length" class="asset-tags">
            <a-tag v-for="tag in parseTags(note.tags_json)" :key="tag" color="blue">{{ tag }}</a-tag>
          </div>

          <!-- 已生成图片缩略 -->
          <div v-if="imageMap[note.id]?.length" class="asset-images">
            <img
              v-for="img in imageMap[note.id].slice(0, 4)"
              :key="img.id"
              :src="img.url"
              class="asset-thumb"
              @click="previewImage(img.url)"
            />
            <span v-if="imageMap[note.id].length > 4" class="muted more-images">
              +{{ imageMap[note.id].length - 4 }}
            </span>
          </div>
        </a-card>
      </div>
    </a-spin>

    <!-- 笔记详情 Drawer -->
    <a-drawer
      v-model:open="detailOpen"
      title="笔记详情"
      placement="right"
      :width="520"
    >
      <div v-if="detailNote" class="detail-body">
        <div class="detail-section">
          <div class="detail-label">标题</div>
          <div class="detail-title">{{ detailNote.title || '—' }}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">正文</div>
          <pre class="detail-content">{{ detailNote.content }}</pre>
        </div>
        <div class="detail-section">
          <div class="detail-label">标签</div>
          <div class="asset-tags">
            <a-tag v-for="tag in parseTags(detailNote.tags_json)" :key="tag" color="blue">{{ tag }}</a-tag>
          </div>
        </div>
        <a-collapse v-if="parseContentBasis(detailNote.content_basis_json).length" size="small">
          <a-collapse-panel key="b" header="内容依据">
            <div v-for="(b, i) in parseContentBasis(detailNote.content_basis_json)" :key="i" class="basis-item">
              <strong>{{ b.name }}</strong>
              <span v-if="b.page" class="muted"> P{{ b.page }}</span>
              <div class="muted">{{ b.source }}</div>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </a-drawer>

    <!-- 图片预览 -->
    <a-modal
      v-model:open="previewOpen"
      :footer="null"
      :body-style="{ padding: 0, lineHeight: 0, background: '#000' }"
      centered
      width="auto"
    >
      <img v-if="previewOpen" :src="previewUrl" style="max-width:90vw;max-height:90vh;display:block;object-fit:contain" />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { getAiNotes, updateAiNote, getGeneratedImages } from '@/api/aiContentCenter'

const props = defineProps({
  productId: { type: [Number, String], required: true },
})

const emit = defineEmits(['open-scripts'])

const loading = ref(false)
const notes = ref([])
const activeStatus = ref('')
const imageMap = ref({})
const imageCountMap = ref({})
const detailOpen = ref(false)
const detailNote = ref(null)
const previewOpen = ref(false)
const previewUrl = ref('')

function statusColor(s) {
  return { draft: 'default', completed: 'green', pending_publish: 'gold',
    published: 'blue', discarded: 'red' }[s] || 'default'
}

function statusLabel(s) {
  return { draft: '草稿', completed: '已完成', pending_publish: '待发布',
    published: '已发布', discarded: '已废弃' }[s] || s
}

function parseTags(json) {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : [] } catch { return [] }
}

function parseContentBasis(json) {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : [] } catch { return [] }
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

async function loadNotes() {
  loading.value = true
  try {
    const res = await getAiNotes(props.productId, { status: activeStatus.value })
    notes.value = res.notes || []
    await loadImagesForNotes()
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadImagesForNotes() {
  for (const note of notes.value) {
    try {
      const res = await getGeneratedImages(note.id)
      const imgs = (res.images || []).filter(i => i.status === 'done' && i.url)
      imageMap.value = { ...imageMap.value, [note.id]: imgs }
      imageCountMap.value = { ...imageCountMap.value, [note.id]: imgs.length }
    } catch { /* non-critical */ }
  }
}

async function changeStatus(note, val) {
  try {
    await updateAiNote(note.id, { status: val })
    note.status = val
  } catch (e) {
    message.error(e.message || '更新失败')
  }
}

function openDetail(note) {
  detailNote.value = note
  detailOpen.value = true
}

function openScripts(note) {
  emit('open-scripts', note)
}

function previewImage(url) {
  previewUrl.value = url
  previewOpen.value = true
}

onMounted(loadNotes)

defineExpose({ loadNotes })
</script>

<style scoped>
.ai-content-assets {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.assets-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.note-asset-card {
  background: #fafafa;
}

.asset-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}

.asset-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.asset-content-preview {
  color: #555;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 8px;
}

.asset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.asset-images {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}

.asset-thumb {
  height: 60px;
  width: 60px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ebebeb;
  cursor: zoom-in;
}

.more-images {
  font-size: 13px;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #1f2937;
}

.detail-section {
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 10px;
}

.detail-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.detail-title {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
}

.detail-content {
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.8;
  margin: 0;
}

.basis-item {
  color: #374151;
  margin-bottom: 8px;
  font-size: 13px;
}

.muted {
  color: #6b7280;
  font-size: 12px;
}
</style>
