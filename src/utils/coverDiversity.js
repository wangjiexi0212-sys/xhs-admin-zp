const COVER_HISTORY_KEY = 'xhs-cover-diversity-history-v1'
const COVER_HISTORY_LIMIT = 200

const FAMILY_RULES = [
  ['ios_notes', /iOS|Apple Notes|手机备忘录|备忘录截图/i],
  ['clipboard', /剪贴板|clipboard/i],
  ['browser_ui', /浏览器|browser|Windows弹窗|桌面UI/i],
  ['memo_card', /Notebook Memo Card|信息卡片|信息卡|圆角卡片/i],
  ['sticky_note', /便签|手账卡片|便利贴|memo style/i],
  ['graph_paper', /方格纸|网格纸|graph paper|grid/i],
  ['lined_note', /横线笔记纸|lined paper|笔记线/i],
  ['emoji_poster', /Emoji大字报|Emoji备考|emoji/i],
  ['paper_collage', /褶皱纸|不规则纸张|贴纸告示|纸张告示|纸胶带|washi tape/i],
  ['stationery', /办公文具|stationery|文具拟物/i],
  ['typography', /大字报|typography poster|超大中文/i],
]

const PALETTE_RULES = [
  ['red', /红色|鲜红|#D[0-9A-F]{5}|#F[0-9A-F]{5}/i],
  ['blue', /蓝色|蓝白|浅蓝|深蓝|#(?:[0-5][0-9A-F]){2}F[0-9A-F]{3}/i],
  ['green', /绿色|薄荷绿|深绿|#00[0-9A-F]{4}|#(?:[0-9A-F]{2}){2}(?:5[0-9A-F]|6[0-9A-F])/i],
  ['yellow', /黄色|奶黄|金黄|荧光笔|#F(?:F|E|D)[0-9A-F]{4}/i],
  ['pink', /粉色|粉紫|玫红|#E[0-9A-F]{5}/i],
  ['black_white', /黑白|黑色.*白色|白色.*黑色/i],
  ['beige', /米白|暖白|奶油|象牙|ivory|beige/i],
]

function firstMatch(text, rules, fallback) {
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || fallback
}

function inferLayout(text) {
  if (/左右分栏|双栏|左右两栏|split/i.test(text)) return 'split'
  if (/左对齐|左侧起始|靠左/i.test(text)) return 'left'
  if (/右对齐|靠右/i.test(text)) return 'right'
  if (/居中|中心构图|水平居中/i.test(text)) return 'center'
  return 'free'
}

function inferIllustration(text) {
  if (/猫咪|猫猫|猫/i.test(text)) return 'cat'
  if (/Emoji|表情符号|表情包/i.test(text)) return 'emoji'
  if (/女生|女孩|女性人物/i.test(text)) return 'female_student'
  if (/男生|男学生|男孩/i.test(text)) return 'male_student'
  if (/人物|学生|卡通人|Q版/i.test(text)) return 'character'
  if (/书本|文件夹|试卷|文具|剪贴板/i.test(text)) return 'object'
  return 'none'
}

function inferTypography(text) {
  if (/毛笔|书法|brush|行楷/i.test(text)) return 'brush'
  if (/手写|handwritten|涂鸦/i.test(text)) return 'handwritten'
  if (/超粗|粗黑|Heavy|大字报|oversized/i.test(text)) return 'heavy'
  return 'standard'
}

export function classifyCoverPrompt(prompt) {
  const content = String(prompt?.content || '')
  // 生产模板的负面约束会枚举大量“不允许出现”的风格词，不能把这些词误判成模板特征。
  const positiveContent = content.split(/(?:负面(?:风格)?约束|Negative (?:Style )?Constraints|严格禁止)/i)[0]
  const heading = `${prompt?.name || ''}\n${prompt?.description || ''}\n${positiveContent.slice(0, 500)}`
  const text = `${heading}\n${positiveContent}`
  const palettes = PALETTE_RULES.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
  return {
    promptId: Number(prompt?.id) || 0,
    promptName: String(prompt?.name || ''),
    family: firstMatch(heading, FAMILY_RULES, firstMatch(text, FAMILY_RULES, 'editorial')),
    layout: inferLayout(text),
    palette: palettes.slice(0, 3).sort().join('+') || 'neutral',
    illustration: inferIllustration(text),
    typography: inferTypography(text),
  }
}

export function loadCoverDiversityHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(COVER_HISTORY_KEY) || '[]')
    return Array.isArray(value) ? value.slice(-COVER_HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

export function appendCoverDiversityHistory(entry) {
  try {
    const history = loadCoverDiversityHistory()
    history.push({ ...entry, createdAt: Date.now() })
    localStorage.setItem(COVER_HISTORY_KEY, JSON.stringify(history.slice(-COVER_HISTORY_LIMIT)))
  } catch { /* localStorage 不可用时不阻断生成 */ }
}

export function calculateCoverDHash(base64) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 9
        canvas.height = 8
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(image, 0, 0, 9, 8)
        const pixels = ctx.getImageData(0, 0, 9, 8).data
        let hash = ''
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const left = (y * 9 + x) * 4
            const right = left + 4
            const leftGray = pixels[left] * 0.299 + pixels[left + 1] * 0.587 + pixels[left + 2] * 0.114
            const rightGray = pixels[right] * 0.299 + pixels[right + 1] * 0.587 + pixels[right + 2] * 0.114
            hash += leftGray > rightGray ? '1' : '0'
          }
        }
        resolve(hash)
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => reject(new Error('封面感知哈希计算失败'))
    image.src = `data:image/jpeg;base64,${base64}`
  })
}

export function assessCoverHashSimilarity(hash, history = loadCoverDiversityHistory()) {
  if (!hash || hash.length !== 64) return { similar: false, similarity: 0, match: null }
  let best = { similarity: 0, match: null }
  history.slice(-80).forEach(entry => {
    const previous = String(entry?.imageHash || '')
    if (previous.length !== hash.length) return
    let differences = 0
    for (let i = 0; i < hash.length; i++) {
      if (hash[i] !== previous[i]) differences++
    }
    const similarity = 1 - differences / hash.length
    if (similarity > best.similarity) best = { similarity, match: entry }
  })
  return { ...best, similar: best.similarity >= 0.86 }
}

function randomTie() {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1)
    globalThis.crypto.getRandomValues(value)
    return value[0] / 0xffffffff
  }
  return Math.random()
}

function repetitionScore(meta, batch, recent, level) {
  const historyWeight = level === 'extreme' ? 1 : level === 'high' ? 0.65 : 0.35
  let score = 0

  for (const item of batch) {
    if (item.promptId === meta.promptId) score += 1000
    if (item.family === meta.family) score += 120
    if (item.layout === meta.layout) score += 65
    if (item.palette === meta.palette) score += 45
    if (item.illustration === meta.illustration) score += 35
    if (item.typography === meta.typography) score += 20
  }

  recent.forEach((item, index) => {
    const decay = (index + 1) / Math.max(recent.length, 1)
    if (item.promptId === meta.promptId) score += 240 * decay * historyWeight
    if (item.family === meta.family) score += 55 * decay * historyWeight
    if (item.layout === meta.layout) score += 25 * decay * historyWeight
    if (item.palette === meta.palette) score += 18 * decay * historyWeight
    if (item.illustration === meta.illustration) score += 14 * decay * historyWeight
  })

  return score
}

export function assignCoverPrompts(productDetails, promptPools, level = 'extreme', history = loadCoverDiversityHistory()) {
  const recentWindow = level === 'extreme' ? 120 : level === 'high' ? 60 : 25
  const recent = history.slice(-recentWindow)
  const batch = []

  return productDetails.map(item => {
    const jobTypeId = Number(item?.detail?.job_type_id)
    const pool = (promptPools.get(jobTypeId) || []).filter(prompt => prompt?.status !== 0 && String(prompt?.content || '').trim())
    if (!pool.length) return null

    const ranked = pool.map(prompt => {
      const meta = classifyCoverPrompt(prompt)
      return { prompt, meta, score: repetitionScore(meta, batch, recent, level), tie: randomTie() }
    }).sort((a, b) => a.score - b.score || a.tie - b.tie)

    const selected = ranked[0]
    batch.push(selected.meta)
    return {
      id: selected.prompt.id,
      name: selected.prompt.name,
      content: selected.prompt.content,
      description: selected.prompt.description,
      sample_image: selected.prompt.sample_image,
      meta: selected.meta,
      alternatives: ranked.slice(1, 4).map(candidate => ({
        id: candidate.prompt.id,
        name: candidate.prompt.name,
        meta: candidate.meta,
      })),
    }
  })
}

export function formatCoverAssignment(assignment) {
  if (!assignment) return '未找到可用封面模板'
  const meta = assignment.meta
  return `模板 ${assignment.name || assignment.id}｜${meta.family}｜${meta.layout}｜${meta.palette}｜${meta.illustration}`
}
