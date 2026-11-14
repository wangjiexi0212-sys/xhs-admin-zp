<template>
  <div class="obsidian-knowledge">
    <a-alert
      type="info"
      show-icon
      message="Obsidian 是可选知识来源"
      description="这里只增量读取 Markdown，不会修改商品、现有提示词或原生成流程。同步或检索失败时，其他功能仍可正常使用。"
      style="margin-bottom: 12px"
    />

    <div class="summary">
      <a-statistic title="有效笔记" :value="status.counts?.active || 0" />
      <a-statistic title="已归档" :value="status.counts?.archived || 0" />
      <div class="sync-info">
        <div class="muted">最近同步</div>
        <div>{{ formatTime(status.latest_sync?.finished_at || status.latest_sync?.created_at) }}</div>
        <a-tag v-if="status.latest_sync" :color="status.latest_sync.status === 'done' ? 'green' : 'red'">
          {{ status.latest_sync.status === 'done' ? '成功' : status.latest_sync.status }}
        </a-tag>
      </div>
    </div>

    <a-card size="small" title="手动增量同步" style="margin-bottom: 12px">
      <a-space direction="vertical" style="width:100%">
        <input ref="fileInput" type="file" accept=".md,text/markdown" multiple @change="onFilesSelected" />
        <div class="muted">可多选 Obsidian Vault 中的 Markdown。相同内容会按哈希跳过；正式自动同步可调用同一个接口。</div>
        <a-space>
          <a-button type="primary" :loading="syncing" :disabled="!pendingFiles.length" @click="syncFiles">
            同步 {{ pendingFiles.length }} 篇笔记
          </a-button>
          <a-button :disabled="!pendingFiles.length" @click="clearFiles">清空</a-button>
        </a-space>
        <div v-if="pendingFiles.length" class="file-preview">
          <a-tag v-for="file in pendingFiles.slice(0, 20)" :key="file.path">{{ file.path }}</a-tag>
          <span v-if="pendingFiles.length > 20" class="muted">等 {{ pendingFiles.length }} 篇</span>
        </div>
      </a-space>
    </a-card>

    <a-card size="small" title="相似资料检索">
      <a-input-search
        v-model:value="query"
        placeholder="输入新企业名称，例如：某市水务集团"
        enter-button="检索"
        :loading="searching"
        @search="search"
      />
      <a-empty v-if="searched && !results.length" description="未找到相似笔记；原生成流程不会受影响" style="margin-top:16px" />
      <a-list v-else :data-source="results" size="small" style="margin-top:12px">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.title">
              <template #description>
                <div>
                  <a-tag v-if="item.company_name">{{ item.company_name }}</a-tag>
                  <a-tag v-if="item.industry" color="blue">{{ item.industry }}</a-tag>
                  <a-tag v-if="item.exam_year">{{ item.exam_year }}</a-tag>
                  <a-tag :color="item.verification_status === 'verified' ? 'green' : 'orange'">
                    {{ item.verification_status === 'verified' ? '已核实' : '待核实' }}
                  </a-tag>
                </div>
                <div class="excerpt">{{ item.excerpt }}</div>
                <div class="muted">{{ item.source_path }} · 匹配分 {{ item.score }}</div>
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getObsidianKnowledgeStatus, searchObsidianKnowledge, syncObsidianKnowledge } from '@/api/aiContentCenter'

const status = ref({ counts: {}, latest_sync: null })
const pendingFiles = ref([])
const fileInput = ref(null)
const syncing = ref(false)
const searching = ref(false)
const searched = ref(false)
const query = ref('')
const results = ref([])

async function loadStatus() {
  try {
    status.value = await getObsidianKnowledgeStatus()
  } catch (e) {
    message.warning(e.message || 'Obsidian 知识库尚未初始化')
  }
}

async function onFilesSelected(event) {
  const files = Array.from(event.target.files || []).filter(file => file.name.toLowerCase().endsWith('.md'))
  pendingFiles.value = await Promise.all(files.map(async file => ({
    path: file.webkitRelativePath || file.name,
    content: await file.text(),
  })))
}

async function syncFiles() {
  if (!pendingFiles.value.length) return
  syncing.value = true
  try {
    const result = await syncObsidianKnowledge({ files: pendingFiles.value })
    message.success(`同步完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`)
    clearFiles()
    await loadStatus()
  } catch (e) {
    message.error(e.message || '同步失败；现有生成流程未受影响')
  } finally {
    syncing.value = false
  }
}

async function search() {
  const value = query.value.trim()
  if (!value) return
  searching.value = true
  searched.value = true
  try {
    const data = await searchObsidianKnowledge({ company_name: value, limit: 10 })
    results.value = data.results || []
  } catch (e) {
    results.value = []
    message.error(e.message || '检索失败；可继续使用原生成流程')
  } finally {
    searching.value = false
  }
}

function clearFiles() {
  pendingFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
}

function formatTime(value) {
  return value ? new Date(Number(value)).toLocaleString() : '暂无'
}

onMounted(loadStatus)
</script>

<style scoped>
.summary { display:flex; gap:36px; align-items:center; padding:8px 4px 16px; }
.sync-info { min-width:180px; }
.muted { color:#8c8c8c; font-size:12px; }
.file-preview { display:flex; flex-wrap:wrap; gap:6px; }
.excerpt { margin:8px 0; color:#4b5563; line-height:1.6; }
</style>
