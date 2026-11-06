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
                <div v-if="theme === 'analysis'" class="analysis-masthead">
                  <span>{{ targetCompany }} · 笔试攻略</span>
                  <span>考点拆解</span>
                </div>
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
                <div v-if="theme === 'analysis'" class="analysis-footer">{{ targetCompany }} · 完整笔试攻略</div>
                <div class="page-number">{{ pageIndex + 1 }} / {{ pages.length }}</div>
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
]

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

const pages = computed(() => {
  if (!guide.sections.length) return []
  const blocks = [{ kind: 'intro', heading: '🎯 先说重点', paragraphs: splitText(guide.intro) }]
  guide.sections.forEach(section => blocks.push({ kind: 'section', heading: section.title, paragraphs: splitText(section.content) }))
  blocks.push({ kind: 'closing', heading: '💬 写在最后', paragraphs: splitText(guide.closing) })
  const output = []
  let page = []
  let used = 0
  let capacity = 540
  for (const block of blocks) {
    let first = true
    for (const paragraph of block.paragraphs) {
      const cost = paragraph.length + (first && block.heading ? 90 : 0)
      if (page.length && used + cost > capacity) {
        output.push(page); page = []; used = 0; capacity = 650
      }
      page.push({ kind: block.kind, heading: first ? block.heading : '', paragraphs: [paragraph] })
      used += cost
      first = false
    }
  }
  if (page.length) output.push(page)
  return output
})

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
  [/习近平新时代中国特色社会主义思想/g, '相关重要理论'],
  [/(习近平|毛泽东|邓小平|江泽民|胡锦涛|李克强|李强)/g, '相关重要人物'],
  [/(总书记|国家主席|国务院总理)/g, '相关负责人'],
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
    const output = []
    for (let i = 0; i < pages.value.length; i++) {
      const node = pageRefs.value[i]
      const previousTransform = node.style.transform
      node.style.transform = 'none'
      try {
        output.push(await toPng(node, { width: 1080, height: 1440, pixelRatio: 1, cacheBust: true, backgroundColor: theme.value === 'analysis' ? '#ffffff' : '#eef1f5' }))
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
.analysis-masthead,.analysis-footer{display:none}
.theme-analysis{--accent:#b5362d;--soft:#f5f1e8;background:#fff;padding:0;color:#151515;font-family:"Songti SC","STSong","SimSun",serif}
.theme-analysis .page-inner{height:1440px;border-radius:0;padding:62px 76px 78px;background:#fff}
.theme-analysis .analysis-masthead{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;margin-bottom:42px;border-bottom:3px solid #171717;color:#6f6b65;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:20px;letter-spacing:.5px}
.theme-analysis h1{max-width:880px;margin:0 0 24px;color:#111;font-family:"Songti SC","STSong","SimSun",serif;font-size:58px;font-weight:500;line-height:1.25;letter-spacing:4px}
.theme-analysis .subtitle{text-align:left;margin:0 0 28px;color:#b5362d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:27px;font-weight:700;line-height:1.55}
.theme-analysis .divider{height:1px;margin:22px 0 34px;background:#d9d5ce}
.theme-analysis .content-block{margin-bottom:29px}
.theme-analysis .content-block h2{margin:0 0 17px;padding:0;border:0;color:#171717;font-family:"Songti SC","STSong","SimSun",serif;font-size:39px;font-weight:500;line-height:1.35;letter-spacing:2px}
.theme-analysis .content-block p{margin:0 0 18px;color:#393735;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:25px;line-height:1.82;text-align:left}
.theme-analysis .block-intro{padding:25px 28px;border:0;border-radius:0;background:#f5f1e8}
.theme-analysis .block-intro h2{color:#b5362d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:27px;font-weight:700;letter-spacing:0}
.theme-analysis .block-section{padding-bottom:21px;border-bottom:1px solid #e6e2dc}
.theme-analysis .block-closing{padding:25px 30px;border:0;border-radius:0;background:#151515}
.theme-analysis .block-closing h2,.theme-analysis .block-closing p{color:#fff}
.theme-analysis .block-closing h2{font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:28px;font-weight:700;letter-spacing:0}
.theme-analysis .watermark{display:none}
.theme-analysis .analysis-footer{display:block;position:absolute;left:76px;right:76px;bottom:32px;padding-top:12px;border-top:1px solid #d8d4cd;color:#77736d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:18px}
.theme-analysis .page-number{right:76px;bottom:32px;color:#77736d;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:18px}
</style>
