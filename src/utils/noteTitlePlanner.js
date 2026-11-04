const GROUPS = [
  ['guide',['备考攻略','备考攻略全梳理','备考从这里开始','这份备考攻略收好','备考指南','准备笔试看这篇','备考思路整理','先看这份备考说明','备考安排怎么做','备考这样起步','学习路线梳理','备考攻略速看']],
  ['focus',['重点梳理','复习重点速看','重点内容整理','复习先抓什么','学习重点怎么理','复习要点梳理','这些重点先理清','重点内容怎么学','复习思路速看','备考重点看这里','复习方向梳理','先把重点理清']],
  ['scope',['笔试考什么内容','考什么先了解','备考方向先理清','复习内容怎么选','先了解备考内容','笔试内容怎么准备','备考内容梳理','这些方向怎么准备','复习内容速览']],
  ['practice',['备考直接刷','刷题攻略','刷题从哪里开始','练习顺序怎么排','这样刷题更清楚','刷题前先看这篇','刷题后记什么','练习重点整理','一轮练习怎么做','刷题思路梳理']],
  ['thinking',['答题思路解析','答题思路梳理','做题先想哪一步','答题从哪里入手','犹豫题怎么处理','解题思路怎么理','做题思路看这里','作答前先理思路','答题方法整理','读题思路拆解']],
  ['review',['错题怎么复盘','二刷先看什么','复盘重点速看','答对也要留意什么','刷完以后做什么','错题原因怎么找','复习记录怎么做','复盘攻略','练完这一轮再看','第二轮复习攻略']],
  ['overview',['这篇先帮你理清','备考先看这一篇','一篇理清备考思路','看这篇了解怎么学','这份攻略先收藏','备考疑问一起理清','给大家讲讲怎么准备','给大家梳理复习方向']],
  ['analysis',['附答题解析','题目与解析怎么用','答题解析怎么看','看解析别漏这一步','解析配合练习怎么用']],
  ['bank',['高频题库','高频题库怎么刷','题库练习攻略','刷题重点速看']],
  ['intensity',['给大家普及笔试强度','笔试强度怎么看','练习节奏怎么安排']],
]

export function chooseNoteTitle(company, detail, topic, batch, history, shuffle) {
  const name=String(company||'企业').trim()
  const facts=String(detail.written_exam_content||'')
  const allowed=GROUPS.filter(([id])=>id!=='analysis'&&id!=='bank'&&id!=='intensity' || id==='analysis'&&/解析/.test(facts) || id==='bank'&&/高频.*题库|题库.*高频/.test(facts) || id==='intensity'&&/难度|强度/.test(facts))
  const preferred={concept:'focus',compare:'focus',memory:'guide',reading:'guide',practice:'practice',reason:'thinking',diagnose:'review',review:'review',second:'review',connect:'practice',check:'focus',split:'guide',culture:'scope',situation:'thinking'}[topic.learningTask]
  let options=allowed.flatMap(([family,phrases])=>phrases.flatMap(phrase=>[
    {title:`${name}笔试，${phrase}`,family,phrase},
    {title:`${name}笔试｜${phrase}`,family,phrase},
    ...(['guide','focus'].includes(family)?[{title:`${name}备考，${phrase}`,family,phrase}]:[]),
  ])).filter(x=>Array.from(x.title).length<=20)
  if (topic.studyDays) {
    options = [`${name}笔试，${topic.studyDays}天冲刺方案`, `${name}笔试｜${topic.studyDays}天复习计划`, `${name}备考，${topic.studyDays}天安排`]
      .filter(title=>Array.from(title).length<=20)
      .map(title=>({title,family:'sprint',phrase:`${topic.studyDays}天冲刺方案`}))
  }
  // Never invent an abbreviation or cut a sentence to fit a long company name.
  if(!options.length) options=[{title:`${name}笔试`,family:'identity',phrase:'笔试'}].filter(x=>Array.from(x.title).length<=20)
  if(!options.length) throw new Error('企业名称过长，请设置准确的企业简称后生成20字以内标题')
  const recent=history.slice(-150)
  options=shuffle(options).map(x=>({...x,score:
    batch.filter(p=>p.noteTitle===x.title).length*10000+
    batch.filter(p=>p.titlePhrase===x.phrase).length*1000+
    recent.filter(e=>e.title===x.title).length*100+
    recent.filter(e=>e.plan?.titlePhrase===x.phrase).length*25+
    batch.filter(p=>p.titleFamily===x.family).length*2+(x.family===preferred?0:5),
  })).sort((a,b)=>a.score-b.score)
  return options[0]
}
