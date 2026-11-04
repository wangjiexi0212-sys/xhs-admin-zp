const START = '【同风格装饰变化开始】'
const END = '【同风格装饰变化结束】'
const bags = new Map()

export function varyCoverDecoration(prompt) {
  let base = String(prompt || '')
  const start = base.indexOf(START)
  if (start >= 0) {
    const end = base.indexOf(END, start)
    if (end >= 0) base = base.slice(0, start) + base.slice(end + END.length)
  }
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
