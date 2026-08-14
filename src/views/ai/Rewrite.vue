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
        <div class="card-tab active">
          <LinkOutlined />
          小红书链接
        </div>
        <div class="card-tab disabled" title="即将开放">
          <PictureOutlined />
          上传图片
        </div>
        <div class="card-tab disabled" title="即将开放">
          <ShoppingOutlined />
          商品笔记
        </div>
      </div>

      <div class="card-body">
        <a-textarea
          v-model:value="links"
          class="link-input"
          placeholder="在此粘贴小红书笔记链接...&#10;支持标准链接、xhslink 短链、App 分享文字"
          :rows="5"
          :bordered="false"
        />
        <div class="card-actions">
          <a-button type="link" size="small" class="prompt-btn" @click="showPromptDrawer = true">
            <SettingOutlined />
            提示词配置
          </a-button>
          <a-button
            type="primary"
            size="large"
            class="rewrite-btn"
            :loading="submitting"
            :disabled="!links.trim()"
            @click="onRewrite"
          >
            <template #icon><ThunderboltOutlined /></template>
            一键 AI 改写
            <ArrowRightOutlined />
          </a-button>
        </div>
        <div class="card-footer-tip">
          <InfoCircleOutlined />
          支持多链接批量改写 · 每行一条链接 · 最多 10 条
        </div>
      </div>
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
                  <a :href="step.imgUrl" :download="`img_${step.key}.jpg`" target="_blank">
                    <a-button size="small" type="link" style="padding:0;font-size:11px">
                      <DownloadOutlined /> 下载
                    </a-button>
                  </a>
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
                  </div>
                  <template v-else>
                    <img :src="img.url" :alt="`图片${ii + 1}`" class="img-preview" />
                    <div class="img-overlay">
                      <a :href="img.url" :download="`xhs_img${ii + 1}.jpg`" target="_blank">
                        <a-button size="small" type="primary" ghost>
                          <DownloadOutlined /> 下载
                        </a-button>
                      </a>
                    </div>
                  </template>
                </div>
              </div>
              <a-button
                v-if="job.result.images.some(i => i.status === 'done')"
                size="small"
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
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  LinkOutlined, PictureOutlined, ShoppingOutlined, SettingOutlined,
  ThunderboltOutlined, ArrowRightOutlined, InfoCircleOutlined,
  CopyOutlined, DownloadOutlined, ReloadOutlined, ExclamationCircleOutlined,
  LoadingOutlined, CheckCircleFilled, CloseCircleFilled, BarsOutlined, DownOutlined,
} from '@ant-design/icons-vue'
import RewritePromptPanel from './RewritePrompt.vue'
import { parseXhsLink, rewriteContent, rewriteImage, uploadXhsImageViaWorker } from '@/api/xhsRewrite'

const links = ref('')
const submitting = ref(false)
const showPromptDrawer = ref(false)
const jobs = ref([])

let _jobId = 0

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
  const urlList = parseLinks(links.value)
  if (!urlList.length) { message.warning('请先填写小红书链接'); return }
  submitting.value = true

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
    const images = (parsed.images ?? []).map((src, i) => ({ src, url: '', status: 'pending', idx: i }))
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
        addStepLog(job, `img_${i}`, `浏览器中转上传中…`)
        let publicSrc
        try {
          const uploaded = await uploadXhsImageViaWorker(img.src)
          publicSrc = uploaded.url
          addStepLog(job, `img_${i}`, `原图已上传：${publicSrc?.slice(0, 50)}…`)
        } catch (uploadErr) {
          throw new Error(`原图上传失败：${uploadErr.message}`)
        }

        // Step 2：调 AI 绘图
        const res = await rewriteImage({ src: publicSrc, prompt: '' })
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

// ─── 操作函数 ─────────────────────────────────────────────

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); message.success('已复制') }
  catch { message.error('复制失败，请手动选中') }
}

async function copyAll(result) {
  await copyText(`${result.title}\n\n${result.content}`)
}

async function downloadAllImages(job) {
  const doneImgs = job.result.images.filter(i => i.status === 'done')
  for (let i = 0; i < doneImgs.length; i++) {
    const a = document.createElement('a')
    a.href = doneImgs[i].url
    a.download = `xhs_img${i + 1}.jpg`
    a.target = '_blank'
    a.click()
    await new Promise(r => setTimeout(r, 300))
  }
  message.success(`已触发 ${doneImgs.length} 张图片下载`)
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

.img-preview { width: 100%; height: 100%; object-fit: cover; }

.img-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity .2s;
}
.image-item:hover .img-overlay { opacity: 1; }

/* 卡片底部 */
.result-card-footer {
  display: flex; gap: 8px;
  margin-top: 16px; padding-top: 14px;
  border-top: 1px solid #f0f0f0;
}
</style>
