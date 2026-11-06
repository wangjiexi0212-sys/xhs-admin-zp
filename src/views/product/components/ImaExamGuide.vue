<template>
  <div class="guide-builder">
    <a-alert
      :type="profileReady ? 'success' : 'warning'"
      show-icon
      :message="profileReady ? '已加载系统默认 IMA 母库画像' : 'IMA 母库画像尚未配置'"
      :description="profileReady ? '画像只指导结构、语气和表达；企业事实仅来自当前商品。' : '请先到「系统设置 → IMA配置」选择母库并生成写作画像。'"
      style="margin-bottom:16px"
    />

    <a-card size="small" title="生成设置" style="margin-bottom:16px">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="目标企业">
              <a-input v-model:value="targetCompany" placeholder="请输入企业名称" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="攻略篇幅">
              <a-select v-model:value="lengthMode" :options="lengthOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="图片主题">
              <a-select v-model:value="theme" :options="themeOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-space>
          <a-button type="primary" :loading="generating" :disabled="!profileReady || !targetCompany.trim()" @click="generateGuide">
            生成完整笔试攻略
          </a-button>
          <a-button v-if="guide.sections.length" :loading="rendering" @click="renderImages">生成图片</a-button>
          <a-button v-if="images.length" :loading="downloading" @click="downloadAll">下载全部图片</a-button>
        </a-space>
      </a-form>
    </a-card>

    <a-card v-if="guide.sections.length" size="small" title="攻略内容（可编辑）" style="margin-bottom:16px">
      <a-form layout="vertical">
        <a-form-item label="主标题"><a-input v-model:value="guide.title" /></a-form-item>
        <a-form-item label="副标题"><a-input v-model:value="guide.subtitle" /></a-form-item>
        <a-form-item label="开篇重点"><a-textarea v-model:value="guide.intro" :auto-size="{ minRows:4, maxRows:10 }" /></a-form-item>
        <a-card v-for="(section, index) in guide.sections" :key="index" size="small" :title="`章节 ${index + 1}`" style="margin-bottom:10px">
          <a-input v-model:value="section.title" style="margin-bottom:8px" />
          <a-textarea v-model:value="section.content" :auto-size="{ minRows:5, maxRows:14 }" />
        </a-card>
        <a-form-item label="结尾总结"><a-textarea v-model:value="guide.closing" :auto-size="{ minRows:4, maxRows:10 }" /></a-form-item>
      </a-form>
    </a-card>

    <a-card v-if="pages.length" size="small" :title="`图片预览（${pages.length}页）`">
      <div class="preview-list">
        <div v-for="(page, pageIndex) in pages" :key="pageIndex" class="preview-item">
          <div class="preview-scale">
            <div :ref="el => setPageRef(el, pageIndex)" class="guide-page" :class="`theme-${theme}`">
              <div class="page-inner">
                <template v-if="theme === 'emerald'">
                  <template v-if="pageIndex === 0">
                    <header class="emerald-hero">
                      <div class="emerald-eyebrow">— {{ targetCompany }} · {{ emeraldYear }} 招聘攻略</div>
                      <h1>{{ guide.title }}</h1>
                      <div v-if="guide.subtitle" class="subtitle">{{ guide.subtitle }}</div>
                      <div class="emerald-meta">
                        <span v-for="item in emeraldMeta" :key="item">◉ {{ item }}</span>
                      </div>
                    </header>
                    <div v-if="emeraldFacts.length" class="emerald-facts">
                      <div v-for="fact in emeraldFacts" :key="fact.label" class="emerald-fact">
                        <strong>{{ fact.value }}</strong><span>{{ fact.label }}</span>
                      </div>
                    </div>
                  </template>
                  <div v-else class="emerald-page-head">
                    <span>{{ targetCompany }} · 笔试攻略</span><span>{{ pageIndex + 1 }} / {{ pages.length }}</span>
                  </div>
                  <main v-if="pageIndex === 1" class="emerald-content emerald-modules-page">
                    <div v-if="page[0]?.heading" class="emerald-section-title emerald-modules-title">
                      <span>{{ emeraldSectionNo(pageIndex, 0) }}</span><h2>{{ page[0].heading }}</h2><i />
                    </div>
                    <div class="emerald-module-grid">
                      <div v-for="(block, blockIndex) in page.slice(0, 2)" :key="blockIndex" class="emerald-module-card">
                        <b>{{ blockIndex === 0 ? '第一模块' : '第二模块' }}</b>
                        <h3>{{ analysisBlockView(block).lead || block.heading }}</h3>
                        <template v-if="analysisBlockView(block).items.length">
                          <p v-for="(item, itemIndex) in analysisBlockView(block).items" :key="itemIndex">
                            <strong>{{ item.title }}</strong><span v-if="item.detail">：{{ item.detail }}</span>
                          </p>
                        </template>
                        <template v-else>
                          <p v-for="(paragraph, pIndex) in block.paragraphs" :key="pIndex">{{ paragraph }}</p>
                        </template>
                      </div>
                    </div>
                    <section v-for="(block, blockIndex) in page.slice(2)" :key="blockIndex" class="emerald-block emerald-followup">
                      <div v-if="block.heading" class="emerald-section-title">
                        <span>{{ emeraldSectionNo(pageIndex, blockIndex + 2) }}</span><h2>{{ block.heading }}</h2><i />
                      </div>
                      <p v-if="analysisBlockView(block).lead" class="emerald-lead">{{ analysisBlockView(block).lead }}</p>
                      <div class="emerald-steps">
                        <div v-for="(item, itemIndex) in analysisBlockView(block).items" :key="itemIndex" class="emerald-step">
                          <span>{{ itemIndex + 1 }}</span><div><strong>{{ item.title }}</strong><p>{{ item.detail }}</p></div>
                        </div>
                      </div>
                    </section>
                  </main>
                  <main v-else :class="['emerald-content', { 'emerald-content-first': pageIndex === 0, 'emerald-content-last': pageIndex === pages.length - 1 }]">
                    <section
                      v-for="(block, blockIndex) in page"
                      :key="blockIndex"
                      :class="['emerald-block', `emerald-${block.kind}`, { 'emerald-warning': pageIndex === pages.length - 1 && block.kind !== 'closing' }]"
                    >
                      <div v-if="block.heading" class="emerald-section-title">
                        <span>{{ emeraldSectionNo(pageIndex, blockIndex) }}</span><h2>{{ block.heading }}</h2><i />
                      </div>
                      <template v-if="pageIndex > 0 && pageIndex < pages.length - 1">
                        <p v-if="analysisBlockView(block).lead" class="emerald-lead">{{ analysisBlockView(block).lead }}</p>
                        <div class="emerald-steps">
                          <div v-for="(item, itemIndex) in analysisBlockView(block).items" :key="itemIndex" class="emerald-step">
                            <span>{{ itemIndex + 1 }}</span><div><strong>{{ item.title }}</strong><p>{{ item.detail }}</p></div>
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <p v-for="(paragraph, pIndex) in block.paragraphs" :key="pIndex">{{ paragraph }}</p>
                      </template>
                    </section>
                  </main>
                  <div v-if="pageIndex === pages.length - 1" class="emerald-signoff">— 祝备考顺利，稳稳进面</div>
                  <div class="emerald-page-number">{{ String(pageIndex + 1).padStart(2, '0') }} / {{ String(pages.length).padStart(2, '0') }}</div>
                </template>
                <template v-else-if="theme === 'analysis'">
                  <div class="analysis-masthead">
                    <span>{{ analysisHeader }}</span>
                    <span>笔试考点拆解</span>
                  </div>
                  <div class="analysis-kicker">{{ analysisKicker(pageIndex) }}</div>
                  <template v-if="pageIndex === 0">
                    <h1>{{ guide.title }}</h1>
                    <div v-if="guide.subtitle" class="subtitle">{{ guide.subtitle }}</div>
                  </template>
                  <div class="analysis-content">
                    <section v-for="(block, blockIndex) in page" :key="blockIndex" :class="['analysis-block', `analysis-${block.kind}`]">
                      <div v-if="block.heading" class="analysis-block-title">
                        <span class="analysis-block-no">{{ String(blockIndex + 1).padStart(2, '0') }}</span>
                        <h2>{{ block.heading }}</h2>
                      </div>
                      <p v-if="analysisBlockView(block).lead" class="analysis-lead">{{ analysisBlockView(block).lead }}</p>
                      <div v-if="analysisBlockView(block).items.length" class="analysis-item-list">
                        <div v-for="(item, itemIndex) in analysisBlockView(block).items" :key="itemIndex" class="analysis-item">
                          <span class="analysis-item-no">{{ String(itemIndex + 1).padStart(2, '0') }}</span>
                          <div class="analysis-item-copy">
                            <strong>{{ item.title }}</strong>
                            <span v-if="item.detail">{{ item.detail }}</span>
                          </div>
                          <em v-if="item.value">{{ item.value }}</em>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div v-if="pageIndex === 0 && analysisFacts.length" class="analysis-facts">
                    <div v-for="fact in analysisFacts" :key="fact.label" class="analysis-fact">
                      <strong>{{ fact.value }}</strong><span>{{ fact.label }}</span>
                    </div>
                  </div>
                  <div class="analysis-footer">{{ analysisHeader }}</div>
                  <div class="page-number">{{ String(pageIndex + 1).padStart(2, '0') }} / {{ String(pages.length).padStart(2, '0') }}</div>
                </template>
                <template v-else>
                  <template v-if="pageIndex === 0">
                    <h1>{{ guide.title }}</h1>
                    <div v-if="guide.subtitle" class="subtitle">{{ guide.subtitle }}</div>
                    <div class="divider" />
                  </template>
                  <div v-for="(block, blockIndex) in page" :key="blockIndex" :class="['content-block', `block-${block.kind}`]">
                    <h2 v-if="block.heading">{{ block.heading }}</h2>
                    <p v-for="(paragraph, pIndex) in block.paragraphs" :key="pIndex">{{ paragraph }}</p>
                  </div>
                  <div class="watermark">{{ targetCompany }} · 笔试攻略</div>
                  <div class="page-number">{{ pageIndex + 1 }} / {{ pages.length }}</div>
                </template>
              </div>
            </div>
          </div>
          <a-button v-if="images[pageIndex]" size="small" @click="downloadOne(pageIndex)">下载第{{ pageIndex + 1 }}页</a-button>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { toPng } from 'html-to-image'
import { chatLlm } from '@/api/llm'
import { getImaConfig, getImaWritingProfile } from '@/api/aiContentCenter'
import { useLlmStore } from '@/stores/llm'

const props = defineProps({ product: { type: Object, required: true } })
const llmStore = useLlmStore()
const targetCompany = ref('')
const profile = ref('')
const profileReady = computed(() => Boolean(profile.value))
const generating = ref(false)
const rendering = ref(false)
const downloading = ref(false)
const lengthMode = ref('standard')
const theme = ref('blue')
const images = ref([])
const pageRefs = ref([])
const guide = reactive({ title: '', subtitle: '', intro: '', sections: [], closing: '' })
const lengthOptions = [
  { value: 'standard', label: '标准（约6页）' },
  { value: 'detailed', label: '详细（约8页）' },
]
const themeOptions = [
  { value: 'blue', label: '蓝色攻略风' },
  { value: 'navy', label: '深蓝简洁风' },
  { value: 'green', label: '绿色备考风' },
  { value: 'analysis', label: '考点拆解杂志风' },
  { value: 'emerald', label: '墨绿金色商务报告风' },
]

const emeraldYear = computed(() => String(
  props.product?.written_exam_time || props.product?.apply_time || props.product?.title || new Date().getFullYear()
).match(/20\d{2}/)?.[0] || new Date().getFullYear())
const emeraldMeta = computed(() => [
  props.product?.apply_time ? `报名 ${props.product.apply_time}` : '',
  props.product?.written_exam_time ? `笔试 ${props.product.written_exam_time}` : '',
  props.product?.job_type_name || '',
].filter(Boolean))
const emeraldFacts = computed(() => [
  { label: '招聘人数', value: props.product?.recruit_count || props.product?.recruitment_count || '' },
  { label: '笔试科目', value: String(props.product?.written_exam_content || '').match(/《[^》]+》/)?.[0] || '以公告为准' },
  { label: '攻略模块', value: guide.sections.length ? `${guide.sections.length}个` : '' },
  { label: '攻略篇幅', value: lengthMode.value === 'detailed' ? '详细版' : '标准版' },
].filter(item => String(item.value).trim()))
function emeraldSectionNo(pageIndex, blockIndex) {
  return String(pageIndex * 2 + blockIndex + 1).padStart(2, '0')
}

const analysisHeader = computed(() => {
  const year = String(props.product?.written_exam_time || props.product?.apply_time || props.product?.title || '').match(/20\d{2}/)?.[0]
  return [year, targetCompany.value.trim(), props.product?.job_type_name].filter(Boolean).join(' · ')
})
const analysisFacts = computed(() => [
  { label: '招聘人数', value: props.product?.recruit_count || props.product?.recruitment_count || '' },
  { label: '报名时间', value: props.product?.apply_time || props.product?.registration_time || '' },
  { label: '笔试时间', value: props.product?.written_exam_time || '' },
].filter(item => String(item.value).trim()))
function analysisKicker(index) {
  if (index === 0) return '一 · 考试概览'
  return `${['二', '三', '四', '五', '六', '七', '八', '九'][Math.min(index - 1, 7)]} · 攻略拆解`
}

function analysisBlockView(block) {
  const raw = (block?.paragraphs || []).map(value => String(value || '').trim()).filter(Boolean).join('\n')
  if (!raw) return { lead: '', items: [] }
  const chunks = raw
    .split(/\n+|(?<=[。！？；])/)
    .map(value => value.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d一二三四五六七八九十]+[、.．)）]\s*/, '').trim())
    .filter(Boolean)
  const lead = chunks.shift() || ''
  const items = chunks.map((sentence) => {
    const clean = sentence.replace(/[。；]$/, '')
    const colonIndex = clean.search(/[：:]/)
    let title = ''
    let detail = ''
    if (colonIndex > 1 && colonIndex <= 18) {
      title = clean.slice(0, colonIndex).trim()
      detail = clean.slice(colonIndex + 1).trim()
    } else {
      const commaIndex = clean.search(/[，,]/)
      const splitAt = commaIndex >= 5 && commaIndex <= 18 ? commaIndex : Math.min(16, clean.length)
      title = clean.slice(0, splitAt).trim()
      detail = clean.slice(splitAt).replace(/^[，,]\s*/, '').trim()
    }
    const value = clean.match(/\d+(?:\.\d+)?\s*(?:%|人|名|分|题|天|分钟|小时|个月|年)/)?.[0] || ''
    return { title, detail, value }
  })
  if (!items.length && lead.length > 70) {
    const detail = lead.slice(18)
    return { lead: '', items: [{ title: lead.slice(0, 18), detail, value: lead.match(/\d+(?:\.\d+)?\s*(?:%|人|名|分|题|天|分钟|小时|个月|年)/)?.[0] || '' }] }
  }
  return { lead, items }
}

function splitText(value, max = 250) {
  const source = String(value || '').split(/\n+/).map(v => v.trim()).filter(Boolean)
  const result = []
  for (const paragraph of source) {
    if (paragraph.length <= max) { result.push(paragraph); continue }
    const sentences = paragraph.split(/(?<=[。！？；])/)
    let current = ''
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > max) { result.push(current); current = '' }
      current += sentence
    }
    if (current) result.push(current)
  }
  return result
}

const pageBlocks = computed(() => {
  if (!guide.sections.length) return []
  const paragraphMax = theme.value === 'analysis' ? 150 : 250
  const blocks = [{ kind: 'intro', heading: '🎯 先说重点', paragraphs: splitText(guide.intro, paragraphMax) }]
  guide.sections.forEach(section => blocks.push({ kind: 'section', heading: section.title, paragraphs: splitText(section.content, paragraphMax) }))
  blocks.push({ kind: 'closing', heading: '💬 写在最后', paragraphs: splitText(guide.closing, paragraphMax) })
  return blocks.flatMap(block => block.paragraphs.map((paragraph, index) => ({
    kind: block.kind, heading: index === 0 ? block.heading : '', paragraphs: [paragraph],
  })))
})

const analysisPages = ref([])
const pages = computed(() => {
  if (theme.value === 'analysis') return analysisPages.value
  const output = []
  let page = []
  let used = 0
  for (const block of pageBlocks.value) {
    const cost = block.paragraphs[0].length + (block.heading ? 90 : 0)
    const capacity = theme.value === 'emerald' ? (output.length ? 620 : 540) : (output.length ? 650 : 540)
    if (page.length && used + cost > capacity) {
      output.push(page)
      page = []
      used = 0
    }
    page.push(block)
    used += cost
  }
  if (page.length) output.push(page)
  return output
})

let paginationRun = 0
async function paginateAnalysis() {
  const run = ++paginationRun
  if (theme.value !== 'analysis') return
  let remaining = pageBlocks.value
  const fitted = []
  if (!remaining.length) {
    analysisPages.value = []
    return
  }
  if (document.fonts?.ready) await document.fonts.ready
  while (remaining.length && run === paginationRun && theme.value === 'analysis') {
    const index = fitted.length
    analysisPages.value = [...fitted, remaining]
    await nextTick()
    if (run !== paginationRun || theme.value !== 'analysis') return
    const node = pageRefs.value[index]
    const footer = node?.querySelector('.analysis-footer')
    if (!footer?.getBoundingClientRect().height) return
    const facts = node.querySelector('.analysis-facts')
    const sections = [...node.querySelectorAll('.analysis-block')]
    const lastBottom = sections.at(-1)?.getBoundingClientRect().bottom
    const factsSpace = facts && lastBottom != null
      ? facts.getBoundingClientRect().bottom - lastBottom
      : 0
    // Preview geometry is scaled by half. Reserve 16px above the export footer.
    const limit = footer.getBoundingClientRect().top - 8 - factsSpace
    const overflow = sections.findIndex(section => section.getBoundingClientRect().bottom > limit)
    if (index > 0 && overflow === 0) {
      const [block, ...rest] = remaining
      const chars = Array.from(block.paragraphs[0])
      if (chars.length > 1) {
        const middle = Math.ceil(chars.length / 2)
        remaining = [
          { ...block, paragraphs: [chars.slice(0, middle).join('')] },
          { ...block, heading: '', paragraphs: [chars.slice(middle).join('')] },
          ...rest,
        ]
        continue
      }
    }
    const count = overflow < 0 ? remaining.length : Math.max(index === 0 ? 0 : 1, overflow)
    fitted.push(remaining.slice(0, count))
    remaining = remaining.slice(count)
  }
  if (run === paginationRun && theme.value === 'analysis') {
    analysisPages.value = fitted
    await nextTick()
  }
}

async function loadProfile() {
  try {
    const config = await getImaConfig()
    const id = String(config.default_knowledge_base_id || '').trim()
    if (!id) return
    const data = await getImaWritingProfile(id)
    profile.value = String(data.profile || '').trim()
  } catch (error) { message.error(error.message || '读取 IMA 写作画像失败') }
}

function productFacts() {
  const p = props.product || {}
  return {
    企业名称: targetCompany.value.trim(), 公告名称: p.title || p.announcement_name || '',
    商品类型: p.job_type_name || '', 招聘人数: p.recruit_count || p.recruitment_count || '',
    报名时间: p.apply_time || p.registration_time || '', 笔试时间: p.written_exam_time || '',
    笔试内容: p.written_exam_content || '', 公告原文: p.original_text || p.announcement_content || '',
  }
}

function parseGuide(text) {
  const cleaned = cleanJsonText(text)
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed.sections) || !parsed.sections.length) throw new Error('攻略结构不完整')
  return {
    title: String(parsed.title || ''), subtitle: String(parsed.subtitle || ''), intro: String(parsed.intro || ''),
    sections: parsed.sections.map(item => ({ title: String(item.title || ''), content: Array.isArray(item.paragraphs) ? item.paragraphs.join('\n\n') : String(item.content || '') })),
    closing: String(parsed.closing || ''),
  }
}

const sensitiveReplacements = [
  [/习\s*近\s*平(?:\s*总\s*书\s*记|\s*国\s*家\s*主\s*席)?(?:\s*重要)?\s*讲话(?:\s*要点)?/g, '公共基础相关内容'],
  [/习\s*近\s*平\s*新\s*时\s*代\s*中\s*国\s*特\s*色\s*社\s*会\s*主\s*义\s*思\s*想/g, '相关重要理论'],
  [/(习\s*近\s*平|毛\s*泽\s*东|邓\s*小\s*平|江\s*泽\s*民|胡\s*锦\s*涛|李\s*克\s*强|李\s*强)/g, '相关重要人物'],
  [/(总\s*书\s*记|国\s*家\s*主\s*席|国\s*务\s*院\s*总\s*理)/g, '相关负责人'],
  [/时事政治/g, '时事热点'],
  [/政治理论/g, '公共基础理论'],
  [/政治常识/g, '公共基础常识'],
  [/政治素质/g, '综合素质'],
  [/政治面貌/g, '个人基本信息'],
  [/政治/g, '公共政策'],
  [/(马克思主义|中国特色社会主义|社会主义核心价值观)/g, '相关基础理论'],
  [/(二十大|十九大|十八大|全国两会|全国人民代表大会|中国人民政治协商会议)/g, '重要会议'],
  [/党建/g, '组织建设'],
  [/党史/g, '发展历史'],
  [/党员/g, '工作人员'],
  [/意识形态/g, '价值观'],
  [/党的重大会议/g, '重要会议'],
  [/党的会议/g, '重要会议'],
  [/中国共产党/g, '相关组织'],
  [/中共中央/g, '相关部门'],
]

function sanitizeSensitiveText(value) {
  let result = String(value || '')
  for (const [pattern, replacement] of sensitiveReplacements) result = result.replace(pattern, replacement)
  return result
}

function sanitizeGuideContent(value) {
  return {
    ...value,
    title: sanitizeSensitiveText(value.title),
    subtitle: sanitizeSensitiveText(value.subtitle),
    intro: sanitizeSensitiveText(value.intro),
    sections: (value.sections || []).map(section => ({
      title: sanitizeSensitiveText(section.title),
      content: sanitizeSensitiveText(section.content),
    })),
    closing: sanitizeSensitiveText(value.closing),
  }
}

let sanitizingGuide = false
function sanitizeGuideInPlace() {
  if (sanitizingGuide) return
  const sanitized = sanitizeGuideContent(guide)
  const before = JSON.stringify(guide)
  const after = JSON.stringify(sanitized)
  if (before === after) return
  sanitizingGuide = true
  Object.assign(guide, sanitized)
  nextTick(() => { sanitizingGuide = false })
}

function cleanJsonText(text) {
  return String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

// 模型经常在 JSON 中文正文里直接使用英文引号，例如“这是"打底"模块”。
// 若引号后面不是 JSON 合法的结束符，就把它视为正文引号并自动转义。
function repairUnescapedContentQuotes(text) {
  const source = cleanJsonText(text)
  let output = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (!inString) {
      output += char
      if (char === '"') inString = true
      continue
    }
    if (escaped) {
      output += char
      escaped = false
      continue
    }
    if (char === '\\') {
      output += char
      escaped = true
      continue
    }
    if (char !== '"') {
      output += char
      continue
    }
    let next = i + 1
    while (next < source.length && /\s/.test(source[next])) next++
    if (next >= source.length || /[,\]}:]/.test(source[next])) {
      output += char
      inString = false
    } else {
      output += '\\"'
    }
  }
  return output
}

async function parseOrRepairGuide(text, active) {
  try { return parseGuide(text) }
  catch (parseError) {
    try { return parseGuide(repairUnescapedContentQuotes(text)) }
    catch {}
    message.info('模型返回格式不完整，正在自动修复…')
    const repaired = await chatLlm({
      provider: active.provider, api_format: active.api_format, api_key: active.api_key,
      base_url: active.base_url || '', model: active.default_model,
      messages: [
        { role: 'system', content: '你是 JSON 修复器。只修复 JSON 语法和字段结构，不删减、不改写正文内容，不输出解释或 Markdown 代码块。' },
        { role: 'user', content: `将下面内容修复成合法 JSON。必须保持结构为 {"title":"","subtitle":"","intro":"","sections":[{"title":"","paragraphs":[""]}],"closing":""}。字符串内部的双引号必须正确转义。\n\n${String(text || '')}` },
      ],
      max_tokens: 7000,
      temperature: 0.05,
    })
    try { return parseGuide(repaired.content) }
    catch { throw new Error(`模型返回的攻略格式无法解析，自动修复仍未成功：${parseError.message}`) }
  }
}

async function generateGuide() {
  const active = llmStore.active
  if (!active) { message.warning('请先在系统设置中启用大模型配置'); return }
  generating.value = true
  images.value = []
  try {
    const wordTarget = lengthMode.value === 'detailed' ? '3500至4500字、7至9个章节' : '2200至3200字、5至7个章节'
    const result = await chatLlm({
      provider: active.provider, api_format: active.api_format, api_key: active.api_key,
      base_url: active.base_url || '', model: active.default_model,
      messages: [
        { role: 'system', content: '你是国企招聘笔试攻略编辑。输出严谨、实用的完整攻略，不写引流话术，不编造企业事实。严禁出现政治敏感内容、政治表述、领导人姓名和领导人相关称谓。' },
        { role: 'user', content: `请为新企业生成一篇可分页制图的完整笔试攻略。\n\n【当前商品真实信息】\n${JSON.stringify(productFacts(), null, 2)}\n\n【IMA母库写作画像】\n${profile.value}\n\n要求：${wordTarget}；包括企业与考试概览、考情分析、模块或题型拆解、备考策略、时间规划、避坑提醒和总结。画像只用于结构和风格。没有明确依据的考试科目、日期、题量、招聘人数必须写成审慎建议或“以官方通知为准”，不得编造。\n【敏感内容硬性限制】不得出现任何领导人姓名、领导人称谓、政治理论、政治口号、党政会议名称或政治评价；“时事政治”统一写成“时事热点”，“政治理论/政治常识”统一写成“公共基础理论/公共基础常识”。不得为了举例重复敏感词。\n禁止出现关注、私信、置顶评论、点击获取、加群等引流表达。只输出合法 JSON，不输出代码块或解释。正文字符串内如需使用引号，必须转义为 \\"。结构：{"title":"","subtitle":"","intro":"","sections":[{"title":"","paragraphs":[""]}],"closing":""}` },
      ], max_tokens: 7000, temperature: 0.55,
    })
    Object.assign(guide, sanitizeGuideContent(await parseOrRepairGuide(result.content, active)))
    message.success('完整笔试攻略生成成功，可编辑后生成图片')
  } catch (error) { message.error(error.message || '攻略生成失败') }
  finally { generating.value = false }
}

function setPageRef(el, index) { if (el) pageRefs.value[index] = el }

async function renderImages() {
  rendering.value = true
  images.value = []
  try {
    Object.assign(guide, sanitizeGuideContent(guide))
    await nextTick()
    if (document.fonts?.ready) await document.fonts.ready
    if (theme.value === 'analysis') await paginateAnalysis()
    const output = []
    for (let i = 0; i < pages.value.length; i++) {
      const node = pageRefs.value[i]
      const previousTransform = node.style.transform
      node.style.transform = 'none'
      try {
        const backgroundColor = theme.value === 'analysis' ? '#ffffff' : (theme.value === 'emerald' ? '#f7f3eb' : '#eef1f5')
        output.push(await toPng(node, { width: 1080, height: 1440, pixelRatio: 1, cacheBust: true, backgroundColor }))
      } finally {
        node.style.transform = previousTransform
      }
    }
    images.value = output
    message.success(`已生成 ${output.length} 张攻略图片`)
  } catch (error) { message.error(error.message || '图片生成失败') }
  finally { rendering.value = false }
}

function downloadOne(index) {
  const link = document.createElement('a')
  link.href = images.value[index]
  link.download = `${targetCompany.value || '企业'}-笔试攻略-${String(index + 1).padStart(2, '0')}.png`
  link.click()
}

async function downloadAll() {
  downloading.value = true
  try {
    for (let i = 0; i < images.value.length; i++) { downloadOne(i); await new Promise(resolve => setTimeout(resolve, 180)) }
  } finally { downloading.value = false }
}

watch(() => props.product?.company_name, value => { if (value) targetCompany.value = value }, { immediate: true })
watch(guide, sanitizeGuideInPlace, { deep: true, flush: 'sync' })
watch([pageBlocks, theme, () => guide.title, () => guide.subtitle, analysisHeader, analysisFacts], paginateAnalysis)
watch([() => guide.title, () => guide.subtitle, () => guide.intro, () => guide.closing, () => guide.sections.map(item => `${item.title}:${item.content}`).join('|'), theme], () => { images.value = [] })
onMounted(loadProfile)
</script>

<style scoped>
.preview-list{display:flex;flex-direction:column;align-items:center;gap:28px}.preview-item{display:flex;flex-direction:column;align-items:center;gap:10px}
.preview-scale{width:540px;height:720px;overflow:hidden;border-radius:14px;box-shadow:0 8px 30px rgba(15,35,60,.14)}
.guide-page{width:1080px;height:1440px;transform:scale(.5);transform-origin:top left;background:#eef1f5;padding:32px;box-sizing:border-box;color:#14283c;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
.page-inner{position:relative;height:1376px;background:#fff;border-radius:28px;padding:58px 48px 70px;box-sizing:border-box;overflow:hidden}
h1{font-size:45px;line-height:1.35;margin:0 0 18px;font-weight:800;letter-spacing:-1px}.subtitle{text-align:center;font-size:28px;font-weight:600;color:#607085}.divider{height:2px;background:#e4e9ef;margin:26px 0 38px}
.content-block{margin-bottom:26px}.content-block h2{font-size:34px;line-height:1.35;margin:0 0 18px;font-weight:800;border-left:8px solid var(--accent);padding-left:18px}.content-block p{white-space:pre-wrap;font-size:27px;line-height:1.85;margin:0 0 18px;text-align:justify;color:#263b50}
.block-intro{background:var(--soft);border-left:7px solid var(--accent);border-radius:16px;padding:26px 30px}.block-intro h2{border:0;padding:0}.block-closing{background:#f7f9fb;border:1px solid #e1e7ee;border-radius:18px;padding:26px 30px}
.watermark{position:absolute;left:180px;top:620px;transform:rotate(-48deg);font-size:48px;color:rgba(90,105,120,.10);white-space:nowrap}.page-number{position:absolute;right:45px;bottom:26px;color:#9aa7b4;font-size:19px}
.theme-blue{--accent:#3788ed;--soft:#edf6ff}.theme-navy{--accent:#193c68;--soft:#f0f4f8}.theme-green{--accent:#24956b;--soft:#edf9f4}
.theme-analysis{--accent:#b5362d;--soft:#f5f1e8;background:#fff;padding:0;color:#151515;font-family:"Songti SC","STSong","SimSun",serif}
.theme-analysis .page-inner{height:1440px;border-radius:0;padding:62px 76px 78px;background:#fff}
.theme-analysis .analysis-masthead{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;margin-bottom:42px;border-bottom:3px solid #171717;color:#6f6b65;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:20px;letter-spacing:.5px}
.theme-analysis .analysis-kicker{margin-bottom:22px;color:#77736d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:23px;letter-spacing:1px}
.theme-analysis h1{max-width:900px;margin:0 0 22px;color:#111;font-family:"Songti SC","STSong","SimSun",serif;font-size:60px;font-weight:500;line-height:1.25;letter-spacing:4px}
.theme-analysis .subtitle{text-align:left;margin:0 0 28px;color:#b5362d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:27px;font-weight:700;line-height:1.55}
.theme-analysis .analysis-content{margin-top:26px}
.theme-analysis .analysis-block{padding:0 0 24px;margin-bottom:25px;border-bottom:1px solid #e6e2dc}
.theme-analysis .analysis-block-title{display:grid;grid-template-columns:70px 1fr;align-items:start;gap:18px;margin-bottom:14px}
.theme-analysis .analysis-block-no{color:#d8d2c8;font-family:"Songti SC","STSong","SimSun",serif;font-size:47px;line-height:1}
.theme-analysis .analysis-block h2{margin:0;color:#171717;font-family:"Songti SC","STSong","SimSun",serif;font-size:38px;font-weight:500;line-height:1.32;letter-spacing:2px}
.theme-analysis .analysis-lead{margin:0 0 20px;color:#484540;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:24px;line-height:1.72;text-align:left}
.theme-analysis .analysis-item-list{border-top:1px solid #e6e2dc}
.theme-analysis .analysis-item{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:16px;min-height:84px;padding:13px 0;border-bottom:1px solid #e6e2dc}
.theme-analysis .analysis-item-no{color:#d1cbc1;font-family:"Songti SC","STSong","SimSun",serif;font-size:28px}
.theme-analysis .analysis-item-copy{display:flex;flex-direction:column;gap:6px;min-width:0;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
.theme-analysis .analysis-item-copy strong{color:#171717;font-size:25px;font-weight:650;line-height:1.35;white-space:normal}
.theme-analysis .analysis-item-copy span{color:#807b74;font-size:19px;line-height:1.5;white-space:normal}
.theme-analysis .analysis-item em{color:#b5362d;font-family:"Songti SC","STSong","SimSun",serif;font-size:31px;font-style:normal;white-space:nowrap}
.theme-analysis .analysis-intro{padding:24px 28px;border:0;background:#f5f1e8}
.theme-analysis .analysis-intro .analysis-block-no{color:#b5362d}
.theme-analysis .analysis-intro h2{color:#b5362d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:28px;font-weight:700;letter-spacing:0}
.theme-analysis .analysis-intro .analysis-item-list{border-top-color:#dcd4c7}.theme-analysis .analysis-intro .analysis-item{border-bottom-color:#dcd4c7}
.theme-analysis .analysis-closing{padding:24px 28px;border:0;background:#151515}
.theme-analysis .analysis-closing .analysis-block-no{color:#e2b643}
.theme-analysis .analysis-closing h2,.theme-analysis .analysis-closing .analysis-lead,.theme-analysis .analysis-closing .analysis-item-copy strong{color:#fff}
.theme-analysis .analysis-closing .analysis-item-copy span{color:#c9c5bf}.theme-analysis .analysis-closing .analysis-item-list{border-top-color:#444}.theme-analysis .analysis-closing .analysis-item{border-bottom-color:#444}
.theme-analysis .analysis-facts{display:grid;grid-template-columns:repeat(3,1fr);margin-top:28px;border:2px solid #202020;background:#fff}
.theme-analysis .analysis-fact{display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100px;padding:12px 16px;text-align:center;border-right:1px solid #d8d4cd}
.theme-analysis .analysis-fact:last-child{border-right:0}
.theme-analysis .analysis-fact strong{color:#b5362d;font-family:"Songti SC","STSong","SimSun",serif;font-size:25px;font-weight:500;line-height:1.35}
.theme-analysis .analysis-fact span{margin-top:7px;color:#77736d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:17px}
.theme-analysis .analysis-footer{display:block;position:absolute;z-index:2;left:76px;right:76px;bottom:0;padding:14px 0 32px;border-top:1px solid #d8d4cd;background:#fff;color:#77736d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:18px}
.theme-analysis .page-number{z-index:3;right:76px;bottom:32px;color:#77736d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:18px}
.theme-emerald{--emerald:#173d40;--emerald-soft:#eaf2f0;--gold:#b8833d;--paper:#f7f3eb;padding:0;background:var(--paper);color:#272823;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
.theme-emerald .page-inner{height:1440px;padding:0 54px 58px;border-radius:0;background:var(--paper)}
.theme-emerald .emerald-hero{margin:0 -54px;padding:76px 54px 86px;background:var(--emerald);color:#fff}
.theme-emerald .emerald-eyebrow{margin-bottom:38px;color:#e0c28b;font-size:20px;letter-spacing:5px}
.theme-emerald h1{max-width:950px;margin:0 0 18px;color:#fff;font-family:"Songti SC","STSong","SimSun",serif;font-size:48px;font-weight:700;line-height:1.35;letter-spacing:1px}
.theme-emerald .subtitle{max-width:900px;margin:0;color:#c6d4d1;text-align:left;font-size:23px;font-weight:400;line-height:1.6}
.theme-emerald .emerald-meta{display:flex;flex-wrap:wrap;gap:22px 34px;margin-top:36px;color:#d9e3e0;font-size:18px}
.theme-emerald .emerald-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin:-52px -28px 0;position:relative;z-index:1}
.theme-emerald .emerald-fact{display:flex;flex-direction:column;justify-content:center;min-height:126px;padding:20px 24px;border:1px solid #ded8cc;border-radius:18px;background:#fff;box-shadow:0 10px 24px rgba(40,55,48,.10)}
.theme-emerald .emerald-fact strong{overflow:hidden;color:var(--emerald);font-family:"Songti SC","STSong","SimSun",serif;font-size:27px;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
.theme-emerald .emerald-fact span{margin-top:12px;color:#696a64;font-size:17px}
.theme-emerald .emerald-page-head{display:flex;justify-content:space-between;padding:30px 0 16px;border-bottom:2px solid var(--emerald);color:#787970;font-size:16px;letter-spacing:1px}
.theme-emerald .emerald-content{padding:36px 0 42px}
.theme-emerald .emerald-content-first{padding-top:42px}
.theme-emerald .emerald-block{margin-bottom:32px}
.theme-emerald .emerald-section-title{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:14px;margin-bottom:24px}
.theme-emerald .emerald-section-title>span{color:var(--gold);font-family:"Songti SC","STSong","SimSun",serif;font-size:27px;font-weight:700}
.theme-emerald .emerald-section-title h2{margin:0;color:#20231f;font-family:"Songti SC","STSong","SimSun",serif;font-size:31px;line-height:1.3}
.theme-emerald .emerald-section-title i{height:1px;background:#d9d0c0}
.theme-emerald .emerald-block>p,.theme-emerald .emerald-lead{margin:0 0 16px;color:#363933;font-size:22px;line-height:1.58;text-align:justify;white-space:pre-wrap}
.theme-emerald .emerald-intro{padding:26px 30px;border:1px solid #bed2cd;border-left:6px solid #277276;border-radius:16px;background:var(--emerald-soft)}
.theme-emerald .emerald-intro .emerald-section-title{margin-bottom:14px}
.theme-emerald .emerald-modules-page{display:block}
.theme-emerald .emerald-modules-title{margin-bottom:22px}
.theme-emerald .emerald-module-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:26px;margin-bottom:30px}
.theme-emerald .emerald-module-card{display:flex;flex-direction:column;min-height:360px;padding:26px 28px;border:1px solid #ddd6c9;border-radius:18px;background:#fff;box-shadow:0 10px 22px rgba(49,52,45,.06)}
.theme-emerald .emerald-module-card>b{display:inline-block;padding:7px 15px;border-radius:20px;background:#e8f1ef;color:var(--emerald);font-size:16px}
.theme-emerald .emerald-module-card h3{min-height:74px;margin:20px 0 12px;color:var(--emerald);font-family:"Songti SC","STSong","SimSun",serif;font-size:27px;line-height:1.38}
.theme-emerald .emerald-module-card p{margin:0 0 10px;color:#454740;font-size:19px;line-height:1.52}
.theme-emerald .emerald-module-card p strong{color:#2b2d28;font-weight:700}
.theme-emerald .emerald-followup{margin-top:18px}
.theme-emerald .emerald-steps{display:flex;flex-direction:column;gap:0}
.theme-emerald .emerald-step{display:grid;grid-template-columns:58px 1fr;gap:20px;padding:18px 0;border-bottom:1px dashed #d8d1c5}
.theme-emerald .emerald-step>span{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:var(--emerald);color:#fff;font-family:"Songti SC","STSong","SimSun",serif;font-size:24px}
.theme-emerald .emerald-step strong{display:block;margin-bottom:7px;color:#22241f;font-size:21px}
.theme-emerald .emerald-step p{margin:0;color:#5f6159;font-size:18px;line-height:1.55}
.theme-emerald .emerald-content-last{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
.theme-emerald .emerald-content-last .emerald-section-title{grid-column:1/-1}
.theme-emerald .emerald-warning{position:relative;padding:25px 28px;border:1px solid #dfbd91;border-radius:18px;background:#fff8f0}
.theme-emerald .emerald-warning::after{content:'!';position:absolute;right:24px;top:-16px;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:var(--gold);color:#fff;font-size:24px;font-weight:700}
.theme-emerald .emerald-warning .emerald-section-title{display:block;margin-bottom:14px}.theme-emerald .emerald-warning .emerald-section-title>span,.theme-emerald .emerald-warning .emerald-section-title i{display:none}
.theme-emerald .emerald-warning .emerald-section-title h2{color:#8a4b19;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:22px}
.theme-emerald .emerald-closing{grid-column:1/-1;padding:34px 38px;border-radius:20px;background:var(--emerald);color:#fff}
.theme-emerald .emerald-closing .emerald-section-title h2,.theme-emerald .emerald-closing>p{color:#fff}
.theme-emerald .emerald-closing .emerald-section-title i{background:rgba(255,255,255,.25)}
.theme-emerald .emerald-signoff{position:absolute;left:92px;bottom:82px;color:#e0c28b;font-size:20px;font-weight:700}
.theme-emerald .emerald-page-number{position:absolute;right:54px;bottom:28px;color:#8a8b82;font-size:16px}
</style>
