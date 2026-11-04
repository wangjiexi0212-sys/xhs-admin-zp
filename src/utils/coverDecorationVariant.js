const START = '【同风格装饰变化开始】'
const END = '【同风格装饰变化结束】'
const bags = new Map()

export function varyCoverDecoration(prompt, level = 'standard') {
  let base = String(prompt || '')
  const start = base.indexOf(START)
  if (start >= 0) {
    const end = base.indexOf(END, start)
    if (end >= 0) base = base.slice(0, start) + base.slice(end + END.length)
  }
  return buildVisualPrompt(base, level)
}

function take(key, values) {
  let bag = bags.get(key) || []
  if (!bag.length) {
    bag = [...values]
    for(let i=bag.length-1;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=n[0]%(i+1);[bag[i],bag[j]]=[bag[j],bag[i]]}
  }
  const value=bag.pop();bags.set(key,bag);return value
}
function buildVisualPrompt(base, level) {
  const mode=['light','standard','deep'].includes(level)?level:'standard'
  const cartoon=/卡通|线稿|手绘|矢量|扁平|cartoon|vector|doodle/i.test(base)&&!/书籍|书脊|档案|正式|editorial/i.test(base)
  const family=cartoon?'illustration':'editorial'
  const palette=take(family+':palette',['奶油背景、米白卡片、墨绿主字、砖红强调','浅蓝背景、白色卡片、藏蓝主字、橙色强调','米白背景、白色卡片、近黑主字、酒红强调','浅黄背景、白色卡片、深棕主字、蓝色强调','浅灰背景、白色卡片、深灰主字、深绿强调','浅紫灰背景、米白卡片、深紫主字、赭黄强调'])
  const subject=take(family+':subject',cartoon?['男生翻书与书签','女生写笔记与铅笔','戴眼镜小熊抱书','小狗写笔记','企鹅指向无字黑板','书本文具静物']:['书本与铅笔静物','资料夹与书签静物','圆角几何图案','书页与细线图形'])
  const layout=mode==='deep'?take(family+':layout',['企业名左对齐、主体右下','企业名居中、主体位于底部','上部标题色块、下部主体场景','企业名占上半部、底部双小插画']):'保留原主构图和文字位置'
  const decoration=take(family+':decor',['空心圆与圆点','小型放射线与圆角几何','小型书签与短线','几何角标与细分隔线'])
  const lines=[
    '以下仅是绘图控制指令，严禁画成文字。先提取原模板全部可见文字，主标题、企业名称、年份、卖点、副标题、标点数字逐字锁定，不增删改写。',
    '保留设计语言、插画技法、描边方式、字体气质、信息层级、画幅与安全边距。照片、3D、渐变、材质等原有禁止项继续有效，品牌标识与有身份意义的主体不得替换。',
    `完整配色方案：${palette}，装饰使用同色系。只替换原有区域的颜色，保持清晰对比，不为配色增加新的卡片。`,
    mode==='light'?'保留原主体、动作与道具，仅调整配色和小装饰。':`替换非品牌装饰主体为：${subject}，沿用原有插画技法。模板无主体或禁止插画时不新增角色，仅变化已有几何图形。`,
    `构图方案：${layout}。企业名称与笔试始终最醒目。`,
    `装饰方案：${decoration}，与主体和色板协调，不兼容则省略。装饰避开文字，书本、衣物、道具与黑板保持无字无标识。`,
    '重组视觉指令时，以本方案替换原模板的颜色、非品牌角色及动作道具；只有深度档替换布局位置。不要同时执行冲突的新旧视觉设定，文字锁定及原有禁止项优先。',
  ]
  return `${base.trim()}\n\n${START}\n${lines.join('\n')}\n${END}`
}

function legacyDecoration(base) {
  const family = /线稿|涂鸦|手绘|doodle/i.test(base) ? 'doodle' : /矢量|扁平|卡通|vector|emoji/i.test(base) ? 'flat' : /纸|便签|手账|笔记|memo|notebook/i.test(base) ? 'paper' : 'minimal'
  const elements = {
    doodle: ['小型手绘星芒与短线','单个空心圆与两条手绘短线','小型闪光线与圆点','短虚线弧与小型空心星'],
    flat: ['小型圆点与扇形几何','两个圆角几何片','小型空心圆与短色条','小型放射线与三角几何'],
    paper: ['窄纸胶带与小圆点','小型回形针与纸页折角','纸边短虚线与单个圆点','窄便签角与小型线条'],
    minimal: ['两条短线与单个圆点','单个空心圆与细分隔线','小型几何角标','两枚小型圆角色块'],
  }[family]
  let bag = bags.get(family) || []
  if (!bag.length) {
    bag = Array.from({length:12},(_,i)=>i)
    for(let i=bag.length-1;i>0;i--){const values=new Uint32Array(1);crypto.getRandomValues(values);const j=values[0]%(i+1);[bag[i],bag[j]]=[bag[j],bag[i]]}
  }
  const variant=bag.pop();bags.set(family,bag)
  const location=['右上与左下留白角落','左上与右下留白角落','侧边与底部留白区域'][Math.floor(variant/4)]
  return `${base.trim()}\n\n${START}\n以下仅为绘图控制指令，严禁画成文字。\n锁定原提示词全部可见文字：主标题、企业名称、年份、副标题、卖点、标点和数字逐字保持，不增删、不改写、不新增文字。\n锁定原有风格、配色、字体、文字层级、主构图、人物和核心插画，仅变化非语义小装饰。\n在${location}尝试使用${elements[variant%4]}，仅使用原有色板与描边方式，总计2至4个小装饰，占画面不超过5%。\n只选择与原风格兼容且原提示词允许的装饰；不兼容时仅移动或调整原有装饰，不强加新元素。无可用留白时省略装饰。\n所有装饰避开文字与阅读安全区，不遮字，不用字母、数字、标签或水印作为装饰。模板明确禁止的材质、渐变、立体效果仍禁止。\n${END}`
}
