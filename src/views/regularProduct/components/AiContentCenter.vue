<template>
  <div class="ai-content-center">
    <div class="center-header">
      <div>
        <div class="center-title">AI内容创作中心</div>
        <div class="center-sub">围绕当前常规商品生成小红书内容，并为长 PDF / 题库解析保留任务链路</div>
      </div>
      <a-space>
        <a-dropdown>
          <a-button type="primary" :loading="quickCreating">快速AI创作</a-button>
          <template #overlay>
            <a-menu @click="({ key }) => doQuickCreate(key)">
              <a-menu-item key="traffic">流量型</a-menu-item>
              <a-menu-item key="search">搜索型</a-menu-item>
              <a-menu-item key="collect">收藏型</a-menu-item>
              <a-menu-item key="professional">专业型</a-menu-item>
              <a-menu-item key="convert">转化型</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-button :loading="loading" @click="refreshAll">刷新</a-button>
        <a-button
          type="primary"
          :loading="submitting"
          :disabled="jobRunning"
          @click="createJob('note_generate')"
        >
          生成笔记
        </a-button>
        <a-dropdown>
          <a-button :disabled="jobRunning || submitting">更多任务</a-button>
          <template #overlay>
            <a-menu @click="({ key }) => createJob(key)">
              <a-menu-item key="full_pipeline">完整链路</a-menu-item>
              <a-menu-item key="pdf_scan">扫描素材</a-menu-item>
              <a-menu-item key="question_parse">解析题库</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-space>
    </div>

    <a-alert
      v-if="!activeLlm"
      type="warning"
      show-icon
      message="请先在「系统设置 → 大模型」中启用模型配置"
      style="margin-bottom: 12px"
    />

    <div class="summary-row">
      <div class="summary-item">
        <span class="summary-label">素材</span>
        <strong>{{ stats.assets || 0 }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">题目</span>
        <strong>{{ stats.questions || 0 }}</strong>
      </div>
      <div class="summary-item wide">
        <span class="summary-label">最近任务</span>
        <strong>{{ latestJob ? jobTypeText(latestJob.job_type) : '暂无' }}</strong>
      </div>
    </div>

    <a-card v-if="latestJob" size="small" class="job-card" :bordered="false">
      <div class="job-top">
        <a-space>
          <a-tag :color="statusColor(latestJob.status)">{{ statusText(latestJob.status) }}</a-tag>
          <span class="job-name">{{ jobTypeText(latestJob.job_type) }}</span>
          <span class="muted">{{ formatTime(latestJob.created_at) }}</span>
        </a-space>
        <a-button
          v-if="jobRunning"
          size="small"
          danger
          :loading="canceling"
          @click="cancelJob"
        >
          取消
        </a-button>
      </div>
      <a-progress :percent="latestJob.progress || 0" size="small" />
      <div v-if="latestJob.error" class="error-text">{{ latestJob.error }}</div>
      <div v-if="steps.length" class="step-list">
        <div v-for="step in steps" :key="step.id" class="step-row">
          <a-tag :color="statusColor(step.status)">{{ statusText(step.status) }}</a-tag>
          <span>{{ step.step_name }}</span>
          <span v-if="stepSummary(step)" class="muted">{{ stepSummary(step) }}</span>
          <span v-if="step.error" class="error-text">{{ step.error }}</span>
        </div>
      </div>
    </a-card>

    <a-tabs v-model:activeKey="activeTab" size="small">
      <a-tab-pane key="sources" tab="网盘资料">
        <div class="source-actions">
          <a-space>
            <a-button :loading="sourceLoading" @click="loadSourceTree">加载网盘目录</a-button>
            <a-button type="primary" :loading="analyzing" :disabled="!selectedPdfFiles.length" @click="analyzeSelectedPdfs">
              分析选中资料（{{ selectedPdfFiles.length }}）
            </a-button>
          </a-space>
          <span class="muted">仅 PDF 会进入 Phase 1 分析；文件夹可展开后选择其中 PDF。</span>
        </div>
        <a-alert
          v-if="analyzingTip"
          type="info"
          show-icon
          :message="analyzingTip"
          style="margin-bottom: 12px"
        />
        <a-alert
          v-if="sourceError"
          type="error"
          show-icon
          :message="sourceError"
          style="margin-bottom: 12px"
        />
        <a-spin :spinning="sourceLoading">
          <a-empty v-if="!sourceTree.length && !sourceLoading" description="尚未加载网盘目录" />
          <a-tree
            v-else
            v-model:checkedKeys="checkedKeys"
            checkable
            block-node
            :tree-data="sourceTree"
            :load-data="loadSourceChildren"
          >
            <template #title="node">
              <span :class="{ 'pdf-title': node.isPdf }">
                {{ node.isLeaf ? '📄' : '📁' }} {{ node.title }}
                <a-tag v-if="node.isPdf" color="red" style="margin-left:6px">PDF</a-tag>
              </span>
            </template>
          </a-tree>
        </a-spin>
        <a-divider v-if="assets.length" style="margin: 16px 0 12px" />
        <div v-if="assets.length" class="asset-list">
          <div class="asset-title">已分析资料</div>
          <a-collapse size="small">
            <a-collapse-panel v-for="asset in assets" :key="asset.id" :header="asset.title || asset.baidu_path">
              <div class="asset-meta-row">
                <span class="muted">{{ asset.baidu_path }}</span>
                <a-space>
                  <a-tag :color="assetStatusColor(asset.meta?.status)">
                    {{ assetStatusText(asset.meta?.status) }}
                  </a-tag>
                  <a-button
                    v-if="asset.meta?.status === 'failed'"
                    size="small"
                    type="link"
                    danger
                    :loading="retryingAssetId === asset.id"
                    @click.stop="retryAsset(asset)"
                  >
                    重试
                  </a-button>
                </a-space>
              </div>
              <div v-if="asset.meta?.error" class="error-text">{{ asset.meta.error }}</div>
              <div class="asset-extra">
                <a-tag v-if="asset.meta?.doc_type">{{ docTypeText(asset.meta.doc_type) }}</a-tag>
                <span v-if="asset.meta?.page_count" class="muted">{{ asset.meta.page_count }} 页</span>
              </div>
              <div class="chapter-list">
                <a-tag v-for="ch in asset.chapters || []" :key="ch.id">
                  {{ ch.title }}<span v-if="ch.start_page"> P{{ ch.start_page }}</span>
                </a-tag>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </a-tab-pane>

      <a-tab-pane key="knowledge" tab="内容知识库">
        <div class="question-toolbar">
          <a-input-search
            v-model:value="knowledgeKeyword"
            placeholder="搜索知识点 / 模块 / 章节"
            allow-clear
            style="width: 260px"
            @search="searchKnowledge"
          />
        </div>
        <a-table
          row-key="id"
          size="small"
          :columns="knowledgeColumns"
          :data-source="knowledgeList"
          :loading="knowledgeLoading"
          :pagination="knowledgePagination"
          @change="onKnowledgeTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button
                size="small"
                type="link"
                :loading="sourceLoadingId === record.id"
                @click="openKnowledgeSources(record)"
              >
                来源
              </a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="outputs" tab="内容产物">
        <a-empty v-if="!outputs.length && !loading" description="暂无内容产物" />
        <div v-else class="output-list">
          <a-card
            v-for="item in outputs"
            :key="item.id"
            size="small"
            class="output-card"
            :bordered="false"
          >
            <template #title>
              <span>{{ item.title || '未命名笔记' }}</span>
            </template>
            <template #extra>
              <a-space>
                <a-tag>{{ item.output_type }}</a-tag>
                <a-button size="small" :loading="savingId === item.id" @click="saveOutput(item)">保存</a-button>
              </a-space>
            </template>
            <a-input v-model:value="item.title" placeholder="标题" style="margin-bottom: 8px" />
            <a-textarea
              v-model:value="item.content"
              placeholder="正文"
              :auto-size="{ minRows: 4, maxRows: 10 }"
              style="margin-bottom: 8px"
            />
            <a-select
              v-model:value="item.tags"
              mode="tags"
              placeholder="标签"
              style="width: 100%"
            />
          </a-card>
        </div>
      </a-tab-pane>

      <a-tab-pane key="questions" tab="题库解析">
        <div class="question-toolbar">
          <a-input-search
            v-model:value="questionKeyword"
            placeholder="搜索题干 / 答案 / 解析"
            allow-clear
            style="width: 260px"
            @search="searchQuestions"
          />
        </div>
        <a-table
          row-key="id"
          size="small"
          :columns="questionColumns"
          :data-source="questions"
          :loading="questionLoading"
          :pagination="questionPagination"
          @change="onQuestionTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button size="small" type="link" @click="openQuestionDetail(record)">
                详情
              </a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="ai-topics" tab="AI选题">
        <AiTopicCenter
          v-if="resolvedProductId"
          ref="topicCenterRef"
          :product-id="resolvedProductId"
          @generate-note="onGenerateNote"
        />
      </a-tab-pane>

      <a-tab-pane key="content-assets" tab="内容资产">
        <AiContentAssets
          v-if="resolvedProductId"
          ref="contentAssetsRef"
          :product-id="resolvedProductId"
          @open-scripts="onOpenScripts"
        />
      </a-tab-pane>
    </a-tabs>

    <AiNoteEditor
      v-model:open="noteEditorOpen"
      :topic="noteEditorTopic"
      :product-id="resolvedProductId"
      :initial-note="null"
      @note-saved="onNoteSaved"
      @open-scripts="onOpenScripts"
    />

    <AiImageScripts
      v-model:open="imageScriptsOpen"
      :note="imageScriptsNote"
      :product-id="resolvedProductId"
    />

    <a-modal
      v-model:open="sourceModalOpen"
      width="760px"
      :title="sourceModalTitle"
      :footer="null"
    >
      <a-empty v-if="!knowledgeSources.length" description="暂无来源记录" />
      <div v-else class="source-list">
        <div v-for="item in knowledgeSources" :key="item.id" class="source-item">
          <div class="source-head">
            <strong>{{ item.asset_title || '未知资料' }}</strong>
            <a-tag v-if="item.source_page">P{{ item.source_page }}</a-tag>
          </div>
          <div class="muted">{{ item.asset_path }}</div>
          <div v-if="item.source_section" class="muted">章节：{{ item.source_section }}</div>
          <div class="source-text">{{ item.source_text }}</div>
        </div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="questionModalOpen"
      width="760px"
      title="题目详情"
      :footer="null"
    >
      <div v-if="selectedQuestion" class="question-detail">
        <div class="detail-meta">
          <a-tag>{{ selectedQuestion.question_type || 'unknown' }}</a-tag>
          <a-tag v-if="selectedQuestion.question_no">第 {{ selectedQuestion.question_no }} 题</a-tag>
          <a-tag v-if="selectedQuestion.page_no">P{{ selectedQuestion.page_no }}</a-tag>
          <a-tag v-if="selectedQuestion.chunk_index !== null && selectedQuestion.chunk_index !== undefined">
            chunk {{ selectedQuestion.chunk_index }}
          </a-tag>
        </div>
        <div v-if="selectedQuestion.asset_title || selectedQuestion.asset_path" class="detail-source">
          <strong>{{ selectedQuestion.asset_title || '未知资料' }}</strong>
          <div class="muted">{{ selectedQuestion.asset_path }}</div>
        </div>
        <div class="detail-block">
          <div class="detail-title">题干</div>
          <div class="detail-text">{{ selectedQuestion.question }}</div>
        </div>
        <div v-if="selectedQuestion.answer" class="detail-block">
          <div class="detail-title">答案</div>
          <div class="detail-text">{{ selectedQuestion.answer }}</div>
        </div>
        <div v-if="selectedQuestion.explanation" class="detail-block">
          <div class="detail-title">解析</div>
          <div class="detail-text">{{ selectedQuestion.explanation }}</div>
        </div>
        <div v-if="selectedQuestion.raw_text" class="detail-block">
          <div class="detail-title">原文</div>
          <div class="source-text">{{ selectedQuestion.raw_text }}</div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { useLlmStore } from '@/stores/llm'
import {
  analyzeAiContentDocuments,
  cancelAiContentJob,
  createAiContentJob,
  getAiContentAssets,
  getAiContentKnowledge,
  getAiContentKnowledgeSources,
  getAiContentJob,
  getAiContentOverview,
  getAiContentQuestions,
  updateAiContentOutput,
  generateAiTopics,
} from '@/api/aiContentCenter'
import { getBaiduFiles } from '@/api/baidu'
import { getToken } from '@/api/request'
import AiTopicCenter from './AiTopicCenter.vue'
import AiNoteEditor from './AiNoteEditor.vue'
import AiImageScripts from './AiImageScripts.vue'
import AiContentAssets from './AiContentAssets.vue'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const props = defineProps({
  productId: { type: [Number, String], required: true },
  diskPath: { type: String, default: '' },
})

const router = useRouter()
const llmStore = useLlmStore()
const activeLlm = computed(() => llmStore.active)
const resolvedProductId = computed(() => {
  const n = Number(props.productId)
  return Number.isInteger(n) && n > 0 ? n : ''
})

const loading = ref(false)
const submitting = ref(false)
const canceling = ref(false)
const latestJob = ref(null)
const steps = ref([])
const outputs = ref([])
const stats = reactive({ assets: 0, questions: 0 })
const activeTab = ref('sources')
let pollTimer = null
let setupWarned = false

const sourceLoading = ref(false)
const sourceError = ref('')
const sourceTree = ref([])
const checkedKeys = ref([])
const analyzing = ref(false)
const analyzingTip = ref('')
const assets = ref([])
const retryingAssetId = ref(0)
let pdfjsLib = null

const knowledgeKeyword = ref('')
const knowledgeLoading = ref(false)
const knowledgeList = ref([])
const sourceLoadingId = ref(0)
const sourceModalOpen = ref(false)
const sourceModalTitle = ref('知识来源')
const knowledgeSources = ref([])
const knowledgePagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
})

const questionKeyword = ref('')
const questionLoading = ref(false)
const questions = ref([])
const questionModalOpen = ref(false)
const selectedQuestion = ref(null)
const questionPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
})

const questionColumns = [
  { title: '序号', dataIndex: 'question_no', key: 'question_no', width: 80 },
  { title: '类型', dataIndex: 'question_type', key: 'question_type', width: 110 },
  { title: '题目', dataIndex: 'question', key: 'question', ellipsis: true },
  { title: '答案', dataIndex: 'answer', key: 'answer', ellipsis: true },
  { title: '页码', dataIndex: 'page_no', key: 'page_no', width: 80 },
  { title: '操作', key: 'action', width: 80 },
]

const knowledgeColumns = [
  { title: '模块', dataIndex: 'module', key: 'module', width: 100 },
  { title: '章节', dataIndex: 'chapter', key: 'chapter', width: 160, ellipsis: true },
  { title: '知识点', dataIndex: 'name', key: 'name', width: 180, ellipsis: true },
  { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
  { title: '重要度', dataIndex: 'importance', key: 'importance', width: 90 },
  { title: '操作', key: 'action', width: 80 },
]

const selectedPdfFiles = computed(() => {
  const checked = new Set(Array.isArray(checkedKeys.value) ? checkedKeys.value : checkedKeys.value.checked || [])
  const files = []
  collectPdfNodes(sourceTree.value, checked, files)
  return files
})

const jobRunning = computed(() => {
  const status = latestJob.value?.status
  return status === 'pending' || status === 'running'
})

async function loadOverview() {
  if (!resolvedProductId.value) return
  loading.value = true
  try {
    const res = await getAiContentOverview(resolvedProductId.value)
    latestJob.value = res.latest_job || null
    outputs.value = (res.outputs || []).map(normalizeOutput)
    stats.assets = res.stats?.assets || 0
    stats.questions = res.stats?.questions || 0
    if (res.setup_required && !setupWarned) {
      setupWarned = true
      message.warning('AI内容创作中心数据库表尚未初始化，请先执行数据库迁移')
    }
    if (latestJob.value?.id) await loadJob(latestJob.value.id)
    if (jobRunning.value) startPolling(latestJob.value.id)
  } catch (e) {
    message.error(e.message || '加载 AI 内容中心失败')
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  if (!resolvedProductId.value) return
  await loadOverview()
  await Promise.all([loadAssets(), loadKnowledge(), loadQuestions()])
}

async function createJob(jobType) {
  if (!resolvedProductId.value) return
  const active = activeLlm.value
  if (!active) {
    Modal.warning({
      title: '提示',
      content: '请先设置使用中的大模型',
      okText: '去设置',
      onOk: () => router.push('/system/llm'),
    })
    return
  }

  submitting.value = true
  try {
    const res = await createAiContentJob(resolvedProductId.value, {
      job_type: jobType,
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
    })
    latestJob.value = res
    await loadJob(res.id)
    startPolling(res.id)
  } catch (e) {
    message.error(e.message || '提交任务失败')
  } finally {
    submitting.value = false
  }
}

async function loadJob(jobId) {
  try {
    const res = await getAiContentJob(jobId)
    latestJob.value = res
    steps.value = res.steps || []
    if (!jobRunning.value) {
      stopPolling()
      await loadOverviewWithoutJob()
      await Promise.all([loadAssets(), loadKnowledge(), loadQuestions()])
    }
  } catch { /* ignore polling errors */ }
}

async function loadOverviewWithoutJob() {
  if (!resolvedProductId.value) return
  const res = await getAiContentOverview(resolvedProductId.value)
  outputs.value = (res.outputs || []).map(normalizeOutput)
  stats.assets = res.stats?.assets || 0
  stats.questions = res.stats?.questions || 0
}

function startPolling(jobId) {
  stopPolling()
  pollTimer = setInterval(() => loadJob(jobId), 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function cancelJob() {
  if (!latestJob.value?.id) return
  canceling.value = true
  try {
    await cancelAiContentJob(latestJob.value.id)
    await loadJob(latestJob.value.id)
    await loadAssets()
    message.success('已取消')
  } catch (e) {
    message.error(e.message || '取消失败')
  } finally {
    canceling.value = false
  }
}

async function loadSourceTree() {
  if (!props.diskPath) {
    sourceError.value = '当前商品未配置网盘路径'
    return
  }
  sourceLoading.value = true
  sourceError.value = ''
  try {
    const res = await getBaiduFiles(props.diskPath)
    const files = (res.files || []).sort((a, b) => b.isdir - a.isdir)
    sourceTree.value = files.map(fileToNode)
  } catch (e) {
    sourceError.value = e.message || '加载网盘目录失败'
  } finally {
    sourceLoading.value = false
  }
}

function loadSourceChildren(treeNode) {
  return new Promise((resolve) => {
    if (treeNode.children?.length || treeNode.isLeaf) {
      resolve()
      return
    }
    getBaiduFiles(treeNode.key)
      .then(res => {
        const children = (res.files || []).sort((a, b) => b.isdir - a.isdir).map(fileToNode)
        injectChildren(sourceTree.value, treeNode.key, children)
        sourceTree.value = [...sourceTree.value]
      })
      .catch(e => {
        message.error(e.message || '加载子目录失败')
      })
      .finally(resolve)
  })
}

function fileToNode(file) {
  const isPdf = file.isdir !== 1 && /\.pdf$/i.test(file.name || '')
  return {
    title: file.name,
    key: file.path,
    isLeaf: file.isdir !== 1,
    disabled: file.isdir !== 1 && !isPdf,
    isPdf,
    path: file.path,
    name: file.name,
  }
}

function injectChildren(nodes, key, children) {
  for (const node of nodes) {
    if (node.key === key) {
      node.children = children
      return true
    }
    if (node.children?.length && injectChildren(node.children, key, children)) return true
  }
  return false
}

function collectPdfNodes(nodes, checked, out) {
  for (const node of nodes) {
    if (node.isPdf && checked.has(node.key)) {
      out.push({ name: node.name || node.title, path: node.path || node.key })
    }
    if (node.children?.length) collectPdfNodes(node.children, checked, out)
  }
}

async function analyzeSelectedPdfs() {
  if (!resolvedProductId.value) return
  const pdfs = selectedPdfFiles.value
  if (!pdfs.length) {
    message.warning('请先选择 PDF')
    return
  }
  analyzing.value = true
  analyzingTip.value = `正在读取 0/${pdfs.length} 个 PDF`
  try {
    const docs = []
    for (let i = 0; i < pdfs.length; i++) {
      const pdf = pdfs[i]
      analyzingTip.value = `正在读取 ${i + 1}/${pdfs.length}：${pdf.name || pdf.path}`
      const pages = await extractPdfText(pdf.path)
      docs.push({ ...pdf, pages })
    }
    analyzingTip.value = 'PDF 文本读取完成，正在提交后端解析'
    const payload = { documents: docs }
    const llm = buildLlmPayload()
    if (llm) payload.llm = llm
    const res = await analyzeAiContentDocuments(resolvedProductId.value, payload)
    latestJob.value = res
    message.success(res.reused ? '已有资料分析任务正在运行，已接入进度' : '分析任务已提交，正在后台解析')
    await loadJob(res.id)
    startPolling(res.id)
    await loadAssets()
    activeTab.value = 'sources'
  } catch (e) {
    message.error(e.message || '分析失败')
  } finally {
    analyzing.value = false
    analyzingTip.value = ''
  }
}

function buildLlmPayload() {
  const active = activeLlm.value
  if (!active?.provider || !active?.api_key || !active?.default_model) return null
  return {
    provider: active.provider,
    api_format: active.api_format,
    api_key: active.api_key,
    base_url: active.base_url || '',
    model: active.default_model,
  }
}

async function retryAsset(asset) {
  if (!resolvedProductId.value) return
  const path = asset.baidu_path
  if (!path) {
    message.warning('该资料缺少网盘路径，无法重试')
    return
  }
  retryingAssetId.value = asset.id
  analyzingTip.value = `正在重新读取：${asset.title || path}`
  try {
    const pages = await extractPdfText(path)
    const payload = {
      documents: [{
        name: asset.title || path.split('/').pop() || 'PDF',
        path,
        pages,
        doc_type: asset.meta?.doc_type || undefined,
      }],
    }
    const llm = buildLlmPayload()
    if (llm) payload.llm = llm
    const res = await analyzeAiContentDocuments(resolvedProductId.value, payload)
    latestJob.value = res
    message.success(res.reused ? '已有资料分析任务正在运行，已接入进度' : '重试任务已提交，正在后台解析')
    await loadJob(res.id)
    startPolling(res.id)
    await loadAssets()
    activeTab.value = 'sources'
  } catch (e) {
    message.error(e.message || '重试失败')
  } finally {
    retryingAssetId.value = 0
    analyzingTip.value = ''
  }
}

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdfjs]')
    if (existing) {
      const timer = setInterval(() => {
        if (window.pdfjsLib) {
          clearInterval(timer)
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = ''
          pdfjsLib = window.pdfjsLib
          resolve(pdfjsLib)
        }
      }, 50)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.setAttribute('data-pdfjs', '1')
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = ''
      pdfjsLib = window.pdfjsLib
      resolve(pdfjsLib)
    }
    script.onerror = () => reject(new Error('PDF.js 加载失败'))
    document.head.appendChild(script)
  })
}

async function extractPdfText(path) {
  const lib = await loadPdfJs()
  const token = getToken()
  const url = `${API_BASE}/api/baidu/proxy-pdf?path=${encodeURIComponent(path)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`PDF 读取失败 (${res.status})`)
  const buffer = await res.arrayBuffer()
  const doc = await lib.getDocument({ data: buffer }).promise
  const pages = []
  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo)
      const textContent = await page.getTextContent()
      const text = (textContent.items || []).map(item => item.str || '').join(' ').trim()
      if (text) pages.push({ page: pageNo, text })
    }
  } finally {
    doc.destroy?.()
  }
  if (!pages.length) throw new Error('PDF 未提取到有效文本，可能是扫描版或加密 PDF')
  return pages
}

const topicCenterRef = ref(null)
const contentAssetsRef = ref(null)
const quickCreating = ref(false)
const noteEditorOpen = ref(false)
const noteEditorTopic = ref(null)
const imageScriptsOpen = ref(false)
const imageScriptsNote = ref(null)

async function doQuickCreate(topicType) {
  if (!resolvedProductId.value) return
  const active = activeLlm.value
  if (!active) {
    message.warning('请先在系统设置中启用大模型配置')
    return
  }
  quickCreating.value = true
  try {
    await generateAiTopics(resolvedProductId.value, {
      topic_types: [topicType],
      count: 3,
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
    })
    activeTab.value = 'ai-topics'
    await topicCenterRef.value?.loadTopics()
    message.success('已生成3个候选选题')
  } catch (e) {
    message.error(e.message || '生成失败')
  } finally {
    quickCreating.value = false
  }
}

function onGenerateNote(topic) {
  noteEditorTopic.value = topic
  noteEditorOpen.value = true
}

function onNoteSaved() {
  contentAssetsRef.value?.loadNotes()
}

function onOpenScripts(note) {
  noteEditorOpen.value = false
  imageScriptsNote.value = note
  imageScriptsOpen.value = true
}

const savingId = ref(0)
async function saveOutput(item) {
  savingId.value = item.id
  try {
    await updateAiContentOutput(item.id, {
      title: item.title,
      content: item.content,
      tags: item.tags,
      images: item.images,
      status: item.status || 'draft',
    })
    message.success('已保存')
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    savingId.value = 0
  }
}

function searchKnowledge() {
  knowledgePagination.current = 1
  loadKnowledge()
}

function searchQuestions() {
  questionPagination.current = 1
  loadQuestions()
}

async function loadQuestions() {
  if (!resolvedProductId.value) return
  questionLoading.value = true
  try {
    const res = await getAiContentQuestions(resolvedProductId.value, {
      keyword: questionKeyword.value,
      page: questionPagination.current,
      pageSize: questionPagination.pageSize,
    })
    questions.value = res.list || []
    questionPagination.total = res.total || 0
  } catch (e) {
    message.error(e.message || '加载题库失败')
  } finally {
    questionLoading.value = false
  }
}

async function loadKnowledge() {
  if (!resolvedProductId.value) return
  knowledgeLoading.value = true
  try {
    const res = await getAiContentKnowledge(resolvedProductId.value, {
      keyword: knowledgeKeyword.value,
      page: knowledgePagination.current,
      pageSize: knowledgePagination.pageSize,
    })
    knowledgeList.value = res.list || []
    knowledgePagination.total = res.total || 0
  } catch (e) {
    message.error(e.message || '加载知识库失败')
  } finally {
    knowledgeLoading.value = false
  }
}

async function openKnowledgeSources(record) {
  sourceLoadingId.value = record.id
  sourceModalTitle.value = `知识来源：${record.name || ''}`
  try {
    const res = await getAiContentKnowledgeSources(record.id)
    knowledgeSources.value = Array.isArray(res) ? res : []
    sourceModalOpen.value = true
  } catch (e) {
    message.error(e.message || '加载知识来源失败')
  } finally {
    sourceLoadingId.value = 0
  }
}

async function loadAssets() {
  if (!resolvedProductId.value) return
  try {
    const res = await getAiContentAssets(resolvedProductId.value)
    assets.value = Array.isArray(res) ? res : []
  } catch {
    assets.value = []
  }
}

function onKnowledgeTableChange(pag) {
  knowledgePagination.current = pag.current
  knowledgePagination.pageSize = pag.pageSize
  loadKnowledge()
}

function onQuestionTableChange(pag) {
  questionPagination.current = pag.current
  questionPagination.pageSize = pag.pageSize
  loadQuestions()
}

function openQuestionDetail(record) {
  selectedQuestion.value = record
  questionModalOpen.value = true
}

function normalizeOutput(item) {
  return {
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    images: Array.isArray(item.images) ? item.images : [],
  }
}

function statusColor(status) {
  if (status === 'done') return 'green'
  if (status === 'failed' || status === 'partial') return 'red'
  if (status === 'running') return 'blue'
  if (status === 'canceled') return 'default'
  return 'gold'
}

function statusText(status) {
  return {
    pending: '排队中',
    running: '运行中',
    done: '已完成',
    failed: '失败',
    partial: '部分完成',
    canceled: '已取消',
  }[status] || status || '未知'
}

function stepSummary(step) {
  const output = step?.output || {}
  if (!output || typeof output !== 'object') return ''
  const parts = []
  if (output.chunks_done || output.chunks) {
    const done = output.chunks_done || output.chunks
    const total = output.chunks_total
    parts.push(total ? `分块 ${done}/${total}` : `分块 ${done}`)
  }
  if (output.knowledge_points) parts.push(`知识点 ${output.knowledge_points}`)
  if (output.questions) parts.push(`题目 ${output.questions}`)
  return parts.join(' · ')
}

function assetStatusColor(status) {
  if (status === 'completed') return 'green'
  if (status === 'processing') return 'blue'
  if (status === 'failed') return 'red'
  return 'default'
}

function assetStatusText(status) {
  return {
    completed: '已完成',
    processing: '分析中',
    failed: '失败',
    canceled: '已取消',
  }[status] || '未知'
}

function jobTypeText(type) {
  return {
    note_generate: '生成小红书笔记',
    pdf_scan: '扫描素材',
    pdf_analysis: '分析选中资料',
    question_parse: '解析题库',
    full_pipeline: '完整链路',
  }[type] || type || '未知任务'
}

function docTypeText(type) {
  return {
    question_bank: '题库',
    high_frequency: '高频资料',
    notes: '讲义笔记',
    policy: '政策文件',
    knowledge: '知识资料',
  }[type] || type
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  if (!llmStore.checked) llmStore.load()
  loadOverview()
  loadAssets()
  loadQuestions()
  loadKnowledge()
  if (props.diskPath) loadSourceTree()
})

onBeforeUnmount(stopPolling)
</script>

<style scoped>
.ai-content-center {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
}

.center-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.center-title {
  font-size: 16px;
  font-weight: 600;
  color: #222;
}

.center-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #888;
}

.summary-row {
  display: grid;
  grid-template-columns: 120px 120px minmax(180px, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.summary-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fafafa;
}

.summary-label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.job-card {
  background: #fafafa;
  margin-bottom: 12px;
}

.job-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.job-name {
  font-weight: 500;
}

.muted {
  color: #999;
  font-size: 12px;
}

.error-text {
  color: #ff4d4f;
  font-size: 12px;
  margin-top: 6px;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.output-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.source-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.pdf-title {
  color: #d4380d;
}

.asset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.asset-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.asset-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.asset-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.chapter-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.output-card {
  background: #fafafa;
}

.question-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.source-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}

.source-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.source-text {
  margin-top: 8px;
  color: #333;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.question-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-source {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fafafa;
}

.detail-block {
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}

.detail-title {
  margin-bottom: 6px;
  font-weight: 600;
  color: #333;
}

.detail-text {
  color: #333;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 720px) {
  .center-header {
    flex-direction: column;
  }

  .summary-row {
    grid-template-columns: 1fr;
  }
}
</style>
