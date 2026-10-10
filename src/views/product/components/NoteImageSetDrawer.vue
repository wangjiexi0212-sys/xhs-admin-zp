<template>
  <a-drawer
    v-model:open="localVisible"
    title="生成整组笔记配图"
    placement="right"
    width="92%"
    :body-style="{ padding: '16px', height: '100%', overflow: 'hidden' }"
  >
    <div class="nis-layout">
      <aside class="nis-side">
        <div class="nis-product">
          <div class="nis-product-name">{{ productName }}</div>
          <div class="nis-product-meta">{{ data.job_type_name || '未设置类型' }}</div>
        </div>

        <a-alert
          type="info"
          show-icon
          message="先选择需要生成的模块"
          description="默认全选，可全部取消、全选，也可以只生成某一张或某几张。"
        />

        <div class="nis-module-panel">
          <div class="nis-module-head">
            <span>生成模块（{{ selectedModuleKeys.length }}/{{ MODULE_OPTIONS.length }}）</span>
            <a-space size="small">
              <a-button type="link" size="small" @click="selectAllModules">全选</a-button>
              <a-button type="link" size="small" @click="clearAllModules">取消</a-button>
            </a-space>
          </div>
          <a-checkbox-group v-model:value="selectedModuleKeys" class="nis-module-checks">
            <a-checkbox
              v-for="item in MODULE_OPTIONS"
              :key="item.key"
              :value="item.key"
            >
              {{ item.label }}
            </a-checkbox>
          </a-checkbox-group>
        </div>

        <div class="nis-actions">
          <a-button type="primary" block :loading="generating" @click="generateAll">
            生成选中模块
          </a-button>
          <a-button block :disabled="!pages.length" :loading="capturing" @click="captureAll">
            截图已生成
          </a-button>
          <a-button block :disabled="!downloadableCount" :loading="downloading" @click="downloadZip">
            下载 ZIP（{{ downloadableCount }} 张）
          </a-button>
        </div>

        <div class="nis-page-list">
          <div
            v-for="page in pages"
            :key="page.key"
            :class="['nis-page-row', { active: activeKey === page.key }]"
            @click="activeKey = page.key"
          >
            <span class="nis-page-index">{{ page.order }}</span>
            <span class="nis-page-title">{{ page.title }}</span>
            <a-tag v-if="page.status === 'done'" color="green">已生成</a-tag>
            <a-tag v-else-if="page.status === 'error'" color="red">失败</a-tag>
            <a-tag v-else color="default">待生成</a-tag>
          </div>
        </div>

        <a-alert
          v-if="errors.length"
          type="warning"
          show-icon
          :message="`有 ${errors.length} 项需要检查`"
          :description="errors.join('；')"
        />
      </aside>

      <main class="nis-main">
        <div v-if="generating && !pages.length" class="nis-center">
          <a-spin size="large" />
          <div>{{ statusText || '正在生成整组笔记配图…' }}</div>
        </div>
        <a-empty v-else-if="!pages.length" description="选择模块后，点击左侧「生成选中模块」开始" />

        <div v-else class="nis-preview-grid">
          <div
            v-for="page in pages"
            :key="page.key"
            :class="['nis-preview-card', { active: activeKey === page.key }]"
          >
            <div class="nis-card-head">
              <span>{{ page.order }}. {{ page.title }}</span>
              <a-button v-if="page.dataUrl" type="link" size="small" @click="downloadOne(page)">下载</a-button>
            </div>
            <div class="nis-canvas-wrap">
              <div class="nis-scale-shell">
                <div
                  :ref="el => setPageRef(page.key, el)"
                  :class="['nis-page', `nis-${page.template || 'text'}`]"
                >
                <template v-if="page.template === 'cover'">
                  <div class="nis-cover-year">{{ yearLabel }}</div>
                  <div class="nis-cover-title">{{ productName }}</div>
                  <div class="nis-cover-sub">笔试备考资料整理</div>
                  <div class="nis-cover-tags">
                    <span v-for="tag in coverTags" :key="tag">{{ tag }}</span>
                  </div>
                </template>

                <template v-else-if="page.template === 'memo'">
                  <div class="nis-memo-nav">‹ 备忘录</div>
                  <div class="nis-memo-title">{{ page.content.title }}</div>
                  <div class="nis-memo-block">
                    <div class="nis-memo-label">（个人情况）</div>
                    <p v-for="(para, idx) in splitParagraphs(page.content.intro)" :key="`intro-${idx}`">{{ para }}</p>
                  </div>
                  <div class="nis-memo-block">
                    <div class="nis-memo-label">（备考建议）</div>
                    <p v-for="(para, idx) in splitParagraphs(page.content.advice)" :key="`advice-${idx}`">{{ para }}</p>
                  </div>
                </template>

                <template v-else-if="page.template === 'timeline'">
                  <div class="nis-blue-title">{{ yearLabel }}{{ productName }}</div>
                  <div class="nis-section-title">一. 招聘考试时间轴</div>
                  <div class="nis-timeline-row">
                    <div v-for="item in page.content.timeline" :key="item.label" class="nis-timeline-item">
                      <div class="nis-time-date">{{ item.date }}</div>
                      <div class="nis-time-dot"></div>
                      <div class="nis-time-label">{{ item.label }}</div>
                    </div>
                  </div>
                  <div class="nis-section-title">二. 考试内容及分值分布</div>
                  <div class="nis-red-line">考试内容：{{ page.content.summary }}</div>
                  <table class="nis-score-table">
                    <tbody>
                      <tr v-for="row in page.content.rows" :key="row.subject">
                        <td>{{ row.subject }}</td>
                        <td>{{ row.scope }}</td>
                        <td>{{ row.count }}</td>
                        <td>{{ row.score }}</td>
                        <td>{{ row.note }}</td>
                      </tr>
                    </tbody>
                  </table>
                </template>

                <template v-else-if="page.template === 'pdf'">
                  <div class="nis-doc-title">{{ yearLabel }}{{ productName }}｜<span>{{ page.content.label }}</span></div>
                  <div v-if="page.content.imageUrl" class="nis-pdf-frame">
                    <img :src="page.content.imageUrl" />
                  </div>
                  <div v-else class="nis-pdf-empty">{{ page.content.emptyText }}</div>
                </template>

                <template v-else-if="page.template === 'region'">
                  <div class="nis-region-title">{{ yearLabel }}{{ productName }}｜<span>{{ page.content.pageTitle }}</span></div>
                  <div class="nis-region-body">
                    <section v-for="(sec, idx) in page.content.sections" :key="idx" class="nis-region-section">
                      <h2>{{ sec.heading }}</h2>
                      <p v-for="(para, pIdx) in sec.paragraphs" :key="pIdx">{{ para }}</p>
                    </section>
                  </div>
                </template>

                <template v-else-if="page.template === 'knowledge'">
                  <div class="nis-knowledge-title">{{ yearLabel }}{{ productName }}｜<span>公基高频考点</span></div>
                  <div class="nis-knowledge-body">
                    <section v-for="(sec, idx) in page.content.sections" :key="idx" class="nis-knowledge-section">
                      <h2>{{ sec.heading }}</h2>
                      <div
                        v-for="(item, itemIdx) in sec.items"
                        :key="itemIdx"
                        class="nis-knowledge-line"
                      >
                        <span class="nis-knowledge-no">{{ itemIdx + 1 }}.</span><span class="nis-knowledge-key">{{ item.title }}：</span>{{ item.text }}
                      </div>
                    </section>
                  </div>
                </template>

                <template v-else-if="page.template === 'three-note'">
                  <div class="nis-three-title">{{ yearLabel }}{{ productName }}｜<span>公基三色笔记</span></div>
                  <div class="nis-three-body">
                    <div
                      v-for="(line, idx) in page.content.lines"
                      :key="idx"
                      class="nis-three-line"
                    >
                      <span class="nis-three-red">{{ idx + 1 }}.{{ line.prefix }}</span>{{ line.before }}<span v-if="line.red" class="nis-three-red">{{ line.red }}</span>{{ line.after }}<span v-if="line.blue" class="nis-three-blue">{{ line.blue }}</span>{{ line.tail }}
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="nis-doc-title">{{ yearLabel }}{{ productName }}｜<span>{{ page.title }}</span></div>
                  <div class="nis-doc-body">
                    <div v-if="page.content.heading" class="nis-doc-heading">{{ page.content.heading }}</div>
                    <div
                      v-for="(line, idx) in page.content.lines"
                      :key="idx"
                      :class="['nis-doc-line', { strong: line.strong }]"
                    >
                      <span v-if="line.prefix" class="nis-doc-prefix">{{ line.prefix }}</span>
                      <span v-if="line.title" class="nis-doc-line-title">{{ line.title }}：</span>{{ line.text }}
                    </div>
                  </div>
                </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </a-drawer>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { toPng } from 'html-to-image'
import { chatLlm } from '@/api/llm'
import { getBaiduFiles } from '@/api/baidu'
import { getToken } from '@/api/request'
import { triggerBlobDownload } from '@/utils/imageProcess'
import { useLlmStore } from '@/stores/llm'

const props = defineProps({
  visible: { type: Boolean, default: false },
  data: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:visible'])

const localVisible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v),
})

const llmStore = useLlmStore()

const pages = ref([])
const errors = ref([])
const activeKey = ref('')
const generating = ref(false)
const capturing = ref(false)
const downloading = ref(false)
const statusText = ref('')
const pageRefs = new Map()
let pdfjsLib = null
let jsZipLib = null

const PUBLIC_KNOWLEDGE_TOPICS = [
  '民法典人身权', '民事行为能力', '婚姻家庭', '行政处罚', '行政许可', '行政复议', '行政强制',
  '宪法基本权利', '国家机构', '公文文种', '公文行文规则', '事业单位常识', '劳动合同',
  '社会保险', '基层治理', '居民自治', '公共服务', '应急管理', '职业道德', '科技常识',
  '经济常识', '管理常识', '资料分析', '时政常识',
]

const MODULE_OPTIONS = [
  { key: 'cover', label: '封面' },
  { key: 'memo', label: '备忘录建议' },
  { key: 'region', label: '区情/市情概况' },
  { key: 'overview', label: '公基高频考点' },
  { key: 'timeline', label: '时间轴分值' },
  { key: 'keypoints', label: '公基三色笔记' },
  { key: 'materials', label: '资料清单' },
  { key: 'methods', label: '备考方法' },
  { key: 'history_pdf', label: '25年真题首页' },
  { key: 'mock_pdf', label: '预测题首页' },
  { key: 'checklist', label: '复习提醒' },
]
const selectedModuleKeys = ref(MODULE_OPTIONS.map(item => item.key))

const data = computed(() => props.data || {})
const productName = computed(() => data.value.company_name || data.value.title || '招聘考试')
const yearLabel = computed(() => {
  const text = `${data.value.title || ''} ${data.value.apply_time || ''} ${data.value.written_exam_time || ''}`
  const match = text.match(/20\d{2}/)
  return match ? `${match[0]}届` : '2026届'
})
const coverTags = computed(() => {
  const type = inferProductType(data.value)
  return [type.label, '真题预览', '模拟预测', '高频考点']
})
const downloadableCount = computed(() => pages.value.filter(p => p.dataUrl).length)

watch(() => props.visible, (visible) => {
  if (visible && !selectedModuleKeys.value.length && !pages.value.length) {
    selectAllModules()
  }
})

function setPageRef(key, el) {
  if (el) pageRefs.set(key, el)
}

async function generateAll() {
  if (generating.value) return
  if (!selectedModuleKeys.value.length) {
    message.warning('请至少选择一个要生成的模块')
    return
  }
  generating.value = true
  errors.value = []
  statusText.value = '正在分析商品信息…'
  pageRefs.clear()
  pages.value = []

  try {
    const selected = new Set(selectedModuleKeys.value)
    let content = buildFallbackContent(data.value)
    if (needsGeneralContent(selected)) {
      content = await buildNoteSetContent(data.value)
    }
    if (selected.has('region')) {
      statusText.value = '正在查询并整理地区状况…'
      content.region = await buildRegionContentWithLlm(data.value, content.region)
    }
    statusText.value = '正在读取网盘 PDF 首页…'
    const [historyPdf, mockPdf] = await Promise.all([
      selected.has('history_pdf') ? loadPdfPreview(data.value.baidu_path_history, 'history').catch(e => {
        errors.value.push(`真题 PDF：${e.message || '读取失败'}`)
        return null
      }) : Promise.resolve(null),
      selected.has('mock_pdf') ? loadPdfPreview(data.value.baidu_path_mock, 'mock').catch(e => {
        errors.value.push(`预测题 PDF：${e.message || '读取失败'}`)
        return null
      }) : Promise.resolve(null),
    ])

    pages.value = buildPages(content, historyPdf, mockPdf, selected)
    activeKey.value = pages.value[0]?.key || ''
    await nextTick()
    await captureAll()
    message.success(`已生成 ${downloadableCount.value} 张笔记配图`)
  } catch (e) {
    message.error(e.message || '整组图生成失败')
  } finally {
    generating.value = false
    statusText.value = ''
  }
}

function selectAllModules() {
  selectedModuleKeys.value = MODULE_OPTIONS.map(item => item.key)
}

function clearAllModules() {
  selectedModuleKeys.value = []
}

function needsGeneralContent(selected) {
  return ['memo', 'overview', 'timeline', 'keypoints', 'materials', 'methods', 'checklist']
    .some(key => selected.has(key))
}

async function buildNoteSetContent(d) {
  const fallback = buildFallbackContent(d)
  const active = llmStore.active
  if (!active) {
    errors.value.push('未配置大模型，已使用商品详情生成基础内容')
    return fallback
  }

  const knowledgeSeed = createRandomSeed()
  const knowledgePool = pickRandomItems(PUBLIC_KNOWLEDGE_TOPICS, 8).join('、')
  const knowledgeNos = pickRandomNumbers(1, 80, 3).join('、')
  const threeNoteSeed = createRandomSeed()
  const threeNotePool = pickRandomItems(PUBLIC_KNOWLEDGE_TOPICS, 10).join('、')
  const prompt = [
    '根据商品详情生成一组小红书笔记配图内容，商品类型可能是国企、工会、书记员、编外、社区工作者等。',
    '只输出 JSON，不要 markdown，不要解释。',
    '要求：内容像用户给的实图：备忘录页要有个人情况和备考建议两大段；资料页像复习讲义，内容密度高，条目具体，每条不要太短。',
    '不要写政治人物、敏感政策文件名；如果信息不足，用“以公告为准”“常见考法”。',
    'JSON字段：',
    '{"memo":{"title":"","intro":"","advice":""},"overview":{"sections":[{"heading":"【考点随机编号】 考点名称","items":[{"title":"短标题","text":"可背诵知识点正文。"}]}]},"region":{"name":"","level":"区/市","heading":"","lines":[{"title":"","text":""}]},"keypoints":[{"prefix":"机关公文","before":"即机关实施领导、履行职能、处理公务的具有特定效力和规范体式的文书，是","red":"传达贯彻方针政策","after":"、公布法规和规章、指导布置和商洽工作的重要工具。","blue":"请示和答复问题","tail":"。"}],"materials":[{"title":"","text":""}],"methods":[{"title":"","text":""}],"checklist":[{"title":"","text":""}],"timeline":{"summary":"","rows":[{"subject":"","scope":"","count":"","score":"","note":""}]}}',
    `overview 规则：这是“公基高频考点”页，不要写单位/考试概况。本次随机种子：${knowledgeSeed}。请根据随机种子从候选池里随机选取 2-3 个公共基础高频考点，不要每次都选同一组。候选池：${knowledgePool}。考点编号也必须随机，不要固定从13开始，不要连续递增；本次可优先使用这些随机编号：${knowledgeNos}。每个考点 2-4 条，结构参考“【考点17】 考点名 / 1.短标题：知识点正文”。`,
    `keypoints 规则：这是“公基三色笔记”页，不要写成普通高频考点列表。本次随机种子：${threeNoteSeed}。请从候选池中随机选取 8-10 个不同知识点生成三色笔记，不要每次都用同一组内容。候选池：${threeNotePool}。每条包含 prefix、before、red、after、blue、tail，其中 red 是红色重点词，blue 是蓝色下划线重点词；没有 blue 时可留空。整体风格参考“1...机关公文，即...是传达贯彻方针政策...请示和答复问题”。`,
    'region 规则：先根据单位名称和公告标题判断企业/单位所在地区；如果能判断到区县，level写“区”，内容写区情；只能判断到市，level写“市”，内容写市情；不确定则结合单位名称中出现的地名并标注“以公告属地为准”。',
    'region 内容像参考图“历史文化底蕴/经济产业/交通区位/公共服务/招聘相关常识”，6-8条，每条具体、可背诵，不要只写空泛口号。',
    '字数要求：memo.intro 80-120字，memo.advice 180-260字；overview 2-3个考点块，每块2-4条；region 6-8条；keypoints 8-10条；materials 7条；methods 6条；checklist 6条。',
    '每条对象的 title 控制在 4-10 字，text 控制在 18-45 字，要结合商品类型和笔试内容，不要泛泛而谈。',
    '商品信息：',
    `公告名称：${d.title || ''}`,
    `单位名称：${d.company_name || ''}`,
    `商品类型：${d.job_type_name || ''}`,
    `招聘人数：${d.recruit_count || ''}`,
    `报名时间：${d.apply_time || ''}`,
    `笔试时间：${d.written_exam_time || ''}`,
    `笔试内容：${d.written_exam_content || ''}`,
    '时间轴 rows 规则：如果有写作/申论/作文/材料题，写作行 count 必须是 1题，score 固定 20%，其他行合计 80%。',
  ].join('\n')

  try {
    const res = await chatLlm({
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
      messages: [
        { role: 'system', content: '你是招聘考试资料整理助手。只输出有效 JSON 对象。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 3200,
      temperature: 0.72,
    })
    const raw = String(res.content || '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('模型未返回 JSON')
    return mergeContent(fallback, JSON.parse(match[0]))
  } catch (e) {
    errors.value.push(`AI 内容：${e.message || '生成失败'}，已使用基础内容`)
    return fallback
  }
}

async function buildRegionContentWithLlm(d, fallbackRegion) {
  const fallback = normalizeRegionContent(buildFallbackRegion(d, fallbackRegion))
  const active = llmStore.active
  if (!active) {
    errors.value.push('地区状况：未配置大模型，无法查询真实市情/区情')
    return buildRegionErrorContent(fallback, '未配置大模型，无法查询真实市情/区情')
  }

  try {
    const resolved = await resolveRegionWithLlm(d, active, fallback)
    const region = await generateRegionFactsWithLlm(resolved, d, active, fallback)
    const normalized = normalizeRegionContent(region)
    if (isEnterpriseRegionContent(normalized)) {
      throw new Error('模型返回了企业/行业内容，不是地区状况')
    }
    return normalized
  } catch (e) {
    errors.value.push(`地区状况：${e.message || '生成失败'}，未使用空泛兜底内容`)
    return buildRegionErrorContent(fallback, e.message || '地区状况生成失败')
  }
}

async function resolveRegionWithLlm(d, active, fallback) {
  const candidate = resolveRegionCandidate(d)
  const prompt = [
    '请只做“属地判断”，不要生成地区介绍正文。',
    '根据单位名称、公告名称、招聘公告信息判断该企业/招聘岗位最可能属于哪个市或区县。',
    '判断规则：',
    '1. 只返回真实行政区划名称，例如“太原市”“瑞安市”“重庆市綦江区”，不要返回企业名、集团名、行业名。',
    '2. 如果公告或单位名称明确出现区、县、县级市，优先返回该区县，level 写“区”。',
    '3. 如果只能判断到地级市，返回该市，level 写“市”。',
    '4. 如果单位是集团或公司名称，不要把行业、企业业务当作地区；必须先判断公司注册地/招聘属地。',
    '5. 不确定时返回最可能的市级属地，并 confidence 写 low。',
    '只输出 JSON：{"name":"","level":"区/市","parentCity":"","confidence":"high/medium/low","reason":""}',
    `候选属地：${candidate?.name || fallback.name || ''}`,
    `候选依据：${candidate?.reason || fallback.heading || ''}`,
    '商品信息：',
    `公告名称：${d.title || ''}`,
    `单位名称：${d.company_name || ''}`,
    `商品类型：${d.job_type_name || ''}`,
  ].join('\n')
  const json = await callRegionJson(active, prompt, 900, 0.2, '你是行政区划判断助手，只输出 JSON。')
  const name = normalizeRegionName(json.name)
  if (isInvalidRegionName(name)) {
    if (candidate?.name && !isInvalidRegionName(candidate.name)) return candidate
    if (fallback.name && !isInvalidRegionName(fallback.name)) {
      return {
        name: fallback.name,
        level: fallback.level,
        parentCity: '',
        confidence: 'low',
        reason: '使用商品信息中的属地候选',
      }
    }
    throw new Error('未判断出有效市/区属地')
  }
  return {
    name,
    level: String(json.level || fallback.level || '').includes('区') ? '区' : '市',
    parentCity: cleanText(json.parentCity, ''),
    confidence: cleanText(json.confidence, 'medium'),
    reason: cleanText(json.reason, ''),
  }
}

async function generateRegionFactsWithLlm(resolved, d, active, fallback) {
  if (isInvalidRegionName(resolved.name)) throw new Error('属地不是有效行政区划')
  const pageTitle = resolved.level === '区' ? '区情概况' : '市情概况'
  const prompt = [
    `请查询并整理“${resolved.name}”的${pageTitle}内容，用于招聘考试笔记配图。`,
    '必须只写该市/区本身的信息，不要写企业情况、行业监管、公司定位、燃气/银行/集团业务等企业内容。',
    '内容风格参考讲义页：标题小节为“一、地理位置”“二、历史文化底蕴”“三、产业交通与发展”，正文是大段说明，不要写成短条目。',
    '正确方向示例：瑞安市地处浙江东南沿海、长三角城市群与沿海城市带交汇，写方位、相邻区县、地形地貌、交通通道、产业与城市功能。',
    '错误方向示例：企业性质定位、行业监管背景、燃气行业规模、管道燃气特点，这些都禁止。',
    '只输出 JSON，不要 markdown。',
    'JSON 格式：',
    '{"name":"","level":"区/市","pageTitle":"区情概况/市情概况","sections":[{"heading":"一、地理位置","paragraphs":["180-260字段落","140-220字段落"]},{"heading":"二、历史文化底蕴","paragraphs":["160-240字段落"]},{"heading":"三、产业交通与发展","paragraphs":["160-240字段落"]}]}',
    '内容要求：',
    '- name 必须是行政区划名称，不得是企业名称。',
    '- 至少 3 个 sections，最多 4 个 sections。',
    '- 地理位置写方位、相邻地区、地形地貌、交通联系。',
    '- 历史文化写沿革、文化特色、地域特点，可概括表达。',
    '- 产业交通写产业基础、交通区位、城市发展定位、公共服务等。',
    '- 不确定的具体数字不要硬写，改用“重要”“较为集中”“具有基础”等概括表达。',
    '- 禁止出现：企业性质、行业监管、燃气行业、天然气、管道燃气、公司业务、考试建议、复习建议。',
    '已判断属地：',
    `地区名称：${resolved.name || fallback.name}`,
    `层级：${resolved.level || fallback.level}`,
    `上级市：${resolved.parentCity || ''}`,
    `判断依据：${resolved.reason || ''}`,
    '商品信息仅用于辅助判断，正文不要写商品/企业：',
    `公告名称：${d.title || ''}`,
    `单位名称：${d.company_name || ''}`,
  ].join('\n')
  const json = await callRegionJson(active, prompt, 2600, 0.35, '你是市情区情资料整理助手，只输出 JSON。')
  const jsonName = normalizeRegionName(json.name)
  const name = isInvalidRegionName(jsonName) ? resolved.name : jsonName
  return {
    ...fallback,
    ...json,
    name,
    level: String(json.level || resolved.level || fallback.level || '').includes('区') ? '区' : '市',
    pageTitle: json.pageTitle || pageTitle,
  }
}

async function callRegionJson(active, prompt, maxTokens, temperature, systemContent) {
  const messages = [
    { role: 'system', content: `${systemContent} 禁止输出解释、代码块、注释或多余文本。必须输出一个可被 JSON.parse 解析的 JSON 对象。` },
    { role: 'user', content: prompt },
  ]
  const first = await requestRegionJson(active, messages, maxTokens, temperature)
  try {
    return parseRegionJson(first)
  } catch (_) {
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: [
          '上一次输出不是合法 JSON。请重新输出一个严格合法的 JSON 对象。',
          '要求：',
          '1. 所有字符串必须用英文双引号。',
          '2. 数组元素之间必须有英文逗号。',
          '3. 不要 markdown，不要注释，不要解释。',
          '4. 只输出 JSON 对象本身。',
        ].join('\n'),
      },
    ]
    const second = await requestRegionJson(active, retryMessages, maxTokens, 0.1)
    try {
      return parseRegionJson(second)
    } catch (_) {
      throw new Error('模型返回格式异常，请重新生成')
    }
  }
}

async function requestRegionJson(active, messages, maxTokens, temperature) {
  const res = await chatLlm({
    provider: active.provider,
    api_format: active.api_format,
    api_key: active.api_key,
    base_url: active.base_url || '',
    model: active.default_model,
    messages,
    max_tokens: maxTokens,
    temperature,
  })
  return String(res.content || '').trim()
}

function parseRegionJson(raw) {
  const text = String(raw || '').trim()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('模型未返回有效 JSON')
  const normalized = match[0]
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/，(?=\s*["}\]])/g, ',')
    .replace(/,\s*([}\]])/g, '$1')
  return JSON.parse(normalized)
}

function buildPages(content, historyPdf, mockPdf, selected = new Set(MODULE_OPTIONS.map(item => item.key))) {
  const timeline = normalizeTimelineContent(content.timeline, data.value)
  return [
    { key: 'cover', order: 1, title: '封面', template: 'cover', status: 'done', content: {} },
    { key: 'memo', order: 2, title: '备忘录建议', template: 'memo', status: 'done', content: content.memo },
    { key: 'region', order: 3, title: getRegionPageTitle(content.region), template: 'region', status: 'done', content: toRegionDocContent(content.region) },
    { key: 'overview', order: 4, title: '公基高频考点', template: 'knowledge', status: 'done', content: normalizeKnowledgeContent(content.overview, data.value) },
    { key: 'timeline', order: 5, title: '时间轴分值', template: 'timeline', status: 'done', content: timeline },
    { key: 'keypoints', order: 6, title: '公基三色笔记', template: 'three-note', status: 'done', content: normalizeThreeNoteContent(content.keypoints, data.value) },
    { key: 'materials', order: 7, title: '资料清单', template: 'doc', status: 'done', content: listDoc('建议优先看的资料', content.materials) },
    { key: 'methods', order: 8, title: '备考方法', template: 'doc', status: 'done', content: listDoc('短期提分节奏', content.methods) },
    {
      key: 'history_pdf',
      order: 9,
      title: '25年真题首页',
      template: 'pdf',
      status: historyPdf ? 'done' : 'error',
      content: { label: '25年真题', imageUrl: historyPdf, emptyText: '未读取到真题目录中的 PDF 首页' },
    },
    {
      key: 'mock_pdf',
      order: 10,
      title: '预测题首页',
      template: 'pdf',
      status: mockPdf ? 'done' : 'error',
      content: { label: '预测题', imageUrl: mockPdf, emptyText: '未读取到模拟题目录中的 PDF 首页' },
    },
    { key: 'checklist', order: 11, title: '复习提醒', template: 'doc', status: 'done', content: listDoc('考前检查清单', content.checklist) },
  ]
    .filter(page => selected.has(page.key))
    .map((page, idx) => ({ ...page, order: idx + 1 }))
}

async function captureAll() {
  if (!pages.value.length || capturing.value) return
  capturing.value = true
  try {
    for (const page of pages.value) {
      const el = pageRefs.get(page.key)
      if (!el) continue
      try {
        await nextTick()
        const dataUrl = await toPng(el, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#ffffff',
          width: 900,
          height: 1200,
        })
        page.dataUrl = dataUrl
        page.status = page.status === 'error' ? 'error' : 'done'
      } catch (e) {
        page.status = 'error'
        errors.value.push(`${page.title}：截图失败`)
      }
      await new Promise(r => setTimeout(r, 80))
    }
  } catch (e) {
    message.error(e.message || '截图失败')
  } finally {
    capturing.value = false
  }
}

async function downloadZip() {
  if (!downloadableCount.value || downloading.value) return
  downloading.value = true
  try {
    const JSZip = await ensureJSZip()
    const zip = new JSZip()
    for (const page of pages.value) {
      if (!page.dataUrl) continue
      zip.file(`${String(page.order).padStart(2, '0')}-${safeFileName(page.title)}.png`, page.dataUrl.replace(/^data:image\/png;base64,/, ''), { base64: true })
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    triggerBlobDownload(blob, `${safeFileName(productName.value)}-笔记配图.zip`)
  } catch (e) {
    message.error(e.message || 'ZIP 下载失败')
  } finally {
    downloading.value = false
  }
}

function downloadOne(page) {
  if (!page?.dataUrl) return
  const a = document.createElement('a')
  a.href = page.dataUrl
  a.download = `${String(page.order).padStart(2, '0')}-${safeFileName(page.title)}.png`
  a.click()
}

async function loadPdfPreview(path, kind) {
  if (!path) throw new Error(kind === 'history' ? '未配置真题目录' : '未配置模拟题目录')
  const pdf = await findPdfInDir(path, kind)
  if (!pdf) throw new Error('目录中未找到 PDF')
  return renderPdfFirstPage(pdf)
}

async function findPdfInDir(path, kind) {
  const res = await getBaiduFiles(path)
  const files = res.files || []
  const direct = pickPdf(files, kind)
  if (direct) return direct
  const dirs = files.filter(f => f.isdir === 1).slice(0, 8)
  for (const dir of dirs) {
    try {
      const sub = await getBaiduFiles(dir.path)
      const hit = pickPdf(sub.files || [], kind)
      if (hit) return hit
    } catch (_) {
      // 跳过无权限或临时失败的子目录
    }
  }
  return null
}

function pickPdf(files, kind) {
  const pdfs = (files || []).filter(f => f.isdir === 0 && /\.pdf$/i.test(String(f.name || '')))
  if (!pdfs.length) return null
  const preferred = kind === 'history'
    ? pdfs.find(f => /25|2025|真题/.test(String(f.name || '')))
    : pdfs.find(f => /模拟|预测|26|2026/.test(String(f.name || '')))
  return preferred || pdfs[0]
}

async function renderPdfFirstPage(file) {
  const lib = await ensurePdfjs()
  const pdf = await lib.getDocument({
    url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(file.path)}`,
    httpHeaders: { Authorization: `Bearer ${getToken()}` },
  }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas.toDataURL('image/png')
}

async function ensurePdfjs() {
  if (pdfjsLib) return pdfjsLib
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  pdfjsLib = window.pdfjsLib
  return pdfjsLib
}

async function ensureJSZip() {
  if (jsZipLib) return jsZipLib
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  jsZipLib = window.JSZip
  return jsZipLib
}

function buildFallbackContent(d) {
  const type = inferProductType(d)
  const exam = String(d.written_exam_content || `${type.label}常见笔试内容`).trim()
  return {
    memo: {
      title: `7天过重点 ${productName.value}`,
      intro: `${productName.value}公告出来后，很多同学最容易卡在不知道先看什么。时间紧的话，不建议一上来就啃厚教材，先把公告里的考试范围、报名节点、真题题型和模拟题结构过一遍，再按模块集中突破。`,
      advice: `备考可以按“公告范围+真题题型+高频资料+模拟练习”的顺序推进。笔试内容重点围绕${exam}整理，先把基础概念和常见题型搭好框架，再用真题看出题侧重，用模拟题练速度和稳定性。最后两天集中复盘错题、常用表述、写作框架和容易混淆的概念，别临时扩太多新资料。`,
    },
    overview: {
      sections: buildFallbackKnowledgeSections(type),
    },
    region: buildFallbackRegion(d),
    keypoints: buildFallbackThreeNotes(type),
    materials: type.materials,
    methods: [
      { title: '第一步', text: '先把公告、报名条件、考试范围和所需材料一次核对清楚。' },
      { title: '第二步', text: '用真题第一页判断题型、题量和常见考点，确定复习优先级。' },
      { title: '第三步', text: '公共基础、岗位知识、写作表达分开整理，避免混在一起背。' },
      { title: '第四步', text: '模拟题按完整时限练，重点记录不会做和做得慢的题。' },
      { title: '第五步', text: '考前只复盘高频概念、错题和写作模板，不再大范围开新坑。' },
      { title: '第六步', text: '把资料压缩成可回看的清单，通勤或碎片时间反复过。' },
    ],
    checklist: [
      { title: '时间节点', text: '公告发布时间、报名起止、准考证、笔试时间都要单独标记。' },
      { title: '资料准备', text: '身份证、学历、资格材料和报名截图提前整理好。' },
      { title: '真题预览', text: '先看25年真题首页，确认题型结构和考查口径。' },
      { title: '模拟练习', text: '预测题按考试时限完成一套，重点练时间分配。' },
      { title: '错题回看', text: '把连续错的概念、公式、法规类知识点集中复盘。' },
      { title: '写作框架', text: '如含写作，提前准备开头、分论点、结尾和规范表达。' },
    ],
    timeline: {
      summary: exam,
      rows: defaultScoreRows(exam, type),
    },
  }
}

function mergeContent(base, patch) {
  return {
    memo: { ...base.memo, ...(patch.memo || {}) },
    overview: {
      sections: normalizeKnowledgeSections(patch.overview?.sections, base.overview.sections),
    },
    region: {
      name: patch.region?.name || base.region.name,
      level: patch.region?.level || base.region.level,
      heading: patch.region?.heading || base.region.heading,
      lines: normalizeRichList(patch.region?.lines, base.region.lines, 8),
    },
    keypoints: normalizeThreeNoteLines(patch.keypoints, base.keypoints),
    materials: normalizeRichList(patch.materials, base.materials, 8),
    methods: normalizeRichList(patch.methods, base.methods, 8),
    checklist: normalizeRichList(patch.checklist, base.checklist, 8),
    timeline: patch.timeline || base.timeline,
  }
}

function inferProductType(d) {
  const text = `${d.job_type_name || ''} ${d.company_name || ''} ${d.title || ''}`
  if (/社区|社工/.test(text)) {
    return {
      label: '社区工作者',
      overview: ['常见考查社区治理、公共服务、基层工作实务、公文写作等。', '复习时要把社区基础知识、居民服务场景和常见法规概念分开整理。'],
      keypoints: ['社区建设与居民自治', '社区公共服务与矛盾调解', '社会工作实务', '公共基础知识', '公文写作与材料分析', '基层治理案例', '民生服务场景', '社区法规常识'],
      materials: ['社区基础知识', '社工实务速记', '公共基础高频考点', '历年真题', '模拟预测卷', '公文写作模板', '错题整理表'],
    }
  }
  if (/工会/.test(text)) {
    return {
      label: '工会',
      overview: ['常见考查工会基础知识、职工服务、公共基础和材料写作。', '建议把组织职能、权益维护、活动服务类场景重点整理。'],
      keypoints: ['工会基础知识', '职工权益维护', '基层服务场景', '公共基础知识', '公文写作', '劳动关系协调', '活动组织实务', '材料分析'],
      materials: ['工会知识速记', '公共基础考点', '写作范文', '真题回忆版', '模拟题', '职工服务案例', '错题清单'],
    }
  }
  if (/书记员|法院|检察/.test(text)) {
    return {
      label: '书记员',
      overview: ['常见考查法律基础、书记员岗位能力、公共基础和文字处理。', '复习要重视法律常识、程序概念和岗位实务表达。'],
      keypoints: ['法律基础知识', '诉讼程序常识', '书记员岗位实务', '文字录入与公文', '公共基础知识', '法律文书常识', '材料整理能力', '案例判断'],
      materials: ['法律基础速记', '书记员实务', '公共基础题库', '真题', '模拟卷', '文书模板', '岗位实务清单'],
    }
  }
  if (/国企|集团|公司|银行|能源|水务|城投|交投|文旅/.test(text)) {
    return {
      label: '国企',
      overview: ['常见考查行测、公基、企业常识、岗位专业知识和写作。', '复习时要结合企业业务、岗位方向和公告中的考试范围。'],
      keypoints: ['行政职业能力测验', '公共基础知识', '企业概况与行业常识', '岗位专业知识', '材料写作', '行业基础知识', '企业文化价值观', '资料分析'],
      materials: ['企业概况资料', '行测题库', '公基高频考点', '岗位专业资料', '真题与模拟题', '写作框架', '行业政策常识'],
    }
  }
  return {
    label: '编外/事业单位',
    overview: ['常见考查公共基础、职业能力、岗位知识和写作。', '建议以公告范围为准，先抓题型结构，再按模块刷题。'],
    keypoints: ['公共基础知识', '职业能力测验', '岗位专业知识', '材料分析', '公文写作', '时事热点常识', '基层工作实务', '判断推理'],
    materials: ['公告考试范围', '公共基础速记', '岗位知识资料', '历年真题', '模拟预测卷', '写作模板', '错题本'],
  }
}

function buildFallbackRegion(d, sourceRegion = null) {
  const candidate = resolveRegionCandidate(d)
  const sourceName = normalizeRegionName(sourceRegion?.name)
  const sourceLevel = String(sourceRegion?.level || '').includes('区') ? '区' : '市'
  const sourceValid = sourceName && !isInvalidRegionName(sourceName)
  const resolved = candidate || (sourceValid ? { name: sourceName, level: sourceLevel, reason: 'AI 初步内容中的属地' } : null)
  const name = resolved?.name || '属地'
  const level = resolved?.level || '市'
  const pageTitle = level === '区' ? '区情概况' : '市情概况'
  const heading = `${name}${pageTitle}`
  const lead = name === '属地' ? '该地区' : name
  return {
    name,
    level,
    pageTitle,
    heading,
    sections: [
      {
        heading: '一、地理位置',
        paragraphs: [
          `${lead}的区位信息应以招聘公告发布地、单位注册地和岗位服务地为准。整理地区状况时，优先关注所在行政区划、周边相邻区域、主要交通通道、地形地貌和城市空间格局，形成对当地公共服务和基层治理环境的基本认识。`,
          `${lead}如果属于集团下属单位或跨区域企业，还需要区分集团总部所在地与本次招聘岗位所在地。笔记配图中的市情、区情内容只回填真实行政区划信息，不写企业性质、行业背景或公司业务。`,
        ],
      },
      {
        heading: '二、历史文化底蕴',
        paragraphs: [
          `${lead}的历史文化内容可从建置沿革、地域文化、城市发展脉络和公共服务传统入手。备考时不必堆砌冷门年份，重点掌握能够体现地方特色、民生服务背景和城市治理特点的基础信息。`,
        ],
      },
      {
        heading: '三、产业交通与发展',
        paragraphs: [
          `${lead}的产业交通内容通常与城市功能、交通区位、公共服务、基层治理和民生保障相关。生成配图时应围绕当地城市发展和区域特点展开，避免写成企业介绍或行业分析。`,
        ],
      },
    ],
  }
}

function resolveRegionCandidate(d) {
  const text = `${d.title || ''} ${d.company_name || ''}`

  const districtMatch = text.match(/([\u4e00-\u9fa5]{2,10}(?:新区|区|县|旗|自治县))/)
  const districtName = normalizeRegionName(districtMatch?.[1])
  if (districtName && !isInvalidRegionName(districtName)) {
    return { name: districtName, level: '区', reason: '标题或单位名称中出现区县级行政区划' }
  }

  const countyCityMatch = text.match(/([\u4e00-\u9fa5]{2,10}市)(?=.*(?:区|社区|社工|工作者|招聘|公告|考试|笔试))/)
  const countyCityName = normalizeRegionName(countyCityMatch?.[1])
  if (countyCityName && !isInvalidRegionName(countyCityName)) {
    return { name: countyCityName, level: '市', reason: '标题或单位名称中出现县级市/地级市' }
  }

  const cityMatch = text.match(/([\u4e00-\u9fa5]{2,10}市)/)
  const cityName = normalizeRegionName(cityMatch?.[1])
  if (cityName && !isInvalidRegionName(cityName)) {
    return { name: cityName, level: '市', reason: '标题或单位名称中出现市级行政区划' }
  }

  return null
}

function buildRegionErrorContent(fallback, reason) {
  const name = !isInvalidRegionName(fallback.name) ? fallback.name : '属地'
  const level = fallback.level === '区' ? '区' : '市'
  const pageTitle = level === '区' ? '区情概况' : '市情概况'
  return normalizeRegionContent({
    name,
    level,
    pageTitle,
    sections: [
      {
        heading: '地区内容待重新生成',
        paragraphs: [
          `${reason}。请确认小红书 AI/大模型配置可用后重新生成，本页不会再用企业性质、行业背景或“以公告为准”的空泛内容冒充市情/区情。`,
        ],
      },
    ],
  })
}

function defaultScoreRows(exam, type) {
  const hasWriting = /写作|申论|作文|材料/.test(exam)
  const rows = [
    { subject: '职业能力测验', scope: '言语理解、数量关系、资料分析、判断推理等', count: '约35-45题', score: hasWriting ? '35%' : '45%', note: '适合用真题熟悉题型和速度。' },
    { subject: '公共基础知识', scope: `${type.label}常识、公共基础、时事热点和常见法规概念`, count: '约20-30题', score: hasWriting ? '30%' : '35%', note: '高频概念集中背，错题反复看。' },
    { subject: '岗位专业知识', scope: type.keypoints.slice(0, 4).join('、'), count: '约15-25题', score: hasWriting ? '15%' : '20%', note: '结合岗位和单位类型针对性复习。' },
  ]
  if (hasWriting) {
    rows.push({ subject: '主观写作', scope: '材料简答、短材料作文、公文写作或观点表达', count: '1题', score: '20%', note: '提前准备常用框架和规范表达。' })
  }
  return rows
}

function buildFallbackKnowledgeSections(type) {
  const weightedKeys = type.label === '社区工作者'
    ? ['基层治理', '居民自治', '公共服务', '应急管理', '民法典人身权', '公文文种']
    : type.label === '国企'
      ? ['劳动合同', '行政许可', '公文文种', '经济常识', '职业道德', '民事行为能力']
      : ['民法典人身权', '行政处罚', '宪法基本权利', '公文文种', '劳动合同', '行政复议']
  const pool = [...weightedKeys, ...PUBLIC_KNOWLEDGE_TOPICS]
  const nos = pickRandomNumbers(1, 80, 3)
  return pickRandomItems(pool, 3)
    .map((key, idx) => knowledgeSectionByKey(key, nos[idx]))
}

function buildFallbackThreeNotes(type) {
  const common = [
    { prefix: '机关公文', before: '即机关实施领导、履行职能、处理公务的具有特定效力和规范体式的文书，是', red: '传达贯彻方针政策', after: '、公布法规和规章、指导布置和商洽工作的重要工具。', blue: '请示和答复问题', tail: '也常通过文种适用场景考查。' },
    { prefix: '通知', before: '适用于发布、传达要求下级机关执行和有关单位周知或者执行的事项，常用于', red: '批转、转发、任免', after: '等场景。', blue: '周知或执行', tail: '是判断文种的关键词。' },
    { prefix: '请示', before: '适用于向上级机关请求指示、批准，应当坚持', red: '一文一事', after: '，一般不得多头主送。', blue: '事前行文', tail: '是和报告区分的重点。' },
    { prefix: '报告', before: '适用于向上级机关汇报工作、反映情况、回复询问，重点在于', red: '陈述情况', after: '，一般不要求上级批复。', blue: '事后行文', tail: '常与请示比较考查。' },
    { prefix: '函', before: '适用于不相隶属机关之间商洽工作、询问和答复问题，具有', red: '平行文', after: '特点。', blue: '不相隶属', tail: '是判断函的核心提示。' },
    { prefix: '行政处罚', before: '是行政机关依法对违反行政管理秩序的公民、法人或者其他组织给予的制裁，必须遵循', red: '处罚法定', after: '原则。', blue: '公正公开', tail: '也是常见判断点。' },
    { prefix: '行政许可', before: '是行政机关根据申请，经依法审查准予其从事特定活动的行为，强调', red: '依申请', after: '和法定审查。', blue: '便民高效', tail: '常与行政确认区分。' },
    { prefix: '行政复议', before: '是行政系统内部解决行政争议的重要制度，申请人认为行政行为侵犯权益时可以', red: '申请复议', after: '。', blue: '合法性与适当性', tail: '都是审查重点。' },
    { prefix: '行政强制', before: '行政机关为制止违法行为、防止证据损毁或履行行政决定，可以依法采取', red: '强制措施或强制执行', after: '。', blue: '比例原则', tail: '是常见考点。' },
    { prefix: '民事主体', before: '自然人、法人和非法人组织都可以成为民事主体，依法享有', red: '民事权利能力', after: '并承担民事义务。', blue: '平等原则', tail: '是民法基础考点。' },
    { prefix: '民事行为能力', before: '自然人的行为能力与年龄、智力状况有关，未成年人实施法律行为要注意', red: '效力判断', after: '。', blue: '八周岁', tail: '是常见年龄节点。' },
    { prefix: '人格权', before: '人格权是民事主体享有的固有权利，包括生命权、身体权、健康权、姓名权、肖像权和', red: '隐私权', after: '等。', blue: '不得放弃转让', tail: '常见于判断题。' },
    { prefix: '婚姻家庭', before: '结婚应当男女双方完全自愿，男不得早于二十二周岁，女不得早于', red: '二十周岁', after: '。', blue: '直系血亲', tail: '和三代以内旁系血亲禁止结婚。' },
    { prefix: '劳动合同', before: '用人单位与劳动者建立劳动关系，应当订立书面劳动合同，试用期约定需符合', red: '合同期限限制', after: '。', blue: '同一单位只能约定一次', tail: '是高频陷阱。' },
    { prefix: '社会保险', before: '社会保险包括养老、医疗、工伤、失业、生育等项目，用人单位和劳动者依法', red: '参保缴费', after: '。', blue: '工伤认定', tail: '常结合工作时间和工作原因考查。' },
    { prefix: '宪法权利', before: '公民在法律面前一律平等，并依法享有选举权、被选举权、言论出版等', red: '基本权利', after: '。', blue: '监督权', tail: '常以批评建议申诉控告命题。' },
    { prefix: '国家机构', before: '人民代表大会是国家权力机关，国务院是最高国家行政机关，监察委员会依法行使', red: '监察权', after: '。', blue: '机关性质', tail: '是常见区分点。' },
    { prefix: '基层治理', before: '强调政府、社区组织、社会力量和居民共同参与，重点围绕', red: '公共服务和矛盾调解', after: '展开。', blue: '多元协同', tail: '常见于社区类考试。' },
    { prefix: '居民自治', before: '居民委员会是基层群众性自治组织，办理本居住地区公共事务和公益事业，实行', red: '自我管理、自我教育、自我服务', after: '。', blue: '不是基层政权', tail: '是高频辨析。' },
    { prefix: '公共服务', before: '公共服务强调面向社会公众提供基本服务，基层岗位常围绕养老、就业、救助和', red: '便民服务', after: '展开。', blue: '公平可及', tail: '是评价方向。' },
    { prefix: '职业道德', before: '公职和窗口服务岗位常考爱岗敬业、诚实守信、办事公道、服务群众和', red: '奉献社会', after: '。', blue: '规范履职', tail: '要结合服务场景判断。' },
    { prefix: '应急管理', before: '包括预防准备、监测预警、应急处置和恢复重建，处置时坚持', red: '生命至上', after: '和快速反应。', blue: '分级负责', tail: '是常见关键词。' },
    { prefix: '经济常识', before: '市场机制通过价格、供求和竞争影响资源配置，宏观调控通常综合运用', red: '经济、法律和行政手段', after: '。', blue: '市场配置资源', tail: '是基础考点。' },
    { prefix: '科技常识', before: '大数据、云计算、人工智能常与数字治理、智慧城市和公共服务效率提升结合考查，核心是', red: '技术赋能治理', after: '。', blue: '数据安全', tail: '也常出现。' },
    { prefix: '资料分析', before: '增长率等于增长量除以基期量，遇到比重变化题时要比较', red: '部分增长率与整体增长率', after: '。', blue: '估算截位', tail: '能提升速度。' },
    { prefix: '管理职能', before: '管理活动通常包括计划、组织、领导和控制，基层岗位还强调沟通协调和', red: '闭环落实', after: '。', blue: '目标管理', tail: '是常见表述。' },
  ]
  const weighted = type.label === '社区工作者'
    ? common.filter(item => /基层治理|居民自治|公共服务|应急管理|职业道德|社会保险|宪法权利/.test(item.prefix))
    : type.label === '国企'
      ? common.filter(item => /劳动合同|经济常识|管理职能|职业道德|行政许可|机关公文|社会保险/.test(item.prefix))
      : []
  const pool = [...weighted, ...common]
  return pickRandomItems(pool, 8 + Math.floor(Math.random() * 3))
}

function normalizeThreeNoteContent(input, d) {
  return {
    lines: normalizeThreeNoteLines(input, buildFallbackContent(d).keypoints),
  }
}

function normalizeThreeNoteLines(list, fallback) {
  const source = Array.isArray(list) && list.length ? list : fallback
  return (source || [])
    .map(item => {
      if (typeof item === 'object' && item) {
        const prefix = cleanText(item.prefix || item.title || item.label || item.key, '')
        const before = cleanText(item.before, '')
        const red = cleanText(item.red || item.highlight || item.important, '')
        const after = cleanText(item.after || item.text || item.content || item.desc, '')
        const blue = cleanText(item.blue || item.underline || '', '')
        const tail = cleanText(item.tail || '', '')
        if (!prefix && !before && !red && !after && !blue && !tail) return null
        return { prefix, before, red, after, blue, tail }
      }
      const text = cleanText(item, '')
      return text ? { prefix: text, before: '', red: '', after: '', blue: '', tail: '' } : null
    })
    .filter(Boolean)
    .slice(0, 10)
}

function knowledgeSectionByKey(key, no) {
  const map = {
    民法典人身权: {
      title: '人身权',
      items: [
        { title: '人身权分为', text: '人格权和身份权，常和民法典总则、侵权责任结合考查。' },
        { title: '人格权包括', text: '生命权、身体权、健康权、姓名权、肖像权、名誉权、隐私权等。' },
        { title: '身份权包括', text: '配偶权、亲权、亲属权等，常见于婚姻家庭类判断题。' },
      ],
    },
    民事行为能力: {
      title: '民事行为能力',
      items: [
        { title: '完全能力人', text: '十八周岁以上自然人为成年人，通常具有完全民事行为能力。' },
        { title: '限制能力人', text: '八周岁以上未成年人实施民事法律行为，需结合年龄和智力判断效力。' },
        { title: '无能力人', text: '不满八周岁的未成年人为无民事行为能力人，由法定代理人代理。' },
      ],
    },
    婚姻家庭: {
      title: '婚姻家庭',
      items: [
        { title: '结婚年龄', text: '男不得早于二十二周岁，女不得早于二十周岁。' },
        { title: '禁止结婚', text: '直系血亲或者三代以内旁系血亲禁止结婚。' },
        { title: '共同财产', text: '婚姻关系存续期间取得的工资、奖金、经营收益等通常归共同所有。' },
      ],
    },
    行政处罚: {
      title: '行政处罚',
      items: [
        { title: '处罚种类', text: '包括警告、罚款、没收违法所得、责令停产停业、暂扣或吊销许可证件等。' },
        { title: '处罚原则', text: '遵循法定、公正、公开、处罚与教育相结合原则。' },
        { title: '一事不再罚', text: '对同一违法行为不得给予两次以上罚款的行政处罚。' },
      ],
    },
    行政许可: {
      title: '行政许可',
      items: [
        { title: '许可含义', text: '行政机关根据申请，经依法审查准予从事特定活动的行为。' },
        { title: '设定原则', text: '行政许可应当依法设定，遵循公开、公平、公正和便民原则。' },
        { title: '常见形式', text: '许可证、执照、资质资格认可等都可能作为题干考点。' },
      ],
    },
    行政复议: {
      title: '行政复议',
      items: [
        { title: '复议性质', text: '行政复议是行政系统内部解决行政争议的重要制度。' },
        { title: '申请对象', text: '公民、法人或其他组织认为具体行政行为侵犯合法权益可申请。' },
        { title: '审查重点', text: '重点审查行政行为是否合法、适当，常和诉讼救济比较考查。' },
      ],
    },
    行政强制: {
      title: '行政强制',
      items: [
        { title: '强制措施', text: '包括限制人身自由、查封场所设施、扣押财物、冻结存款等。' },
        { title: '强制执行', text: '当事人不履行行政决定时，行政机关可依法强制履行。' },
        { title: '基本原则', text: '实施行政强制应当适当，并兼顾公共利益和个人权益。' },
      ],
    },
    宪法基本权利: {
      title: '宪法基本权利',
      items: [
        { title: '平等权', text: '公民在法律面前一律平等，是常见宪法判断题考点。' },
        { title: '政治权利', text: '包括选举权、被选举权以及言论、出版、集会等自由。' },
        { title: '监督权', text: '公民对国家机关及其工作人员有批评、建议、申诉、控告等权利。' },
      ],
    },
    国家机构: {
      title: '国家机构',
      items: [
        { title: '权力机关', text: '人民代表大会是国家权力机关，地方各级人大是地方权力机关。' },
        { title: '行政机关', text: '国务院是最高国家行政机关，地方政府管理本行政区域行政工作。' },
        { title: '监察机关', text: '监察委员会依法对公职人员进行监察，注意与检察机关区分。' },
      ],
    },
    公文文种: {
      title: '公文文种',
      items: [
        { title: '通知适用于', text: '发布、传达要求下级机关执行和有关单位周知或者执行的事项。' },
        { title: '请示适用于', text: '向上级机关请求指示、批准，请示一般应当一文一事。' },
        { title: '函适用于', text: '不相隶属机关之间商洽工作、询问和答复问题。' },
      ],
    },
    公文行文规则: {
      title: '公文行文规则',
      items: [
        { title: '上行文', text: '请示、报告属于常见上行文，主送机关一般只能有一个。' },
        { title: '联合行文', text: '同级机关、部门或单位必要时可以联合行文。' },
        { title: '请示报告', text: '请示要求批复，报告重在陈述情况，二者不能混用。' },
      ],
    },
    事业单位常识: {
      title: '事业单位常识',
      items: [
        { title: '单位属性', text: '事业单位通常以社会公益为目的，提供教育、科技、文化、卫生等服务。' },
        { title: '岗位类别', text: '常见岗位包括管理岗、专业技术岗和工勤技能岗。' },
        { title: '考查方向', text: '常结合公共服务、职业道德、岗位职责等内容命题。' },
      ],
    },
    劳动合同: {
      title: '劳动合同',
      items: [
        { title: '合同类型', text: '包括固定期限、无固定期限和以完成一定工作任务为期限的劳动合同。' },
        { title: '试用期', text: '试用期长短与劳动合同期限有关，同一用人单位只能约定一次。' },
        { title: '解除情形', text: '劳动合同解除常考协商解除、预告解除、即时解除等区别。' },
      ],
    },
    社会保险: {
      title: '社会保险',
      items: [
        { title: '基本项目', text: '包括养老、医疗、工伤、失业、生育保险等。' },
        { title: '工伤认定', text: '在工作时间和工作场所内因工作原因受到事故伤害，一般可认定工伤。' },
        { title: '缴纳主体', text: '用人单位和劳动者依法参加社会保险并缴纳相关费用。' },
      ],
    },
    基层治理: {
      title: '基层治理',
      items: [
        { title: '治理主体', text: '基层治理强调多元主体参与，政府、社区组织、社会力量共同协同。' },
        { title: '治理重点', text: '常围绕矛盾调解、公共服务、网格管理、应急处置等场景考查。' },
        { title: '服务导向', text: '基层工作要坚持群众需求导向，提升公共服务精细化水平。' },
      ],
    },
    居民自治: {
      title: '居民自治',
      items: [
        { title: '自治内容', text: '包括民主选举、民主协商、民主决策、民主管理、民主监督。' },
        { title: '自治组织', text: '居民委员会是基层群众性自治组织，不是基层政权机关。' },
        { title: '常见考点', text: '注意区分居委会、街道办、业委会和物业服务企业的职责。' },
      ],
    },
    公共服务: {
      title: '公共服务',
      items: [
        { title: '服务范围', text: '涵盖就业、养老、教育、医疗、救助、便民服务等民生事项。' },
        { title: '服务原则', text: '强调公平可及、便民高效、资源整合和精准供给。' },
        { title: '基层场景', text: '常结合窗口服务、群众诉求办理、特殊群体帮扶出题。' },
      ],
    },
    应急管理: {
      title: '应急管理',
      items: [
        { title: '工作环节', text: '包括预防准备、监测预警、应急处置和恢复重建。' },
        { title: '处置原则', text: '坚持生命至上、统一领导、分级负责、快速反应。' },
        { title: '基层重点', text: '社区和单位应加强风险排查、隐患整改和应急宣传演练。' },
      ],
    },
    职业道德: {
      title: '职业道德',
      items: [
        { title: '基本要求', text: '爱岗敬业、诚实守信、办事公道、服务群众、奉献社会。' },
        { title: '服务意识', text: '窗口和基层岗位常考耐心沟通、规范办理和群众满意度。' },
        { title: '纪律意识', text: '遵守岗位规范、保守工作秘密、依法依规履职。' },
      ],
    },
    科技常识: {
      title: '科技常识',
      items: [
        { title: '信息技术', text: '大数据、云计算、人工智能常与数字治理、智慧城市结合考查。' },
        { title: '生活科技', text: '常见物理化学生物常识会以生活场景判断题出现。' },
        { title: '创新发展', text: '科技创新是现代化产业体系和公共治理能力提升的重要支撑。' },
      ],
    },
    经济常识: {
      title: '经济常识',
      items: [
        { title: '市场机制', text: '价格、供求、竞争共同影响资源配置，是经济常识基础考点。' },
        { title: '宏观调控', text: '常见手段包括经济手段、法律手段和必要的行政手段。' },
        { title: '国企属性', text: '国有企业在重要行业和关键领域承担保障、引领和服务功能。' },
      ],
    },
    管理常识: {
      title: '管理常识',
      items: [
        { title: '管理职能', text: '计划、组织、领导、控制是管理学常见基础概念。' },
        { title: '沟通协调', text: '基层岗位重视跨部门协同、信息反馈和问题闭环。' },
        { title: '目标管理', text: '围绕目标分解、过程跟踪、结果评价形成管理闭环。' },
      ],
    },
    资料分析: {
      title: '资料分析',
      items: [
        { title: '增长率', text: '增长率等于增长量除以基期量，注意现期量和基期量转换。' },
        { title: '比重变化', text: '部分增长率高于整体增长率，比重通常上升。' },
        { title: '速算技巧', text: '资料分析要重视估算、截位和选项差距判断。' },
      ],
    },
    时政常识: {
      title: '时政常识',
      items: [
        { title: '复习范围', text: '重点关注近期重要会议、政府工作报告、地方重点工作等。' },
        { title: '命题特点', text: '常以关键词、年度主题、重大活动和民生政策形式出现。' },
        { title: '备考方式', text: '建议按月份整理关键词，不必机械背诵长篇材料。' },
      ],
    },
  }
  const hit = map[key] || map.民法典人身权
  return {
    heading: `【考点${no}】 ${hit.title}`,
    items: hit.items,
  }
}

function normalizeKnowledgeContent(input, d) {
  return {
    sections: normalizeKnowledgeSections(input?.sections, buildFallbackContent(d).overview.sections),
  }
}

function normalizeKnowledgeSections(sections, fallback) {
  const source = Array.isArray(sections) && sections.length ? sections : fallback
  const nos = pickRandomNumbers(1, 80, 3)
  return (source || [])
    .map((sec, idx) => {
      const rawHeading = cleanText(sec?.heading || sec?.title, '')
      const heading = normalizeKnowledgeHeading(rawHeading, nos[idx] || nos[0] || 1)
      const items = normalizeKnowledgeItems(sec?.items || sec?.lines || sec?.points)
      return items.length ? { heading, items } : null
    })
    .filter(Boolean)
    .slice(0, 3)
}

function normalizeKnowledgeHeading(heading, no) {
  const text = cleanText(heading, '高频考点')
  if (/【考点\d+】/.test(text)) return text
  return `【考点${no}】 ${text.replace(/^【?考点[^】\s]*】?\s*/, '')}`
}

function normalizeKnowledgeItems(items) {
  const source = Array.isArray(items) ? items : []
  return source
    .map(item => {
      if (typeof item === 'object' && item) {
        const title = cleanText(item.title || item.label || item.key, '')
        const text = cleanText(item.text || item.content || item.desc, '')
        return title || text ? { title: title || '重点', text } : null
      }
      const text = cleanText(item, '')
      const parts = text.split(/：|:/)
      return text ? { title: parts.length > 1 ? parts[0] : '重点', text: parts.length > 1 ? parts.slice(1).join('：') : text } : null
    })
    .filter(Boolean)
    .slice(0, 4)
}

function normalizeTimelineContent(timeline, d) {
  const fallback = buildFallbackContent(d).timeline
  const rows = Array.isArray(timeline?.rows) && timeline.rows.length ? timeline.rows : fallback.rows
  return {
    summary: timeline?.summary || fallback.summary,
    timeline: buildTimelineItems(d),
    rows: normalizeScoreRows(rows),
  }
}

function normalizeScoreRows(rows) {
  const normalized = rows.slice(0, 5).map(row => ({
    subject: cleanText(row.subject, '综合基础知识'),
    scope: cleanText(row.scope, '相关基础知识、常见题型和高频考法'),
    count: cleanText(row.count, '约20题'),
    score: cleanScore(row.score),
    note: cleanText(row.note, '以公告和真题题型为准。'),
  }))
  const writingIndex = normalized.findIndex(row => /写作|申论|作文|材料/.test(row.subject))
  if (writingIndex >= 0 && normalized.length > 1) {
    normalized[writingIndex].count = '1题'
    normalized[writingIndex].score = '20%'
    const others = normalized.filter((_, idx) => idx !== writingIndex)
    const each = Math.floor(80 / others.length)
    let rest = 80
    others.forEach((row, idx) => {
      const val = idx === others.length - 1 ? rest : each
      row.score = `${val}%`
      rest -= val
    })
  }
  return normalized
}

function buildTimelineItems(d) {
  const apply = splitRange(d.apply_time)
  return [
    { label: '公告发布', date: '以公告为准' },
    { label: '报名开始', date: apply[0] || '另行通知' },
    { label: '报名结束', date: apply[1] || '另行通知' },
    { label: '笔试时间', date: d.written_exam_time || '另行通知' },
    { label: '面试时间', date: d.interview_time || '另行通知' },
  ]
}

function splitRange(text) {
  const parts = String(text || '').split(/至|到|—|-|~|～/).map(s => s.trim()).filter(Boolean)
  return parts.length >= 2 ? [parts[0], parts[1]] : [parts[0] || '', '']
}

function toDocContent(input) {
  return {
    heading: input?.heading || '考试信息整理',
    lines: normalizeRichList(input?.lines, [], 8).map((item, idx) => toLine(item, idx)),
  }
}

function getRegionPageTitle(region) {
  const normalized = normalizeRegionContent(region)
  return normalized.name ? `${normalized.name}${normalized.pageTitle}` : normalized.pageTitle
}

function toRegionDocContent(region) {
  return normalizeRegionContent(region)
}

function listDoc(heading, list) {
  return {
    heading,
    lines: normalizeRichList(list, [], 10).map((item, idx) => ({ ...toLine(item, idx), strong: idx === 0 || idx === 1 })),
  }
}

function toLine(item, idx) {
  if (typeof item === 'object' && item) {
    return {
      prefix: `${idx + 1}.`,
      title: cleanText(item.title, ''),
      text: cleanText(item.text || item.content || item.desc, ''),
    }
  }
  return { prefix: `${idx + 1}.`, text: cleanText(item, '') }
}

function normalizeStringList(list, fallback) {
  const arr = Array.isArray(list) ? list : []
  const result = arr.map(item => String(item || '').trim()).filter(Boolean)
  return result.length ? result.slice(0, 8) : fallback
}

function normalizeRichList(list, fallback, limit = 8) {
  const source = Array.isArray(list) && list.length ? list : fallback
  return (source || [])
    .map(item => {
      if (typeof item === 'object' && item) {
        const title = String(item.title || item.label || '').trim()
        const text = String(item.text || item.content || item.desc || '').trim()
        return title || text ? { title, text } : null
      }
      const text = String(item || '').trim()
      return text ? { title: '', text } : null
    })
    .filter(Boolean)
    .slice(0, limit)
}

function normalizeRegionContent(region) {
  const base = region || {}
  const level = String(base.level || '').includes('区') ? '区' : '市'
  const pageTitle = base.pageTitle || (level === '区' ? '区情概况' : '市情概况')
  const name = normalizeRegionName(base.name)
  let sections = []

  if (Array.isArray(base.sections) && base.sections.length) {
    sections = base.sections.map((sec, idx) => ({
      heading: cleanText(sec.heading, ['一、地理位置', '二、历史文化底蕴', '三、产业交通与发展', '四、公共服务与治理'][idx] || `${idx + 1}. 地区概况`),
      paragraphs: normalizeParagraphList(sec.paragraphs || sec.text || sec.content),
    }))
  } else {
    const lines = normalizeRichList(base.lines, [], 8)
    sections = lines.map((line, idx) => ({
      heading: `${toChineseNumber(idx + 1)}、${line.title || '地区概况'}`,
      paragraphs: [line.text || '相关内容以公告属地和当地公开资料为准。'],
    }))
  }

  sections = sections
    .map(sec => ({ ...sec, paragraphs: sec.paragraphs.filter(Boolean) }))
    .filter(sec => sec.heading && sec.paragraphs.length)

  if (!sections.length) {
    sections = buildFallbackRegion(data.value).sections
  }

  return {
    name,
    level,
    pageTitle,
    heading: base.heading || (name ? `${name}${pageTitle}` : pageTitle),
    sections: sections.slice(0, 4),
  }
}

function isEnterpriseRegionContent(region) {
  const text = (region.sections || [])
    .flatMap(sec => [sec.heading, ...(sec.paragraphs || [])])
    .join('')
  return /企业性质|企业定位|行业监管|行业背景|行业规模|行业特点|燃气行业|天然气|管道燃气|公司业务|集团业务|主营|供应|甲烷|国企考试信息|复习建议|考试建议/.test(text)
}

function isInvalidRegionName(name) {
  const text = cleanText(name, '')
  if (!text || ['当地', '属地', '本地', '该地区'].includes(text)) return true
  if (!/(市|区|县|旗)$/.test(text)) return true
  return /公司|集团|燃气|银行|医院|学校|中心|岗位|招聘|考试|资料|国企|单位|企业|行业|业务/.test(text)
}

function normalizeRegionName(value) {
  let text = cleanText(value, '')
  if (!text) return ''
  text = text
    .replace(/^.*?(?=[\u4e00-\u9fa5]{2,10}(?:新区|自治县|区|县|旗|市)$)/, '')
    .replace(/^[第\d零一二三四五六七八九十百千万年月届期批次\s]+/, '')
    .replace(/^(年|届|第|省|市)+/, '')
  const district = text.match(/([\u4e00-\u9fa5]{2,10}(?:新区|自治县|区|县|旗))$/)
  if (district) return district[1].replace(/^[年届第]+/, '')
  const city = text.match(/([\u4e00-\u9fa5]{2,10}市)$/)
  if (city) return city[1].replace(/^[年届第]+/, '')
  return text
}

function normalizeParagraphList(value) {
  if (Array.isArray(value)) return value.map(v => cleanText(v, '')).filter(Boolean).slice(0, 3)
  const text = cleanText(value, '')
  if (!text) return []
  return splitParagraphs(text).slice(0, 3)
}

function toChineseNumber(num) {
  return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][num] || String(num)
}

function splitParagraphs(text) {
  const parts = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean)
  if (parts.length > 1) return parts
  const raw = String(text || '').trim()
  if (raw.length <= 120) return [raw]
  const first = raw.slice(0, 110)
  return [first, raw.slice(110)]
}

function cleanText(value, fallback) {
  return String(value || fallback || '').replace(/\s+/g, ' ').trim()
}

function cleanScore(score) {
  const match = String(score || '').match(/\d+/)
  return match ? `${match[0]}%` : '20%'
}

function createRandomSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function pickRandomItems(list, count) {
  const unique = Array.from(new Set(list || [])).filter(Boolean)
  for (let i = unique.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[unique[i], unique[j]] = [unique[j], unique[i]]
  }
  return unique.slice(0, count)
}

function pickRandomNumbers(min, max, count) {
  const nums = Array.from({ length: max - min + 1 }, (_, idx) => min + idx)
  for (let i = nums.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[nums[i], nums[j]] = [nums[j], nums[i]]
  }
  return nums.slice(0, count)
}

function safeFileName(name) {
  return String(name || 'image').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
}
</script>

<style scoped>
.nis-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  height: 100%;
  min-height: 0;
}
.nis-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
.nis-product {
  border: 1px solid #edf0f5;
  border-radius: 8px;
  padding: 12px;
  background: #fbfcff;
}
.nis-product-name {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.45;
}
.nis-product-meta {
  color: #6b7280;
  margin-top: 4px;
}
.nis-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nis-module-panel {
  border: 1px solid #edf0f5;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
}
.nis-module-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-weight: 700;
  color: #1f2937;
}
.nis-module-checks {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}
.nis-module-checks :deep(.ant-checkbox-wrapper) {
  margin-inline-start: 0;
}
.nis-page-list {
  overflow: auto;
  min-height: 0;
  border: 1px solid #edf0f5;
  border-radius: 8px;
}
.nis-page-row {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid #f1f3f7;
  cursor: pointer;
}
.nis-page-row.active {
  background: #eaf4ff;
}
.nis-page-index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #eef2f7;
  color: #475569;
  font-weight: 700;
}
.nis-page-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.nis-main {
  overflow: auto;
  min-width: 0;
  background: #f4f5f7;
  border-radius: 8px;
  padding: 16px;
}
.nis-center {
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  color: #64748b;
}
.nis-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 16px;
}
.nis-preview-card {
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}
.nis-preview-card.active {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}
.nis-card-head {
  height: 40px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eef1f5;
  font-weight: 600;
}
.nis-canvas-wrap {
  display: flex;
  justify-content: center;
  padding: 12px;
  background: #f7f8fb;
  min-height: 450px;
  overflow: hidden;
}
.nis-scale-shell {
  width: 900px;
  height: 1200px;
  transform: scale(0.35);
  transform-origin: top center;
  margin-bottom: -780px;
}
.nis-page {
  width: 900px;
  height: 1200px;
  overflow: hidden;
  background: #fff;
  color: #111827;
  box-sizing: border-box;
}
.nis-cover {
  padding: 92px 64px;
  background:
    radial-gradient(circle at 74% 78%, rgba(59, 130, 246, 0.11), transparent 28%),
    linear-gradient(180deg, #fffaf1 0%, #eef7ff 100%);
}
.nis-cover-year {
  color: #3b82f6;
  font-size: 62px;
  font-weight: 800;
}
.nis-cover-title {
  margin-top: 42px;
  font-size: 82px;
  line-height: 1.18;
  font-weight: 900;
  color: #111827;
}
.nis-cover-sub {
  margin-top: 34px;
  color: #ef4444;
  font-size: 44px;
  font-weight: 800;
}
.nis-cover-tags {
  margin-top: 72px;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}
.nis-cover-tags span {
  padding: 14px 24px;
  border-radius: 999px;
  background: #ffe66d;
  color: #1f2937;
  font-size: 30px;
  font-weight: 700;
}
.nis-memo {
  padding: 46px 36px;
  background: #fffef9;
}
.nis-memo-nav {
  color: #b5a94d;
  font-size: 32px;
  font-weight: 700;
}
.nis-memo-title {
  margin-top: 20px;
  font-size: 60px;
  line-height: 1.24;
  font-weight: 900;
}
.nis-memo-block {
  margin-top: 44px;
  padding: 24px 30px 28px;
  background: #ffc49d;
  color: #733b18;
  font-size: 30px;
  line-height: 1.64;
}
.nis-memo-label {
  font-weight: 800;
  margin-bottom: 8px;
}
.nis-memo-block p {
  margin: 0 0 10px;
}
.nis-doc,
.nis-pdf,
.nis-timeline {
  padding: 62px 56px 46px;
  background:
    radial-gradient(circle at 50% 78%, rgba(148, 163, 184, 0.16), transparent 30%),
    linear-gradient(180deg, #fffaf0 0%, #fffef9 48%, #f8fbff 100%);
}
.nis-doc-title,
.nis-blue-title {
  text-align: center;
  font-size: 31px;
  font-weight: 900;
  margin-bottom: 72px;
}
.nis-doc-title span {
  color: #ef4444;
  border-bottom: 7px double #54c4e8;
}
.nis-doc-body {
  font-size: 29px;
  line-height: 1.58;
}
.nis-doc-heading {
  color: #ef4444;
  font-size: 34px;
  font-weight: 800;
  margin-bottom: 18px;
}
.nis-doc-line {
  margin: 8px 0;
  padding-bottom: 2px;
}
.nis-doc-line.strong {
  color: #2563eb;
  font-weight: 800;
}
.nis-doc-prefix {
  color: #2563eb;
  font-weight: 800;
  margin-right: 8px;
}
.nis-doc-line-title {
  color: #ef4444;
  font-weight: 800;
  background: linear-gradient(transparent 64%, rgba(255, 222, 89, 0.85) 64%);
}
.nis-region {
  padding: 70px 72px 52px;
  background-color: #fbfaf0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    radial-gradient(circle at 54% 55%, rgba(96, 165, 250, 0.12), transparent 28%);
  background-size: 34px 34px, 34px 34px, 100% 100%;
}
.nis-region-title {
  text-align: center;
  font-size: 39px;
  line-height: 1.2;
  font-weight: 900;
  color: #050505;
  margin-bottom: 56px;
}
.nis-region-title span {
  color: #ef4444;
  border-bottom: 7px double #54c4e8;
}
.nis-region-body {
  color: #0b0b0b;
}
.nis-region-section {
  margin-bottom: 42px;
}
.nis-region-section h2 {
  margin: 0 0 28px;
  font-size: 36px;
  line-height: 1.25;
  font-weight: 500;
}
.nis-region-section p {
  margin: 0 0 26px;
  font-size: 35px;
  line-height: 1.52;
  letter-spacing: 0;
  text-align: justify;
}
.nis-knowledge {
  padding: 76px 72px 52px;
  background-color: #fbfaf0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    radial-gradient(circle at 52% 58%, rgba(96, 165, 250, 0.12), transparent 30%);
  background-size: 34px 34px, 34px 34px, 100% 100%;
}
.nis-knowledge-title {
  text-align: center;
  font-size: 42px;
  line-height: 1.2;
  font-weight: 900;
  color: #050505;
  margin-bottom: 94px;
}
.nis-knowledge-title span {
  color: #ef4444;
  border-bottom: 7px double #54c4e8;
}
.nis-knowledge-section {
  margin-bottom: 28px;
}
.nis-knowledge-section h2 {
  margin: 0 0 18px;
  color: #ef4444;
  font-size: 31px;
  line-height: 1.28;
  font-weight: 800;
}
.nis-knowledge-line {
  margin: 0 0 12px;
  font-size: 29px;
  line-height: 1.55;
  color: #0b0b0b;
}
.nis-knowledge-no,
.nis-knowledge-key {
  color: #1677e8;
  font-weight: 800;
}
.nis-knowledge-key {
  background: linear-gradient(transparent 68%, rgba(84, 196, 232, 0.55) 68%);
}
.nis-three-note {
  padding: 34px 14px 48px;
  background-color: #fbfaf0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    radial-gradient(circle at 52% 55%, rgba(96, 165, 250, 0.12), transparent 30%);
  background-size: 28px 28px, 28px 28px, 100% 100%;
}
.nis-three-title {
  text-align: center;
  font-size: 36px;
  line-height: 1.2;
  font-weight: 900;
  color: #050505;
  margin: 6px 0 78px;
}
.nis-three-title span {
  color: #ef4444;
  border-bottom: 7px double #54c4e8;
}
.nis-three-body {
  font-size: 28px;
  line-height: 1.62;
  color: #050505;
}
.nis-three-line {
  margin-bottom: 8px;
}
.nis-three-red {
  color: #ef4444;
  font-weight: 800;
}
.nis-three-blue {
  color: #1677e8;
  font-weight: 800;
  background: linear-gradient(transparent 68%, rgba(84, 196, 232, 0.7) 68%);
}
.nis-blue-title {
  color: #4a9be8;
  margin-bottom: 42px;
}
.nis-section-title {
  display: inline-block;
  color: #4a9be8;
  background: linear-gradient(transparent 60%, #ffe66d 60%);
  font-size: 32px;
  font-weight: 900;
  margin: 10px 0 24px;
}
.nis-timeline {
  padding-left: 0;
  padding-right: 0;
}
.nis-timeline .nis-blue-title,
.nis-timeline .nis-section-title,
.nis-timeline .nis-red-line,
.nis-score-table {
  margin-left: 56px;
  margin-right: 56px;
}
.nis-timeline .nis-blue-title {
  display: block;
}
.nis-timeline {
  color: #2d3748;
}
.nis-timeline-item {
  flex: 1;
  text-align: center;
  color: #4193e8;
  font-weight: 800;
}
.nis-timeline {
  position: relative;
}
.nis-timeline .nis-timeline-item {
  position: relative;
}
.nis-timeline-row {
  display: flex;
  background: #d7ecff;
  padding: 38px 28px 46px;
  margin: 10px 0 22px;
}
.nis-time-date,
.nis-time-label {
  font-size: 20px;
}
.nis-time-dot {
  width: 12px;
  height: 12px;
  background: #4193e8;
  border-radius: 50%;
  margin: 12px auto;
}
.nis-red-line {
  color: #d71920;
  font-size: 24px;
  font-weight: 900;
  line-height: 1.5;
  margin-bottom: 16px;
}
.nis-score-table {
  width: calc(100% - 112px);
  border-collapse: collapse;
  table-layout: fixed;
  background: rgba(255,255,255,0.72);
}
.nis-score-table td {
  border: 1px solid #40657d;
  padding: 10px 8px;
  font-size: 20px;
  line-height: 1.38;
  text-align: center;
}
.nis-score-table td:nth-child(2),
.nis-score-table td:nth-child(5) {
  width: 28%;
}
.nis-score-table td:nth-child(1) {
  font-weight: 800;
  width: 16%;
}
.nis-pdf-frame {
  height: 960px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.78);
  border: 1px solid #e5e7eb;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
}
.nis-pdf-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.nis-pdf-empty {
  height: 930px;
  display: grid;
  place-items: center;
  color: #94a3b8;
  font-size: 32px;
  border: 2px dashed #cbd5e1;
}
</style>
