export function resolveExamScope(detail = {}) {
  const configured = String(detail.written_exam_content || '').trim()
  const type = String(detail.job_type_name || '')
  if (configured) return { source: 'configured', directions: configured.split(/[、，,；;\n]+/).map(s => s.trim()).filter(Boolean) }
  if (/社区工作|社工/.test(type + String(detail.company_name || ''))) return { source: 'fallback', directions: ['社区工作专业知识和实务', '公共基础知识', '行政能力测试', '综合能力测验'] }
  if (/国企|央企|国有|中央企业/.test(type)) return { source: 'fallback', directions: ['综合基础知识', '企业文化'] }
  return { source: 'fallback', directions: ['综合基础知识'] }
}

// Each task supplies a different concrete deliverable, rather than synonyms for a generic guide.
const TASKS = [
  ['concept','概念理解','怎样理解一个新概念？','定义之外还要记录适用条件','一份概念、条件、区别三栏笔记示例','single_deep_dive'],
  ['compare','易混内容对照','相近内容怎样区分？','把区别并排比较比孤立摘抄更清楚','一个明确标注为示例的对照整理方法','positive_negative'],
  ['memory','回看安排','看过后怎样安排回看？','回看应检查能否独立解释','一套阅读后合上资料自述的流程','three_steps'],
  ['reading','阅读提问','阅读时该抓住什么？','带着一个问题阅读更方便检查理解','三个阅读前后可以使用的自查问题','three_qa'],
  ['practice','练习过程','怎样完成一次完整练习？','作答判断与核对依据都要留下记录','一份练习前、练习中、练习后的动作说明','three_steps'],
  ['reason','判断依据','怎样把判断过程写清楚？','记录选择依据也记录排除理由','一个判断依据记录示例，不虚构实际考题','usage_manual'],
  ['diagnose','错误原因诊断','答错以后先检查什么？','没理解、没记住和没读清需要分别处理','三类原因各配一个检查动作','three_item_list'],
  ['review','复盘整理','核对以后还要做什么？','错误原因应对应下一次学习动作','原因、动作、完成标志的复盘示例','problem_reason_solution'],
  ['second','再次练习','第二遍先看什么？','再次练习先检验上次未解决的问题','一份回看问题并检查是否解决的短流程','four_steps'],
  ['connect','阅读练习衔接','阅读和练习怎样衔接？','练习发现的问题可以成为下一次阅读任务','从问题到阅读再到复练的具体操作','three_steps'],
  ['check','掌握情况自查','熟悉和理解怎样区分？','能独立解释条件和区别才方便检验理解','五个不同层次的自查问题','five_item_check'],
  ['split','学习任务拆分','内容零散时怎么开始？','把任务拆成可完成且有结果的一小步','三项任务及各自完成标志','three_item_list'],
  ['culture','企业文化信息整理','企业文化怎样分类阅读？','企业介绍、业务信息和文化表述分别归纳','一份分类阅读框架，不编造企业事实','usage_manual'],
  ['situation','情境分析','读完情境后从哪里分析？','先分开已知信息、待解决问题和个人判断','一份明确标注为假设情境的三栏记录示例','single_deep_dive'],
]

export function chooseExamTopic(detail, batchPlans, history, shuffle) {
  const scope = resolveExamScope(detail)
  const options = scope.directions.flatMap(direction => TASKS.filter(task => {
    if (task[0] === 'culture') return /企业文化/.test(direction)
    if (task[0] === 'situation') return /社区|实务|综合能力/.test(direction)
    if (/企业文化/.test(direction)) return ['reading','memory','split','check','concept'].includes(task[0])
    return true
  }).map(task => ({ direction, task, key: `${direction}:${task[0]}` })))
  const recent = history.slice(-120).map(entry => entry.plan || {})
  const ranked = shuffle(options).map(option => ({ ...option, score:
    batchPlans.filter(p => p.topicKey === option.key).length * 1000 +
    batchPlans.filter(p => p.learningTask === option.task[0]).length * 30 +
    recent.filter(p => p.topicKey === option.key).length * 25 +
    recent.filter(p => p.learningTask === option.task[0]).length * 3,
  })).sort((a,b) => a.score-b.score)
  const selected = ranked[0], [id,name,question,viewpoint,deliverable,structure] = selected.task
  return { examScope: scope.directions, examScopeSource: scope.source, examDirection: selected.direction,
    topicKey: selected.key, learningTask: id, coreViewpoint: viewpoint, practicalDeliverable: deliverable,
    angle: { id: selected.key, name: `${selected.direction}·${name}`, main: name, question, need: 'any' }, structure }
}
