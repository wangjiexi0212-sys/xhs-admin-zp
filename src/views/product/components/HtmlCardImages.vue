<template>
  <a-drawer
    v-model:open="localVisible"
    title="生图 — AI图片生成"
    placement="right"
    width="90%"
    :body-style="{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }"
  >
    <!-- ─── 工具栏 ─── -->
    <div class="hci-toolbar">
      <span class="hci-label">类型：</span>
      <a-radio-group v-model:value="activeType" button-style="solid" size="small" @change="onTypeChange">
        <a-radio-button value="exam_info">📋 考情</a-radio-button>
        <a-radio-button value="sprint">🚀 冲刺</a-radio-button>
        <a-radio-button value="advice">💡 备考建议</a-radio-button>
        <a-radio-button value="intensity">💪 强度</a-radio-button>
        <a-radio-button value="timeline_score">📊 时间轴/分值</a-radio-button>
      </a-radio-group>

      <span class="hci-label" style="margin-left:4px">主题：</span>
      <div class="hci-theme-dots">
        <span
          v-for="(tc, i) in currentThemeColors"
          :key="i"
          :class="['hci-dot', { active: activeTheme === i + 1 }]"
          :style="{ background: tc }"
          @click="activeTheme = i + 1"
        />
      </div>

      <a-button size="small" :loading="generating" @click="generateContent">
        <template #icon><SyncOutlined /></template>
        重新生成
      </a-button>
      <a-button
        type="primary"
        size="small"
        :loading="capturing"
        :disabled="!content"
        @click="captureImage"
      >
        📷 截图
      </a-button>
      <a-button
        v-if="capturedUrl"
        type="primary"
        ghost
        size="small"
        :loading="downloading"
        @click="downloadImage"
      >
        <template #icon><DownloadOutlined /></template>
        下载图片
      </a-button>
    </div>

    <!-- ─── 主内容区 ─── -->
    <div class="hci-main">
      <!-- 左侧：模板预览 -->
      <div class="hci-template-area">
        <div v-if="generating" class="hci-center">
          <a-spin size="large" />
          <div style="margin-top:14px;color:#666;font-size:14px">{{ statusMsg || '正在生成内容…' }}</div>
        </div>
        <div v-else-if="!content" class="hci-center">
          <a-empty description="暂无内容，点击「重新生成」开始" />
        </div>
        <div v-else ref="templateRef" style="display:inline-block;line-height:0">

          <!-- ① 考情模板 -->
          <div v-if="activeType === 'exam_info'" :class="`tpl-base tpl-exam-info theme-${activeTheme}`">
            <div class="tpl-ei-body">
              <div class="tpl-ei-title">{{ data.company_name }}</div>
              <div class="tpl-ei-subtitle">往年笔试考情：</div>
              <div class="tpl-ei-divider"></div>
              <div v-for="(sec, i) in content.sections" :key="i" class="tpl-ei-section">
                <div class="tpl-ei-section-head">
                  <div class="tpl-ei-circle"></div>
                  <span class="tpl-ei-section-title">{{ sec.title }}：</span>
                </div>
                <div class="tpl-ei-bullets">
                  <div v-for="(b, j) in sec.bullets" :key="j" class="tpl-ei-bullet">• {{ b }}</div>
                </div>
              </div>
              <div v-if="content.note" class="tpl-ei-note">⚠️ {{ content.note }}</div>
            </div>
            <div class="tpl-ei-corner-tr">≫</div>
            <div class="tpl-ei-corner-bl">≪</div>
            <div class="tpl-ei-footer-bar"></div>
          </div>

          <!-- ② 冲刺模板 -->
          <div v-else-if="activeType === 'sprint'" :class="`tpl-base tpl-sprint theme-${activeTheme}`">
            <div class="tpl-sp-header">
              <div class="tpl-sp-company">{{ data.company_name }}</div>
              <div class="tpl-sp-main-title">冲刺攻略</div>
              <div v-if="content.intro" class="tpl-sp-intro">{{ content.intro }}</div>
            </div>
            <div class="tpl-sp-body">
              <div v-for="(sec, i) in content.sections" :key="i" class="tpl-sp-section">
                <div class="tpl-sp-label">{{ sec.label }}</div>
                <div class="tpl-sp-content">{{ sec.content }}</div>
              </div>
            </div>
            <div class="tpl-sp-bottom-bar"></div>
          </div>

          <!-- ③ 备考建议模板 -->
          <div v-else-if="activeType === 'advice'" :class="`tpl-base tpl-advice theme-${activeTheme}`">
            <div class="tpl-adv-topbar">
              <div class="tpl-adv-badge">BKZT</div>
              <div class="tpl-adv-pin">📌</div>
            </div>
            <div class="tpl-adv-card">
              <div class="tpl-adv-hero">
                特别提醒下<br>
                <span style="font-size:30px">备考{{ data.company_name }}笔试的人</span>
              </div>
              <div class="tpl-adv-section">
                <div class="tpl-adv-tag">考生交流情况</div>
                <div class="tpl-adv-text">{{ content.intro }}</div>
              </div>
              <div class="tpl-adv-section" style="margin-bottom:0">
                <div class="tpl-adv-tag">备考小建议</div>
                <div class="tpl-adv-text">
                  <template v-for="part in parseHighlights(content.advice)" :key="part.key">
                    <span v-if="part.highlight" class="tpl-highlight">{{ part.text }}</span>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </div>
              </div>
            </div>
            <div style="height:20px"></div>
          </div>

          <!-- ④ 强度模板 -->
          <div v-else-if="activeType === 'intensity'" :class="`tpl-base tpl-intensity theme-${activeTheme}`">
            <div class="tpl-int-line-thick"></div>
            <div class="tpl-int-line-thin"></div>
            <div class="tpl-int-title-wrap">
              <div class="tpl-int-title">给大家普及下</div>
              <div class="tpl-int-title">{{ data.company_name }}备考的强度</div>
            </div>
            <div class="tpl-int-intro">{{ content.intro }}</div>
            <div class="tpl-int-blue-card">
              <div class="tpl-int-card-title">（备考建议）</div>
              <div class="tpl-int-card-text">
                <template v-for="part in parseHighlights(content.content)" :key="part.key">
                  <span v-if="part.highlight" class="tpl-highlight">{{ part.text }}</span>
                  <span v-else>{{ part.text }}</span>
                </template>
              </div>
            </div>
            <div class="tpl-int-line-thin" style="margin-top:0"></div>
            <div class="tpl-int-line-thick" style="margin-bottom:0"></div>
            <div class="tpl-int-footer">MAKE PEACE WITH YOURSELF</div>
          </div>

          <!-- ⑤ 时间轴/分值模板 -->
          <div v-else-if="activeType === 'timeline_score'" :class="`tpl-base tpl-timeline-score theme-${activeTheme}`">
            <div class="tpl-ts-title">
              <span>{{ content.yearLabel }}</span>{{ data.company_name || '招聘考试' }}
            </div>
            <div class="tpl-ts-highlight tpl-ts-subtitle">
              一. {{ content.shortName }}招聘考试时间轴
            </div>

            <div class="tpl-ts-timeline-wrap">
              <div class="tpl-ts-line"></div>
              <div
                v-for="(item, i) in content.timeline"
                :key="i"
                class="tpl-ts-node"
                :style="{ left: `${item.left}%` }"
              >
                <div class="tpl-ts-date">{{ item.date }}</div>
                <div class="tpl-ts-dot"></div>
                <div class="tpl-ts-label">{{ item.label }}</div>
              </div>
            </div>

            <div class="tpl-ts-content">
              <div class="tpl-ts-highlight tpl-ts-section-title">二. 考试内容及分值分布</div>
              <div class="tpl-ts-summary">
                <span>考试内容：</span>{{ content.summary }}
              </div>

              <table class="tpl-ts-table">
                <tbody>
                  <tr v-for="(row, i) in content.rows" :key="i">
                    <td class="tpl-ts-subject">{{ row.subject }}</td>
                    <td class="tpl-ts-scope">{{ row.scope }}</td>
                    <td class="tpl-ts-count">{{ row.count }}</td>
                    <td class="tpl-ts-score">{{ row.score }}</td>
                    <td class="tpl-ts-note">{{ row.note }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <!-- 右侧：截图预览 -->
      <div v-if="capturedUrl" class="hci-preview-area">
        <div class="hci-preview-title">截图预览</div>
        <img :src="capturedUrl" class="hci-preview-img" />
        <a-button
          type="primary"
          ghost
          :loading="downloading"
          style="margin-top:12px"
          @click="downloadImage"
        >
          <template #icon><DownloadOutlined /></template>
          下载图片
        </a-button>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { SyncOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { toPng } from 'html-to-image'
import { chatLlm } from '@/api/llm'
import { useLlmStore } from '@/stores/llm'
import { useRouter } from 'vue-router'

// ─── Props / Emits ─────────────────────────────────────────
const props = defineProps({
  data: { type: Object, default: () => ({}) },
  visible: { type: Boolean, default: false },
  initType: { type: String, default: 'exam_info' },
})
const emit = defineEmits(['update:visible'])

const localVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

// ─── Stores / Router ───────────────────────────────────────
const llmStore = useLlmStore()
const router = useRouter()

// ─── State ─────────────────────────────────────────────────
const activeType  = ref('exam_info')
const activeTheme = ref(1)
const generating  = ref(false)
const capturing   = ref(false)
const downloading = ref(false)
const statusMsg   = ref('')
const content     = ref(null)
const capturedUrl = ref('')
const templateRef = ref(null)

// ─── 主题圆点颜色 ──────────────────────────────────────────
const THEME_COLORS = {
  exam_info: ['#f0a500', '#4fc3f7', '#e53935', '#7b1fa2', '#2e7d32'],
  sprint:    ['#c8000f', '#1a1a1a', '#e65100', '#1a237e', '#1b5e20'],
  advice:    ['#1a3a5c', '#c2185b', '#f57f17', '#2e7d32', '#6a1b9a'],
  intensity: ['#111111', '#ff6d00', '#c62828', '#0d47a1', '#5d4037'],
  timeline_score: ['#4a9be8', '#ff5a7a', '#22a06b', '#805ad5', '#f97316'],
}
const currentThemeColors = computed(() => THEME_COLORS[activeType.value] || [])

// ─── 类型切换 ──────────────────────────────────────────────
function onTypeChange() {
  activeTheme.value = 1
  content.value = null
  capturedUrl.value = ''
  generateContent()
}

watch(() => props.visible, (v) => {
  if (v) {
    activeType.value  = props.initType || 'exam_info'
    activeTheme.value = 1
    content.value     = null
    capturedUrl.value = ''
    generateContent()
  }
})

// ─── LLM 生成 ──────────────────────────────────────────────
async function generateContent() {
  if (activeType.value === 'timeline_score') {
    generating.value = true
    statusMsg.value  = '正在查询并整理考试内容…'
    try {
      content.value = await buildTimelineScoreContentWithLlm(props.data)
    } catch (e) {
      message.warning(e.message || 'LLM 生成失败，已使用商品详情生成基础表格')
      content.value = buildTimelineScoreContent(props.data)
    } finally {
      generating.value = false
      statusMsg.value  = ''
    }
    return
  }

  const active = llmStore.active
  if (!active) {
    Modal.warning({
      title: '提示',
      content: '请先在「系统设置 → 大模型」中设置使用中的模型',
      okText: '去设置',
      onOk: () => router.push('/system/llm'),
    })
    return
  }

  generating.value = true
  statusMsg.value  = '正在分析内容，生成卡片文字…'
  try {
    const d = props.data
    const userPrompt = buildPrompt(activeType.value, d)

    const res = await chatLlm({
      provider:   active.provider,
      api_format: active.api_format,
      api_key:    active.api_key,
      base_url:   active.base_url || '',
      model:      active.default_model,
      messages: [
        {
          role: 'system',
          content: '你是一个JSON生成助手。只输出有效的JSON对象，不要任何解释说明，不要用markdown代码块包裹，直接输出原始JSON。严禁涉及政治人物、党政文件等敏感内容。',
        },
        { role: 'user', content: userPrompt },
      ],
      max_tokens:  1200,
      temperature: 0.7,
    })

    const raw = (res.content || '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('模型未返回有效JSON，请重试')
    content.value = JSON.parse(match[0])
  } catch (e) {
    message.error(e.message || '生成失败，请重试')
    content.value = null
  } finally {
    generating.value = false
    statusMsg.value  = ''
  }
}

// ─── Prompt 构建 ───────────────────────────────────────────
function buildWrittenExamConstraint(d) {
  const content = String(d?.written_exam_content || '').trim()
  if (!content) {
    return [
      '【笔试内容约束】',
      '商品详情未填写明确的笔试内容，可按现有招聘信息和商品类型生成，但不要无依据写得过于具体。',
    ].join('\n')
  }
  return [
    '【笔试内容约束】',
    `商品详情里的笔试内容：${content}`,
    '生成内容必须严格围绕上述笔试内容展开；如果只写了某一科或某一类内容，就只写该范围。',
    '不要主动扩展到未出现的考试科目或模块。例如只写“公共基础/公共基础知识”时，不要写行测、申论、面试、专业知识等无关内容。',
  ].join('\n')
}

function buildPrompt(type, d) {
  const base = [
    d.company_name         ? `单位名称：${d.company_name}` : '',
    d.written_exam_time    ? `笔试时间：${d.written_exam_time}` : '',
    d.written_exam_content ? `笔试内容：${d.written_exam_content}` : '',
    d.recruit_count        ? `招聘人数：${d.recruit_count}` : '',
  ].filter(Boolean).join('\n')
  const examConstraint = buildWrittenExamConstraint(d)

  if (type === 'exam_info') {
    return [
      '根据以下招聘信息，整理笔试考情卡片内容。',
      '',
      base,
      '',
      examConstraint,
      '',
      '输出格式（sections必须恰好3项）：',
      '{"sections":[{"title":"笔试相关","bullets":["时间/形式/地点等，1-2条"]},{"title":"笔试内容","bullets":["主要考察科目/内容，2-4条"]},{"title":"笔试题型","bullets":["题目类型和数量分布，2-3条"]}],"note":"每年笔试内容略有变化，仅供参考"}',
      '',
      '要求：内容具体实用，bullets每条不超过60字，若信息不明确写"具体以通知为准"。',
    ].filter(Boolean).join('\n')
  }

  if (type === 'sprint') {
    return [
      '根据以下招聘信息，生成冲刺备考攻略内容。',
      '',
      base,
      '',
      examConstraint,
      '',
      '输出格式（sections必须恰好3项）：',
      '{"intro":"激励短句，不超过30字","sections":[{"label":"重点科目","content":"..."},{"label":"答题技巧","content":"..."},{"label":"备考提醒","content":"..."}]}',
      '',
      '要求：针对该单位笔试内容，每个content不超过80字，语气激励实用。',
    ].filter(Boolean).join('\n')
  }

  if (type === 'advice') {
    return [
      '根据以下招聘信息，模拟已上岸考生的备考分享帖，生成备考建议卡片内容。',
      '',
      base,
      '',
      examConstraint,
      '',
      '输出格式（**词**标记的内容将渲染为红色高亮）：',
      '{"intro":"考生交流情况开场，50字以内，模拟上岸考生讲自己的备考经历","advice":"备考建议正文，150-200字，包含具体科目建议和刷题方向，至少用**词**标记3-5个关键词，关键词必须来自笔试内容或招聘信息"}',
      '',
      '要求：语言亲切自然，严禁引流内容（加微信/关注等）。',
    ].filter(Boolean).join('\n')
  }

  // intensity
  return [
    '根据以下招聘信息，描述备考该单位笔试的学习强度和备考建议。',
    '',
    base,
    '',
    examConstraint,
    '',
    '输出格式（**词**标记的内容将渲染为红色高亮）：',
    '{"intro":"80字以内，讲述一位考生的备考经历和强度感受","content":"150-200字，描述考试特点和备考建议，至少用**词**标记3-5个关键词"}',
    '',
    '要求：真实感强，聚焦该单位考试特点，严禁引流内容。',
  ].filter(Boolean).join('\n')
}

// ─── 关键词高亮解析 ─────────────────────────────────────────
function parseHighlights(text) {
  if (!text) return []
  const parts = []
  const regex = /\*\*(.*?)\*\*/g
  let lastIndex = 0
  let match
  let idx = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), highlight: false, key: idx++ })
    }
    parts.push({ text: match[1], highlight: true, key: idx++ })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false, key: idx++ })
  }
  return parts
}

// ─── 时间轴/分值模板：从商品详情本地生成 ─────────────────────
function buildTimelineScoreContent(d) {
  const company = String(d?.company_name || d?.title || '招聘考试').trim()
  const writtenContent = String(d?.written_exam_content || '').trim()
  const subjects = splitExamSubjects(writtenContent)
  const rows = buildScoreRows(subjects, writtenContent)
  return {
    yearLabel: extractYearLabel(d),
    shortName: getShortCompanyName(company),
    timeline: buildTimelineItems(d),
    summary: writtenContent || '具体考试内容以公告及准考证通知为准',
    rows,
  }
}

async function buildTimelineScoreContentWithLlm(d) {
  const base = buildTimelineScoreContent(d)
  const active = llmStore.active
  if (!active) return base

  const res = await chatLlm({
    provider:   active.provider,
    api_format: active.api_format,
    api_key:    active.api_key,
    base_url:   active.base_url || '',
    model:      active.default_model,
    messages: [
      {
        role: 'system',
        content: '你是招聘考试资料整理助手。只输出有效JSON对象，不要markdown，不要解释。内容必须克制、像考试资料表格，不要编造确定年份真题；不确定的信息写“以公告为准”或“常见考法”。严禁涉及政治人物、党政文件等敏感内容。',
      },
      { role: 'user', content: buildTimelineScorePrompt(d, base) },
    ],
    max_tokens:  1400,
    temperature: 0.45,
  })

  const raw = String(res?.content || '').trim()
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('模型未返回有效JSON')
  const parsed = JSON.parse(match[0])
  return {
    ...base,
    summary: normalizeTimelineText(parsed.summary) || base.summary,
    rows: normalizeTimelineRows(parsed.rows, base.rows),
  }
}

function buildTimelineScorePrompt(d, base) {
  return [
    '请根据商品详情，结合该单位/行业常见招聘笔试考察方向，生成“考试内容及分值分布”表格。',
    '要求优先使用商品详情里的笔试内容；如果单位信息不足，只能写常见考法，不要写成确定真题。',
    '分析风格必须接近参考样例：把综合类考试拆成“行政职业能力测验 / 公共基础知识+本地或单位常识 / 岗位专业知识 / 主观写作”等可复习模块；每行都要有具体内容细分、题量、分值和备考判断。',
    '',
    '商品详情：',
    d?.title ? `公告名称：${d.title}` : '',
    d?.company_name ? `单位名称：${d.company_name}` : '',
    d?.job_type_name ? `商品类型：${d.job_type_name}` : '',
    d?.recruit_count ? `招聘人数：${d.recruit_count}` : '',
    d?.apply_time ? `报名时间：${d.apply_time}` : '',
    d?.written_exam_time ? `笔试时间：${d.written_exam_time}` : '',
    d?.interview_time ? `面试时间：${d.interview_time}` : '',
    d?.written_exam_content ? `笔试内容：${d.written_exam_content}` : '',
    '',
    '当前基础拆分：',
    JSON.stringify({ summary: base.summary, rows: base.rows }, null, 2),
    '',
    '请输出JSON：',
    '{"summary":"一句考试内容摘要，80字以内","rows":[{"subject":"模块名称","scope":"内容细分，尽量具体，40-70字","count":"题量，如约35-45题；写作类必须是1题","score":"占比，如40%","note":"复习建议或考法特点，30-55字"}]}',
    '',
    '参考样例结构（请仿照这种分析深度，不要照抄单位名）：',
    JSON.stringify({
      rows: [
        {
          subject: '行政职业能力测验',
          scope: '言语理解、数量关系、资料分析、判断推理（不含图形推理）',
          count: '约40题',
          score: '40%',
          note: '难度低于公务员行测；重点练言语与资料分析，性价比最高',
        },
        {
          subject: '公共基础知识+本地/单位常识',
          scope: '本地时政、国企基础、本地政策、单位发展历程、主营业务、重点项目、企业文化价值观',
          count: '约20题',
          score: '20%',
          note: '属于拿分模块，直接背诵单位简介和本地相关常识，必考',
        },
        {
          subject: '岗位专业知识',
          scope: '财务岗、工程岗、运营岗、综合岗等按岗位拆分专业基础、法规、流程、案例和实务应用',
          count: '约25题',
          score: '30%',
          note: '岗位差异大，根据报递岗位针对性复习基础专业课，不深挖难题',
        },
        {
          subject: '主观写作（综合/宣传类岗位）',
          scope: '材料简答、短材料作文、考察文字表达、公文思维和结构化表达',
          count: '1题',
          score: '10%',
          note: '综合、宣传、党建类岗位大概率考察，其他岗位准备简短策论框架',
        },
      ],
    }),
    '',
    '规则：',
    '1. rows 建议 4 行优先，最多 5 行。若商品详情只有“综合基础知识及写作”，也要按参考样例拆出行测、公基/常识、岗位专业、写作。',
    '2. 写作、申论、作文、材料写作类题量必须写“1题”；只要有写作类，写作类分值固定为20%。',
    '3. score 合计必须为100%；有写作类时，其他客观/专业模块重新分配剩余80%。',
    '4. scope 不要空泛，不要只写“相关基础知识”；必须写出具体科目、知识点或岗位方向。',
    '5. note 要像备考判断：说明难度、拿分价值、复习优先级或岗位差异。',
  ].filter(Boolean).join('\n')
}

function normalizeTimelineRows(rows, fallbackRows) {
  if (!Array.isArray(rows) || !rows.length) return fallbackRows
  const normalized = rows.slice(0, 5).map((row, index) => {
    const subject = normalizeTimelineText(row?.subject) || fallbackRows[index]?.subject || '综合模块'
    const isWriting = isWritingSubject(subject)
    return {
      subject,
      scope: normalizeTimelineText(row?.scope) || fallbackRows[index]?.scope || buildSubjectScope(subject, ''),
      count: isWriting ? '1 题' : (normalizeTimelineText(row?.count) || fallbackRows[index]?.count || '约 20-30 题'),
      score: normalizeTimelineScore(row?.score) || fallbackRows[index]?.score || '',
      note: normalizeTimelineText(row?.note) || fallbackRows[index]?.note || '结合公告要求和常见题型进行针对性复习。',
    }
  })
  return normalizeTimelineScores(normalized)
}

function normalizeTimelineText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeTimelineScore(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/\d{1,3}/)
  if (!match) return ''
  const n = Math.max(0, Math.min(100, Number(match[0]) || 0))
  return n ? `${n}%` : ''
}

function normalizeTimelineScores(rows) {
  const scores = rows.map(row => Number(String(row.score || '').match(/\d{1,3}/)?.[0] || 0))
  const writingIndexes = rows
    .map((row, index) => isWritingSubject(row.subject) ? index : -1)
    .filter(index => index >= 0)
  if (writingIndexes.length && writingIndexes.length < rows.length) {
    const writingScore = Math.round(20 / writingIndexes.length)
    const writingTotal = writingScore * writingIndexes.length
    const objectiveIndexes = rows.map((_, index) => index).filter(index => !writingIndexes.includes(index))
    const objectiveTotal = objectiveIndexes.reduce((sum, index) => sum + (scores[index] || 0), 0) || objectiveIndexes.length
    let used = writingTotal
    const nextRows = rows.map((row, index) => {
      if (writingIndexes.includes(index)) return { ...row, score: `${writingScore}%`, count: '1 题' }
      const score = Math.max(1, Math.round(80 * ((scores[index] || 1) / objectiveTotal)))
      used += score
      return { ...row, score: `${score}%` }
    })
    const lastObjective = objectiveIndexes[objectiveIndexes.length - 1]
    if (lastObjective !== undefined) {
      const current = Number(String(nextRows[lastObjective].score || '').match(/\d{1,3}/)?.[0] || 0)
      nextRows[lastObjective] = { ...nextRows[lastObjective], score: `${Math.max(1, current + (100 - used))}%` }
    }
    return nextRows
  }
  const sum = scores.reduce((a, b) => a + b, 0)
  if (!sum) return rows
  if (sum === 100) return rows
  const lastIndex = rows.length - 1
  const fixedLast = Math.max(1, scores[lastIndex] + (100 - sum))
  rows[lastIndex] = { ...rows[lastIndex], score: `${fixedLast}%` }
  return rows
}

function isWritingSubject(subject) {
  return /写作|申论|作文|材料/.test(String(subject || ''))
}

function extractYearLabel(d) {
  const text = [d?.title, d?.apply_time, d?.written_exam_time, d?.interview_time].filter(Boolean).join(' ')
  const match = String(text).match(/20\d{2}/)
  return match ? `${match[0]}届` : ''
}

function getShortCompanyName(name) {
  const raw = String(name || '').trim()
  if (!raw) return '本单位'
  const cleaned = raw
    .replace(/^20\d{2}(年|届)?/, '')
    .replace(/招聘.*$/, '')
    .replace(/考试.*$/, '')
    .replace(/有限责任公司|股份有限公司|有限公司|集团有限公司|集团/g, '集团')
    .trim()
  return cleaned.slice(0, 10) || raw.slice(0, 10)
}

function buildTimelineItems(d) {
  const applyParts = splitApplyTime(d?.apply_time)
  const items = [
    { date: '以公告为准', label: '公告发布' },
    { date: applyParts.start || formatTimelineDate(d?.apply_time) || '以公告为准', label: '报名开始' },
    { date: applyParts.end || '以公告为准', label: '报名结束' },
    { date: formatTimelineDate(d?.written_exam_time) || '另行通知', label: '笔试时间' },
    { date: formatTimelineDate(d?.interview_time) || '另行通知', label: '面试时间' },
  ]
  const denom = Math.max(items.length - 1, 1)
  return items.map((item, index) => ({
    ...item,
    left: 6 + (index / denom) * 88,
  }))
}

function splitApplyTime(value) {
  const raw = String(value || '').trim()
  if (!raw) return { start: '', end: '' }
  const parts = raw.split(/\s*(?:~|—|-|至|到)\s*/).filter(Boolean)
  if (parts.length >= 2) {
    return { start: formatTimelineDate(parts[0]), end: formatTimelineDate(parts[1]) }
  }
  return { start: formatTimelineDate(raw), end: '' }
}

function formatTimelineDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/另行通知|待定|以.*为准/.test(raw)) return raw
  const normalized = raw.replace(/[年月.\/]/g, '-').replace(/日/g, '')
  const match = normalized.match(/(?:(20\d{2})-)?(\d{1,2})-(\d{1,2})/)
  if (match) {
    const year = match[1]
    const mm = String(Number(match[2])).padStart(2, '0')
    const dd = String(Number(match[3])).padStart(2, '0')
    return year ? `${year} 年 ${mm} 月 ${dd} 日` : `${mm} 月 ${dd} 日`
  }
  return raw.length > 12 ? raw.slice(0, 12) : raw
}

function splitExamSubjects(content) {
  const raw = String(content || '').trim()
  if (!raw) return ['笔试综合内容']
  if (shouldUseDetailedExamStructure(raw)) {
    return buildDetailedExamSubjects(raw)
  }
  const normalized = raw
    .replace(/[；;]/g, '、')
    .replace(/[+＋]/g, '、')
    .replace(/以及|及|和/g, '、')
  return normalized
    .split(/[、,，\n]/)
    .map(item => item.replace(/考试内容[:：]?|笔试内容[:：]?/g, '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function shouldUseDetailedExamStructure(content) {
  return /综合基础|公共基础|公基|综合知识|职业能力|行测|写作|申论|岗位|专业/.test(content)
}

function buildDetailedExamSubjects(content) {
  const subjects = []
  if (/行测|职测|职业能力|行政职业能力/.test(content) || /综合基础|公共基础|公基|综合知识/.test(content)) {
    subjects.push('行政职业能力测验')
  }
  if (/公共基础|公基|综合基础|综合知识|省情|市情|区情|企业|集团|单位|常识/.test(content)) {
    subjects.push('公共基础知识+本地/单位常识')
  }
  if (/岗位|专业|财务|工程|运营|综合岗|信息技术|人力|法务|文旅|市场/.test(content) || subjects.length < 3) {
    subjects.push('岗位专业知识')
  }
  if (/写作|申论|作文|材料|公文/.test(content)) {
    subjects.push('主观写作')
  }
  return [...new Set(subjects)].slice(0, 5)
}

function buildScoreRows(subjects, rawContent) {
  const list = subjects.length ? subjects : ['笔试综合内容']
  const metas = list.map(subject => buildSubjectMeta(subject))
  const writingCount = metas.filter(item => item.type === 'writing').length
  const writingTotal = writingCount ? (list.length === writingCount ? 100 : 20) : 0
  const objectiveMetas = metas.filter(item => item.type !== 'writing')
  const objectiveBaseTotal = objectiveMetas.reduce((sum, item) => sum + item.baseWeight, 0) || objectiveMetas.length || 1

  const rows = metas.map((meta) => {
    let score
    if (meta.type === 'writing') {
      score = list.length === writingCount ? Math.round(100 / writingCount) : Math.round(writingTotal / writingCount)
    } else {
      const remaining = 100 - writingTotal
      score = Math.max(10, Math.round(remaining * meta.baseWeight / objectiveBaseTotal))
    }
    return {
      subject: meta.label,
      scope: buildSubjectScope(meta.label, rawContent),
      count: meta.count || getObjectiveQuestionCount(score),
      score: `${score}%`,
      note: meta.note,
    }
  })
  return normalizeTimelineScores(rows)
}

function buildSubjectMeta(subject) {
  const s = String(subject || '').trim()
  if (/写作|申论|作文|材料/.test(s)) {
    return {
      type: 'writing',
      label: s,
      baseWeight: 10,
      count: '1 题',
      note: '主观题重点看审题、结构、论点和材料提炼，建议提前准备常用框架。',
    }
  }
  if (/行测|职测|职业能力/.test(s)) {
    return {
      type: 'aptitude',
      label: s,
      baseWeight: 40,
      count: '约 35-45 题',
      note: '客观题题量较大，适合用限时训练提升速度和正确率。',
    }
  }
  if (/公基|公共基础/.test(s)) {
    return {
      type: 'public',
      label: s,
      baseWeight: 30,
      count: '约 20-30 题',
      note: '覆盖面广，建议按模块梳理高频知识点并配套刷题。',
    }
  }
  if (/本地|单位|企业|集团|常识|省情|市情|区情/.test(s)) {
    return {
      type: 'local',
      label: s,
      baseWeight: 20,
      count: '约 15-25 题',
      note: '属于拿分模块，建议直接背诵本地概况、单位简介和近期重点信息。',
    }
  }
  if (/专业|岗位/.test(s)) {
    return {
      type: 'major',
      label: s,
      baseWeight: 28,
      count: '约 20-30 题',
      note: '岗位差异较大，要结合岗位方向复习专业基础和实务应用。',
    }
  }
  return {
    type: 'common',
    label: s,
    baseWeight: 22,
    count: '',
    note: '细节以公告和准考证要求为准，考前集中回顾高频考点。',
  }
}

function getObjectiveQuestionCount(score) {
  if (score >= 35) return '约 35-45 题'
  if (score >= 25) return '约 20-30 题'
  if (score >= 15) return '约 10-20 题'
  return '约 5-10 题'
}

function buildSubjectScope(subject, rawContent) {
  const text = String(rawContent || '').trim()
  if (!text) return '具体考察范围以公告及考试通知为准'
  if (/行测|职测|职业能力/.test(subject)) return '言语理解、数量关系、判断推理、资料分析，重点练速度、准确率和易错题型'
  if (/公共基础知识\+本地|公共基础知识\+单位|本地\/单位/.test(subject)) return '基础常识、法律经济、公文管理、本地概况、单位发展历程、主营业务、重点项目和文化价值观'
  if (/公基|公共基础/.test(subject)) return '法律基础、经济管理、公文写作、科技人文、时事常识，重点背高频概念和常考判断'
  if (/省情|区情|市情|本地/.test(subject)) return '本地概况、经济社会发展、历史文化、重点项目、文旅资源及近年热点'
  if (/企业|集团|文化|价值观/.test(subject)) return '单位概况、发展历程、主营业务、企业文化、价值理念和岗位匹配认知'
  if (/写作|申论|作文|材料/.test(subject)) return '材料阅读、综合分析、观点提炼、文字表达、公文或短文写作，注意结构完整'
  if (/专业|岗位/.test(subject)) return '围绕岗位要求细分专业基础、业务流程、实务应用、常见案例和规范要求'
  if (subject.length >= 18) return `${subject}；建议按关键词拆成知识点、题型和易错点复习`
  return `${subject}相关基础概念、核心知识点、常见题型、易错点和真题高频考法`
}

// ─── 截图 ──────────────────────────────────────────────────
async function captureImage() {
  const el = templateRef.value
  if (!el) { message.warning('模板未就绪，请稍后重试'); return }

  capturing.value = true
  try {
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: false,
    })
    capturedUrl.value = dataUrl
    message.success('截图成功')
  } catch (e) {
    console.error('截图失败', e)
    message.error('截图失败：' + (e.message || '未知错误'))
  } finally {
    capturing.value = false
  }
}

// ─── 下载 ──────────────────────────────────────────────────
const TYPE_LABEL_MAP = {
  exam_info: '考情',
  sprint:    '冲刺',
  advice:    '备考建议',
  intensity: '强度',
  timeline_score: '时间轴分值',
}

async function downloadImage() {
  if (!capturedUrl.value) return
  downloading.value = true
  try {
    const company = props.data.company_name || 'product'
    const label   = TYPE_LABEL_MAP[activeType.value] || activeType.value
    const a = document.createElement('a')
    a.href     = capturedUrl.value
    a.download = `${company}-${label}-主题${activeTheme.value}.png`
    a.click()
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
/* ─── 布局 ────────────────────────────────────────────────── */
.hci-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.hci-label {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
}
.hci-theme-dots {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hci-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  box-sizing: border-box;
  transition: transform 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
}
.hci-dot:hover { transform: scale(1.2); }
.hci-dot.active {
  box-shadow: 0 0 0 2px #1677ff;
  transform: scale(1.15);
}
.hci-main {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
  overflow: hidden;
}
.hci-template-area {
  flex: 1;
  overflow: auto;
  background: #e8e8e8;
  border-radius: 8px;
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.hci-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 80px;
}
.hci-preview-area {
  width: 360px;
  flex-shrink: 0;
  overflow: auto;
  background: #e8e8e8;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.hci-preview-title { font-size: 13px; font-weight: 600; color: #444; }
.hci-preview-img {
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  display: block;
}

/* ─── 公共模板基础 ────────────────────────────────────────── */
.tpl-base {
  width: 540px;
  box-sizing: border-box;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
  position: relative;
  overflow: hidden;
}
/* 关键词高亮，颜色由各主题变量控制 */
.tpl-highlight {
  color: var(--highlight, #e8001a);
  font-weight: 700;
}

/* ══════════════════════════════════════════════════════════
   ⑤ 时间轴/分值模板
   ══════════════════════════════════════════════════════════ */
.tpl-timeline-score {
  --ts-blue: #4a9be8;
  --ts-blue-soft: #d9ecff;
  --ts-yellow: #ffe676;
  --ts-red: #c91515;
  --ts-grid: #4b6a7a;
  --ts-text: #333333;
  width: 720px;
  min-height: 960px;
  background: #ffffff;
  color: var(--ts-text);
  padding-top: 24px;
}
.tpl-timeline-score.theme-2 {
  --ts-blue: #ff5a7a;
  --ts-blue-soft: #ffe1e8;
  --ts-yellow: #fff0a8;
  --ts-red: #b5123c;
  --ts-grid: #8f5060;
}
.tpl-timeline-score.theme-3 {
  --ts-blue: #22a06b;
  --ts-blue-soft: #dff7ec;
  --ts-yellow: #f5e77e;
  --ts-red: #0f7a4b;
  --ts-grid: #3d755f;
}
.tpl-timeline-score.theme-4 {
  --ts-blue: #805ad5;
  --ts-blue-soft: #ece3ff;
  --ts-yellow: #ffe98f;
  --ts-red: #5a32b0;
  --ts-grid: #62517d;
}
.tpl-timeline-score.theme-5 {
  --ts-blue: #f97316;
  --ts-blue-soft: #ffead7;
  --ts-yellow: #ffe27a;
  --ts-red: #c2410c;
  --ts-grid: #8a5b35;
}
.tpl-ts-title {
  width: fit-content;
  max-width: 620px;
  margin: 0 auto 26px;
  color: var(--ts-blue);
  font-size: 38px;
  font-weight: 500;
  line-height: 1.18;
  text-align: center;
  position: relative;
  z-index: 0;
}
.tpl-ts-title::after,
.tpl-ts-highlight::after {
  content: '';
  position: absolute;
  left: -10px;
  right: -10px;
  bottom: 2px;
  height: 22px;
  background: var(--ts-yellow);
  border-radius: 999px;
  z-index: -1;
}
.tpl-ts-title span { margin-right: 4px; }
.tpl-ts-highlight {
  width: fit-content;
  color: var(--ts-blue);
  font-weight: 500;
  line-height: 1.2;
  position: relative;
  z-index: 0;
}
.tpl-ts-subtitle {
  margin: 0 0 18px 10px;
  font-size: 28px;
}
.tpl-ts-timeline-wrap {
  height: 150px;
  background: var(--ts-blue-soft);
  position: relative;
  margin-bottom: 16px;
  overflow: hidden;
}
.tpl-ts-line {
  position: absolute;
  left: 28px;
  right: 28px;
  top: 70px;
  height: 2px;
  background: repeating-linear-gradient(
    90deg,
    var(--ts-blue) 0,
    var(--ts-blue) 16px,
    transparent 16px,
    transparent 22px
  );
}
.tpl-ts-node {
  position: absolute;
  top: 38px;
  width: 132px;
  transform: translateX(-50%);
  text-align: center;
  color: var(--ts-blue);
}
.tpl-ts-date {
  height: 25px;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  white-space: normal;
}
.tpl-ts-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ts-blue);
  margin: 5px auto 8px;
}
.tpl-ts-label {
  font-size: 17px;
  font-weight: 800;
  line-height: 1.2;
}
.tpl-ts-content {
  position: relative;
  padding: 0 4px 18px;
}
.tpl-ts-section-title {
  margin-left: 6px;
  margin-bottom: 12px;
  font-size: 29px;
}
.tpl-ts-summary {
  color: var(--ts-red);
  font-size: 20px;
  font-weight: 900;
  line-height: 1.55;
  padding: 0 8px 8px;
}
.tpl-ts-summary span {
  font-weight: 900;
}
.tpl-ts-table {
  width: calc(100% - 8px);
  margin: 0 4px;
  border-collapse: collapse;
  table-layout: fixed;
  background: #ffffff;
}
.tpl-ts-table td {
  border: 1.5px solid var(--ts-grid);
  padding: 7px 8px;
  text-align: center;
  vertical-align: middle;
  color: #333;
  line-height: 1.45;
  word-break: break-word;
}
.tpl-ts-subject {
  width: 15%;
  font-size: 18px;
  font-weight: 500;
}
.tpl-ts-scope {
  width: 39%;
  font-size: 17px;
}
.tpl-ts-count {
  width: 12%;
  font-size: 17px;
  font-weight: 600;
}
.tpl-ts-score {
  width: 9%;
  font-size: 18px;
  font-weight: 700;
}
.tpl-ts-note {
  width: 25%;
  font-size: 16px;
}

/* ══════════════════════════════════════════════════════════
   ① 考情模板 — 5 套主题
   ══════════════════════════════════════════════════════════ */

/* 主题1: 暖米色（默认） */
.tpl-exam-info {
  --ei-bg:           #fffef9;
  --ei-title:        #2a1a08;
  --ei-subtitle:     #2a1a08;
  --ei-accent:       #f0a500;
  --ei-divider-from: #2a1a08;
  --ei-circle:       #2a1a08;
  --ei-sec-title:    #2a1a08;
  --ei-bullet:       #3a3a3a;
  --ei-note-bg:      #fff8e6;
  --ei-note-border:  #f0a500;
  --ei-note-text:    #888;
  --ei-footer-bar:   #2a1a08;
  --ei-corner:       #f0a500;
  background: var(--ei-bg);
  min-height: 720px;
}
/* 主题2: 深夜蓝 */
.tpl-exam-info.theme-2 {
  --ei-bg:           #0d1b2a;
  --ei-title:        #ffffff;
  --ei-subtitle:     #90b8d8;
  --ei-accent:       #4fc3f7;
  --ei-divider-from: #4fc3f7;
  --ei-circle:       #4fc3f7;
  --ei-sec-title:    #e0f0ff;
  --ei-bullet:       #a8c0d8;
  --ei-note-bg:      rgba(79,195,247,0.12);
  --ei-note-border:  #4fc3f7;
  --ei-note-text:    #7ab8d8;
  --ei-footer-bar:   #4fc3f7;
  --ei-corner:       #4fc3f7;
}
/* 主题3: 极简红 */
.tpl-exam-info.theme-3 {
  --ei-bg:           #ffffff;
  --ei-title:        #111111;
  --ei-subtitle:     #111111;
  --ei-accent:       #e53935;
  --ei-divider-from: #111111;
  --ei-circle:       #111111;
  --ei-sec-title:    #111111;
  --ei-bullet:       #333333;
  --ei-note-bg:      #fff5f5;
  --ei-note-border:  #e53935;
  --ei-note-text:    #999;
  --ei-footer-bar:   #e53935;
  --ei-corner:       #e53935;
}
/* 主题4: 典雅紫 */
.tpl-exam-info.theme-4 {
  --ei-bg:           #f3e5f5;
  --ei-title:        #311b92;
  --ei-subtitle:     #4a148c;
  --ei-accent:       #7b1fa2;
  --ei-divider-from: #7b1fa2;
  --ei-circle:       #7b1fa2;
  --ei-sec-title:    #4a148c;
  --ei-bullet:       #333;
  --ei-note-bg:      rgba(123,31,162,0.08);
  --ei-note-border:  #7b1fa2;
  --ei-note-text:    #9c4dcc;
  --ei-footer-bar:   #311b92;
  --ei-corner:       #ce93d8;
}
/* 主题5: 自然绿 */
.tpl-exam-info.theme-5 {
  --ei-bg:           #f1f8e9;
  --ei-title:        #1b5e20;
  --ei-subtitle:     #2e7d32;
  --ei-accent:       #2e7d32;
  --ei-divider-from: #2e7d32;
  --ei-circle:       #2e7d32;
  --ei-sec-title:    #1b5e20;
  --ei-bullet:       #333;
  --ei-note-bg:      rgba(46,125,50,0.08);
  --ei-note-border:  #2e7d32;
  --ei-note-text:    #558b2f;
  --ei-footer-bar:   #1b5e20;
  --ei-corner:       #81c784;
}

/* 考情 — 元素样式 */
.tpl-ei-body { padding: 50px 48px 56px; }
.tpl-ei-title {
  display: block;
  font-size: 52px;
  font-weight: 900;
  color: var(--ei-title);
  line-height: 1.25;
  letter-spacing: -1px;
  margin-bottom: 4px;
}
.tpl-ei-subtitle {
  display: block;
  font-size: 34px;
  font-weight: 900;
  color: var(--ei-subtitle);
  line-height: 1.3;
  margin-bottom: 26px;
  margin-top: 0;
}
.tpl-ei-divider {
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, var(--ei-divider-from) 60%, transparent);
  margin-bottom: 26px;
}
.tpl-ei-section { margin-bottom: 22px; }
.tpl-ei-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.tpl-ei-circle {
  width: 20px;
  height: 20px;
  border: 2.5px solid var(--ei-circle);
  border-radius: 50%;
  flex-shrink: 0;
}
.tpl-ei-section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--ei-sec-title);
}
.tpl-ei-bullets { padding-left: 32px; }
.tpl-ei-bullet {
  font-size: 16px;
  color: var(--ei-bullet);
  line-height: 1.85;
}
.tpl-ei-note {
  margin-top: 18px;
  padding: 10px 14px;
  background: var(--ei-note-bg);
  border-left: 3px solid var(--ei-note-border);
  border-radius: 4px;
  font-size: 14px;
  color: var(--ei-note-text);
  line-height: 1.6;
}
.tpl-ei-corner-tr {
  position: absolute;
  top: 18px; right: 20px;
  font-size: 26px;
  color: var(--ei-corner);
  font-weight: 900;
  transform: rotate(-15deg);
  line-height: 1;
}
.tpl-ei-corner-bl {
  position: absolute;
  bottom: 16px; left: 18px;
  font-size: 26px;
  color: var(--ei-corner);
  font-weight: 900;
  transform: rotate(15deg);
  line-height: 1;
}
.tpl-ei-footer-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 10px;
  background: var(--ei-footer-bar);
}

/* ══════════════════════════════════════════════════════════
   ② 冲刺模板 — 5 套主题
   ══════════════════════════════════════════════════════════ */

/* 主题1: 活力红（默认） */
.tpl-sprint {
  --sp-header-bg:   linear-gradient(135deg, #c8000f 0%, #ff5520 100%);
  --sp-header-text: #ffffff;
  --sp-label-bg:    #c8000f;
  --sp-label-color: #ffffff;
  --sp-bottom-bar:  linear-gradient(90deg, #c8000f, #ff5520);
  --sp-body-bg:     #ffffff;
  --sp-text:        #333333;
  background: var(--sp-body-bg);
  min-height: 680px;
}
/* 主题2: 暗夜黑 */
.tpl-sprint.theme-2 {
  --sp-header-bg:   linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  --sp-header-text: #ffffff;
  --sp-label-bg:    #ffd600;
  --sp-label-color: #111111;
  --sp-bottom-bar:  #1a1a1a;
  --sp-body-bg:     #ffffff;
  --sp-text:        #333333;
}
/* 主题3: 橙色能量 */
.tpl-sprint.theme-3 {
  --sp-header-bg:   linear-gradient(135deg, #e65100 0%, #ff8f00 100%);
  --sp-header-text: #ffffff;
  --sp-label-bg:    #e65100;
  --sp-label-color: #ffffff;
  --sp-bottom-bar:  linear-gradient(90deg, #e65100, #ff8f00);
  --sp-body-bg:     #ffffff;
  --sp-text:        #333333;
}
/* 主题4: 星空蓝 */
.tpl-sprint.theme-4 {
  --sp-header-bg:   linear-gradient(135deg, #1a237e 0%, #1565c0 100%);
  --sp-header-text: #ffffff;
  --sp-label-bg:    #1a237e;
  --sp-label-color: #ffffff;
  --sp-bottom-bar:  linear-gradient(90deg, #1a237e, #1565c0);
  --sp-body-bg:     #ffffff;
  --sp-text:        #333333;
}
/* 主题5: 墨绿沉稳 */
.tpl-sprint.theme-5 {
  --sp-header-bg:   linear-gradient(135deg, #1b5e20 0%, #388e3c 100%);
  --sp-header-text: #ffffff;
  --sp-label-bg:    #1b5e20;
  --sp-label-color: #ffffff;
  --sp-bottom-bar:  linear-gradient(90deg, #1b5e20, #388e3c);
  --sp-body-bg:     #ffffff;
  --sp-text:        #333333;
}

/* 冲刺 — 元素样式 */
.tpl-sp-header {
  background: var(--sp-header-bg);
  padding: 36px 46px 30px;
  color: var(--sp-header-text);
}
.tpl-sp-company {
  display: block;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
  line-height: 1.5;
  margin-bottom: 6px;
  opacity: 0.85;
}
.tpl-sp-main-title {
  display: block;
  font-size: 52px;
  font-weight: 900;
  letter-spacing: 2px;
  line-height: 1.2;
}
.tpl-sp-intro {
  display: block;
  font-size: 15px;
  margin-top: 14px;
  opacity: 0.92;
  line-height: 1.7;
}
.tpl-sp-body { padding: 30px 46px 40px; background: var(--sp-body-bg); }
.tpl-sp-section {
  margin-bottom: 22px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.tpl-sp-label {
  display: block;
  width: fit-content;
  background: var(--sp-label-bg);
  color: var(--sp-label-color);
  font-size: 14px;
  font-weight: 700;
  padding: 5px 16px;
  border-radius: 20px;
  margin-bottom: 10px;
  line-height: 1.4;
}
.tpl-sp-content {
  display: block;
  width: 100%;
  font-size: 16px;
  color: var(--sp-text);
  line-height: 1.85;
  padding-left: 4px;
}
.tpl-sp-bottom-bar {
  height: 6px;
  background: var(--sp-bottom-bar);
}

/* ══════════════════════════════════════════════════════════
   ③ 备考建议模板 — 5 套主题
   ══════════════════════════════════════════════════════════ */

/* 主题1: 天蓝清新（默认） */
.tpl-advice {
  --adv-bg:         linear-gradient(160deg, #dce8f5 0%, #eaf4fb 50%, #f0f6fb 100%);
  --adv-badge-bg:   #1a3a5c;
  --adv-badge-text: #ffffff;
  --adv-card-bg:    #ffffff;
  --adv-hero:       #1a2a40;
  --adv-tag-border: #1a2a40;
  --adv-tag-color:  #1a2a40;
  --adv-text:       #444444;
  --highlight:      #e8001a;
  background: var(--adv-bg);
  min-height: 720px;
}
/* 主题2: 樱花粉 */
.tpl-advice.theme-2 {
  --adv-bg:         linear-gradient(160deg, #fce4ec 0%, #f8bbd0 50%, #fce4ec 100%);
  --adv-badge-bg:   #c2185b;
  --adv-badge-text: #ffffff;
  --adv-card-bg:    #ffffff;
  --adv-hero:       #880e4f;
  --adv-tag-border: #c2185b;
  --adv-tag-color:  #c2185b;
  --adv-text:       #444444;
  --highlight:      #c2185b;
}
/* 主题3: 柠檬清新 */
.tpl-advice.theme-3 {
  --adv-bg:         linear-gradient(160deg, #fff9c4 0%, #fffde7 50%, #fff9c4 100%);
  --adv-badge-bg:   #f57f17;
  --adv-badge-text: #ffffff;
  --adv-card-bg:    #ffffff;
  --adv-hero:       #e65100;
  --adv-tag-border: #f57f17;
  --adv-tag-color:  #f57f17;
  --adv-text:       #444444;
  --highlight:      #e65100;
}
/* 主题4: 竹绿清风 */
.tpl-advice.theme-4 {
  --adv-bg:         linear-gradient(160deg, #e8f5e9 0%, #c8e6c9 50%, #e8f5e9 100%);
  --adv-badge-bg:   #2e7d32;
  --adv-badge-text: #ffffff;
  --adv-card-bg:    #ffffff;
  --adv-hero:       #1b5e20;
  --adv-tag-border: #2e7d32;
  --adv-tag-color:  #2e7d32;
  --adv-text:       #444444;
  --highlight:      #2e7d32;
}
/* 主题5: 午夜深色 */
.tpl-advice.theme-5 {
  --adv-bg:         #1a1a2e;
  --adv-badge-bg:   rgba(255,255,255,0.15);
  --adv-badge-text: #e0e0e0;
  --adv-card-bg:    #16213e;
  --adv-hero:       #e0e0e0;
  --adv-tag-border: rgba(255,255,255,0.35);
  --adv-tag-color:  #b0b8d0;
  --adv-text:       #b0b8d0;
  --highlight:      #ff6b6b;
}

/* 备考建议 — 元素样式 */
.tpl-adv-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 0;
}
.tpl-adv-badge {
  font-size: 12px;
  background: var(--adv-badge-bg);
  color: var(--adv-badge-text);
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 700;
  letter-spacing: 1px;
}
.tpl-adv-pin { font-size: 26px; line-height: 1; }
.tpl-adv-card {
  margin: 14px 16px 0;
  background: var(--adv-card-bg);
  border-radius: 14px;
  padding: 28px 30px;
  box-shadow: 0 3px 16px rgba(0,80,160,0.08);
}
.tpl-adv-hero {
  font-size: 36px;
  font-weight: 900;
  color: var(--adv-hero);
  line-height: 1.25;
  margin-bottom: 22px;
}
.tpl-adv-section {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.tpl-adv-tag {
  display: block;
  width: fit-content;
  border: 2px solid var(--adv-tag-border);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 15px;
  font-weight: 700;
  color: var(--adv-tag-color);
  line-height: 1.4;
  margin-bottom: 10px;
}
.tpl-adv-text {
  font-size: 16px;
  color: var(--adv-text);
  line-height: 1.85;
}

/* ══════════════════════════════════════════════════════════
   ④ 强度模板 — 5 套主题
   ══════════════════════════════════════════════════════════ */

/* 主题1: 黑白极简（默认） */
.tpl-intensity {
  --int-bg:         #ffffff;
  --int-line:       #111111;
  --int-title:      #111111;
  --int-intro:      #333333;
  --int-card-bg:    #e8f0fa;
  --int-card-title: #1a2a5c;
  --int-card-text:  #333333;
  --int-footer:     #aaaaaa;
  --highlight:      #e8001a;
  background: var(--int-bg);
  min-height: 720px;
}
/* 主题2: 暗夜橙 */
.tpl-intensity.theme-2 {
  --int-bg:         #111111;
  --int-line:       #ff6d00;
  --int-title:      #ffffff;
  --int-intro:      #cccccc;
  --int-card-bg:    #1e1e1e;
  --int-card-title: #ff6d00;
  --int-card-text:  #cccccc;
  --int-footer:     #555555;
  --highlight:      #ff9a40;
}
/* 主题3: 热血红 */
.tpl-intensity.theme-3 {
  --int-bg:         #fff5f5;
  --int-line:       #c62828;
  --int-title:      #b71c1c;
  --int-intro:      #333;
  --int-card-bg:    #ffebee;
  --int-card-title: #c62828;
  --int-card-text:  #333;
  --int-footer:     #aaa;
  --highlight:      #c62828;
}
/* 主题4: 海洋蓝 */
.tpl-intensity.theme-4 {
  --int-bg:         #e3f2fd;
  --int-line:       #0d47a1;
  --int-title:      #0d47a1;
  --int-intro:      #333;
  --int-card-bg:    #bbdefb;
  --int-card-title: #0d47a1;
  --int-card-text:  #333;
  --int-footer:     #888;
  --highlight:      #0d47a1;
}
/* 主题5: 大地褐 */
.tpl-intensity.theme-5 {
  --int-bg:         #fff8f0;
  --int-line:       #5d4037;
  --int-title:      #3e2723;
  --int-intro:      #4e342e;
  --int-card-bg:    #efebe9;
  --int-card-title: #5d4037;
  --int-card-text:  #4e342e;
  --int-footer:     #a1887f;
  --highlight:      #bf360c;
}

/* 强度 — 元素样式 */
.tpl-int-line-thick { height: 5px; background: var(--int-line); margin-bottom: 3px; }
.tpl-int-line-thin  { height: 2px; background: var(--int-line); margin-bottom: 30px; }
.tpl-int-title-wrap { padding: 0 40px; margin-bottom: 26px; }
.tpl-int-title {
  display: block;
  font-size: 50px;
  font-weight: 900;
  color: var(--int-title);
  line-height: 1.18;
  letter-spacing: -1px;
}
.tpl-int-intro {
  padding: 0 40px;
  font-size: 17px;
  color: var(--int-intro);
  line-height: 1.9;
  margin-bottom: 26px;
}
.tpl-int-blue-card {
  margin: 0 30px 30px;
  background: var(--int-card-bg);
  border-radius: 14px;
  padding: 22px 26px;
}
.tpl-int-card-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--int-card-title);
  margin-bottom: 12px;
}
.tpl-int-card-text {
  font-size: 16px;
  color: var(--int-card-text);
  line-height: 1.9;
}
.tpl-int-footer {
  text-align: right;
  padding: 10px 40px 24px;
  font-size: 11px;
  font-weight: 700;
  color: var(--int-footer);
  letter-spacing: 2px;
}
</style>
