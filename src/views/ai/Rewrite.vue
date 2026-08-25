<template>
  <div class="rewrite-page">
    <!-- Hero 区域 -->
    <div class="hero">
      <div class="hero-badge">✦ 小红书 AI 内容工作台</div>
      <h1 class="hero-title">让 AI 替你写更懂小红书的笔记</h1>
      <p class="hero-sub">智能识别参考内容 · 自动生成 <strong>标题 / 正文 / 标签</strong> · 图片 AI 二创</p>
    </div>

    <!-- 输入卡片 -->
    <div class="input-card">
      <div class="card-tabs">
        <div class="card-tab" :class="{ active: activeTab === 'link' }" @click="activeTab = 'link'">
          <LinkOutlined />
          小红书链接
        </div>
        <div class="card-tab disabled" title="即将开放">
          <PictureOutlined />
          上传图片
        </div>
        <div class="card-tab" :class="{ active: activeTab === 'product' }" @click="activeTab = 'product'">
          <ShoppingOutlined />
          商品链接
        </div>
      </div>

      <div class="card-body">
        <!-- 小红书链接输入 -->
        <a-textarea
          v-if="activeTab === 'link'"
          v-model:value="links"
          class="link-input"
          placeholder="在此粘贴小红书笔记链接...&#10;支持标准链接、xhslink 短链、App 分享文字"
          :rows="5"
          :bordered="false"
        />
        <!-- 商品链接输入 -->
        <a-input
          v-else
          v-model:value="productUrl"
          class="product-url-input"
          placeholder="粘贴小红书商品页链接，支持 xhslink 短链和 App 分享文字"
          :bordered="false"
          allow-clear
        >
          <template #prefix><LinkOutlined style="color:#9ca3af" /></template>
        </a-input>

        <!-- 本地上传图片（商品链接 tab） -->
        <template v-if="activeTab === 'product'">
          <div class="upload-or-divider"><span class="or-label">或 直接上传图片</span></div>
          <div
            class="local-upload-area"
            :class="{ uploading: localUploading }"
            @click="triggerLocalUpload"
          >
            <input
              ref="localFileInput"
              type="file"
              accept="image/*"
              multiple
              style="display:none"
              @change="handleLocalImageUpload"
            />
            <template v-if="localUploading">
              <a-spin size="small" />
              <span class="local-upload-tip">上传中，请稍候…</span>
            </template>
            <template v-else>
              <UploadOutlined class="local-upload-icon" />
              <span class="local-upload-tip">点击选择图片（支持多选）</span>
              <span class="local-upload-hint">JPG · PNG · WEBP · 上传后自动进入 AI 二创</span>
            </template>
          </div>
        </template>
        <div class="card-actions">
          <div class="action-left">
            <template v-if="activeTab === 'link'">
              <a-switch v-model:checked="directRewrite" size="small" />
              <span class="direct-label" :class="{ off: !directRewrite }">直接改写</span>
              <template v-if="directRewrite">
                <a-divider type="vertical" style="margin: 0 2px;" />
                <a-switch v-model:checked="imgTextRewrite" size="small" />
                <span class="direct-label" :class="{ off: !imgTextRewrite }">图片文字二创</span>
              </template>
            </template>
            <a-button type="link" size="small" class="prompt-btn" @click="showPromptDrawer = true">
              <SettingOutlined />
              提示词配置
            </a-button>
          </div>
          <a-button
            type="primary"
            size="large"
            class="rewrite-btn"
            :loading="submitting"
            :disabled="activeTab === 'link' ? !links.trim() : (!productUrl.trim() && !productResult)"
            @click="onRewrite"
          >
            <template #icon><ThunderboltOutlined /></template>
            {{ activeTab === 'link' ? '一键 AI 改写' : '解析商品' }}
            <ArrowRightOutlined />
          </a-button>
        </div>
        <div class="card-footer-tip">
          <InfoCircleOutlined />
          <template v-if="activeTab === 'link'">支持多链接批量改写 · 每行一条链接 · 最多 10 条</template>
          <template v-else>支持小红书商品页链接 · 自动提取商品标题和主图、详情图</template>
        </div>
      </div>
    </div>

    <!-- 商品解析结果 -->
    <div v-if="activeTab === 'product' && productResult" class="product-result-card">
      <div class="product-result-header">
        <span class="product-result-title">{{ productResult.title || '（无标题）' }}</span>
        <a-button size="small" @click="productResult = null; productAiImages = []"><CloseOutlined /> 清除</a-button>
      </div>
      <div v-if="productResult.images?.length" class="product-img-section">
        <div class="product-img-label">商品图片（{{ productResult.images.length }} 张）</div>
        <div class="product-img-grid">
          <div
            v-for="(img, ii) in productResult.images"
            :key="ii"
            class="product-img-item"
          >
            <img :src="img" class="product-img-thumb" @error="e => e.target.style.display='none'" />
            <div class="product-img-overlay">
              <a-button size="small" type="primary" ghost @click="downloadProductImg(img, ii)">
                <DownloadOutlined />
              </a-button>
              <a-button size="small" danger ghost @click.stop="deleteProductImg(ii)">
                <DeleteOutlined />
              </a-button>
            </div>
          </div>
        </div>
        <div class="product-bottom-actions">
          <a-button size="small" @click="downloadAllProductImgs">
            <DownloadOutlined /> 批量下载
          </a-button>
          <a-button
            size="small"
            type="primary"
            class="product-ai-btn"
            :loading="productAiGenerating"
            :disabled="productAiGenerating"
            @click="handleProductAiRewrite"
          >
            <template #icon><ThunderboltOutlined /></template>
            AI 二创
          </a-button>
        </div>
      </div>
      <div v-else class="product-no-img">未解析到图片，可能商品页需要登录或页面结构不支持</div>

      <!-- AI 二创结果 -->
      <template v-if="productAiImages.length">
        <div class="product-ai-divider" />
        <div class="product-img-section">
          <div class="product-img-label">
            AI 二创图片（{{ productAiImages.filter(i => i.status === 'done').length }} / {{ productAiImages.length }} 张完成）
          </div>
          <div class="product-img-grid">
            <div
              v-for="(img, ii) in productAiImages"
              :key="ii"
              class="product-img-item"
            >
              <!-- 排队 / 生成中 -->
              <div v-if="img.status === 'pending' || img.status === 'running'" class="img-placeholder">
                <a-spin size="small" />
                <span class="img-placeholder-text">{{ img.status === 'pending' ? '排队中' : '生成中' }}</span>
              </div>
              <!-- 失败 -->
              <div v-else-if="img.status === 'error'" class="img-error">
                <ExclamationCircleOutlined />
                <span>生成失败</span>
                <a-button size="small" class="img-retry-btn" @click.stop="retryProductAiImage(img)">
                  <ReloadOutlined /> 重试
                </a-button>
              </div>
              <!-- 完成 -->
              <template v-else>
                <img :src="img.url" :alt="`AI二创 ${ii + 1}`" class="img-preview" />
                <div class="img-overlay">
                  <a-button size="small" type="primary" ghost :loading="img.downloading" @click.prevent="downloadProductAiImage(img, ii)">
                    <DownloadOutlined /> 下载
                  </a-button>
                </div>
              </template>
            </div>
          </div>
          <a-button
            v-if="productAiImages.some(i => i.status === 'done')"
            size="small"
            :loading="productAiBatchDownloading"
            @click="downloadAllProductAiImages"
            style="margin-top:8px"
          >
            <DownloadOutlined /> 批量下载 AI 图
          </a-button>
        </div>
      </template>
    </div>

    <!-- 改写任务列表 -->
    <div v-if="jobs.length" class="result-section">
      <div class="result-section-header">
        <span class="result-section-title">改写任务（{{ jobs.length }} 条）</span>
        <a-button size="small" danger @click="jobs = []">清除全部</a-button>
      </div>

      <div v-for="(job, ji) in jobs" :key="job.id" class="result-card">
        <!-- 卡片头部 -->
        <div class="result-card-header">
          <div class="result-source">
            <LinkOutlined style="flex-shrink:0" />
            <span class="source-url">{{ job.sourceUrl }}</span>
          </div>
          <div class="header-right">
            <!-- 总耗时 -->
            <span v-if="job.status === 'done'" class="elapsed-total">
              {{ formatDuration(job.totalMs) }}
            </span>
            <a-tag :color="statusColor(job.status)">{{ statusLabel(job.status) }}</a-tag>
          </div>
        </div>

        <!-- ===== 进度日志面板（运行中始终展示，完成后可折叠） ===== -->
        <div class="progress-panel" :class="{ collapsed: job.status === 'done' && job.logsCollapsed }">
          <!-- 折叠切换 -->
          <div v-if="job.status === 'done'" class="panel-toggle" @click="job.logsCollapsed = !job.logsCollapsed">
            <span class="toggle-label">
              <BarsOutlined />
              执行日志
            </span>
            <DownOutlined class="toggle-arrow" :class="{ rotated: !job.logsCollapsed }" />
          </div>

          <div v-show="!job.logsCollapsed || job.status !== 'done'" class="steps-list">
            <div
              v-for="step in job.steps"
              :key="step.key"
              class="step-item"
              :class="step.status"
            >
              <!-- 左侧状态图标 -->
              <div class="step-icon-wrap">
                <LoadingOutlined v-if="step.status === 'running'" class="step-icon spin" />
                <CheckCircleFilled v-else-if="step.status === 'done'" class="step-icon done" />
                <CloseCircleFilled v-else-if="step.status === 'error'" class="step-icon error" />
                <div v-else class="step-icon-dot" />
              </div>

              <!-- 步骤主体 -->
              <div class="step-body">
                <div class="step-top">
                  <span class="step-label">{{ step.label }}</span>
                  <span v-if="step.durationMs != null" class="step-duration">
                    {{ formatDuration(step.durationMs) }}
                  </span>
                </div>

                <!-- 流式文字输出（标题/正文） -->
                <div v-if="step.streaming !== undefined" class="step-streaming">
                  <span class="streaming-text">{{ step.streaming }}</span>
                  <span v-if="step.status === 'running'" class="cursor" />
                </div>

                <!-- 图片预览行（图片步骤完成后） -->
                <div v-if="step.imgUrl" class="step-img-preview">
                  <img :src="step.imgUrl" class="step-img" />
                  <a-button size="small" type="link" style="padding:0;font-size:11px" @click="downloadFromUrl(step.imgUrl, `img_${step.key}.jpg`)">
                    <DownloadOutlined /> 下载
                  </a-button>
                </div>

                <!-- 错误信息 -->
                <div v-if="step.status === 'error' && step.errMsg" class="step-error-msg">
                  {{ step.errMsg }}
                </div>

                <!-- 日志子条目 -->
                <div v-if="step.logs?.length" class="step-logs">
                  <div v-for="(log, li) in step.logs" :key="li" class="log-line" :class="log.type">
                    <span class="log-time">{{ log.time }}</span>
                    <span class="log-text">{{ log.text }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== 改写结果（完成后展示） ===== -->
        <template v-if="job.status === 'done' && job.result">
          <div class="result-divider" />
          <div class="result-body">
            <!-- 左：文案 -->
            <div class="result-text">
              <div class="result-block">
                <div class="result-block-label">改写标题</div>
                <div class="result-block-content title-content">{{ job.result.title }}</div>
                <a-button size="small" @click="copyText(job.result.title)">
                  <CopyOutlined /> 复制
                </a-button>
              </div>
              <div class="result-block">
                <div class="result-block-label">改写正文</div>
                <div class="result-block-content">{{ job.result.content }}</div>
                <a-button size="small" @click="copyText(job.result.content)">
                  <CopyOutlined /> 复制
                </a-button>
              </div>
            </div>

            <!-- 右：图片 -->
            <div v-if="job.result.images?.length" class="result-images">
              <div class="result-block-label">AI 二创图片（{{ job.result.images.length }} 张）</div>
              <div class="image-grid">
                <div
                  v-for="(img, ii) in job.result.images"
                  :key="ii"
                  class="image-item"
                >
                  <div v-if="img.status !== 'done' && img.status !== 'error'" class="img-placeholder">
                    <a-spin size="small" />
                    <span class="img-placeholder-text">{{ img.status === 'pending' ? '排队中' : '生成中' }}</span>
                  </div>
                  <div v-else-if="img.status === 'error'" class="img-error">
                    <ExclamationCircleOutlined />
                    <span>生成失败</span>
                    <a-button size="small" class="img-retry-btn" @click.stop="retryImage(job, img, ii)">
                      <ReloadOutlined /> 重试
                    </a-button>
                  </div>
                  <template v-else>
                    <img :src="img.url" :alt="`图片${ii + 1}`" class="img-preview" />
                    <div class="img-overlay">
                      <a-button size="small" type="primary" ghost :loading="img.downloading" @click.prevent="downloadSingleImage(img, ii)">
                        <DownloadOutlined /> 下载
                      </a-button>
                      <a-button size="small" type="primary" ghost @click.prevent="openEditModal(job, img, ii)">
                        <EditOutlined /> AI 编辑
                      </a-button>
                    </div>
                  </template>
                </div>
              </div>
              <a-button
                v-if="job.result.images.some(i => i.status === 'done')"
                size="small"
                :loading="job.batchDownloading"
                :disabled="job.batchDownloading"
                @click="downloadAllImages(job)"
              >
                <DownloadOutlined /> 批量下载
              </a-button>
            </div>
          </div>

          <div class="result-card-footer">
            <a-button size="small" @click="copyAll(job.result)">
              <CopyOutlined /> 复制标题+正文
            </a-button>
            <a-button size="small" @click="rewriteAgain(job)">
              <ReloadOutlined /> 重新改写
            </a-button>
          </div>
        </template>

        <!-- 错误结果 -->
        <a-alert
          v-if="job.status === 'error'"
          :message="job.error"
          type="error"
          show-icon
          style="margin-top: 12px"
        />
      </div>
    </div>

    <!-- 单图 AI 编辑 Modal -->
    <a-modal
      v-model:open="editState.visible"
      title="编辑图片提示词"
      :footer="null"
      :width="560"
      :mask-closable="!editState.generating"
      destroy-on-close
    >
      <p class="edit-modal-sub">AI 会结合当前编辑及系统预设提示词生成新图</p>

      <div class="edit-modal-body">
        <!-- 左：提示词输入 -->
        <a-textarea
          v-model:value="editState.customPrompt"
          class="edit-prompt-ta"
          placeholder="描述你希望如何改动这张图，例如：换成浅色背景、参考这张图的色调风格…"
          :maxlength="500"
          :rows="7"
          show-count
        />

        <!-- 右：参考图上传 -->
        <div class="edit-ref-col">
          <div class="edit-ref-label">上传参考图</div>
          <div
            class="edit-ref-area"
            :class="{ 'has-img': editState.refPreview }"
            @click="triggerRefUpload"
          >
            <template v-if="editState.refPreview">
              <img :src="editState.refPreview" class="edit-ref-img" />
              <div class="edit-ref-change">更换</div>
              <button class="edit-ref-rm" @click.stop="removeRefImage">×</button>
            </template>
            <template v-else>
              <PlusOutlined class="edit-ref-plus" />
              <span class="edit-ref-hint">点击上传</span>
            </template>
          </div>
          <div class="edit-ref-tip"><InfoCircleOutlined /> 学习图片风格</div>
        </div>
      </div>

      <input
        ref="refFileInput"
        type="file"
        accept="image/*"
        style="display:none"
        @change="handleRefImageChange"
      />

      <div class="edit-modal-footer">
        <div class="edit-footer-left">
          <a-switch v-model:checked="editState.attachSysPrompt" size="small" />
          <span class="edit-footer-label">附上系统提示词</span>
        </div>
        <div class="edit-footer-right">
          <a-button @click="closeEditModal">取消</a-button>
          <a-button
            type="primary"
            class="edit-gen-btn"
            :loading="editState.generating"
            @click="onEditGenerate"
          >
            立即生成
          </a-button>
        </div>
      </div>
    </a-modal>

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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  LinkOutlined, PictureOutlined, ShoppingOutlined, SettingOutlined,
  ThunderboltOutlined, ArrowRightOutlined, InfoCircleOutlined,
  CopyOutlined, DownloadOutlined, ReloadOutlined, ExclamationCircleOutlined,
  LoadingOutlined, CheckCircleFilled, CloseCircleFilled, BarsOutlined, DownOutlined,
  EditOutlined, PlusOutlined, CloseOutlined, UploadOutlined, DeleteOutlined,
} from '@ant-design/icons-vue'
import RewritePromptPanel from './RewritePrompt.vue'
import { parseXhsLink, rewriteContent, rewriteImage, uploadXhsImageViaWorker, uploadLocalImageToR2, proxyImageForDownload, parseProductLink } from '@/api/xhsRewrite'
import { processImageForDownload, triggerBlobDownload } from '@/utils/imageProcess'

const links = ref('')
const productUrl = ref('')
const productResult = ref(null)   // { title, images: string[] }
const productAiImages = ref([])   // [{ src, url, status, downloading }]
const productAiGenerating = ref(false)
const productAiBatchDownloading = ref(false)
const activeTab = ref('link')    // 'link' | 'product'
const submitting = ref(false)
const showPromptDrawer = ref(false)
const jobs = ref([])
const directRewrite = ref(true)
const imgTextRewrite = ref(false)   // 图片文字二创，默认关闭

// 直接改写关闭时，联动重置图片文字二创
watch(directRewrite, (val) => { if (!val) imgTextRewrite.value = false })

// 本地图片上传
const localFileInput = ref(null)
const localUploading = ref(false)

const router = useRouter()

// ─── 从 Chrome 插件跳转时自动填充商品数据 ─────────────────────
onMounted(async () => {
  let raw = null
  try {
    const xhsGoods = new URLSearchParams(location.search).get('xhs_goods')
    if (!xhsGoods) return
    raw = JSON.parse(decodeURIComponent(xhsGoods))
  } catch {
    return
  }

  if (!raw || (!raw.images?.length && !raw.title)) return

  // 先用原始 URL 展示（立刻可见），避免空白
  productResult.value = { title: raw.title || '', images: raw.images || [] }
  activeTab.value = 'product'
  window.history.replaceState({}, '', location.pathname)

  // 若有图片，尝试通过 worker 代理到 R2（绕过 XHS CDN 防外链）
  if (raw.images?.length) {
    message.info(`正在代理 ${raw.images.length} 张图片…`, 2)
    const proxied = await Promise.all(
      raw.images.map(async (url) => {
        try {
          const res = await proxyImageForDownload(url)
          return res?.url || url   // 代理成功用 R2 URL，失败降级原 URL
        } catch {
          return url
        }
      })
    )
    // 更新为 R2 可访问的地址
    productResult.value = { title: raw.title || '', images: proxied }
    message.success(`已填充商品数据：${proxied.length} 张图片`)
  } else {
    message.success(`已填充商品数据（仅标题，未找到图片）`)
  }
})

let _jobId = 0

// 默认图片提示词（与 RewritePrompt.vue 中保持一致，用于「附上系统提示词」功能）
const DEFAULT_IMAGE_PROMPT = `基于输入图片进行轻度重绘，生成一张风格自然、适合小红书发布的新图。

要求：
1. 保持主体、产品、人物和核心构图基本不变
2. 可以调整色调、背景细节、光线感和氛围，让画面更清新、更有质感
3. 风格贴近小红书流行审美：明亮、干净、真实生活感
4. 不添加文字水印或 logo
5. 输出比例与原图一致`

// 单图 AI 编辑弹窗状态
const editState = reactive({
  visible: false,
  job: null,
  img: null,
  imgIdx: -1,
  customPrompt: '',
  attachSysPrompt: true,
  refFile: null,
  refPreview: '',
  generating: false,
})
const refFileInput = ref(null)

// ─── 工具函数 ──────────────────────────────────────────────

function parseLinks(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 10)
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function formatDuration(ms) {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusColor(s) {
  return { running: 'processing', done: 'success', error: 'error', pending: 'default' }[s] ?? 'default'
}
function statusLabel(s) {
  return { running: '改写中', done: '已完成', error: '失败', pending: '排队' }[s] ?? s
}

// ─── Step 操作 ────────────────────────────────────────────

function makeStep(key, label, extra = {}) {
  return { key, label, status: 'pending', durationMs: null, logs: [], errMsg: '', ...extra }
}

/** 开始一个步骤，返回结束函数 */
function startStep(job, key) {
  const step = job.steps.find(s => s.key === key)
  if (!step) return () => {}
  step.status = 'running'
  step.logs.push({ time: nowTime(), text: `开始执行…`, type: 'info' })
  const t0 = Date.now()
  return (ok = true, msg = '') => {
    step.durationMs = Date.now() - t0
    step.status = ok ? 'done' : 'error'
    if (!ok) step.errMsg = msg
    step.logs.push({
      time: nowTime(),
      text: ok ? `✓ 完成，耗时 ${formatDuration(step.durationMs)}` : `✗ ${msg}`,
      type: ok ? 'success' : 'error',
    })
  }
}

function addStepLog(job, key, text, type = 'info') {
  const step = job.steps.find(s => s.key === key)
  if (step) step.logs.push({ time: nowTime(), text, type })
}

/** 逐字打字动画（模拟流式输出） */
async function typewrite(step, text, msPerChar = 18) {
  step.streaming = ''
  for (const ch of text) {
    step.streaming += ch
    await new Promise(r => setTimeout(r, msPerChar))
  }
}

// ─── 主流程 ───────────────────────────────────────────────

async function onRewrite() {
  // ── 商品链接模式 ─────────────────────────────────────────
  if (activeTab.value === 'product') {
    const url = productUrl.value.trim()
    if (!url) { message.warning('请输入商品链接'); return }
    submitting.value = true
    productResult.value = null
    productAiImages.value = []
    try {
      const result = await parseProductLink({ url })
      productResult.value = result
      if (!result.images?.length) message.warning('未解析到图片，请检查链接或尝试其他商品')
      else message.success(`解析成功：${result.images.length} 张图片`)
    } catch (e) {
      message.error(e.message || '解析失败，请检查链接')
    } finally {
      submitting.value = false
    }
    return
  }

  // ── 小红书链接模式（原有逻辑） ────────────────────────────
  const urlList = parseLinks(links.value)
  if (!urlList.length) { message.warning('请先填写小红书链接'); return }
  submitting.value = true

  // 关闭"直接改写"时：解析第一条链接后跳转编辑页
  if (!directRewrite.value) {
    try {
      const parsed = await parseXhsLink({ url: urlList[0] })
      sessionStorage.setItem('xhs_rewrite_draft', JSON.stringify({
        sourceUrl: urlList[0],
        title: parsed.title,
        content: parsed.content,
        images: parsed.images ?? [],
      }))
      router.push({ name: 'ai-rewrite-edit' })
    } catch (e) {
      message.error(e.message || '解析链接失败，请检查链接或 Cookie 配置')
    } finally {
      submitting.value = false
    }
    return
  }

  // 直接改写：批量处理全部链接
  const newJobs = urlList.map(url => ({
    id: ++_jobId,
    sourceUrl: url,
    status: 'running',
    result: null,
    error: null,
    totalMs: null,
    logsCollapsed: true,
    steps: [
      makeStep('parse',   '📡  解析小红书链接'),
      makeStep('title',   '✍️   AI 改写标题',   { streaming: '' }),
      makeStep('content', '📝  AI 改写正文',   { streaming: '' }),
      // 图片步骤在解析到图片数量后动态追加
    ],
  }))

  jobs.value = [...newJobs, ...jobs.value]
  submitting.value = false

  // 必须从 jobs.value 取响应式 Proxy，直接用 newJobs 原始对象赋值不会触发 Vue 响应式
  for (let i = 0; i < newJobs.length; i++) {
    processJob(jobs.value[i])
  }
}

async function processJob(job) {
  const t0 = Date.now()

  try {
    // ── Step 1: 解析链接 ───────────────────────────────────
    const endParse = startStep(job, 'parse')
    addStepLog(job, 'parse', `链接：${job.sourceUrl}`)

    let parsed
    try {
      parsed = await parseXhsLink({ url: job.sourceUrl })
      addStepLog(job, 'parse', `获取到标题：${parsed.title?.slice(0, 30)}…`)
      addStepLog(job, 'parse', `正文 ${parsed.content?.length ?? 0} 字，图片 ${parsed.images?.length ?? 0} 张`)
      endParse(true)
    } catch (e) {
      endParse(false, e.message || '解析失败，请检查链接或 Cookie')
      throw e
    }

    // 动态追加图片步骤
    const imgCount = parsed.images?.length ?? 0
    for (let i = 0; i < imgCount; i++) {
      job.steps.push(makeStep(`img_${i}`, `🎨  AI 绘图 第 ${i + 1} 张`))
    }

    // ── Step 2: AI 改写标题 ────────────────────────────────
    const endTitle = startStep(job, 'title')
    addStepLog(job, 'title', '调用 LLM 生成中…')
    const titleStep = job.steps.find(s => s.key === 'title')

    let rewritten
    try {
      rewritten = await rewriteContent({ title: parsed.title, content: parsed.content })

      // 打字动画展示标题
      await typewrite(titleStep, rewritten.title, 22)
      endTitle(true)
      addStepLog(job, 'title', `生成标题：${rewritten.title}`)
    } catch (e) {
      endTitle(false, e.message || '标题改写失败')
      throw e
    }

    // ── Step 3: AI 改写正文 ────────────────────────────────
    const endContent = startStep(job, 'content')
    addStepLog(job, 'content', '调用 LLM 生成中…')
    const contentStep = job.steps.find(s => s.key === 'content')

    try {
      // 正文打字动画（使用已获取的 rewritten.content）
      await typewrite(contentStep, rewritten.content, 8)
      endContent(true)
      addStepLog(job, 'content', `正文共 ${rewritten.content?.length ?? 0} 字`)
    } catch (e) {
      endContent(false, e.message || '正文改写失败')
      throw e
    }

    // 文案完成后，先展示结果框架（图片异步继续）
    const images = (parsed.images ?? []).map((src, i) => ({ src, url: '', status: 'pending', idx: i, downloading: false }))
    job.result = { title: rewritten.title, content: rewritten.content, images }
    job.status = 'done'
    job.totalMs = Date.now() - t0
    job.logsCollapsed = false // 完成后先展开日志供查看

    // ── Step 4: 逐张 AI 绘图 ──────────────────────────────
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      const imgStep = job.steps.find(s => s.key === `img_${i}`)
      const endImg = startStep(job, `img_${i}`)
      addStepLog(job, `img_${i}`, `原图地址：${img.src?.slice(0, 50)}…`)
      img.status = 'running'

      try {
        // Step 1：浏览器下载原图 → 上传到 R2（绕过 XHS CDN 防外链）
        // 若已有缓存的 publicSrc（重试时复用），跳过重新上传
        let publicSrc = img.publicSrc || ''
        if (!publicSrc) {
          addStepLog(job, `img_${i}`, `浏览器中转上传中…`)
          try {
            const uploaded = await uploadXhsImageViaWorker(img.src)
            publicSrc = uploaded.url
            img.publicSrc = publicSrc // 缓存，供重试复用
            addStepLog(job, `img_${i}`, `原图已上传：${publicSrc?.slice(0, 50)}…`)
          } catch (uploadErr) {
            throw new Error(`原图上传失败：${uploadErr.message}`)
          }
        } else {
          addStepLog(job, `img_${i}`, `复用已上传原图：${publicSrc?.slice(0, 50)}…`)
        }

        // Step 2：调 AI 绘图
        const res = await rewriteImage({
          src: publicSrc,
          prompt: '',
          image_prompt: imgTextRewrite.value
            ? '保持图片整体构图和主体内容不变，对图片中出现的所有覆盖文字进行改写，更换措辞和表达方式，文字风格与原图保持一致，其余内容轻度重绘，风格清新自然，适合小红书发布。'
            : '',
        })
        img.url = res.url
        img.status = 'done'
        if (imgStep) imgStep.imgUrl = res.url
        endImg(true)
        addStepLog(job, `img_${i}`, `新图已生成：${res.url?.slice(0, 50)}…`)
      } catch (e) {
        img.status = 'error'
        endImg(false, e.message || '绘图失败')
      }
    }

  } catch (e) {
    if (job.status !== 'done') {
      job.status = 'error'
      job.error = e.message || '改写失败，请检查链接或 Cookie 配置'
      job.totalMs = Date.now() - t0
    }
  }
}

// ─── 本地图片上传（直接进 AI 二创） ──────────────────────────

function triggerLocalUpload() {
  localFileInput.value?.click()
}

async function handleLocalImageUpload(e) {
  const files = [...(e.target.files ?? [])]
  e.target.value = ''   // 允许重复选同一批文件
  if (!files.length) return

  localUploading.value = true
  const hide = message.loading(`上传 ${files.length} 张图片中…`, 0)
  let uploaded = 0

  try {
    const urls = await Promise.all(
      files.map(async (file) => {
        const res = await uploadLocalImageToR2(file)
        uploaded++
        return res.url
      })
    )
    // 追加到现有图片（或新建）
    const prev = productResult.value
    productResult.value = {
      title: prev?.title || '',
      images: [...(prev?.images ?? []), ...urls],
    }
    productAiImages.value = []   // 新图加入，清空旧的 AI 二创结果
    hide()
    message.success(`已上传 ${urls.length} 张图片，点击「AI 二创」开始生成`)
  } catch (err) {
    hide()
    message.error(err.message || '图片上传失败')
  } finally {
    localUploading.value = false
  }
}

// ─── 商品图片下载 ─────────────────────────────────────────

/** 删除单张商品图片 */
function deleteProductImg(idx) {
  productResult.value = {
    ...productResult.value,
    images: productResult.value.images.filter((_, i) => i !== idx),
  }
  // 图片来源变化，清空旧的 AI 二创结果
  productAiImages.value = []
}

async function downloadProductImg(url, idx) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    triggerBlobDownload(blob, `product_${idx + 1}.jpg`)
  } catch (e) {
    message.error(`下载失败：${e.message}`)
  }
}

async function downloadAllProductImgs() {
  const imgs = productResult.value?.images ?? []
  if (!imgs.length) return
  const hide = message.loading(`下载 ${imgs.length} 张图片中…`, 0)
  let ok = 0
  for (let i = 0; i < imgs.length; i++) {
    try {
      const res = await fetch(imgs[i])
      if (!res.ok) continue
      const blob = await res.blob()
      triggerBlobDownload(blob, `product_${i + 1}.jpg`)
      ok++
      if (i < imgs.length - 1) await new Promise(r => setTimeout(r, 600))
    } catch { /* 单张失败不中断 */ }
  }
  hide()
  message.success(`已下载 ${ok} / ${imgs.length} 张`)
}

// ─── 商品图片 AI 二创 ──────────────────────────────────────

/** 单张商品图执行 AI 二创（先代理到 R2，再调 AI 绘图） */
async function _doProductAiOne(imgObj) {
  imgObj.status = 'running'
  imgObj.url = ''
  try {
    // 优先复用已上传的 R2 地址（重试时跳过中转）
    let publicSrc = imgObj.publicSrc || imgObj.src
    if (!imgObj.publicSrc && /xhscdn\.com|xiaohongshu\.com/i.test(imgObj.src)) {
      const uploaded = await uploadXhsImageViaWorker(imgObj.src)
      publicSrc = uploaded.url
      imgObj.publicSrc = publicSrc // 缓存，重试复用
    }
    const res = await rewriteImage({ src: publicSrc, prompt: '' })
    imgObj.url = res.url
    imgObj.status = 'done'
  } catch (e) {
    imgObj.status = 'error'
    imgObj.errMsg = e.message || '绘图失败'
  }
}

/** AI 二创全部商品图 */
async function handleProductAiRewrite() {
  const srcs = productResult.value?.images ?? []
  if (!srcs.length) { message.warning('请先解析到商品图片'); return }

  productAiGenerating.value = true
  // 初始化（重新生成时重置）
  productAiImages.value = srcs.map(src => ({
    src, url: '', status: 'pending', downloading: false, errMsg: '',
  }))

  for (const imgObj of productAiImages.value) {
    await _doProductAiOne(imgObj)
  }

  productAiGenerating.value = false
  const done = productAiImages.value.filter(i => i.status === 'done').length
  message.success(`AI 二创完成：${done} / ${productAiImages.value.length} 张`)
}

/** 单张失败重试 */
async function retryProductAiImage(imgObj) {
  await _doProductAiOne(imgObj)
}

/** 下载单张 AI 二创图 */
async function downloadProductAiImage(img, idx) {
  if (img.downloading) return
  img.downloading = true
  try {
    const blob = await _getProcessedBlob(img.url)
    triggerBlobDownload(blob, `product_ai_${idx + 1}.jpg`)
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    img.downloading = false
  }
}

/** 批量下载全部已完成的 AI 二创图 */
async function downloadAllProductAiImages() {
  const doneImgs = productAiImages.value.filter(i => i.status === 'done')
  if (!doneImgs.length) return
  productAiBatchDownloading.value = true
  const hide = message.loading(`下载 ${doneImgs.length} 张 AI 图中…`, 0)
  let ok = 0
  for (let i = 0; i < doneImgs.length; i++) {
    try {
      const blob = await _getProcessedBlob(doneImgs[i].url)
      triggerBlobDownload(blob, `product_ai_${i + 1}.jpg`)
      ok++
      if (i < doneImgs.length - 1) await new Promise(r => setTimeout(r, 600))
    } catch { /* 单张失败不中断 */ }
  }
  hide()
  productAiBatchDownloading.value = false
  message.success(`已下载 ${ok} / ${doneImgs.length} 张 AI 图（已处理去重指纹）`)
}

// ─── 操作函数 ─────────────────────────────────────────────

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); message.success('已复制') }
  catch { message.error('复制失败，请手动选中') }
}

async function copyAll(result) {
  await copyText(`${result.title}\n\n${result.content}`)
}

// ─── 图片下载（带防 AI 标注 + 去重指纹处理） ────────────────

/**
 * 内部：获取 blob，自动处理 CORS。
 * - 优先直接 CORS fetch（若 AI CDN 支持）
 * - 失败后通过 Worker 中转到 R2 再处理（绕过 CDN CORS 限制）
 */
async function _getProcessedBlob(srcUrl) {
  try {
    return await processImageForDownload(srcUrl)
  } catch {
    // AI 服务 CDN 不返回 CORS 头，通过 Worker 中转
    const proxied = await proxyImageForDownload(srcUrl)
    return await processImageForDownload(proxied.url)
  }
}

/** 单张下载（供图片 overlay 按钮调用） */
async function downloadSingleImage(img, idx) {
  if (img.downloading) return
  img.downloading = true
  try {
    const blob = await _getProcessedBlob(img.url)
    triggerBlobDownload(blob, `xhs_ai_${idx + 1}.jpg`)
    message.success('下载成功（已处理去重指纹）')
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    img.downloading = false
  }
}

/** 通过 URL 直接下载（供执行日志下载按钮调用） */
async function downloadFromUrl(url, filename) {
  try {
    const blob = await _getProcessedBlob(url)
    triggerBlobDownload(blob, filename)
  } catch (e) {
    message.error(e.message || '下载失败')
  }
}

/** 批量下载全部已完成的图片 */
async function downloadAllImages(job) {
  const doneImgs = job.result.images.filter(i => i.status === 'done' && !i.downloading)
  if (!doneImgs.length) return

  job.batchDownloading = true
  const hideMsg = message.loading(`处理 ${doneImgs.length} 张图片中…`, 0)
  let success = 0

  for (let i = 0; i < doneImgs.length; i++) {
    const img = doneImgs[i]
    img.downloading = true
    try {
      const blob = await _getProcessedBlob(img.url)
      triggerBlobDownload(blob, `xhs_ai_${img.idx + 1}.jpg`)
      success++
      // 批量下载间隔，避免浏览器弹窗被拦截
      if (i < doneImgs.length - 1) await new Promise(r => setTimeout(r, 600))
    } catch {
      // 单张失败不中断
    } finally {
      img.downloading = false
    }
  }

  hideMsg()
  job.batchDownloading = false
  message.success(`已下载 ${success} / ${doneImgs.length} 张（已处理去重指纹）`)
}

function rewriteAgain(job) {
  const url = job.sourceUrl
  const idx = jobs.value.indexOf(job)
  const newJob = {
    id: ++_jobId,
    sourceUrl: url,
    status: 'running',
    result: null,
    error: null,
    totalMs: null,
    logsCollapsed: true,
    steps: [
      makeStep('parse',   '📡  解析小红书链接'),
      makeStep('title',   '✍️   AI 改写标题',   { streaming: '' }),
      makeStep('content', '📝  AI 改写正文',   { streaming: '' }),
    ],
  }
  jobs.value.splice(idx, 1, newJob)
  processJob(jobs.value[idx]) // 使用响应式 Proxy
}

/** 对单张失败图片发起重新生成 */
async function retryImage(job, img, idx) {
  img.status = 'running'
  img.url = ''

  const stepKey = `img_${idx}`
  const imgStep = job.steps.find(s => s.key === stepKey)
  if (imgStep) {
    imgStep.status = 'running'
    imgStep.imgUrl = ''
    imgStep.errMsg = ''
    imgStep.logs.push({ time: nowTime(), text: '重新发起绘图…', type: 'info' })
  }

  try {
    // 优先复用首次已上传的 R2 地址，避免重复走浏览器中转
    let publicSrc = img.publicSrc || ''
    if (!publicSrc) {
      addStepLog(job, stepKey, `浏览器中转上传中…`)
      try {
        const uploaded = await uploadXhsImageViaWorker(img.src)
        publicSrc = uploaded.url
        img.publicSrc = publicSrc // 缓存，下次重试继续复用
        addStepLog(job, stepKey, `原图已上传：${publicSrc?.slice(0, 50)}…`)
      } catch (uploadErr) {
        throw new Error(`原图上传失败：${uploadErr.message}`)
      }
    } else {
      addStepLog(job, stepKey, `复用已上传原图：${publicSrc?.slice(0, 50)}…`)
    }

    // 重新调 AI 绘图
    const res = await rewriteImage({ src: publicSrc, prompt: '' })
    img.url = res.url
    img.status = 'done'
    if (imgStep) {
      imgStep.status = 'done'
      imgStep.imgUrl = res.url
      imgStep.logs.push({ time: nowTime(), text: `✓ 重新生成成功`, type: 'success' })
    }
  } catch (e) {
    img.status = 'error'
    if (imgStep) {
      imgStep.status = 'error'
      imgStep.errMsg = e.message || '绘图失败'
      imgStep.logs.push({ time: nowTime(), text: `✗ ${e.message || '绘图失败'}`, type: 'error' })
    }
  }
}

// ─── 单图 AI 编辑 ─────────────────────────────────────────

function openEditModal(job, img, idx) {
  Object.assign(editState, {
    visible: true,
    job, img, imgIdx: idx,
    customPrompt: '',
    attachSysPrompt: true,
    refFile: null,
    refPreview: '',
    generating: false,
    _srcSnapshot: img.url,  // 打开弹窗时快照当前生成图 URL，提交后 img.url 会被清空
  })
}

function closeEditModal() {
  if (editState.generating) return
  editState.visible = false
}

function triggerRefUpload() {
  refFileInput.value?.click()
}

function handleRefImageChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  editState.refFile = file
  const reader = new FileReader()
  reader.onload = () => { editState.refPreview = reader.result }
  reader.readAsDataURL(file)
  e.target.value = '' // 允许重复选同一文件
}

function removeRefImage() {
  editState.refFile = null
  editState.refPreview = ''
}

async function onEditGenerate() {
  const { job, img, imgIdx, customPrompt, attachSysPrompt, refFile } = editState
  if (!customPrompt.trim() && !refFile) {
    message.warning('请输入提示词或上传参考图')
    return
  }

  editState.generating = true
  const stepKey = `img_${imgIdx}`
  const imgStep = job.steps.find(s => s.key === stepKey)

  // 组合最终提示词
  let finalPrompt = customPrompt.trim()
  if (attachSysPrompt) {
    finalPrompt = finalPrompt
      ? `${finalPrompt}\n\n${DEFAULT_IMAGE_PROMPT}`
      : DEFAULT_IMAGE_PROMPT
  }

  try {
    // 上传参考图到 R2（如有）
    let refSrc
    if (refFile) {
      const uploaded = await uploadLocalImageToR2(refFile)
      refSrc = uploaded.url
    }

    // 关弹窗，更新图片状态为生成中
    editState.visible = false
    img.status = 'running'
    img.url = ''
    if (imgStep) {
      imgStep.status = 'running'
      imgStep.imgUrl = ''
      imgStep.errMsg = ''
      imgStep.logs.push({ time: nowTime(), text: 'AI 编辑中…', type: 'info' })
      if (refSrc) addStepLog(job, stepKey, `参考图已上传：${refSrc.slice(0, 50)}…`)
    }

    // 以当前 AI 生成图（img.url 更新前的最后已知 URL）为底图进行编辑
    // 注意：img.url 在上面已被清空为 ''，需要从 img.src 降级；
    // 但实际上我们应使用编辑前的生成图，为此提前暂存。
    // → 实际解法：在关弹窗前先读取，见 editState 存储的 img 引用
    //   (img.url 清空前已被 rewriteImage 用作 src，故在 openEditModal 时快照即可)
    const res = await rewriteImage({
      src: editState._srcSnapshot,     // 打开弹窗时的快照 URL
      image_prompt: finalPrompt || undefined,
      ref_src: refSrc,
    })

    img.url = res.url
    img.status = 'done'
    if (imgStep) {
      imgStep.status = 'done'
      imgStep.imgUrl = res.url
      imgStep.logs.push({ time: nowTime(), text: '✓ AI 编辑完成', type: 'success' })
    }
  } catch (e) {
    img.status = 'error'
    if (imgStep) {
      imgStep.status = 'error'
      imgStep.errMsg = e.message || 'AI 编辑失败'
      imgStep.logs.push({ time: nowTime(), text: `✗ ${e.message || 'AI 编辑失败'}`, type: 'error' })
    }
    message.error(e.message || 'AI 编辑失败')
  } finally {
    editState.generating = false
  }
}
</script>

<style scoped>
/* ─── 页面框架 ─────────────────────────────────────────── */
.rewrite-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding: 8px 0 48px;
}

/* ─── Hero ─────────────────────────────────────────────── */
.hero { text-align: center; max-width: 640px; }

.hero-badge {
  display: inline-block;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 4px 14px;
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 16px;
}

.hero-title {
  font-size: 32px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.3;
  margin: 0 0 10px;
  letter-spacing: -0.5px;
}

.hero-sub { font-size: 14px; color: #6b7280; margin: 0; }

/* ─── 输入卡片 ─────────────────────────────────────────── */
.input-card {
  width: 100%;
  max-width: 760px;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,.04);
}

.card-tabs {
  display: flex;
  border-bottom: 1.5px solid #f0f0f0;
  padding: 0 20px;
}

.card-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  border-bottom: 2.5px solid transparent;
  margin-bottom: -1.5px;
  cursor: pointer;
  transition: all .15s;
}
.card-tab.active  { color: #ff2442; border-bottom-color: #ff2442; }
.card-tab.disabled { color: #d1d5db; cursor: not-allowed; }

.card-body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }

.link-input { font-size: 14px; line-height: 1.7; color: #374151; resize: none; }
.link-input :deep(textarea) { padding: 0; }

.card-actions { display: flex; align-items: center; justify-content: space-between; }

.action-left { display: flex; align-items: center; gap: 10px; }

.direct-label {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}
.direct-label.off { color: #9ca3af; }

.prompt-btn { color: #6b7280 !important; font-size: 13px; padding: 0; }
.prompt-btn:hover { color: #ff2442 !important; }

.rewrite-btn {
  background: #ff2442;
  border: none;
  border-radius: 8px;
  height: 44px;
  padding: 0 24px;
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rewrite-btn:not(:disabled):hover { background: #e01f3b !important; border-color: transparent !important; }

.card-footer-tip { font-size: 12px; color: #9ca3af; display: flex; align-items: center; gap: 5px; }

/* ─── 结果区 ────────────────────────────────────────────── */
.result-section {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-section-header { display: flex; align-items: center; justify-content: space-between; }
.result-section-title { font-size: 15px; font-weight: 600; color: #374151; }

.result-card {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
}

.result-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.result-source {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  max-width: 68%;
}
.source-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.header-right { display: flex; align-items: center; gap: 8px; }
.elapsed-total { font-size: 12px; color: #9ca3af; }

/* ─── 进度面板 ─────────────────────────────────────────── */
.progress-panel {
  background: #0f1117;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 4px;
  transition: max-height .3s ease;
}

.panel-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid #1e2130;
}
.panel-toggle:hover { background: #1a1f2e; }

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.toggle-arrow {
  font-size: 11px;
  color: #6b7280;
  transition: transform .2s;
}
.toggle-arrow.rotated { transform: rotate(180deg); }

.steps-list {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ─── 单个步骤 ─────────────────────────────────────────── */
.step-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  opacity: .45;
  transition: opacity .2s;
}
.step-item.running,
.step-item.done,
.step-item.error { opacity: 1; }

.step-icon-wrap {
  width: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 1px;
}

.step-icon { font-size: 14px; }
.step-icon.spin  { color: #1677ff; animation: spin 1s linear infinite; }
.step-icon.done  { color: #52c41a; }
.step-icon.error { color: #ff4d4f; }

.step-icon-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2a2f3e;
  border: 1.5px solid #3a3f52;
}

@keyframes spin { to { transform: rotate(360deg); } }

.step-body { flex: 1; min-width: 0; }

.step-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.step-label { font-size: 13px; color: #c9d1d9; font-family: 'SF Mono', 'Fira Code', monospace; }
.step-item.done  .step-label { color: #e6edf3; }
.step-item.error .step-label { color: #ff7875; }

.step-duration { font-size: 11px; color: #484f5e; flex-shrink: 0; font-family: monospace; }
.step-item.done .step-duration { color: #52c41a; }

/* 流式文字 */
.step-streaming {
  margin-top: 5px;
  font-size: 12px;
  color: #8b949e;
  line-height: 1.6;
  max-height: 80px;
  overflow: hidden;
  font-family: 'SF Mono', 'Fira Code', monospace;
  word-break: break-all;
}

.streaming-text { color: #79c0ff; }

.cursor {
  display: inline-block;
  width: 1.5px;
  height: 12px;
  background: #79c0ff;
  margin-left: 1px;
  vertical-align: text-bottom;
  animation: blink .7s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }

/* 图片预览行 */
.step-img-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.step-img {
  width: 44px;
  height: 58px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #2a2f3e;
}

/* 错误信息 */
.step-error-msg {
  margin-top: 4px;
  font-size: 11px;
  color: #ff7875;
  font-family: monospace;
}

/* 子日志 */
.step-logs { margin-top: 5px; display: flex; flex-direction: column; gap: 2px; }

.log-line {
  display: flex;
  gap: 8px;
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  line-height: 1.5;
}
.log-time  { color: #484f5e; flex-shrink: 0; }
.log-line.info    .log-text { color: #8b949e; }
.log-line.success .log-text { color: #3fb950; }
.log-line.error   .log-text { color: #ff7875; }

/* ─── 结果主体 ─────────────────────────────────────────── */
.result-divider { height: 1px; background: #f0f0f0; margin: 16px 0; }

.result-body { display: flex; gap: 20px; align-items: flex-start; }

.result-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; }

.result-block { display: flex; flex-direction: column; gap: 6px; }

.result-block-label {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: .6px;
}

.result-block-content {
  font-size: 14px;
  line-height: 1.75;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-all;
}
.title-content { font-size: 16px; font-weight: 600; }

/* 图片 */
.result-images { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; }

.image-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }

.image-item {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f6f7;
}

.img-placeholder {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px;
}
.img-placeholder-text { font-size: 11px; color: #9ca3af; }

.img-error {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  font-size: 11px; color: #ef4444;
}

.img-retry-btn {
  margin-top: 2px;
  font-size: 11px !important;
  height: 22px !important;
  padding: 0 7px !important;
  line-height: 1 !important;
}

.img-preview { width: 100%; height: 100%; object-fit: cover; }

.img-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,.45);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  opacity: 0; transition: opacity .2s;
}
.image-item:hover .img-overlay { opacity: 1; }

/* 卡片底部 */
.result-card-footer {
  display: flex; gap: 8px;
  margin-top: 16px; padding-top: 14px;
  border-top: 1px solid #f0f0f0;
}

/* ─── 单图 AI 编辑 Modal ────────────────────────────────── */
.edit-modal-sub {
  font-size: 13px;
  color: #6b7280;
  margin: -8px 0 16px;
}

.edit-modal-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.edit-prompt-ta {
  flex: 1;
  font-size: 14px;
  line-height: 1.7;
}

/* 右侧参考图列 */
.edit-ref-col {
  width: 118px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-ref-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.edit-ref-area {
  width: 118px;
  height: 158px;
  border: 1.5px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: #f9fafb;
  transition: border-color .2s;
}
.edit-ref-area:hover,
.edit-ref-area.has-img { border-color: #ff2442; }

.edit-ref-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.edit-ref-change {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,.5);
  color: #fff;
  text-align: center;
  font-size: 12px;
  padding: 4px 0;
}

.edit-ref-rm {
  position: absolute;
  top: 4px; right: 4px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: rgba(0,0,0,.5);
  border: none;
  color: #fff;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-ref-plus { font-size: 22px; color: #9ca3af; }
.edit-ref-hint { font-size: 12px; color: #9ca3af; }

.edit-ref-tip {
  font-size: 11px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 弹窗底部 */
.edit-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.edit-footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-footer-label {
  font-size: 13px;
  color: #374151;
}

.edit-footer-right { display: flex; gap: 8px; }

.edit-gen-btn {
  background: #ff2442 !important;
  border-color: #ff2442 !important;
}
.edit-gen-btn:hover:not(:disabled) {
  background: #e01f3b !important;
  border-color: #e01f3b !important;
}

/* ─── 商品链接输入 ───────────────────────────────────────── */
.product-url-input {
  font-size: 14px;
  padding: 10px 0;
}
.product-url-input :deep(.ant-input) { font-size: 14px; }

/* ─── 本地上传图片 ───────────────────────────────────────── */
.upload-or-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #d1d5db;
  font-size: 12px;
  margin: 2px 0;
}
.upload-or-divider::before,
.upload-or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #f0f0f0;
}
.or-label { white-space: nowrap; color: #9ca3af; }

.local-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px dashed #e5e7eb;
  border-radius: 8px;
  padding: 16px 20px;
  cursor: pointer;
  background: #fafafa;
  transition: border-color .2s, background .2s;
  min-height: 80px;
}
.local-upload-area:hover { border-color: #ff2442; background: #fff5f6; }
.local-upload-area.uploading { border-color: #1677ff; cursor: default; background: #f0f7ff; }

.local-upload-icon { font-size: 22px; color: #9ca3af; }
.local-upload-area:hover .local-upload-icon { color: #ff2442; }

.local-upload-tip { font-size: 13px; color: #374151; font-weight: 500; }
.local-upload-hint { font-size: 11px; color: #9ca3af; }

/* ─── 商品解析结果卡片 ──────────────────────────────────── */
.product-result-card {
  width: 100%;
  max-width: 760px;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,.04);
}

.product-result-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.product-result-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.5;
  flex: 1;
}

.product-img-section { display: flex; flex-direction: column; gap: 10px; }
.product-img-label { font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .5px; }

.product-img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.product-img-item {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f6f7;
  border: 1px solid #e5e7eb;
}

.product-img-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-img-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0;
  transition: opacity .2s;
}
.product-img-item:hover .product-img-overlay { opacity: 1; }

.product-no-img {
  font-size: 13px;
  color: #9ca3af;
  padding: 20px 0;
  text-align: center;
}

/* 商品底部操作行 */
.product-bottom-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.product-ai-btn {
  background: #ff2442 !important;
  border-color: #ff2442 !important;
}
.product-ai-btn:hover:not(:disabled) {
  background: #e01f3b !important;
  border-color: #e01f3b !important;
}

/* AI 二创结果分隔线 */
.product-ai-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 16px 0 12px;
}
</style>
