import { EDITORIAL_CARD_STYLES } from './editorialCardStyles.js'
import { chooseExamTopic } from './examContentPlan.js'
import { chooseNoteTitle } from './noteTitlePlanner.js'

const HISTORY_KEY = 'xhs-content-diversity-history-v1'
const HISTORY_LIMIT = 200

const CONTENT_ANGLES = [
  { id: 'material_overview', name: '资料内容说明', main: '资料内容', question: '资料里都有哪些内容？', need: 'exam' },
  { id: 'directory_guide', name: '资料目录解读', main: '资料目录', question: '资料目录应该怎么看？', need: 'exam' },
  { id: 'material_purpose', name: '资料用途说明', main: '资料怎么用', question: '不同资料分别怎么用？', need: 'exam' },
  { id: 'confirmed_scope', name: '已确认内容梳理', main: '已确认内容', question: '目前能确认哪些考试内容？', need: 'content' },
  { id: 'information_boundary', name: '资料配合方法', main: '资料配合使用', question: '怎样用不同资料建立复习框架？', need: 'any' },
  { id: 'beginner_start', name: '新手开始路径', main: '从哪里开始', question: '第一次准备应该先做什么？', need: 'any' },
  { id: 'scope_check', name: '复习范围确认', main: '复习范围', question: '怎么先把复习范围理清？', need: 'any' },
  { id: 'baseline_check', name: '基础摸底方法', main: '基础摸底', question: '开始复习前怎么做摸底？', need: 'any' },
  { id: 'material_filter', name: '资料筛选方法', main: '资料筛选', question: '资料太多应该怎么筛？', need: 'exam' },
  { id: 'study_order', name: '复习顺序建议', main: '复习顺序', question: '资料和刷题应该怎么安排？', need: 'any' },
  { id: 'history_first_round', name: '回忆题第一轮', main: '第一轮怎么刷', question: '回忆题第一遍应该怎么做？', need: 'history' },
  { id: 'history_second_round', name: '回忆题第二轮', main: '第二轮看什么', question: '回忆题第二遍重点看什么？', need: 'history' },
  { id: 'history_classify', name: '回忆题分类整理', main: '题目分类整理', question: '做过的题应该怎么分类？', need: 'history' },
  { id: 'history_review', name: '回忆题复盘方法', main: '做完怎么复盘', question: '做完回忆题后怎么复盘？', need: 'history' },
  { id: 'error_review', name: '错题复盘方法', main: '错题复盘', question: '错题应该怎么重新整理？', need: 'history' },
  { id: 'mock_timing', name: '模拟题使用时机', main: '模拟题怎么用', question: '模拟题什么时候开始做？', need: 'mock' },
  { id: 'mock_practice', name: '套卷训练方法', main: '套卷练习流程', question: '模拟套卷应该怎么练？', need: 'mock' },
  { id: 'mock_metrics', name: '模拟练习检查', main: '练完检查什么', question: '完成模拟练习后看哪些指标？', need: 'mock' },
  { id: 'notes_usage', name: '讲义使用方法', main: '讲义使用方法', question: '讲义应该从哪里开始看？', need: 'exam' },
  { id: 'question_bank_usage', name: '题库使用方法', main: '题库使用方法', question: '题库怎样刷才更清楚？', need: 'exam' },
  { id: 'material_index', name: '资料索引方法', main: '建立资料索引', question: '怎么快速找到需要的资料？', need: 'exam' },
  { id: 'task_split', name: '学习任务拆分', main: '拆分学习任务', question: '怎么把资料拆成具体任务？', need: 'exam' },
  { id: 'completion_check', name: '复习完成度自查', main: '完成度自查', question: '怎么判断复习是否完整？', need: 'any' },
  { id: 'weakness_check', name: '薄弱内容检查', main: '检查薄弱内容', question: '怎么找到真正薄弱的部分？', need: 'any' },
]

const TITLE_STRATEGIES = [
  { id: 'direct_question', name: '直接问题' },
  { id: 'choice_question', name: '二选一问题' },
  { id: 'common_question', name: '常见疑问' },
  { id: 'information', name: '信息说明' },
  { id: 'material', name: '资料说明' },
  { id: 'method', name: '方法指导' },
  { id: 'order', name: '使用顺序' },
  { id: 'mistake', name: '误区提醒' },
  { id: 'breakdown', name: '内容拆解' },
  { id: 'checklist', name: '自查清单' },
  { id: 'comparison', name: '对照分析' },
  { id: 'single_focus', name: '单点讲解' },
  { id: 'objective', name: '客观汇总' },
  { id: 'operation', name: '操作流程' },
  { id: 'notice', name: '注意事项' },
  { id: 'beginner', name: '新手入门' },
]

const BODY_STRUCTURES = [
  { id: 'three_paragraphs', name: '三段自然文', instruction: '写成三段自然文：直接说明、具体解释、实用提醒；不要使用列表符号。' },
  { id: 'four_short_paragraphs', name: '四段短文', instruction: '写成四个长度明显不同的短段落，不使用统一小标题。' },
  { id: 'conclusion_first', name: '先结论后解释', instruction: '第一句直接给出结论，再用两到三段解释原因和使用方法。' },
  { id: 'problem_reason_solution', name: '问题原因方案', instruction: '按“具体问题—产生原因—可执行方案”组织，三个部分篇幅不要相同。' },
  { id: 'three_item_list', name: '三项清单', instruction: '只列三项，每项必须包含一个具体动作和一个注意点，不要使用相同句式。' },
  { id: 'five_item_check', name: '五项自查', instruction: '写成五个自查问题，读者可以逐项判断；不要写资料推销式结尾。' },
  { id: 'three_steps', name: '三步骤流程', instruction: '写成三个连续步骤，每一步说明做什么、为什么以及完成标志。' },
  { id: 'four_steps', name: '四步骤流程', instruction: '写成四步骤操作流程，步骤标题短，解释具体，避免口号。' },
  { id: 'three_qa', name: '三组问答', instruction: '使用三组Q/A，每个问题必须不同，每个回答控制在两三句话。' },
  { id: 'positive_negative', name: '正反对照', instruction: '只对比两种学习动作或复习顺序，不得把学习资料目录、回忆题目录、模拟题目录中的任何一种写成低效、无效、不可靠或与考试无关。' },
  { id: 'single_deep_dive', name: '单点深度解释', instruction: '全文只解释一个问题，不延伸成完整备考攻略。' },
  { id: 'usage_manual', name: '使用说明', instruction: '像使用说明一样写清适用场景、操作方法和限制，语气客观。' },
]

const OPENINGS = [
  { id: 'question', name: '具体问题', instruction: '用一个与本篇主题直接相关的具体问题开头。' },
  { id: 'conclusion', name: '直接结论', instruction: '第一句直接给结论，不铺垫、不制造焦虑。' },
  { id: 'fact', name: '资料事实', instruction: '从商品真实包含的资料或已知信息开始。' },
  { id: 'common_case', name: '常见情况', instruction: '描述一种常见复习情况，但不要使用“很多人都”“后台被问”等套话。' },
  { id: 'scope', name: '说明范围', instruction: '先说明本文只解决哪一个问题。' },
  { id: 'mistake', name: '具体误区', instruction: '从一个具体错误做法开始，不使用夸张警告。' },
  { id: 'self_check', name: '自查问题', instruction: '用一个读者可以立即自查的问题开头。' },
  { id: 'operation', name: '直接操作', instruction: '不写开场寒暄，直接从第一个操作动作开始。' },
]

const ENDINGS = [
  { id: 'summary', name: '简短总结', instruction: '用一句不超过25字的客观总结结束。' },
  { id: 'next_action', name: '下一步行动', instruction: '最后给出一个明确且可执行的下一步动作。' },
  { id: 'self_check', name: '自查收尾', instruction: '最后留下一个复习自查问题，不使用互动引流话术。' },
  { id: 'usage_notice', name: '使用提醒', instruction: '最后提醒资料应结合实际公告和个人基础使用。' },
  { id: 'information_boundary', name: '资料配合提醒', instruction: '最后用积极语气说明可以结合资料目录、回忆题和模拟题安排后续复习，不讨论资料是否可靠。' },
  { id: 'review', name: '复盘提醒', instruction: '最后提醒记录错误原因或复盘结果。' },
  { id: 'none', name: '自然结束', instruction: '讲完核心内容后直接结束，不添加总结、祝福或资料推荐。' },
]

const TONES = [
  { id: 'objective', name: '客观说明', instruction: '语气客观克制，不使用情绪化网络口头禅。' },
  { id: 'tutorial', name: '教程说明', instruction: '语气像简洁教程，动作清楚，避免营销表达。' },
  { id: 'qa', name: '问答解惑', instruction: '语气自然直接，围绕用户疑问回答。' },
  { id: 'review', name: '复盘记录', instruction: '语气像整理记录，不虚构亲身考试经历。' },
  { id: 'analysis', name: '分析型', instruction: '说明判断依据和方法，不写绝对结论。' },
  { id: 'reminder', name: '提醒型', instruction: '给出温和提醒，不制造焦虑。' },
]

const LENGTH_BANDS = [
  { id: 'short', name: '简短', min: 130, max: 180 },
  { id: 'normal', name: '标准', min: 210, max: 280 },
  { id: 'detailed', name: '详细', min: 320, max: 420 },
  { id: 'compact_list', name: '清单', min: 180, max: 260 },
]

export const DIVERSITY_LEVEL_OPTIONS = [
  { label: '标准差异化', value: 'standard' },
  { label: '高差异化', value: 'high' },
  { label: '极高差异化（推荐）', value: 'extreme' },
]

const CARD_GOALS = [
  { id: 'material_display', name: '资料展示', needs: ['exam', 'history', 'mock'], viewpoints: ['内容整理', '目录导航', '资料说明'] },
  { id: 'usage_path', name: '使用路径', needs: ['any'], viewpoints: ['新手起步', '学习流程', '分步使用'] },
  { id: 'question_answer', name: '问题解答', needs: ['any'], viewpoints: ['常见疑问', '操作说明', '单点解答'] },
  { id: 'review_check', name: '复盘自查', needs: ['history', 'mock', 'any'], viewpoints: ['练习复盘', '完成度检查', '薄弱项检查'] },
  { id: 'single_focus', name: '单点拆解', needs: ['any'], viewpoints: ['单点提示', '重点解释', '方法拆解'] },
  { id: 'scene_action', name: '场景动作', needs: ['any'], viewpoints: ['打开资料时', '完成练习后', '准备第二轮时'] },
]

const DOCUMENT_STYLES = [
  'poster','check','tags','folder','note2','mono','exam','stamp','dark2','app','course','wrong','side','gridnote','paperclip','blue','photo','cutout','softpink','greenfile',
  'orangeburst','blueprint_card','receipt_card','neon','vertical','filetab','calendar_card','folderwall_card','outline_card','cream_card','stamp2','marker',
]
const REFERENCE_STYLES = [
  'ref_dark_border','ref_plaid','ref_arch','ref_ticket','ref_purple_sidebar','ref_clipboard','ref_minimal_red','ref_green_wave','ref_green_bands','ref_envelope','ref_purple_wave','ref_blue_sidebar','ref_brown_banner',
]
const TEA_STYLES = REFERENCE_STYLES.map(id => id.replace('ref_', 'ref_tea_'))
const ROUTE_STYLES = ['concept_metro','concept_track','concept_stairs','concept_compass','concept_timeline','concept_circuit','concept_countdown']
const REVIEW_STYLES = ['concept_dashboard','concept_answer','concept_radar','concept_matrix','concept_bars','concept_compare']
const MAP_STYLES = ['concept_tree','concept_puzzle','concept_orbit','concept_elements','concept_funnel']
const FOCUS_STYLES = ['concept_target','concept_ranking']
const VIRTUAL_MATERIAL_STYLES = ['virtual_file_drawer','virtual_download_window','virtual_cloud_drive','virtual_pdf_stack','virtual_archive_seal','virtual_course_pack','virtual_ring_binder','virtual_material_kit']
const VIRTUAL_INDEX_STYLES = ['virtual_content_index','virtual_az_index','virtual_file_tree','virtual_split_catalog','virtual_book_toc','virtual_folder_tabs','virtual_search_panel','virtual_module_map']
const VIRTUAL_ROUTE_STYLES = ['virtual_breadcrumb_path','virtual_study_signpost','virtual_bus_route','virtual_mountain_route','virtual_circular_route','virtual_task_flow','virtual_assembly_steps','virtual_workflow_pipeline']
const VIRTUAL_REVIEW_STYLES = ['virtual_review_diagnosis','virtual_sticky_wall','virtual_error_report','virtual_review_log','virtual_status_board','virtual_round_compare','virtual_checklist_sheet','virtual_progress_journal']
const VIRTUAL_FOCUS_STYLES = ['virtual_qa_dialogue','virtual_proofread_note','virtual_user_manual','virtual_magnifier_focus','virtual_highlighter_page','virtual_teacher_board','virtual_memo_note','virtual_question_cards']

const CARD_STYLE_DEFINITIONS = [
  ...EDITORIAL_CARD_STYLES,
  ...DOCUMENT_STYLES.map(id => ({ id, family: `document:${id}`, goals: ['material_display','question_answer','single_focus','scene_action','review_check'] })),
  ...REFERENCE_STYLES.map(id => ({ id, family: `reference:${id}`, goals: ['material_display','question_answer','single_focus','scene_action'] })),
  ...TEA_STYLES.map(id => ({ id, family: `reference:${id.replace('ref_tea_', 'ref_')}`, goals: ['material_display','question_answer','single_focus','scene_action'] })),
  ...ROUTE_STYLES.map(id => ({ id, family: `route:${id}`, goals: ['usage_path','scene_action'] })),
  ...REVIEW_STYLES.map(id => ({ id, family: `review:${id}`, goals: ['review_check','question_answer'] })),
  ...MAP_STYLES.map(id => ({ id, family: `map:${id}`, goals: ['material_display','usage_path'] })),
  ...FOCUS_STYLES.map(id => ({ id, family: `focus:${id}`, goals: ['single_focus','review_check'] })),
  ...VIRTUAL_MATERIAL_STYLES.map(id => ({ id, family: `virtual-material:${id}`, goals: ['material_display','scene_action'] })),
  ...VIRTUAL_INDEX_STYLES.map(id => ({ id, family: `virtual-index:${id}`, goals: ['material_display','question_answer'] })),
  ...VIRTUAL_ROUTE_STYLES.map(id => ({ id, family: `virtual-route:${id}`, goals: ['usage_path','scene_action'] })),
  ...VIRTUAL_REVIEW_STYLES.map(id => ({ id, family: `virtual-review:${id}`, goals: ['review_check','question_answer'] })),
  ...VIRTUAL_FOCUS_STYLES.map(id => ({ id, family: `virtual-focus:${id}`, goals: ['single_focus','question_answer'] })),
]

function randomIndex(max) {
  if (max <= 1) return 0
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1)
    globalThis.crypto.getRandomValues(buf)
    return buf[0] % max
  }
  return Math.floor(Math.random() * max)
}

function shuffledCopy(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function hasValue(value) {
  return String(value || '').trim().length > 0
}

function getCapabilities(detail) {
  return {
    any: true,
    content: hasValue(detail?.written_exam_content) || hasValue(detail?.job_type_name),
    exam: hasValue(detail?.baidu_path_exam),
    history: hasValue(detail?.baidu_path_history),
    mock: hasValue(detail?.baidu_path_mock),
  }
}

function pickWithDiversity(items, field, batchUsed, history, level, eligibility = () => true) {
  const eligible = items.filter(eligibility)
  const pool = eligible.length ? eligible : items
  const recentWindow = level === 'extreme' ? 80 : level === 'high' ? 40 : 15
  const recent = history.slice(-recentWindow)
  const ranked = shuffledCopy(pool).map(item => {
    const batchCount = batchUsed.filter(value => value === item.id).length
    const historyCount = recent.filter(entry => entry?.plan?.[field] === item.id).length
    return { item, score: batchCount * 100 + historyCount * (level === 'standard' ? 2 : 8) }
  }).sort((a, b) => a.score - b.score)
  return ranked[0]?.item || pool[0]
}

function buildTitle(company, strategy, angle) {
  const prefix = company ? `${company}笔试` : '企业笔试'
  // Direction labels may contain the company name from written_exam_content.
  // Keep the task itself in titles; the company already appears in the prefix.
  const task = company ? String(angle.main || '').split(company).join('').replace(/^[·：:，,\s]+|[·：:，,\s]+$/g, '') : angle.main
  const map = {
    direct_question: `${prefix}：${angle.question}`,
    choice_question: angle.id.includes('history') ? `${prefix}：先做题还是先看答案？` : `${prefix}：先看资料还是先做练习？`,
    common_question: `关于${prefix}，这个问题经常被忽略`,
    information: `${prefix}：${task}`,
    material: `${prefix}资料内容和使用方法整理`,
    method: `${prefix}${angle.main}可以这样做`,
    order: `${prefix}资料使用顺序整理`,
    mistake: `${prefix}${angle.main}时容易忽略的问题`,
    breakdown: `${prefix}${angle.main}逐项拆解`,
    checklist: `${prefix}${angle.main}自查清单`,
    comparison: `${prefix}：低效做法和有效做法的区别`,
    single_focus: `${prefix}，这篇只讲${angle.main}`,
    objective: `${prefix}${task}汇总`,
    operation: `${prefix}${angle.main}操作流程`,
    notice: `${prefix}${angle.main}注意事项`,
    beginner: `第一次准备${prefix}，先弄清这件事`,
  }
  const title = map[strategy.id] || `${prefix}：${task}`
  const first = company ? title.indexOf(company) : -1
  const unique = first < 0 ? title : title.slice(0, first + company.length) + title.slice(first + company.length).split(company).join('')
  if (Array.from(unique).length <= 20) return unique
  // Prefer a complete short task over truncating a long sentence halfway.
  const compact = `${prefix}：${task}`
  if (Array.from(compact).length <= 20) return compact
  return Array.from(prefix).slice(0, 20).join('')
}

function buildCoverText(company, angle) {
  return {
    main: angle.main,
    sub: angle.need === 'history' ? '回忆题｜练习｜复盘' : angle.need === 'mock' ? '模拟练习｜检查｜调整' : '资料说明｜使用方法',
    cardText: `${company || ''}笔试，${angle.main}`,
  }
}

function buildCardItems(capabilities, goal) {
  const materials = []
  if (capabilities.exam) materials.push('学习资料')
  if (capabilities.history) materials.push('历年回忆题')
  if (capabilities.mock) materials.push('模拟练习')
  if (!materials.length) materials.push('资料目录', '分类整理')
  const actionMap = {
    material_display: [...materials, '内容索引', '使用说明'],
    usage_path: [...materials, '复盘整理'],
    question_answer: ['先看目录', '确定顺序', '分步练习', '及时复盘'],
    review_check: ['完成情况', '错误原因', '薄弱内容', '下一轮重点'],
    single_focus: ['找到对应内容', '完成一次练习', '记录问题', '回看整理'],
    scene_action: ['打开资料', '顺着目录', '开始练习', '完成复盘'],
  }
  return [...new Set(actionMap[goal.id] || materials)].slice(0, 6)
}

function buildCardFooter(goal) {
  const footers = {
    material_display: ['不同资料可以分阶段配合使用', '先认识资料结构，再安排学习顺序', '本页展示资料内容与使用思路'],
    usage_path: ['先看目录，再按顺序开始练习', '每完成一步，再安排下一轮内容', '把资料拆成可以逐项完成的任务'],
    question_answer: ['一次只解决一个具体问题', '先明确问题，再回到资料中查找', '把疑问转换成一个可执行动作'],
    review_check: ['完成练习后，记得记录错误原因', '复盘不是重复答案，而是找到问题', '下一轮重点来自这一次的检查'],
    single_focus: ['这一页只说明一个使用重点', '先完成眼前这一步，再继续展开', '把一个问题讲清楚再进入下一项'],
    scene_action: ['打开资料后，先从第一个动作开始', '做完一组内容，再停下来检查', '准备下一轮前，先回看已有记录'],
  }
  return shuffledCopy(footers[goal.id] || footers.material_display)[0]
}

function pickCardStyle(goal, usedStyles, usedFamilies, history, level) {
  const candidates = CARD_STYLE_DEFINITIONS.filter(item => item.goals.includes(goal.id))
  const recent = history.slice(level === 'extreme' ? -120 : level === 'high' ? -60 : -25)
  return shuffledCopy(candidates).map(item => {
    const styleCount = usedStyles.filter(value => value === item.id).length
    const familyCount = usedFamilies.filter(value => value === item.family).length
    const historyStyle = recent.filter(entry => entry?.plan?.coverTemplateStyle === item.id).length
    const historyFamily = recent.filter(entry => entry?.plan?.cardStyleFamily === item.family).length
    return { item, score: styleCount * 1000 + familyCount * 180 + historyStyle * 30 + historyFamily * 12 }
  }).sort((a, b) => a.score - b.score)[0]?.item || candidates[0]
}

function buildPlanFacts(detail) {
  const facts = []
  if (hasValue(detail?.company_name)) facts.push(`企业名称：${detail.company_name}`)
  if (hasValue(detail?.job_type_name)) facts.push(`商品类型：${detail.job_type_name}`)
  if (hasValue(detail?.written_exam_content)) facts.push(`已填写的笔试内容：${detail.written_exam_content}`)
  return facts
}

export function createDiversityPlans(productDetails, level = 'extreme', history = loadDiversityHistory()) {
  const used = { contentAngle: [], titleStrategy: [], bodyStructure: [], openingStrategy: [], endingStrategy: [], toneStrategy: [], lengthBand: [], cardGoal: [], cardViewpoint: [], coverTemplateStyle: [], cardStyleFamily: [] }
  const batchPlans = []
  return productDetails.map((item) => {
    const detail = item.detail || item
    const capabilities = getCapabilities(detail)
    const topic = chooseExamTopic(detail, batchPlans, history, shuffledCopy)
    const angle = topic.angle
    let titleStrategy = pickWithDiversity(TITLE_STRATEGIES, 'titleStrategy', used.titleStrategy, history, level)
    const bodyStructure = topic.studyDays ? { id: 'daily_plan', name: '逐日复习计划', instruction: `按第1天至第${topic.studyDays}天分别安排，不能合并省略天数，每天说明科目、资料和具体动作。` } : BODY_STRUCTURES.find(item => item.id === topic.structure) || BODY_STRUCTURES[0]
    const opening = pickWithDiversity(OPENINGS, 'openingStrategy', used.openingStrategy, history, level)
    const ending = pickWithDiversity(ENDINGS, 'endingStrategy', used.endingStrategy, history, level)
    const tone = pickWithDiversity(TONES, 'toneStrategy', used.toneStrategy, history, level)
    const lengthBand = pickWithDiversity(LENGTH_BANDS, 'lengthBand', used.lengthBand, history, level, candidate => bodyStructure.id.includes('list') ? candidate.id === 'compact_list' : true)
    const goal = pickWithDiversity(CARD_GOALS, 'cardGoal', used.cardGoal, history, level, candidate => candidate.needs.some(need => capabilities[need]))
    const viewpoint = pickWithDiversity(goal.viewpoints.map(id => ({ id })), 'cardViewpoint', used.cardViewpoint, history, level)
    const cover = pickCardStyle(goal, used.coverTemplateStyle, used.cardStyleFamily, history, level)
    const emojiLevel = used.contentAngle.length % 4
    const company = String(detail?.company_name || item.company || '').trim()
    let title = buildTitle(company, titleStrategy, angle)
    const recentTitles = history.slice(level === 'extreme' ? -120 : -50)
    if (recentTitles.some(entry => textSimilarity(
      normalizeForSimilarity(title, company),
      normalizeForSimilarity(entry.title, entry.companyName),
    ) >= (level === 'extreme' ? .48 : .6))) {
      const alternative = shuffledCopy(TITLE_STRATEGIES)
        .filter(candidate => candidate.id !== titleStrategy.id && !used.titleStrategy.includes(candidate.id))
        .find((candidate) => {
          const candidateTitle = buildTitle(company, candidate, angle)
          return !recentTitles.some(entry => textSimilarity(
            normalizeForSimilarity(candidateTitle, company),
            normalizeForSimilarity(entry.title, entry.companyName),
          ) >= (level === 'extreme' ? .48 : .6))
        })
      if (alternative) {
        titleStrategy = alternative
        title = buildTitle(company, titleStrategy, angle)
      }
    }
    const selectedTitle = chooseNoteTitle(company, detail, topic, batchPlans, history, shuffledCopy)
    title = selectedTitle.title
    const coverText = buildCoverText(company, angle)
    const cardItems = buildCardItems(capabilities, goal)

    const plan = {
      ...topic,
      titleFamily: selectedTitle.family,
      titlePhrase: selectedTitle.phrase,
      contentAngle: angle.id,
      contentAngleName: angle.name,
      readerQuestion: angle.question,
      titleStrategy: titleStrategy.id,
      titleStrategyName: titleStrategy.name,
      bodyStructure: bodyStructure.id,
      bodyStructureName: bodyStructure.name,
      bodyStructureInstruction: bodyStructure.instruction,
      openingStrategy: opening.id,
      openingStrategyName: opening.name,
      openingInstruction: opening.instruction,
      endingStrategy: ending.id,
      endingStrategyName: ending.name,
      endingInstruction: ending.instruction,
      toneStrategy: tone.id,
      toneStrategyName: tone.name,
      toneInstruction: tone.instruction,
      lengthBand: lengthBand.id,
      lengthBandName: lengthBand.name,
      minLength: lengthBand.min,
      maxLength: lengthBand.max,
      emojiLevel,
      coverTemplateStyle: cover.id,
      cardStyleFamily: cover.family,
      cardGoal: goal.id,
      cardGoalName: goal.name,
      cardViewpoint: viewpoint.id,
      cardScene: viewpoint.id,
      noteTitle: title,
      coverMainText: coverText.main,
      coverSubText: coverText.sub,
      cardText: coverText.cardText,
      cardItems,
      cardFooter: buildCardFooter(goal),
      verifiedFacts: buildPlanFacts(detail),
    }

    Object.keys(used).forEach((field) => used[field].push(plan[field]))
    batchPlans.push(plan)
    return plan
  })
}

export function ensureBodyCompany(body, companyName) {
  const text = String(body || '').trim()
  const company = String(companyName || '').trim()
  if (!text || !company || text.includes(company)) return text
  return `准备${company}笔试，${text.replace(/^[这本]篇只解决一个问题[：:]\s*/, '')}`
}

export function buildDiversityPrompt(plan, detail, previousDraft = '') {
  // Resolve again here so an edited drawer title also controls the body task.
  const family = /考什么|考哪些|笔试内容|备考内容|复习内容|备考方向|复习方向/.test(plan.noteTitle || '') ? 'scope' : plan.titleFamily
  const scopes = (plan.examScope || []).join('、')
  const contracts = {
    scope: ['笔试内容拆解', '笔试准备哪些具体内容？', '先回答科目与学习内容，再简短说明如何准备', `依次展开${scopes}，每项给具体学习内容；资料用途最多一句，不得占主体`],
    guide: ['科目备考攻略', '各科目怎样准备？', '科目各有准备方法', `围绕${scopes}给具体准备安排，禁止全文只写资料分类`],
    focus: ['科目重点梳理', '各方向重点准备什么？', '明确学习内容与相应练习动作', `具体展开${scopes}的学习重点，不虚构官方高频考点`],
    practice: ['分科刷题路线', '不同科目怎样刷题？', '按科目讲练习动作，资料辅助', `结合${scopes}讲刷题安排，不要只介绍三类资料用途`],
    thinking: ['作答方法', '题目怎样读和怎样作答？', '解释具体作答动作', `围绕允许科目讲读题、判断或计算方法，不编造实际题目`],
    review: ['分科复盘', '各科练习后怎样补？', '不同科目对应不同补习动作', `联系${scopes}给出具体薄弱内容与补习方式，不能只写记录错误原因`],
  }
  const contract = contracts[family]
  if (contract && !plan.studyDays) {
    plan = { ...plan, contentAngleName: contract[0], readerQuestion: contract[1], examDirection: scopes,
      coreViewpoint: contract[2], practicalDeliverable: contract[3], bodyStructureName: '先回答标题，再分科展开',
      bodyStructureInstruction: '开头两句直接回答标题；主体按允许的科目分别展开具体内容和学习动作；结尾可短句结束。',
      openingInstruction: '直接进入单位笔试与具体科目，禁止以很多人、资料散、形成合力等通用铺垫开场。',
      endingInstruction: '讲完即结束，不用现在回顾一下、你有没有等反问收尾。' }
  }
  const emojiInstruction = [
    '全文不使用表情符号。',
    '全文最多使用1个表情符号。',
    '全文最多使用2个表情符号，且不能连续出现。',
    '可以使用少量清单图标，但不要每段都使用相同图标。',
  ][plan.emojiLevel] || '全文不使用表情符号。'

  return [
    '请根据下面的内容规划，创作一篇新的小红书笔记正文。',
    '不要模仿任何既有成品文章，不得套用固定开头、固定清单和资料推荐结尾。',
    '',
    '【本篇内容规划】',
    `正文开头第一段必须自然写出完整单位名称“${detail?.company_name || ''}”，明确是准备该单位的笔试，不能只在标题提及单位。后文按需提及，不要反复堆叠名称。`,
    `内容角度：${plan.contentAngleName}`,
    `需要解决的问题：${plan.readerQuestion}`,
    `允许的备考方向：${(plan.examScope || []).join('、')}`,
    `本篇只展开：${plan.examDirection || ''}`,
    `核心观点：${plan.coreViewpoint || ''}`,
    `必须提供的实用内容：${plan.practicalDeliverable || ''}`,
    `已配置资料类型：${(plan.availableMaterials || []).join('、') || '未确认，不宣称商品包含任何特定资料'}`,
    plan.studyDays ? `本篇写${plan.studyDays}天冲刺方案，天数仅是复习周期建议，不表示考试即将开始，不说三天足够、保证通过或保证分数。` : '',
    '【正文质量要求】以科目拆解、刷题路线或资料用途为主线，开头直接进入企业备考场景。口吻干脆自然，短段落，适量表情，不写成通用学习方法说明书。',
    '不要编造学习禁忌，例如“回忆题和模拟卷不能同一天刷”。不写形成合力、实质性推进、发挥作用等空泛表达。',
    '明确写刷历年回忆题、翻学习资料、练薄弱模块、做模拟卷；避免“选一组企业笔试练习、处理一项、留下判断依据、完成标志、适用场景、限制”等生硬表达。资料动作仅限已配置类型。',
    '允许范围包含公基时讲知识框架、易混内容与练习；包含行测时可讲言语、判断、数量、资料分析的分模块练习；包含企业文化时讲企业概况、业务介绍、文化表述的阅读整理，不编造具体企业事实。',
    '文章必须有主次：科目拆解型分别介绍方向；刷题路线型突出资料使用顺序；资料用途型解释每类资料作用；单科型详细讲一个科目。不要每篇都重复同一套三条通用建议。',
    `标题表达方向：${plan.titlePhrase || ''}。正文必须回应标题；涉及备考攻略、复习重点时围绕本篇笔试方向给出具体建议。`,
    '标题中的答题思路仅指方法指导，不得编造实际试题解析、题库内容、官方考情或提分效果。',
    plan.examScopeSource === 'fallback' ? '上述方向来自商品类型的默认备考建议，不得称为已确认的官方考试范围。' : '以上范围来自商品详情填写的笔试内容，不得自行增加其他科目。',
    '正文不得读取、引用或描述网盘目录、文件名、截图或试题的具体内容；只根据本次笔试方向关联生成。',
    '示例必须标注为示例，不编造企业事实、考试题目、法规政策结论、经历和考生反馈。',
    '整篇围绕一个问题交付指定方法，不要反复写成多看资料、多刷题、及时复盘的通用三条建议。',
    `正文结构：${plan.bodyStructureName}。${plan.bodyStructureInstruction}`,
    `开头方式：${plan.openingStrategyName}。${plan.openingInstruction}`,
    `结尾方式：${plan.endingStrategyName}。${plan.endingInstruction}`,
    `语言风格：${plan.toneStrategyName}。${plan.toneInstruction}`,
    `篇幅要求：${plan.minLength}至${plan.maxLength}字。`,
    emojiInstruction,
    '',
    '【笔记标题】',
    plan.noteTitle,
    '',
    '【只能使用的已确认信息】',
    ...(plan.verifiedFacts.length ? plan.verifiedFacts : ['暂无明确考试范围，只能提供通用资料使用和复习方法。']),
    '',
    '【事实约束】',
    '不能虚构考试时间、倒计时、招聘岗位、题量、分值、难度、通过率、高分、必考内容或亲身上岸经历。',
    '未确认的科目不得自行补充；商品标注为回忆题时统一写“历年回忆题”；不承诺提分、进面或通过。',
    '',
    '【商品价值保护要求】',
    '学习资料目录、历年回忆题目录、模拟题目录都是商品的重要内容和卖点，必须使用中性或积极的方式介绍各自用途。',
    '不得把这些资料描述为低效、无效、不可靠、不能代表考试、与实际方向不一致或不值得使用。',
    '不得写“回忆题不等同于官方真题”“模拟题与实际考查方向未必一致”“不要把资料当考试范围”等削弱商品价值的表述。',
    '不得出现“考生考后整理”“考后回忆整理”“凭记忆还原”“非官方原题”“非官方真题”等来源免责声明。',
    '不得讨论回忆题是否官方、是否原题、是否准确或是否可靠；只说明它适合用于了解题目表达、整理练习线索和复盘。',
    '模拟题应描述为练习、检验掌握情况和复盘方法的工具，不得用转折句否定其价值。',
    '',
    '【去同质化要求】',
    '不要使用“宝子看过来、后台被问麻了、救命、冲就完事了、稳稳上岸、资料都整理好了、少走弯路”等批量营销表达。',
    '不要以“需要的直接拿走、祝大家顺利上岸、抓紧冲”等方式结尾。',
    '只输出正文，不重复标题，不包含关注、私信、加联系方式等引流内容。',
    previousDraft ? `上一版未通过内容检查，请彻底改变句式和表达，并严格遵守商品价值保护要求，不要复用以下文本：\n${previousDraft}` : '',
    '',
    `企业名称：${detail?.company_name || ''}`,
  ].filter(Boolean).join('\n')
}

const PRODUCT_VALUE_RISK_PATTERNS = [
  /考生.{0,6}考后.{0,8}整理/,
  /考后.{0,8}(?:回忆|记忆).{0,8}整理/,
  /(?:凭|根据).{0,6}记忆.{0,8}(?:还原|整理)/,
  /非官方.{0,8}(?:原题|真题|题目|资料)/,
  /回忆题.{0,18}(?:不等同|不是|并非).{0,10}(?:官方)?真题/,
  /回忆题.{0,18}(?:不准确|不可靠|可信度|仅供参考)/,
  /模拟题.{0,20}(?:未必|不一定|不能|无法).{0,12}(?:一致|代表|反映|考试方向|考查方向)/,
  /(?:学习资料|资料目录|回忆题|模拟题).{0,30}(?:全当|当成).{0,12}(?:考试范围|实际范围)/,
  /不加区分.{0,30}(?:学习资料|资料目录|回忆题|模拟题)/,
  /不要.{0,12}(?:依赖|迷信|只看).{0,12}(?:回忆题|模拟题|资料目录)/,
  /(?:回忆题|模拟题|资料目录).{0,18}(?:低效|无效|没用|意义不大|与考试无关)/,
]

export function assessProductValueRisk(body) {
  const text = String(body || '').replace(/\s+/g, '')
  const matchedPattern = PRODUCT_VALUE_RISK_PATTERNS.find(pattern => pattern.test(text))
  return { rejected: Boolean(matchedPattern), matchedPattern: matchedPattern?.source || '' }
}

export function normalizeForSimilarity(text, companyName = '') {
  let result = String(text || '').toLowerCase()
  if (companyName) result = result.split(String(companyName).toLowerCase()).join('')
  return result.replace(/[\s\p{P}\p{S}]+/gu, '').replace(/\d+/g, '#')
}

function ngramSet(text, size = 3) {
  const value = normalizeForSimilarity(text)
  const set = new Set()
  for (let i = 0; i <= value.length - size; i++) set.add(value.slice(i, i + size))
  return set
}

export function textSimilarity(a, b) {
  const aSet = ngramSet(a)
  const bSet = ngramSet(b)
  if (!aSet.size || !bSet.size) return 0
  let intersection = 0
  aSet.forEach(value => { if (bSet.has(value)) intersection++ })
  return intersection / (aSet.size + bSet.size - intersection)
}

export function assessDiversityRisk({ title, body, companyName = '', plan }, entries = [], level = 'extreme') {
  let maxTitleSimilarity = 0
  let maxBodySimilarity = 0
  let maxOpeningSimilarity = 0
  let maxEndingSimilarity = 0
  const normalizedTitle = normalizeForSimilarity(title, companyName)
  for (const entry of entries.slice(-200)) {
    maxTitleSimilarity = Math.max(maxTitleSimilarity, textSimilarity(normalizedTitle, normalizeForSimilarity(entry.title, entry.companyName)))
    maxBodySimilarity = Math.max(maxBodySimilarity, textSimilarity(body, entry.body))
    maxOpeningSimilarity = Math.max(maxOpeningSimilarity, textSimilarity(String(body).slice(0, 80), String(entry.body || '').slice(0, 80)))
    maxEndingSimilarity = Math.max(maxEndingSimilarity, textSimilarity(String(body).slice(-80), String(entry.body || '').slice(-80)))
  }
  const structureMatches = entries.slice(-80).filter(entry => entry.plan &&
    entry.plan.bodyStructure === plan.bodyStructure &&
    entry.plan.openingStrategy === plan.openingStrategy &&
    entry.plan.endingStrategy === plan.endingStrategy).length
  const threshold = level === 'extreme' ? { title: .48, body: .42, edge: .52 } : level === 'high' ? { title: .58, body: .52, edge: .62 } : { title: .68, body: .62, edge: .72 }
  // 正文可以在当前计划下自动重写；标题与结构风险用于评分和提示，避免因固定计划造成无效重复重试。
  const rejected = maxBodySimilarity >= threshold.body || maxOpeningSimilarity >= threshold.edge || maxEndingSimilarity >= threshold.edge
  const score = Math.round(Math.max(maxTitleSimilarity, maxBodySimilarity, maxOpeningSimilarity * .9, maxEndingSimilarity * .9) * 100)
  return {
    rejected,
    level: rejected ? 'high' : score >= 35 ? 'medium' : 'low',
    score,
    maxTitleSimilarity,
    maxBodySimilarity,
    maxOpeningSimilarity,
    maxEndingSimilarity,
    structureMatches,
  }
}

export function loadDiversityHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendDiversityHistory(entry) {
  try {
    const history = loadDiversityHistory()
    history.push({ ...entry, createdAt: Date.now() })
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)))
  } catch {}
}

export function formatPlanSummary(plan) {
  return `${plan.contentAngleName} / ${plan.titleStrategyName} / ${plan.bodyStructureName} / ${plan.lengthBandName}`
}
