<template>
  <div class="edit-page">
    <!-- ─── 顶部工具栏 ──────────────────────────────────────── -->
    <div class="edit-topbar">
      <div class="topbar-left">
        <a-button type="text" class="back-btn" @click="router.push({ name: 'ai-rewrite' })">
          <LeftOutlined /> 返回
        </a-button>
        <div class="source-url-text" :title="draft?.sourceUrl">{{ draft?.sourceUrl }}</div>
      </div>

      <div class="topbar-center">
        <div class="status-pills">
          <span class="pill" :class="titleDone ? 'done' : 'pending'">
            <CheckCircleFilled v-if="titleDone" /><div v-else class="pill-dot" />
            标题
          </span>
          <span class="pill" :class="contentDone ? 'done' : 'pending'">
            <CheckCircleFilled v-if="contentDone" /><div v-else class="pill-dot" />
            正文
          </span>
          <span class="pill" :class="tagsDone ? 'done' : 'pending'">
            <CheckCircleFilled v-if="tagsDone" /><div v-else class="pill-dot" />
            标签
          </span>
          <span class="pill" :class="imagesDone ? 'done' : 'pending'">
            <CheckCircleFilled v-if="imagesDone" /><div v-else class="pill-dot" />
            图片 {{ doneImgCount }}/{{ images.length }}
          </span>
        </div>
      </div>

      <div class="topbar-right">
        <a-button type="text" size="small" class="tbar-btn" @click="showPromptDrawer = true">
          <SettingOutlined /> 提示词
        </a-button>
        <a-button
          v-if="logs.length"
          type="text"
          size="small"
          class="tbar-btn log-toggle-btn"
          @click="logsVisible = !logsVisible"
        >
          <UnorderedListOutlined />
          {{ logsVisible ? '收起日志' : '展开日志' }}
          <span class="log-count-badge">{{ logs.length }}</span>
          <DownOutlined class="log-toggle-arrow" :class="{ rotated: logsVisible }" />
        </a-button>
      </div>
    </div>

    <!-- ─── 日志面板（可折叠） ──────────────────────────────── -->
    <div v-if="logsVisible && logs.length" class="log-panel">
      <div class="log-list">
        <div v-for="(log, li) in logs" :key="li" class="log-entry">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-icon" :class="log.type">
            <CheckCircleFilled v-if="log.type === 'success'" />
            <CloseCircleFilled v-else-if="log.type === 'error'" />
            <LoadingOutlined v-else-if="log.type === 'running'" />
            <MinusCircleOutlined v-else />
          </span>
          <span class="log-text">{{ log.text }}</span>
          <span v-if="log.detail" class="log-detail">{{ log.detail }}</span>
        </div>
      </div>
    </div>

    <!-- ─── 主体双栏 ─────────────────────────────────────────── -->
    <div class="edit-body">
      <!-- 左栏：编辑区 -->
      <div class="edit-left">

        <!-- 标题 -->
        <div class="edit-section">
          <div class="section-header">
            <span class="section-label">标题</span>
            <div class="section-actions">
              <span v-if="aiTitleDirty" class="ai-badge"><ThunderboltOutlined /> AI 改写</span>
              <a-button
                size="small"
                class="section-ai-btn"
                :loading="rewritingTitle"
                :disabled="rewriting"
                @click="onRewriteTitle"
              >
                <ThunderboltOutlined v-if="!rewritingTitle" />
                AI 改写标题
              </a-button>
            </div>
          </div>
          <a-input
            v-model:value="title"
            class="title-input"
            placeholder="笔记标题"
            :maxlength="100"
            show-count
          />
          <div v-if="aiTitleDirty" class="ai-undo-row">
            <a-button size="small" danger @click="rejectTitle"><RollbackOutlined /> 撤销</a-button>
            <span class="ai-undo-hint">可直接编辑，或撤销恢复原始标题</span>
          </div>
        </div>

        <!-- 正文 -->
        <div class="edit-section">
          <div class="section-header">
            <span class="section-label">正文</span>
            <div class="section-actions">
              <span v-if="aiContentDirty" class="ai-badge"><ThunderboltOutlined /> AI 改写</span>
              <a-button
                size="small"
                class="section-ai-btn"
                :loading="rewritingContent"
                :disabled="rewriting"
                @click="onRewriteContent"
              >
                <ThunderboltOutlined v-if="!rewritingContent" />
                AI 改写正文
              </a-button>
            </div>
          </div>
          <a-textarea
            v-model:value="content"
            class="content-input"
            placeholder="笔记正文…"
            :auto-size="{ minRows: 8, maxRows: 20 }"
          />
          <div v-if="aiContentDirty" class="ai-undo-row">
            <a-button size="small" danger @click="rejectContent"><RollbackOutlined /> 撤销</a-button>
            <span class="ai-undo-hint">可直接编辑，或撤销恢复原始正文</span>
          </div>
        </div>

        <!-- 标签 -->
        <div class="edit-section">
          <div class="section-header">
            <span class="section-label">标签</span>
            <span class="section-hint">从正文中自动提取，可手动增删</span>
          </div>
          <div class="tags-area">
            <a-tag
              v-for="(tag, ti) in tags"
              :key="ti"
              closable
              class="edit-tag"
              @close="removeTag(ti)"
            >
              #{{ tag }}
            </a-tag>
            <a-input
              v-if="tagInputVisible"
              ref="tagInputRef"
              v-model:value="tagInputVal"
              size="small"
              class="tag-input"
              placeholder="输入标签后回车"
              @keydown.enter="addTag"
              @blur="addTag"
            />
            <a-button v-else size="small" class="add-tag-btn" @click="showTagInput">
              <PlusOutlined /> 添加标签
            </a-button>
          </div>
        </div>

        <!-- 图片区 -->
        <div class="edit-section">
          <div class="section-header">
            <span class="section-label">图片（{{ images.length }} 张）</span>
            <div class="section-actions">
              <a-button
                size="small"
                class="section-ai-btn"
                :loading="batchGenerating"
                :disabled="rewriting || !images.length"
                @click="onBatchGenerate"
              >
                <PictureOutlined v-if="!batchGenerating" />
                AI 批量生成
              </a-button>
            </div>
          </div>
          <div class="img-grid">
            <div v-for="(img, ii) in images" :key="ii" class="img-cell">
              <!-- 原图 -->
              <div class="img-slot original">
                <img :src="xhsImgProxyUrl(img.src)" class="img-thumb" />
                <div class="img-label">原图</div>
              </div>
              <!-- AI 生成图 -->
              <div class="img-slot ai-slot">
                <template v-if="img.status === 'done' && img.aiUrl">
                  <img :src="img.aiUrl" class="img-thumb" />
                  <div class="img-label ai">AI 二创</div>
                  <div class="img-overlay-actions">
                    <a-button size="small" type="primary" ghost @click="previewImg.url = img.aiUrl; previewImg.visible = true">
                      <EyeOutlined />
                    </a-button>
                    <a-button size="small" type="primary" ghost :loading="img.downloading" @click="downloadImg(img, ii)">
                      <DownloadOutlined />
                    </a-button>
                    <a-button size="small" type="primary" ghost @click="retrySingleImg(img, ii)">
                      <ReloadOutlined />
                    </a-button>
                  </div>
                </template>
                <template v-else-if="img.status === 'running'">
                  <div class="img-generating">
                    <a-spin size="small" />
                    <span class="gen-text">生成中</span>
                  </div>
                </template>
                <template v-else-if="img.status === 'error'">
                  <div class="img-error-cell">
                    <ExclamationCircleOutlined style="font-size:16px" />
                    <span class="img-err-text">失败</span>
                    <a-button size="small" class="img-retry-btn" @click="retrySingleImg(img, ii)">
                      <ReloadOutlined /> 重试
                    </a-button>
                  </div>
                </template>
                <template v-else>
                  <!-- 待生成：点击直接触发单张生成 -->
                  <div class="img-pending-cell" @click="generateSingleImg(img, ii)">
                    <PlusOutlined class="pending-plus" />
                    <span class="pending-text">点击生成</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <a-button
            v-if="images.some(i => i.status === 'done' && i.aiUrl)"
            size="small"
            :loading="batchDownloading"
            style="margin-top:8px"
            @click="downloadAllAiImgs"
          >
            <DownloadOutlined /> 批量下载 AI 图
          </a-button>
        </div>
      </div>

      <!-- 右栏：预览 + 发布 -->
      <div class="edit-right">
        <!-- XHS 预览面板 -->
        <div class="preview-phone">
          <div class="phone-header">
            <span class="phone-title-text">小红书预览</span>
          </div>
          <div class="phone-body">
            <div class="preview-cover">
              <img v-if="coverImgSrc" :src="coverImgSrc" class="cover-img" />
              <div v-else class="cover-placeholder"><PictureOutlined /></div>
            </div>
            <div class="preview-title">{{ title || '（标题为空）' }}</div>
            <div class="preview-content">{{ contentPreview }}</div>
            <div v-if="tags.length" class="preview-tags">
              <span v-for="(t, ti) in tags.slice(0, 5)" :key="ti" class="preview-tag">#{{ t }}</span>
            </div>
          </div>
        </div>

        <!-- 发布操作 -->
        <div class="publish-actions">
          <div class="publish-label">发布操作</div>
          <a-button block class="pub-btn" @click="copyAll">
            <CopyOutlined /> 复制标题 + 正文
          </a-button>
          <a-button block class="pub-btn" @click="saveDraft">
            <SaveOutlined /> 保存到草稿
          </a-button>
        </div>
      </div>
    </div>

    <!-- ─── 底部 AI Action Bar ───────────────────────────────── -->
    <div class="edit-actionbar">
      <div class="actionbar-inner">
        <!-- 统一风格 -->
        <a-dropdown :trigger="['click']">
          <a-button class="style-btn">
            <AppstoreOutlined /> 统一风格 <DownOutlined />
          </a-button>
          <template #overlay>
            <a-menu @click="onSelectPrompt">
              <a-menu-item v-for="p in promptList" :key="p.id">{{ p.name }}</a-menu-item>
              <a-menu-divider v-if="promptList.length" />
              <a-menu-item key="__default__">系统默认</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <div class="actionbar-divider" />

        <!-- 一键 AI 改写（标题 + 正文 + 全部图片） -->
        <a-button
          type="primary"
          class="ai-rewrite-btn"
          :loading="rewriting"
          @click="onAiRewriteAll"
        >
          <ThunderboltOutlined /> 一键 AI 改写
        </a-button>
      </div>
    </div>

    <!-- 提示词 Drawer -->
    <a-drawer
      v-model:open="showPromptDrawer"
      title="提示词配置"
      :width="900"
      :body-style="{ padding: '16px' }"
      destroy-on-close
    >
      <RewritePromptPanel />
    </a-drawer>

  <!-- 大图预览 Modal -->
  <a-modal
    v-model:open="previewImg.visible"
    :footer="null"
    :body-style="{ padding: 0, lineHeight: 0, background: '#000' }"
    centered
    width="auto"
    wrap-class-name="img-preview-modal"
  >
    <img
      v-if="previewImg.visible"
      :src="previewImg.url"
      style="max-width: 90vw; max-height: 90vh; display: block; object-fit: contain"
    />
  </a-modal>
</div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  LeftOutlined, ThunderboltOutlined, CheckCircleFilled, CloseCircleFilled,
  LoadingOutlined, MinusCircleOutlined, SettingOutlined, UnorderedListOutlined,
  DownOutlined, PlusOutlined, DownloadOutlined, ReloadOutlined, RollbackOutlined,
  ExclamationCircleOutlined, PictureOutlined, CopyOutlined, SaveOutlined,
  AppstoreOutlined, EyeOutlined,
} from '@ant-design/icons-vue'
import RewritePromptPanel from './RewritePrompt.vue'
import { rewriteContent, rewriteImage, uploadXhsImageViaWorker, proxyImageForDownload, xhsImgProxyUrl } from '@/api/xhsRewrite'
import { getRewritePromptList } from '@/api/rewritePrompts'
import { processImageForDownload, triggerBlobDownload } from '@/utils/imageProcess'
import { saveDraft as saveDraftFn } from '@/utils/draftStorage'

const router = useRouter()

// ─── 草稿数据 ─────────────────────────────────────────────
const draft   = ref(null)
const currentDraftId = ref(null)   // 继续编辑已有草稿时的 id
const title   = ref('')
const content = ref('')
const tags    = ref([])
const images  = ref([])   // { src, aiUrl, status:'pending'|'running'|'done'|'error', idx, downloading }

const previewImg = reactive({ visible: false, url: '' })  // 大图预览状态

// 原始内容快照（用于"撤销"）
const origTitle   = ref('')
const origContent = ref('')

// AI 改写标记（标记是否已被 AI 修改，用于显示撤销按钮）
const aiTitleDirty   = ref(false)
const aiContentDirty = ref(false)

// ─── UI 状态 ─────────────────────────────────────────────
const rewriting        = ref(false)   // 全量改写 loading
const rewritingTitle   = ref(false)   // 单独改写标题 loading
const rewritingContent = ref(false)   // 单独改写正文 loading
const batchGenerating  = ref(false)
const batchDownloading = ref(false)
const showPromptDrawer = ref(false)

// ─── 日志 ────────────────────────────────────────────────
const logs        = ref([])   // { time, type:'success'|'error'|'info'|'running', text, detail }
const logsVisible = ref(false)

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}
function addLog(text, type = 'info', detail = '') {
  const entry = { time: nowTime(), type, text, detail }
  logs.value.unshift(entry)
  // 有新日志时自动展开
  if (!logsVisible.value) logsVisible.value = true
  return entry   // 返回引用，调用方可就地更新 type/text/detail
}

// ─── 标签输入 ─────────────────────────────────────────────
const tagInputVisible = ref(false)
const tagInputVal     = ref('')
const tagInputRef     = ref(null)

// ─── Prompt 配置 ─────────────────────────────────────────
const selectedPrompt = ref(null)
const promptList     = ref([])

// ─── 计算属性 ─────────────────────────────────────────────
const titleDone    = computed(() => !!title.value.trim())
const contentDone  = computed(() => !!content.value.trim())
const tagsDone     = computed(() => tags.value.length > 0)
const doneImgCount = computed(() => images.value.filter(i => i.aiUrl).length)
const imagesDone   = computed(() => doneImgCount.value > 0)

const coverImgSrc    = computed(() => images.value[0]?.aiUrl || images.value[0]?.src || '')
const contentPreview = computed(() => {
  const t = content.value.replace(/#[^\s#，。！？]+/g, '').trim()
  return t.slice(0, 120) + (t.length > 120 ? '…' : '')
})

// ─── 初始化 ───────────────────────────────────────────────
onMounted(async () => {
  const raw = sessionStorage.getItem('xhs_rewrite_draft')
  if (!raw) {
    message.warning('未检测到解析数据，即将返回')
    setTimeout(() => router.push({ name: 'ai-rewrite' }), 1500)
    return
  }
  try {
    const data = JSON.parse(raw)
    draft.value   = data
    title.value   = data.title   ?? ''
    content.value = data.content ?? ''
    if (!title.value && content.value) {
      const firstLine = content.value.split(/[\r\n]/)[0].replace(/#\S+\s*/g, '').trim()
      title.value = firstLine.slice(0, 50)
    }
    origTitle.value   = title.value
    origContent.value = content.value
    tags.value   = extractTags(content.value)
    currentDraftId.value = data.draftId ?? null
    // 兼容两种格式：新建（images 为 string[]）/ 继续编辑（images 为 object[]）
    images.value = (data.images ?? []).map((item, i) => {
      if (typeof item === 'string') {
        return { src: item, aiUrl: '', status: 'pending', idx: i, downloading: false }
      }
      return {
        src: item.src, aiUrl: item.aiUrl || '',
        status: item.aiUrl ? 'done' : (item.status || 'pending'),
        idx: i, downloading: false,
      }
    })
    addLog(`已载入原始内容：标题 ${title.value ? '✓' : '空'}，正文 ${content.value.length} 字，图片 ${images.value.length} 张`, 'info')
  } catch {
    message.error('数据解析失败，即将返回')
    setTimeout(() => router.push({ name: 'ai-rewrite' }), 1500)
  }
  try {
    const res = await getRewritePromptList()
    promptList.value = res ?? []
  } catch { /* 静默 */ }
})

// ─── 工具函数 ─────────────────────────────────────────────
function extractTags(text) {
  return [...text.matchAll(/#([^\s#，。！？\n]+)/g)].map(m => m[1])
}
function removeTag(idx) { tags.value.splice(idx, 1) }
function showTagInput() {
  tagInputVisible.value = true
  nextTick(() => tagInputRef.value?.focus())
}
function addTag() {
  const v = tagInputVal.value.trim().replace(/^#/, '')
  if (v && !tags.value.includes(v)) tags.value.push(v)
  tagInputVal.value = ''
  tagInputVisible.value = false
}

function getPromptExtra() {
  return selectedPrompt.value
    ? { title_prompt: selectedPrompt.value.title_prompt, content_prompt: selectedPrompt.value.content_prompt }
    : {}
}

// ─── 单独改写标题 ─────────────────────────────────────────
async function onRewriteTitle() {
  if (rewriting.value || rewritingTitle.value) return
  rewritingTitle.value = true
  const log = addLog('AI 改写标题中…', 'running')
  const t0 = Date.now()
  try {
    const result = await rewriteContent({ title: title.value, content: content.value, ...getPromptExtra() })
    title.value     = result.title ?? title.value
    aiTitleDirty.value = true
    log.type   = 'success'
    log.text   = '标题改写完成'
    log.detail = `耗时 ${((Date.now()-t0)/1000).toFixed(1)}s · ${title.value.slice(0,20)}…`
  } catch (e) {
    log.type   = 'error'
    log.text   = `标题改写失败：${e.message}`
    message.error(e.message || '标题改写失败')
  } finally {
    rewritingTitle.value = false
  }
}

// ─── 单独改写正文 ─────────────────────────────────────────
async function onRewriteContent() {
  if (rewriting.value || rewritingContent.value) return
  rewritingContent.value = true
  const log = addLog('AI 改写正文中…', 'running')
  const t0 = Date.now()
  try {
    const result = await rewriteContent({ title: title.value, content: content.value, ...getPromptExtra() })
    content.value        = result.content ?? content.value
    aiContentDirty.value = true
    tags.value = extractTags(content.value)
    log.type   = 'success'
    log.text   = '正文改写完成'
    log.detail = `耗时 ${((Date.now()-t0)/1000).toFixed(1)}s · ${content.value.length} 字`
  } catch (e) {
    log.type   = 'error'
    log.text   = `正文改写失败：${e.message}`
    message.error(e.message || '正文改写失败')
  } finally {
    rewritingContent.value = false
  }
}

// ─── 撤销 ────────────────────────────────────────────────
function rejectTitle() {
  title.value = origTitle.value
  aiTitleDirty.value = false
  addLog('已撤销标题改写，恢复原始内容', 'info')
}
function rejectContent() {
  content.value = origContent.value
  aiContentDirty.value = false
  tags.value = extractTags(origContent.value)
  addLog('已撤销正文改写，恢复原始内容', 'info')
}

// ─── 一键全量改写（标题 + 正文 + 全部图片） ──────────────
async function onAiRewriteAll() {
  if (rewriting.value) return
  rewriting.value = true
  const mainLog = addLog('一键 AI 改写开始…', 'running', `提示词：${selectedPrompt.value?.name ?? '系统默认'}`)
  const t0 = Date.now()
  try {
    // 1. 文案改写（并行标题+正文）
    const textLog = addLog('AI 改写标题 + 正文中…', 'running')
    const result = await rewriteContent({ title: title.value, content: content.value, ...getPromptExtra() })
    title.value   = result.title   ?? title.value
    content.value = result.content ?? content.value
    aiTitleDirty.value   = true
    aiContentDirty.value = true
    tags.value = extractTags(content.value)
    textLog.type   = 'success'
    textLog.text   = '文案改写完成'
    textLog.detail = `标题+正文 · 耗时 ${((Date.now()-t0)/1000).toFixed(1)}s`

    // 2. 图片批量生成（并行）
    if (images.value.length) {
      const imgLog = addLog(`开始批量生成 ${images.value.length} 张图片…`, 'running')
      await Promise.allSettled(images.value.map((img, ii) => generateSingleImg(img, ii)))
      const ok = images.value.filter(i => i.status === 'done').length
      imgLog.type   = ok === images.value.length ? 'success' : 'info'
      imgLog.text   = `图片生成完成 ${ok}/${images.value.length}`
      imgLog.detail = ''
    }

    mainLog.type   = 'success'
    mainLog.text   = '一键改写完成'
    mainLog.detail = `总耗时 ${((Date.now()-t0)/1000).toFixed(1)}s`
    message.success('一键 AI 改写完成')
  } catch (e) {
    mainLog.type   = 'error'
    mainLog.text   = `一键改写出错：${e.message}`
    message.error(e.message || 'AI 改写失败')
  } finally {
    rewriting.value = false
  }
}

// ─── Prompt 选择 ─────────────────────────────────────────
function onSelectPrompt({ key }) {
  if (key === '__default__') {
    selectedPrompt.value = null
    addLog('已切换为系统默认提示词', 'info')
  } else {
    selectedPrompt.value = promptList.value.find(p => String(p.id) === String(key)) ?? null
    addLog(`已切换提示词：${selectedPrompt.value?.name}`, 'info')
  }
}

// ─── 图片生成 ─────────────────────────────────────────────
async function onBatchGenerate() {
  const pending = images.value.filter(i => i.status !== 'running' && i.status !== 'done')
  if (!pending.length && images.value.some(i => i.status === 'done')) {
    // 全部已生成，重新生成全部
    images.value.forEach(i => { i.status = 'pending'; i.aiUrl = '' })
  }
  const targets = images.value.filter(i => i.status !== 'running')
  if (!targets.length) return
  batchGenerating.value = true
  const batchLog = addLog(`开始批量生成 ${targets.length} 张图片…`, 'running')
  await Promise.allSettled(targets.map(img => generateSingleImg(img, img.idx)))
  const ok = images.value.filter(i => i.status === 'done').length
  batchLog.type   = ok === images.value.length ? 'success' : 'info'
  batchLog.text   = `批量生成完成 ${ok}/${images.value.length}`
  batchLog.detail = ''
  batchGenerating.value = false
}

async function generateSingleImg(img, idx) {
  if (img.status === 'running') return
  img.status = 'running'
  img.aiUrl  = ''
  const t0  = Date.now()
  // 单条日志贯穿整个生命周期：上传 → 生成中 → 完成/失败
  const log = addLog(
    img.publicSrc ? `图片 ${idx + 1}：AI 生成中…` : `图片 ${idx + 1}：上传原图中…`,
    'running',
  )
  try {
    // 优先复用已上传的 R2 地址，避免重复走浏览器中转
    if (!img.publicSrc) {
      const uploaded = await uploadXhsImageViaWorker(img.src)
      img.publicSrc = uploaded.url // 缓存，重试复用
      log.text = `图片 ${idx + 1}：AI 生成中…`
    }
    const imagePrompt = selectedPrompt.value?.image_prompt ?? ''
    const res = await rewriteImage({ src: img.publicSrc, prompt: imagePrompt })
    img.aiUrl  = res.url
    img.status = 'done'
    log.type   = 'success'
    log.text   = `图片 ${idx + 1} 生成完成`
    log.detail = `耗时 ${((Date.now()-t0)/1000).toFixed(1)}s`
  } catch (e) {
    img.status = 'error'
    log.type   = 'error'
    log.text   = `图片 ${idx + 1} 生成失败`
    log.detail = e.message
  }
}

async function retrySingleImg(img, idx) {
  img.status = 'pending'
  img.aiUrl  = ''
  // 注意：不重置 img.publicSrc，保留已上传的 R2 地址供复用
  await generateSingleImg(img, idx)
}

// ─── 图片下载 ────────────────────────────────────────────
async function _getProcessedBlob(srcUrl) {
  try { return await processImageForDownload(srcUrl) }
  catch {
    const proxied = await proxyImageForDownload(srcUrl)
    return await processImageForDownload(proxied.url)
  }
}

async function downloadImg(img, idx) {
  if (img.downloading || !img.aiUrl) return
  img.downloading = true
  try {
    const blob = await _getProcessedBlob(img.aiUrl)
    triggerBlobDownload(blob, `xhs_ai_${idx + 1}.jpg`)
    message.success('下载成功')
  } catch (e) { message.error(e.message || '下载失败') }
  finally { img.downloading = false }
}

async function downloadAllAiImgs() {
  const done = images.value.filter(i => i.status === 'done' && i.aiUrl && !i.downloading)
  if (!done.length) return
  batchDownloading.value = true
  const hide = message.loading(`处理 ${done.length} 张…`, 0)
  let ok = 0
  for (let i = 0; i < done.length; i++) {
    const img = done[i]
    img.downloading = true
    try {
      const blob = await _getProcessedBlob(img.aiUrl)
      triggerBlobDownload(blob, `xhs_ai_${img.idx + 1}.jpg`)
      ok++
      if (i < done.length - 1) await new Promise(r => setTimeout(r, 600))
    } catch { /* 单张失败不中断 */ }
    finally { img.downloading = false }
  }
  hide()
  batchDownloading.value = false
  message.success(`已下载 ${ok} / ${done.length} 张`)
}

// ─── 发布操作 ─────────────────────────────────────────────
async function copyAll() {
  try {
    const tagStr = tags.value.map(t => `#${t}`).join(' ')
    await navigator.clipboard.writeText(`${title.value}\n\n${content.value}\n\n${tagStr}`.trim())
    message.success('已复制标题 + 正文 + 标签')
    addLog('已复制标题+正文+标签到剪贴板', 'success')
  } catch { message.error('复制失败') }
}

function saveDraft() {
  const saved = saveDraftFn({
    id: currentDraftId.value,        // null → storage 自动新建
    sourceUrl: draft.value?.sourceUrl,
    title: title.value,
    content: content.value,
    tags: tags.value,
    images: images.value.map(i => ({ src: i.src, aiUrl: i.aiUrl, status: i.status })),
  })
  currentDraftId.value = saved.id   // 记录 id，下次再保存时是更新
  message.success('已保存草稿')
  addLog('草稿已保存，即将跳转到发布列表', 'success')
  router.push({ name: 'ai-publish-list' })
  addLog('已保存草稿到本地存储', 'success')
}
</script>

<style scoped>
/* ─── 页面骨架 ─────────────────────────────────────────── */
.edit-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f5f6f8;
}

/* ─── 顶栏 ─────────────────────────────────────────────── */
.edit-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 52px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 12px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.back-btn { color: #374151 !important; font-weight: 500; padding: 0 8px; flex-shrink: 0; }
.back-btn:hover { color: #ff2442 !important; }

.source-url-text {
  font-size: 12px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.topbar-center { flex-shrink: 0; }

.status-pills { display: flex; gap: 6px; }

.pill {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #9ca3af;
}
.pill.done { background: #f0fdf4; border-color: #86efac; color: #16a34a; }
.pill-dot { width: 6px; height: 6px; border-radius: 50%; background: #d1d5db; }

.topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tbar-btn { color: #6b7280 !important; font-size: 13px; }
.tbar-btn:hover { color: #ff2442 !important; }

.log-toggle-btn { display: flex; align-items: center; gap: 4px; }

.log-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #e5e7eb;
  font-size: 10px;
  color: #6b7280;
  line-height: 1;
}

.log-toggle-arrow {
  font-size: 10px;
  transition: transform .2s;
}
.log-toggle-arrow.rotated { transform: rotate(180deg); }

/* ─── 日志面板 ─────────────────────────────────────────── */
.log-panel {
  background: #0f1117;
  border-bottom: 1px solid #1e2130;
  max-height: 260px;
  overflow-y: auto;
}

.log-list {
  padding: 10px 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-entry {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  line-height: 1.6;
}

.log-time { color: #484f5e; flex-shrink: 0; width: 68px; }

.log-icon { flex-shrink: 0; font-size: 13px; width: 14px; text-align: center; }
.log-icon.success { color: #3fb950; }
.log-icon.error   { color: #ff7875; }
.log-icon.running { color: #1677ff; }
.log-icon.info    { color: #484f5e; }

.log-text   { color: #c9d1d9; }
.log-detail { color: #6b7280; font-size: 11px; }

/* ─── 主体 ─────────────────────────────────────────────── */
.edit-body {
  display: flex;
  gap: 20px;
  padding: 20px 24px 100px;
  flex: 1;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* ─── 左栏 ─────────────────────────────────────────────── */
.edit-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.edit-section {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-label { font-size: 13px; font-weight: 600; color: #374151; }
.section-hint  { font-size: 12px; color: #9ca3af; }

.section-actions { display: flex; align-items: center; gap: 8px; }

.section-ai-btn {
  font-size: 12px !important;
  height: 26px !important;
  padding: 0 10px !important;
  border-color: #e5e7eb;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 4px;
}
.section-ai-btn:hover { border-color: #ff2442 !important; color: #ff2442 !important; }

.ai-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #1677ff;
  background: #eff6ff;
  border-radius: 999px;
  padding: 1px 8px;
}

.ai-undo-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-undo-hint { font-size: 12px; color: #9ca3af; }

.title-input   { font-size: 15px; font-weight: 500; }
.content-input { font-size: 14px; line-height: 1.75; }

/* ─── 标签区 ─────────────────────────────────────────────── */
.tags-area { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.edit-tag { font-size: 13px; color: #374151; background: #f3f4f6; border: 1px solid #e5e7eb; }
.tag-input { width: 110px; font-size: 13px; }
.add-tag-btn { font-size: 13px; border-style: dashed; color: #6b7280; }

/* ─── 图片网格 ──────────────────────────────────────────── */
.img-grid { display: flex; flex-wrap: wrap; gap: 10px; }

.img-cell { display: flex; gap: 6px; align-items: flex-start; }

.img-slot {
  width: 76px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f6f7;
  border: 1px solid #e5e7eb;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.img-thumb { width: 100%; height: 100%; object-fit: cover; }

.img-label {
  position: absolute; bottom: 0; left: 0; right: 0;
  font-size: 10px; text-align: center; padding: 2px 0;
  background: rgba(0,0,0,.35); color: #fff;
}
.img-label.ai { background: rgba(22,119,255,.65); }

.img-overlay-actions {
  position: absolute; inset: 0;
  background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; gap: 6px;
  opacity: 0; transition: opacity .2s;
}
.img-slot:hover .img-overlay-actions { opacity: 1; }

.img-generating,
.img-error-cell,
.img-pending-cell {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  font-size: 11px; color: #9ca3af;
}
.img-error-cell { color: #ef4444; }

.img-pending-cell {
  cursor: pointer;
  transition: background .15s;
}
.img-pending-cell:hover { background: #f0f0f0; }
.pending-plus { font-size: 18px; color: #d1d5db; }
.pending-text { font-size: 10px; }
.img-err-text { font-size: 10px; }

.img-retry-btn {
  font-size: 10px !important;
  height: 20px !important;
  padding: 0 6px !important;
}

/* ─── 右栏 ─────────────────────────────────────────────── */
.edit-right {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 68px;
  align-self: flex-start;
}

/* ─── XHS 预览面板 ─────────────────────────────────────── */
.preview-phone {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,.06);
}

.phone-header {
  padding: 10px 14px;
  border-bottom: 1px solid #f0f0f0;
  text-align: center;
}
.phone-title-text { font-size: 12px; color: #9ca3af; font-weight: 500; }

.phone-body { padding: 0 0 14px; }

.preview-cover {
  width: 100%;
  aspect-ratio: 4 / 5;
  background: #f5f6f7;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #d1d5db;
}
.cover-img { width: 100%; height: 100%; object-fit: cover; }

.preview-title { padding: 10px 14px 4px; font-size: 14px; font-weight: 600; color: #1f2937; line-height: 1.4; }
.preview-content { padding: 0 14px 6px; font-size: 12px; color: #4b5563; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
.preview-tags { padding: 0 14px; display: flex; flex-wrap: wrap; gap: 4px; }
.preview-tag { font-size: 12px; color: #ff2442; }

/* ─── 发布操作 ──────────────────────────────────────────── */
.publish-actions {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.publish-label { font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
.pub-btn { text-align: left; font-size: 13px; color: #374151; }

/* ─── 底部 Action Bar ─────────────────────────────────── */
.edit-actionbar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  padding: 10px 24px;
  z-index: 100;
}

.actionbar-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 1280px;
  margin: 0 auto;
}

.style-btn { display: flex; align-items: center; gap: 5px; font-size: 14px; color: #374151; border-color: #e5e7eb; }
.actionbar-divider { width: 1px; height: 24px; background: #e5e7eb; }

.ai-rewrite-btn {
  background: #ff2442 !important;
  border-color: #ff2442 !important;
  font-size: 14px;
  font-weight: 500;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.ai-rewrite-btn:not(:disabled):hover {
  background: #e01f3b !important;
  border-color: #e01f3b !important;
}
</style>
