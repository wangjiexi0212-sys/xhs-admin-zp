// 按北京时间的自然日计算；不从商品标题或报名时间推断考试日期。
export function getExamStudyWindow(value, now = new Date()) {
  const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = name => Number(todayParts.find(item => item.type === name)?.value)
  const yearNow = part('year')
  const today = Date.UTC(yearNow, part('month') - 1, part('day'))
  const text = String(value || '').trim()
  // 区间、多日期或待定不猜测，避免把多个场次误认为一个确定日期。
  if (!text || /待定|另行通知|暂未|未定|预计|左右|至|到|~|～|—/.test(text)) return { status: 'unknown' }
  const full = [...text.matchAll(/(?<!\d)(\d{4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})(?:日|号)?/g)]
  const monthDay = [...text.matchAll(/(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/g)]
  if (full.length > 1 || (!full.length && monthDay.length !== 1) || (full.length && monthDay.length > 1)) return { status: 'unknown' }
  const explicitYear = full.length === 1
  const match = explicitYear ? full[0] : monthDay[0]
  let year = explicitYear ? Number(match[1]) : yearNow
  const month = Number(match[explicitYear ? 2 : 1])
  const day = Number(match[explicitYear ? 3 : 2])
  const makeDate = y => {
    const date = new Date(Date.UTC(y, month - 1, day))
    return date.getUTCFullYear() === y && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() : NaN
  }
  let exam = makeDate(year)
  if (!Number.isFinite(exam)) return { status: 'unknown' }
  if (!explicitYear && exam < today) {
    year += 1
    exam = makeDate(year)
    if (!Number.isFinite(exam)) return { status: 'unknown' }
  }
  const days = Math.round((exam - today) / 86400000)
  return { status: days < 0 ? 'past' : 'upcoming', days, examDate: `${year}年${month}月${day}日`, inferredYear: !explicitYear }
}

export function buildExamStudyWindowPrompt(value, now = new Date()) {
  const window = getExamStudyWindow(value, now)
  const common = '报名时间不得用于计算备考天数或替代笔试时间；只围绕商品明确的笔试内容安排复习。'
  if (window.status === 'unknown') return `【备考时间规则】笔试日期不明确或无法可靠解析。不得编造考试日期、真实倒计时或假定距离考试还有几天；提供不绑定实际日期的通用建议。${common}`
  if (window.status === 'past') return `【备考时间规则】商品填写的笔试日期 ${window.examDate} 已过，请提醒核对最新通知；不得生成未来倒计时或假设新的考试日期，提供不绑定日期的复习建议。${common}`
  const timing = window.days === 0 ? '笔试日期为今天，剩余自然日为0天，只安排考前准备与状态调整，不安排跨天计划。' : `距笔试还有 ${window.days} 个自然日（不含今天、含考试日）。备考任务只能安排在今天至笔试前，不能超过考试日期。`
  return `【备考时间规则】北京时间今天为生成日；商品笔试日期为 ${window.examDate}${window.inferredYear ? '（商品未写年份，按当前年份及未来日期规则推算，请以公告为准）' : ''}。${timing}必须根据剩余时间分配任务：时间短时精简为重点回顾、错题及考前准备，时间充足时再安排基础、专项训练和复盘；三页可以是不同任务视角，不得强行虚构三个跨天阶段。不得把建议复习周期当作真实倒计时，不得编造其他日期。${common}`
}
