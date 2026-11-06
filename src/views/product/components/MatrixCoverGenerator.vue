<template>
  <a-drawer v-model:open="visible" title="生成矩阵封面" width="1120" :destroy-on-close="false">
    <a-alert
      type="info"
      show-icon
      message="先选择这篇笔记准备讲什么，再选择呈现方式。只有点击“生成这个封面方案”后才生成具体方案。"
      style="margin-bottom:16px"
    />

    <a-card v-if="!analysis" size="small" title="智能分析当前商品">
      <p class="matrix-muted">系统将识别招聘类型、可用内容和推荐方向。分析结果会按商品内容缓存，信息未变化时不会重复分析。</p>
      <a-descriptions size="small" bordered :column="2" style="margin:14px 0">
        <a-descriptions-item label="单位">{{ facts.companyName || '未填写' }}</a-descriptions-item>
        <a-descriptions-item label="商品类型">{{ facts.jobType || '未填写' }}</a-descriptions-item>
        <a-descriptions-item label="招聘人数">{{ facts.recruitCount || '未填写' }}</a-descriptions-item>
        <a-descriptions-item label="笔试时间">{{ facts.examTime || '未填写' }}</a-descriptions-item>
      </a-descriptions>
      <a-button type="primary" :loading="analyzing" @click="analyzeProduct">智能分析当前商品</a-button>
      <a-button style="margin-left:8px" @click="useLocalAnalysis">使用基础分类</a-button>
    </a-card>

    <template v-else>
      <div class="matrix-analysis-head">
        <div>
          <a-tag color="blue">{{ analysis.recruitment_type.primary }}</a-tag>
          <a-tag v-for="tag in analysis.recruitment_type.secondary" :key="tag">{{ tag }}</a-tag>
          <span class="matrix-muted">{{ analysis.recruitment_type.reason }}</span>
        </div>
        <a-space>
          <span class="matrix-muted">分析于 {{ formatTime(analysis.analyzed_at) }}</span>
          <a-button type="link" size="small" :loading="analyzing" @click="analyzeProduct(true)">重新分析</a-button>
        </a-space>
      </div>

      <a-alert
        v-if="analysis.risk_notices.length"
        type="warning"
        show-icon
        :message="`本商品未明确：${analysis.risk_notices.join('、')}。生成时不会补充这些信息。`"
        style="margin-bottom:16px"
      />

      <a-steps :current="step" size="small" style="margin-bottom:20px">
        <a-step title="内容方向" />
        <a-step title="具体选题" />
        <a-step title="呈现方式" />
        <a-step title="确认生成" />
      </a-steps>

      <section v-if="step === 0">
        <h3>推荐给当前商品</h3>
        <div class="matrix-recommend-grid">
          <button v-for="item in recommendations" :key="item.topic_id" class="matrix-recommend" @click="selectRecommendation(item)">
            <strong>{{ topicName(item.topic_id) }}</strong>
            <span>{{ item.reason }}</span>
            <small>{{ item.evidence?.length ? `依据：${item.evidence.join('、')}` : '基于当前商品类型与内容推荐' }}</small>
          </button>
        </div>
        <h3 style="margin-top:20px">全部内容分类</h3>
        <div class="matrix-category-grid">
          <button
            v-for="category in categories"
            :key="category.id"
            class="matrix-category"
            :class="{ active: selection.categoryId === category.id }"
            @click="selectCategory(category.id)"
          >
            <strong>{{ category.name }}</strong><span>{{ category.description }}</span>
          </button>
        </div>
      </section>

      <section v-else-if="step === 1">
        <div class="matrix-section-head"><h3>{{ selectedCategory?.name }}</h3><a-button type="link" @click="step = 0">返回分类</a-button></div>
        <div class="matrix-topic-grid">
          <button
            v-for="topic in selectedCategory?.topics || []"
            :key="topic.id"
            class="matrix-topic"
            :class="{ active: selection.topicId === topic.id, disabled: topicState(topic).state === 'disabled' }"
            :disabled="topicState(topic).state === 'disabled'"
            @click="selectTopic(topic.id)"
          >
            <div><strong>{{ topic.name }}</strong><a-tag :color="stateColor(topicState(topic).state)">{{ topicState(topic).label }}</a-tag></div>
            <span>{{ topic.description }}</span>
            <small v-if="topicState(topic).reason">{{ topicState(topic).reason }}</small>
          </button>
        </div>
      </section>

      <section v-else-if="step === 2">
        <div class="matrix-section-head"><h3>{{ topicName(selection.topicId) }}</h3><a-button type="link" @click="step = 1">返回选题</a-button></div>
        <a-form layout="vertical">
          <a-form-item label="目标受众">
            <a-radio-group v-model:value="selection.audienceId" button-style="solid">
              <a-radio-button v-for="item in audienceOptions" :key="item.id" :value="item.id">{{ item.name }}</a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="信息结构">
            <div class="matrix-choice-grid">
              <button v-for="item in recommendedStructures" :key="item.id" type="button" :class="{ active: selection.structureId === item.id }" @click="selection.structureId = item.id">
                <strong>{{ item.name }}</strong><span>{{ item.description }}</span>
              </button>
            </div>
          </a-form-item>
          <a-form-item label="视觉场景">
            <div class="matrix-choice-grid">
              <button v-for="item in recommendedScenes" :key="item.id" type="button" :class="{ active: selection.sceneId === item.id }" @click="selection.sceneId = item.id">
                <strong>{{ item.name }}</strong><span>{{ item.description }}</span>
              </button>
            </div>
          </a-form-item>
        </a-form>
        <a-button type="primary" :disabled="!canConfirm" @click="step = 3">下一步：确认方案</a-button>
      </section>

      <section v-else>
        <div class="matrix-section-head"><h3>确认本次方案</h3><a-button type="link" @click="step = 2">返回修改</a-button></div>
        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item label="招聘类型">{{ analysis.recruitment_type.primary }}</a-descriptions-item>
          <a-descriptions-item label="目标受众">{{ optionName(audienceOptions, selection.audienceId) }}</a-descriptions-item>
          <a-descriptions-item label="内容分类">{{ selectedCategory?.name }}</a-descriptions-item>
          <a-descriptions-item label="具体选题">{{ topicName(selection.topicId) }}</a-descriptions-item>
          <a-descriptions-item label="信息结构">{{ optionName(structureOptions, selection.structureId) }}</a-descriptions-item>
          <a-descriptions-item label="视觉场景">{{ optionName(sceneOptions, selection.sceneId) }}</a-descriptions-item>
        </a-descriptions>
        <a-card size="small" title="本次允许使用的商品事实" style="margin-top:14px">
          <div class="matrix-facts"><span v-for="item in allowedFacts" :key="item">{{ item }}</span></div>
        </a-card>
        <a-alert
          v-if="selectedTopicState.state === 'generic'"
          type="info"
          show-icon
          :message="genericTimeMessage"
          style="margin-top:14px"
        />
        <a-button type="primary" size="large" :loading="generating" style="margin-top:18px" @click="generatePlan">生成这个封面方案</a-button>
      </section>

      <a-card v-if="result.prompt" size="small" title="已生成封面方案" style="margin-top:18px">
        <a-form layout="vertical">
          <a-form-item label="推荐标题"><a-input v-model:value="result.title" /></a-form-item>
          <a-form-item label="推荐副标题"><a-input v-model:value="result.subtitle" /></a-form-item>
          <a-form-item label="完整图片提示词"><a-textarea v-model:value="result.prompt" :auto-size="{ minRows: 12, maxRows: 22 }" /></a-form-item>
          <a-space>
            <a-button @click="step = 2">返回修改方向</a-button>
            <a-button type="primary" @click="usePrompt">使用此方案生成图片</a-button>
          </a-space>
        </a-form>
      </a-card>
    </template>
  </a-drawer>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { chatLlm } from '@/api/llm'
import { useLlmStore } from '@/stores/llm'

const props = defineProps({ product: { type: Object, required: true } })
const emit = defineEmits(['generate'])
const llmStore = useLlmStore()
const visible = ref(false)
const analyzing = ref(false)
const generating = ref(false)
const analysis = ref(null)
const step = ref(0)
const result = reactive({ title: '', subtitle: '', prompt: '' })
const selection = reactive({ categoryId: '', topicId: '', audienceId: 'zero-base', structureId: '', sceneId: '' })

const structureOptions = [
  { id: 'timeline', name: '时间轴', description: '按日期或阶段梳理重点' },
  { id: 'data-cards', name: '数据卡', description: '突出关键事实与数字' },
  { id: 'knowledge-tree', name: '知识树', description: '展示知识范围和层级' },
  { id: 'roadmap', name: '路线图', description: '展示连续行动步骤' },
  { id: 'checklist', name: '执行清单', description: '适合任务与避坑提醒' },
  { id: 'comparison', name: '对比表', description: '呈现两类内容的差异' },
  { id: 'faq', name: 'FAQ问答', description: '围绕考生问题组织内容' },
  { id: 'index', name: '资料索引', description: '适合资料和法规清单' },
  { id: 'calendar', name: '日历提醒', description: '突出时间与备考节奏' },
  { id: 'file-page', name: '档案页', description: '把信息分区归档' },
  { id: 'module-map', name: '模块地图', description: '一览考试模块' },
  { id: 'priority-matrix', name: '优先级矩阵', description: '突出复习先后顺序' },
]
const sceneOptions = [
  { id: 'study-desk', name: '学习桌', description: '书本、笔记和文具场景' },
  { id: 'library-index', name: '图书馆索引卡', description: '知识与资料索引感' },
  { id: 'exam-paper', name: '试卷桌面', description: '突出考试和练习氛围' },
  { id: 'briefing', name: '公告简报', description: '正式清晰的信息简报' },
  { id: 'planner', name: '日程本', description: '适合时间计划和冲刺' },
  { id: 'archive', name: '档案袋', description: '适合资料与企业信息' },
  { id: 'loose-leaf', name: '活页本', description: '清晰的课堂讲义风' },
  { id: 'clipboard', name: '夹板清单', description: '突出任务和执行动作' },
  { id: 'calendar-page', name: '日历页', description: '突出关键日期' },
  { id: 'newspaper', name: '报刊头版', description: '适合公告速览和快讯' },
  { id: 'data-report', name: '数据报告', description: '适合模块与事实拆解' },
  { id: 'computer-exam', name: '机考桌面', description: '适合线上考试准备' },
]
const audienceOptions = [
  { id: 'zero-base', name: '零基础考生' },
  { id: 'first-time', name: '第一次参加该类考试' },
  { id: 'experienced', name: '有相关考试基础' },
  { id: 'working', name: '在职备考考生' },
  { id: 'graduate', name: '应届毕业生' },
  { id: 'professional', name: '专业岗位考生' },
  { id: 'sprint', name: '考前冲刺考生' },
]

const categories = [
  { id: 'announcement', name: '公告信息与时间节点', description: '招聘人数、日期和公告重点', topics: [
    topic('announcement-overview', '招聘公告一页速览', '把明确事实整理成一页封面', ['data-cards', 'file-page'], ['briefing', 'newspaper']),
    topic('application-reminder', '报名时间提醒', '突出报名窗口与注意事项', ['calendar', 'timeline'], ['calendar-page', 'planner'], ['applyTime']),
    topic('exam-time-reminder', '笔试时间提醒', '突出笔试时间和考前动作', ['calendar', 'checklist'], ['calendar-page', 'clipboard'], ['examTime']),
  ]},
  { id: 'exam', name: '笔试范围与考情拆解', description: '科目范围、专项内容和考试差异', topics: [
    topic('exam-scope', '笔试到底考什么', '概览商品明确提供的考试范围', ['module-map', 'knowledge-tree'], ['loose-leaf', 'data-report'], ['examScope']),
    topic('exam-module-breakdown', '笔试模块拆解', '按模块建立复习框架', ['knowledge-tree', 'module-map'], ['loose-leaf', 'data-report'], ['examScope']),
    topic('law-study-list', '法规模块怎么准备', '整理法规清单和学习方法', ['index', 'checklist'], ['library-index', 'archive'], ['lawContent']),
    topic('basic-vs-special', '通用内容与专项内容', '比较两类内容的复习重点', ['comparison', 'priority-matrix'], ['data-report', 'loose-leaf'], ['examScope']),
  ]},
  { id: 'method', name: '备考顺序与学习方法', description: '复习顺序、刷题和行动建议', topics: [
    topic('zero-base-route', '零基础备考顺序', '从搭框架到练习的行动路线', ['roadmap', 'priority-matrix'], ['study-desk', 'clipboard']),
    topic('working-plan', '在职备考计划', '围绕有限时间安排任务', ['checklist', 'roadmap'], ['planner', 'study-desk']),
    topic('practice-review', '刷题与错题整理', '组织练习、限时和复盘动作', ['checklist', 'roadmap'], ['exam-paper', 'study-desk']),
  ]},
  { id: 'schedule', name: '时间规划与冲刺安排', description: '通用周期或真实倒计时计划', topics: [
    topic('sprint-30', '考前30天计划', '系统复习周期', ['timeline', 'calendar'], ['planner', 'calendar-page'], [], 30),
    topic('sprint-14', '考前14天计划', '重点突破周期', ['timeline', 'checklist'], ['planner', 'clipboard'], [], 14),
    topic('sprint-7', '考前7天冲刺', '最后一周冲刺安排', ['timeline', 'checklist'], ['calendar-page', 'planner'], [], 7),
    topic('sprint-3', '考前3天复习', '短期回顾与检查', ['checklist', 'calendar'], ['clipboard', 'calendar-page'], [], 3),
    topic('sprint-1', '考前一天检查', '资料、设备和状态检查', ['checklist'], ['clipboard', 'exam-paper'], [], 1),
  ]},
  { id: 'resources', name: '备考资料与知识清单', description: '公告、法规、企业和题库资料', topics: [
    topic('official-materials', '官方公告清单', '整理需要持续关注的官方信息', ['index', 'checklist'], ['archive', 'library-index']),
    topic('law-materials', '法规原文清单', '整理明确出现的法规资料', ['index', 'file-page'], ['library-index', 'archive'], ['lawContent']),
    topic('exam-materials', '考前资料包', '按优先级整理复习资料', ['index', 'priority-matrix'], ['archive', 'study-desk']),
  ]},
  { id: 'risks', name: '易错点与避坑提醒', description: '复习偏题、信息误判和考前检查', topics: [
    topic('scope-risks', '复习范围避坑', '避免加入公告未明确的科目', ['checklist', 'faq'], ['clipboard', 'loose-leaf']),
    topic('special-risk', '忽略专项知识的风险', '强调通用与专项的合理安排', ['comparison', 'checklist'], ['data-report', 'clipboard'], ['examScope']),
    topic('exam-check', '考前检查清单', '整理材料、设备和时间检查', ['checklist'], ['clipboard', 'exam-paper']),
  ]},
  { id: 'comparison', name: '考试差异与对比分析', description: '类别、岗位和复习方法对比', topics: [
    topic('general-vs-special', '通用知识与专项知识', '比较内容性质与复习方式', ['comparison', 'priority-matrix'], ['data-report', 'loose-leaf'], ['examScope']),
    topic('online-vs-paper', '线上考试与纸笔考试', '比较设备和应试准备', ['comparison', 'checklist'], ['computer-exam', 'exam-paper'], ['examFormat']),
  ]},
  { id: 'scenario', name: '考生场景与行动指南', description: '针对具体身份和现实场景', topics: [
    topic('first-exam', '第一次参加该类考试', '从信息确认到开始复习', ['roadmap', 'faq'], ['study-desk', 'loose-leaf']),
    topic('after-application', '报名完成后做什么', '把下一步行动整理成路线', ['roadmap', 'checklist'], ['planner', 'clipboard'], ['applyTime']),
    topic('working-candidate', '在职考生怎么准备', '围绕碎片时间安排复习', ['timeline', 'checklist'], ['planner', 'study-desk']),
  ]},
]

function topic(id, name, description, structures, scenes, requires = [], days = 0) {
  return { id, name, description, structures, scenes, requires, days }
}

const facts = computed(() => {
  const p = props.product || {}
  return {
    companyName: String(p.company_name || '').trim(), title: String(p.title || '').trim(), jobType: String(p.job_type_name || '').trim(),
    recruitCount: String(p.recruit_count || '').trim(), applyTime: String(p.apply_time || '').trim(), examTime: String(p.written_exam_time || '').trim(),
    examScope: String(p.written_exam_content || '').trim(), interview: String(p.interview_content || '').trim(),
    lawContent: /民法典|条例|法律|法规|组织法/.test(String(p.written_exam_content || '')),
    examFormat: /线上|在线|机考|纸笔|闭卷|开卷/.test(String(p.written_exam_content || '')),
  }
})
const selectedCategory = computed(() => categories.find(v => v.id === selection.categoryId))
const selectedTopic = computed(() => selectedCategory.value?.topics.find(v => v.id === selection.topicId))
const selectedTopicState = computed(() => selectedTopic.value ? topicState(selectedTopic.value) : { state: '', label: '' })
const recommendedStructures = computed(() => optionSubset(structureOptions, selectedTopic.value?.structures))
const recommendedScenes = computed(() => optionSubset(sceneOptions, selectedTopic.value?.scenes))
const canConfirm = computed(() => selection.audienceId && selection.structureId && selection.sceneId)
const genericTimeMessage = computed(() => examDaysRemaining() != null && examDaysRemaining() < 0
  ? '当前商品的笔试日期已经过去，本方案仅按通用复习周期生成，不会写成当前考试倒计时。'
  : '当前商品没有可计算的明确笔试日期，本方案按通用复习周期生成，不会写成真实考试倒计时。')
const recommendations = computed(() => (analysis.value?.recommended_topics || []).slice(0, 3))
const allowedFacts = computed(() => [
  facts.value.companyName && `单位：${facts.value.companyName}`,
  facts.value.recruitCount && `招聘人数：${facts.value.recruitCount}`,
  facts.value.applyTime && `报名时间：${facts.value.applyTime}`,
  facts.value.examTime && `笔试时间：${facts.value.examTime}`,
  facts.value.jobType && `岗位类型：${facts.value.jobType}`,
  facts.value.examScope && `笔试内容：${facts.value.examScope}`,
].filter(Boolean))

function optionSubset(options, ids = []) { return ids.map(id => options.find(v => v.id === id)).filter(Boolean) }
function optionName(options, id) { return options.find(v => v.id === id)?.name || '' }
function allTopics() { return categories.flatMap(v => v.topics) }
function topicName(id) { return allTopics().find(v => v.id === id)?.name || id }
function stateColor(state) { return ({ recommended: 'green', available: 'blue', generic: 'orange', disabled: 'default' })[state] || 'default' }
function formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '' }

function topicState(item) {
  const missing = item.requires?.find(key => !facts.value[key])
  if (missing) return { state: 'disabled', label: '暂不可用', reason: requirementReason(missing) }
  if (item.days) {
    const remaining = examDaysRemaining()
    if (remaining == null) return { state: 'generic', label: '通用计划', reason: '不代表当前考试剩余时间' }
    if (remaining < 0) return { state: 'generic', label: '通用计划', reason: '当前笔试日期已过，仅按通用复习周期生成' }
    if (item.days > remaining) return { state: 'disabled', label: '暂不可用', reason: `当前约剩${remaining}天，计划周期不能超过剩余时间` }
    if (item.days === remaining) return { state: 'recommended', label: '推荐', reason: '与当前剩余时间匹配' }
  }
  if (analysis.value?.available_topic_ids?.includes(item.id)) return { state: 'recommended', label: '推荐', reason: '' }
  return { state: 'available', label: '可使用', reason: '' }
}
function requirementReason(key) {
  return ({ applyTime: '当前商品未填写报名时间', examTime: '当前商品未填写笔试时间', examScope: '当前商品未填写笔试内容', lawContent: '笔试内容未明确列出法规', examFormat: '当前商品未明确考试形式' })[key] || '缺少必要商品信息'
}
function examDaysRemaining() {
  const raw = facts.value.examTime
  if (!raw || /另行|待定|预计|中旬|上旬|下旬|准考证/.test(raw)) return null
  const match = raw.match(/(?:(20\d{2})[年\-/.])?(\d{1,2})[月\-/.](\d{1,2})/)
  if (!match) return null
  const fallbackYear = Number((facts.value.title.match(/20\d{2}/) || [])[0]) || new Date().getFullYear()
  const date = new Date(Number(match[1]) || fallbackYear, Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - now.getTime()) / 86400000)
}

function selectCategory(id) { selection.categoryId = id; selection.topicId = ''; step.value = 1; clearResult() }
function selectTopic(id) {
  selection.topicId = id
  const item = allTopics().find(v => v.id === id)
  selection.structureId = item?.structures?.[0] || ''
  selection.sceneId = item?.scenes?.[0] || ''
  step.value = 2; clearResult()
}
function selectRecommendation(item) {
  const category = categories.find(v => v.topics.some(t => t.id === item.topic_id))
  if (!category) return
  selection.categoryId = category.id
  selectTopic(item.topic_id)
  selection.structureId = item.structure_ids?.find(id => structureOptions.some(v => v.id === id)) || selection.structureId
  selection.sceneId = item.scene_ids?.find(id => sceneOptions.some(v => v.id === id)) || selection.sceneId
}
function clearResult() { result.title = ''; result.subtitle = ''; result.prompt = '' }

function contentHash() {
  const source = [facts.value.companyName, facts.value.title, facts.value.jobType, facts.value.recruitCount, facts.value.applyTime, facts.value.examTime, facts.value.examScope, facts.value.interview].join('|')
  let hash = 5381
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash) ^ source.charCodeAt(i)
  return (hash >>> 0).toString(16)
}
function cacheKey() { return `matrix-cover-analysis-v1:${props.product?.id || facts.value.companyName || 'unknown'}` }
function loadCache() {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey()) || 'null')
    if (value?.content_hash === contentHash() && value?.analysis) analysis.value = value.analysis
  } catch { /* ignore */ }
}
function saveCache(value) {
  try { localStorage.setItem(cacheKey(), JSON.stringify({ content_hash: contentHash(), analysis: value })) } catch { /* ignore */ }
}

function buildLocalAnalysis() {
  const text = `${facts.value.companyName} ${facts.value.title} ${facts.value.jobType} ${facts.value.examScope}`
  let primary = '综合招聘'
  if (/社区|社工|基层治理/.test(text)) primary = '社区工作者'
  else if (/事业单位|职测|综合应用能力/.test(text)) primary = '事业单位'
  else if (/银行|农商行|农信/.test(text)) primary = '银行、农商行'
  else if (/烟草|电网|能源|燃气|煤|石油/.test(text)) primary = '烟草、电网、能源'
  else if (/医院|医疗|教师|学校|教育/.test(text)) primary = '医疗、教育及专业岗位'
  else if (/集团|公司|国企|央企/.test(text)) primary = /市属|区属|地方/.test(text) ? '地方国企' : '央企、国企'
  const available = allTopics().filter(t => topicStateWithoutAnalysis(t).state !== 'disabled').map(t => t.id)
  const preferred = primary === '社区工作者'
    ? ['exam-module-breakdown', 'law-study-list', 'zero-base-route']
    : ['announcement-overview', facts.value.examScope ? 'exam-module-breakdown' : 'zero-base-route', 'official-materials']
  return {
    recruitment_type: { primary, secondary: [], confidence: .6, reason: '根据商品类型、单位名称和笔试内容识别' },
    content_tags: extractTags(), available_topic_ids: available,
    recommended_topics: preferred.filter(id => available.includes(id)).slice(0, 3).map(id => recommendationFor(id)),
    risk_notices: riskNotices(), analyzed_at: new Date().toISOString(), source: 'local',
  }
}
function topicStateWithoutAnalysis(item) {
  const missing = item.requires?.find(key => !facts.value[key])
  if (missing) return { state: 'disabled' }
  if (item.days) {
    const remaining = examDaysRemaining()
    if (remaining != null && remaining >= 0 && item.days > remaining) return { state: 'disabled' }
  }
  return { state: 'available' }
}
function extractTags() {
  const source = facts.value.examScope
  return ['综合基础知识', '职业能力测验', '综合应用能力', '社区工作', '社会工作', '民法典', '法规', '时事', '市情区情', '企业知识', '行业知识', '金融经济', '英语']
    .filter(v => source.includes(v))
}
function riskNotices() {
  const scope = facts.value.examScope
  return [!facts.value.examTime && '明确笔试日期', !/题/.test(scope) && '题量', !/分/.test(scope) && '分值', !/分钟|小时/.test(scope) && '考试时长', !facts.value.examFormat && '考试形式'].filter(Boolean)
}
function recommendationFor(id) {
  const item = allTopics().find(v => v.id === id)
  return { topic_id: id, reason: item?.description || '适合当前商品', evidence: extractTags().slice(0, 3), structure_ids: item?.structures || [], scene_ids: item?.scenes || [] }
}

async function analyzeProduct(force = false) {
  if (analyzing.value) return
  if (!force) { loadCache(); if (analysis.value) return }
  const active = llmStore.active
  if (!active) { useLocalAnalysis(); message.info('未配置使用中的大模型，已启用基础分类'); return }
  analyzing.value = true
  try {
    const allowedTopicIds = allTopics().map(v => v.id)
    const response = await chatLlm({
      provider: active.provider, api_format: active.api_format, api_key: active.api_key, base_url: active.base_url || '', model: active.default_model,
      messages: [
        { role: 'system', content: '你是招聘考试内容分类助手。只能分析和归纳，不能修改、补充或推测商品事实。只能从用户提供的topic_id中选择。不得输出政治人物、领导人姓名或敏感政治内容。只返回JSON。' },
        { role: 'user', content: `请分析以下商品并输出JSON：\n商品事实：${JSON.stringify(facts.value)}\n允许的topic_id：${JSON.stringify(allowedTopicIds)}\n输出字段：recruitment_type{primary,secondary,confidence,reason}、content_tags、available_topic_ids、recommended_topics[{topic_id,reason,evidence,structure_ids,scene_ids}]、risk_notices。推荐3项。structure_ids只能取${JSON.stringify(structureOptions.map(v => v.id))}；scene_ids只能取${JSON.stringify(sceneOptions.map(v => v.id))}。` },
      ], max_tokens: 1800, temperature: .25,
    })
    const parsed = parseJson(response.content)
    analysis.value = validateAnalysis(parsed)
    saveCache(analysis.value)
    message.success('商品智能分析完成')
  } catch (error) {
    useLocalAnalysis()
    message.warning(`智能分析未完成，已使用基础分类：${error.message || '未知错误'}`)
  } finally { analyzing.value = false }
}
function useLocalAnalysis() { analysis.value = buildLocalAnalysis(); saveCache(analysis.value) }
function parseJson(value) {
  const source = String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = source.indexOf('{'); const end = source.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('模型未返回有效JSON')
  return JSON.parse(source.slice(start, end + 1))
}
function validateAnalysis(value) {
  const allowedTopics = new Set(allTopics().map(v => v.id)); const allowedStructures = new Set(structureOptions.map(v => v.id)); const allowedScenes = new Set(sceneOptions.map(v => v.id))
  const local = buildLocalAnalysis()
  const recommendations = (Array.isArray(value?.recommended_topics) ? value.recommended_topics : [])
    .filter(v => allowedTopics.has(v.topic_id) && topicStateWithoutAnalysis(allTopics().find(t => t.id === v.topic_id)).state !== 'disabled')
    .map(v => ({ ...v, evidence: Array.isArray(v.evidence) ? v.evidence.slice(0, 4) : [], structure_ids: (v.structure_ids || []).filter(id => allowedStructures.has(id)), scene_ids: (v.scene_ids || []).filter(id => allowedScenes.has(id)) }))
  for (const item of local.recommended_topics) if (recommendations.length < 3 && !recommendations.some(v => v.topic_id === item.topic_id)) recommendations.push(item)
  return {
    recruitment_type: { primary: String(value?.recruitment_type?.primary || local.recruitment_type.primary), secondary: Array.isArray(value?.recruitment_type?.secondary) ? value.recruitment_type.secondary.slice(0, 4).map(String) : [], confidence: Number(value?.recruitment_type?.confidence || .5), reason: String(value?.recruitment_type?.reason || local.recruitment_type.reason) },
    content_tags: Array.isArray(value?.content_tags) ? value.content_tags.slice(0, 12).map(String) : local.content_tags,
    available_topic_ids: (Array.isArray(value?.available_topic_ids) ? value.available_topic_ids : local.available_topic_ids).filter(id => allowedTopics.has(id)),
    recommended_topics: recommendations.slice(0, 3), risk_notices: Array.isArray(value?.risk_notices) ? value.risk_notices.slice(0, 8).map(String) : local.risk_notices,
    analyzed_at: new Date().toISOString(), source: 'ai',
  }
}

async function generatePlan() {
  const active = llmStore.active
  if (!active) { buildFallbackResult(); message.info('未配置大模型，已生成基础方案'); return }
  generating.value = true
  try {
    const topic = selectedTopic.value
    const genericTime = selectedTopicState.value.state === 'generic'
    const response = await chatLlm({
      provider: active.provider, api_format: active.api_format, api_key: active.api_key, base_url: active.base_url || '', model: active.default_model,
      messages: [
        { role: 'system', content: '你是小红书招聘考试资料封面策划师。封面必须让用户第一眼识别出“具体单位/招聘类型＋笔试备考资料或攻略”，不能像普通学习记录。商品事实不得改写或补充；通用内容只能写成备考建议。禁止政治人物、领导人姓名、旗帜、徽章、政府建筑和政治象征。禁止稳上岸、必过、押题、内部资料等表达。只返回JSON。' },
        { role: 'user', content: `根据以下选择生成一套3:4竖版封面方案。\n商品事实：${JSON.stringify(facts.value)}\n招聘类型：${analysis.value.recruitment_type.primary}\n内容分类：${selectedCategory.value.name}\n具体选题：${topic.name}\n目标受众：${optionName(audienceOptions, selection.audienceId)}\n信息结构：${optionName(structureOptions, selection.structureId)}\n视觉场景：${optionName(sceneOptions, selection.sceneId)}\n${genericTime ? '时间规则：这是通用复习周期，禁止写成距离当前考试还有对应天数。' : ''}\n标题要求：必须包含单位名称或清晰简称，并明确出现“笔试攻略、备考攻略、备考资料、考情分析”中的一种，使缩略图状态下也能看出这是一篇招聘考试资料笔记；具体选题作为第二层卖点，不能取代单位和资料属性。\n视觉对比要求：主标题文字与标题区背景必须形成明显明暗反差，禁止棕色字配米色背景、浅色字配浅色背景或同色系低对比搭配；优先使用深蓝/近黑文字配白色或浅色独立标题卡，或白色文字配深蓝/墨绿/深红纯色标题区。\n输出JSON：title、subtitle、core_content数组、suggestions数组、prompt。prompt必须要求单张完整封面、文字清晰、缩略图可读、一个核心场景、禁止拼图和多方案合图。` },
      ], max_tokens: 2200, temperature: .72,
    })
    const parsed = parseJson(response.content)
    result.title = ensureCommercialTitle(parsed.title || topic.name)
    result.subtitle = sanitize(String(parsed.subtitle || ''))
    result.prompt = sanitize(buildFinalPrompt(parsed))
    saveHistory()
    message.success('矩阵封面方案生成完成')
  } catch (error) {
    buildFallbackResult(); message.warning(`AI方案生成失败，已生成基础方案：${error.message || '未知错误'}`)
  } finally { generating.value = false }
}
function buildFinalPrompt(parsed) {
  const core = Array.isArray(parsed.core_content) ? parsed.core_content.map(sanitize).filter(Boolean) : []
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map(sanitize).filter(Boolean) : []
  return [
    '生成一张小红书招聘考试资料封面，竖版3:4比例，只输出一张完整图片。', `【主标题】${ensureCommercialTitle(parsed.title || selectedTopic.value.name)}`,
    parsed.subtitle ? `【副标题】${sanitize(parsed.subtitle)}` : '', `【单位】${facts.value.companyName}`, `【内容方向】${selectedTopic.value.name}`,
    `【目标受众】${optionName(audienceOptions, selection.audienceId)}`, `【信息结构】${optionName(structureOptions, selection.structureId)}`, `【视觉场景】${optionName(sceneOptions, selection.sceneId)}`,
    allowedFacts.value.length ? `【可使用的商品事实】${allowedFacts.value.join('；')}` : '', core.length ? `【封面核心内容】${core.join('；')}` : '', suggestions.length ? `【备考建议】${suggestions.join('；')}` : '',
    parsed.prompt ? `【视觉执行】${sanitize(parsed.prompt)}` : '',
    selectedTopicState.value.state === 'generic' ? '【时间约束】这是通用复习周期，不得写成距离当前考试还有对应天数，不得虚构具体考试日期。' : '',
    '【首屏识别目标】用户必须在缩略图状态下第一眼看出“哪个单位/招聘类型＋笔试备考资料或攻略”。单位名称与“笔试攻略/备考攻略/备考资料/考情分析”必须处于最高视觉层级，具体选题处于第二层级。',
    '【标题高对比硬性要求】主标题必须放在独立、干净、无复杂纹理的标题区域。标题文字与背景必须形成强烈明暗反差：使用近黑/深蓝文字配白色或极浅色不透明标题卡，或使用纯白文字配深蓝、墨绿、深红等深色不透明标题区。禁止棕色字配米色背景、浅色字配浅色背景、同色系低对比、半透明文字、纹理穿过文字以及强光覆盖标题。',
    '【标题版式】标题位于画面上方约30%区域，控制在2—3行，字重醒目但字形清楚；单位名称、笔试属性和资料属性不得缩成小字。副标题和场景素材不能抢夺主标题注意力。',
    '画面必须清晰、一目了然，信息块不超过5个，每块1—3行，四周保留安全边距。只使用简体中文。',
    '严禁拼贴、九宫格、分屏、三联画、方案对比图、画中画、重复多个封面。禁止二维码、Logo、水印和引流文案。',
    '不得虚构题量、分值、占比、考试时长、合格线、报录比或未公布科目。不得出现政治人物、领导人姓名、旗帜、徽章、政府建筑或政治象征。',
  ].filter(Boolean).join('\n')
}
function buildFallbackResult() {
  const company = facts.value.companyName || '本次招聘'
  result.title = ensureCommercialTitle(`${company}${selectedTopic.value.name}`)
  result.subtitle = selectedTopic.value.description
  result.prompt = buildFinalPrompt({ title: result.title, subtitle: result.subtitle, core_content: analysis.value.content_tags.slice(0, 5), suggestions: ['先确认考试范围', '按模块安排复习', '使用官方信息核对时间'], prompt: `${optionName(sceneOptions, selection.sceneId)}场景，采用${optionName(structureOptions, selection.structureId)}组织信息，低饱和配色，深色文字，层级清楚。` })
  saveHistory()
}
function sanitize(value) {
  return String(value || '').replace(/习近平|毛泽东|邓小平|江泽民|胡锦涛|李克强|领导人|总书记/g, '').replace(/稳上岸|必过|包进面|内部资料|独家押题|100%考/g, '重点准备').trim()
}
function ensureCommercialTitle(value) {
  let title = sanitize(value)
  const company = facts.value.companyName
  if (company && !title.includes(company)) title = `${company}${title}`
  if (!/(笔试攻略|备考攻略|备考资料|考情分析)/.test(title)) title = `${title}｜笔试备考攻略`
  return title.replace(/\|{2,}/g, '|').trim()
}
function saveHistory() {
  try {
    const key = `matrix-cover-history-v1:${props.product?.id || 'unknown'}`
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    list.unshift({ categoryId: selection.categoryId, topicId: selection.topicId, audienceId: selection.audienceId, structureId: selection.structureId, sceneId: selection.sceneId, title: result.title, createdAt: new Date().toISOString() })
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)))
  } catch { /* ignore */ }
}
function usePrompt() { emit('generate', { ...result, selection: { ...selection } }); visible.value = false }
function open() { visible.value = true; step.value = 0; clearResult(); analysis.value = null; loadCache() }
defineExpose({ open })
</script>

<style scoped>
.matrix-muted{color:#888;font-size:12px}.matrix-analysis-head,.matrix-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.matrix-recommend-grid,.matrix-category-grid,.matrix-topic-grid,.matrix-choice-grid{display:grid;gap:12px}.matrix-recommend-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.matrix-category-grid,.matrix-choice-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.matrix-topic-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.matrix-recommend,.matrix-category,.matrix-topic,.matrix-choice-grid button{display:flex;flex-direction:column;gap:7px;padding:15px;border:1px solid #e1e5eb;border-radius:9px;background:#fff;text-align:left;cursor:pointer;transition:.2s}.matrix-recommend:hover,.matrix-category:hover,.matrix-topic:hover,.matrix-choice-grid button:hover,.matrix-category.active,.matrix-topic.active,.matrix-choice-grid button.active{border-color:#1677ff;box-shadow:0 0 0 2px rgba(22,119,255,.1)}.matrix-recommend strong,.matrix-category strong,.matrix-topic strong,.matrix-choice-grid strong{color:#222}.matrix-recommend span,.matrix-category span,.matrix-topic span,.matrix-choice-grid span{color:#666;font-size:12px;line-height:1.55}.matrix-recommend small,.matrix-topic small{color:#999;line-height:1.45}.matrix-topic>div{display:flex;align-items:center;justify-content:space-between;gap:6px}.matrix-topic.disabled{cursor:not-allowed;opacity:.5}.matrix-facts{display:flex;flex-direction:column;gap:8px;color:#555;font-size:13px;line-height:1.55}@media(max-width:900px){.matrix-recommend-grid,.matrix-category-grid,.matrix-topic-grid,.matrix-choice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
