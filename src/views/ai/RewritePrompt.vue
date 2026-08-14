<template>
  <div class="prompt-page">
    <div class="page-header">
      <div>
        <div class="page-title">提示词配置</div>
        <div class="page-desc">三段提示词均必填 · 影响改写结果</div>
      </div>
    </div>

    <div class="prompt-layout">
      <!-- 左侧：模板列表 -->
      <div class="template-list">
        <div
          v-for="tpl in templates"
          :key="tpl.id"
          class="template-item"
          :class="{ active: currentId === tpl.id }"
          @click="selectTemplate(tpl)"
        >
          <div class="tpl-dot" :class="tpl.is_system ? 'dot-red' : 'dot-gray'" />
          <div class="tpl-info">
            <div class="tpl-name">{{ tpl.name }}</div>
            <div class="tpl-sub">
              {{ tpl.type === 'link' ? '链接改写' : '看图配文案' }}
              · {{ currentId === tpl.id ? '当前' : '点击切换' }}
            </div>
          </div>
          <a-popconfirm
            v-if="!tpl.is_system"
            title="确定删除此模板？"
            ok-type="danger"
            ok-text="删除"
            @confirm.stop="onDelete(tpl.id)"
            @click.stop
          >
            <DeleteOutlined class="tpl-del" />
          </a-popconfirm>
        </div>

        <div class="template-add" @click="onAddTemplate">
          <PlusOutlined />
          <span>新建模板</span>
          <span class="add-limit">最多 5 个</span>
        </div>
      </div>

      <!-- 右侧：编辑区 -->
      <div v-if="form" class="template-editor">
        <!-- 模板名称 -->
        <div class="editor-header">
          <div class="editor-meta">
            <span class="meta-label">模板名称</span>
            <span class="meta-hint">系统默认也可改名（本次会话生效）</span>
          </div>
          <a-button
            v-if="currentTpl?.is_system"
            size="small"
            @click="onReset"
          >
            <ReloadOutlined />
            恢复系统默认
          </a-button>
        </div>
        <a-input
          v-model:value="form.name"
          placeholder="模板名称"
          :maxlength="40"
          class="name-input"
        />

        <!-- 类型 Tab -->
        <div class="type-tabs">
          <div
            class="type-tab"
            :class="{ active: form.type === 'link' }"
            @click="form.type = 'link'"
          >
            链接改写
          </div>
          <div
            class="type-tab"
            :class="{ active: form.type === 'image' }"
            @click="form.type = 'image'"
          >
            看图配文案
          </div>
        </div>

        <!-- 标题提示词 -->
        <div class="prompt-block">
          <div class="prompt-label">
            标题提示词
            <span class="required">*</span>
          </div>
          <a-textarea
            v-model:value="form.title_prompt"
            :rows="6"
            :maxlength="2000"
            show-count
            placeholder="在原始标题和正文基础上，改写 1 条小红书标题。"
          />
        </div>

        <!-- 正文提示词 -->
        <div class="prompt-block">
          <div class="prompt-label">
            正文提示词
            <span class="required">*</span>
          </div>
          <a-textarea
            v-model:value="form.content_prompt"
            :rows="6"
            :maxlength="2000"
            show-count
            placeholder="在原始标题和正文基础上，改写一篇小红书笔记正文。"
          />
        </div>

        <!-- 图片提示词 -->
        <div class="prompt-block">
          <div class="prompt-label">
            图片提示词
            <span class="required">*</span>
          </div>
          <a-textarea
            v-model:value="form.image_prompt"
            :rows="6"
            :maxlength="2000"
            show-count
            placeholder="基于输入图片进行轻度重绘，生成一张风格自然、适合小红书发布的新图。"
          />
        </div>

        <!-- 底部操作 -->
        <div class="editor-footer">
          <a-button @click="onCancel">取消</a-button>
          <a-button type="primary" :loading="saving" @click="onSave">
            <CheckOutlined />
            保存
          </a-button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="editor-empty">
        <div class="empty-icon">📝</div>
        <div>请从左侧选择或新建模板</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckOutlined,
} from '@ant-design/icons-vue'
import {
  getRewritePromptList,
  createRewritePrompt,
  updateRewritePrompt,
  deleteRewritePrompt,
  resetRewritePrompt,
} from '@/api/rewritePrompts'

// 系统默认提示词
const DEFAULT_TITLE_PROMPT = `在原始标题和正文基础上，改写 1 条小红书标题。

要求：
1. 保留原意和真实信息，不新增原文没有的数字、价格、地点、功效或体验
2. 总长度 15-30 字，尽量控制在 1 个句子
3. 可以使用情绪词、疑问句、反转句式增强吸引力
4. 不要使用与原标题完全相同的开头词
5. 只输出标题文本，不加引号、序号或额外说明`

const DEFAULT_CONTENT_PROMPT = `在原始标题和正文基础上，改写一篇小红书笔记正文。

要求：
1. 保留原意、关键细节和事实边界，不新增原文没有的品牌、价格、功效、数据或亲身体验
2. 总长度约为原文长度，最少 80 字，最多适当扩充至 400 字
3. 语气真实自然，行文像真实用户分享，不像广告或机器生成
4. 可以调整句式、段落顺序和情绪，但核心内容不能偏离
5. 结尾可加 3-5 个相关标签（#tag 形式）
6. 只输出正文内容，不加标题`

const DEFAULT_IMAGE_PROMPT = `基于输入图片进行轻度重绘，生成一张风格自然、适合小红书发布的新图。

要求：
1. 保持主体、产品、人物和核心构图基本不变
2. 可以调整色调、背景细节、光线感和氛围，让画面更清新、更有质感
3. 风格贴近小红书流行审美：明亮、干净、真实生活感
4. 不添加文字水印或 logo
5. 输出比例与原图一致`

// 系统默认模板数据（用于兜底/前端 mock）
const SYS_DEFAULTS = [
  {
    id: '__sys1__',
    name: '系统默认 1',
    type: 'link',
    is_system: true,
    title_prompt: DEFAULT_TITLE_PROMPT,
    content_prompt: DEFAULT_CONTENT_PROMPT,
    image_prompt: DEFAULT_IMAGE_PROMPT,
  },
  {
    id: '__sys2__',
    name: '系统默认 2',
    type: 'image',
    is_system: true,
    title_prompt: DEFAULT_TITLE_PROMPT,
    content_prompt: DEFAULT_CONTENT_PROMPT,
    image_prompt: DEFAULT_IMAGE_PROMPT,
  },
]

const templates = ref([])
const currentId = ref(null)
const saving = ref(false)

const form = reactive({
  name: '',
  type: 'link',
  title_prompt: '',
  content_prompt: '',
  image_prompt: '',
})
let originalForm = {}

const currentTpl = computed(() => templates.value.find(t => t.id === currentId.value))

async function load() {
  try {
    const list = await getRewritePromptList()
    templates.value = list?.length ? list : SYS_DEFAULTS
  } catch {
    templates.value = SYS_DEFAULTS
  }
  if (templates.value.length) selectTemplate(templates.value[0])
}

function selectTemplate(tpl) {
  currentId.value = tpl.id
  Object.assign(form, {
    name: tpl.name,
    type: tpl.type ?? 'link',
    title_prompt: tpl.title_prompt ?? '',
    content_prompt: tpl.content_prompt ?? '',
    image_prompt: tpl.image_prompt ?? '',
  })
  originalForm = { ...form }
}

function onCancel() {
  Object.assign(form, originalForm)
}

async function onSave() {
  if (!form.title_prompt.trim() || !form.content_prompt.trim() || !form.image_prompt.trim()) {
    message.warning('三段提示词均为必填')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim() || '未命名模板',
      type: form.type,
      title_prompt: form.title_prompt.trim(),
      content_prompt: form.content_prompt.trim(),
      image_prompt: form.image_prompt.trim(),
    }
    if (currentId.value && !String(currentId.value).startsWith('__')) {
      await updateRewritePrompt(currentId.value, payload)
      const idx = templates.value.findIndex(t => t.id === currentId.value)
      if (idx !== -1) templates.value[idx] = { ...templates.value[idx], ...payload }
    } else {
      const res = await createRewritePrompt(payload)
      templates.value.push(res)
      currentId.value = res.id
    }
    originalForm = { ...form }
    message.success('保存成功')
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onDelete(id) {
  try {
    await deleteRewritePrompt(id)
    const idx = templates.value.findIndex(t => t.id === id)
    templates.value.splice(idx, 1)
    if (currentId.value === id) {
      if (templates.value.length) selectTemplate(templates.value[0])
      else currentId.value = null
    }
    message.success('删除成功')
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

async function onReset() {
  Modal.confirm({
    title: '恢复系统默认',
    content: '将把三段提示词恢复为系统预设内容，当前编辑将丢失，是否继续？',
    okText: '恢复',
    cancelText: '取消',
    onOk: async () => {
      if (currentId.value && !String(currentId.value).startsWith('__')) {
        try {
          const res = await resetRewritePrompt(currentId.value)
          Object.assign(form, {
            title_prompt: res.title_prompt,
            content_prompt: res.content_prompt,
            image_prompt: res.image_prompt,
          })
        } catch {
          // 后端未实现则本地重置
          Object.assign(form, {
            title_prompt: DEFAULT_TITLE_PROMPT,
            content_prompt: DEFAULT_CONTENT_PROMPT,
            image_prompt: DEFAULT_IMAGE_PROMPT,
          })
        }
      } else {
        Object.assign(form, {
          title_prompt: DEFAULT_TITLE_PROMPT,
          content_prompt: DEFAULT_CONTENT_PROMPT,
          image_prompt: DEFAULT_IMAGE_PROMPT,
        })
      }
      message.success('已恢复系统默认')
    },
  })
}

function onAddTemplate() {
  const userTemplates = templates.value.filter(t => !t.is_system)
  if (userTemplates.length >= 5) {
    message.warning('最多创建 5 个自定义模板')
    return
  }
  const newTpl = {
    id: `__new__${Date.now()}`,
    name: `自定义模板 ${userTemplates.length + 1}`,
    type: 'link',
    is_system: false,
    title_prompt: DEFAULT_TITLE_PROMPT,
    content_prompt: DEFAULT_CONTENT_PROMPT,
    image_prompt: DEFAULT_IMAGE_PROMPT,
  }
  templates.value.push(newTpl)
  selectTemplate(newTpl)
}

onMounted(load)
</script>

<style scoped>
.prompt-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.page-desc {
  font-size: 13px;
  color: #6b7280;
}

/* 主布局 */
.prompt-layout {
  display: flex;
  gap: 0;
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  min-height: 600px;
}

/* 左侧模板列表 */
.template-list {
  width: 200px;
  flex-shrink: 0;
  background: #f8f9fb;
  border-right: 1px solid #e5e7eb;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.template-item:hover {
  background: #f0f0f0;
}

.template-item.active {
  background: #fff1f2;
}

.tpl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-red {
  background: #ff2442;
}

.dot-gray {
  background: #9ca3af;
}

.tpl-info {
  flex: 1;
  min-width: 0;
}

.tpl-name {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.template-item.active .tpl-name {
  color: #ff2442;
}

.tpl-sub {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 1px;
  white-space: nowrap;
}

.tpl-del {
  color: #d1d5db;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.15s;
}

.template-item:hover .tpl-del {
  opacity: 1;
}

.tpl-del:hover {
  color: #ef4444 !important;
}

.template-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px;
  border-radius: 7px;
  cursor: pointer;
  color: #6b7280;
  font-size: 13px;
  margin-top: 4px;
  transition: background 0.15s;
}

.template-add:hover {
  background: #f0f0f0;
  color: #ff2442;
}

.add-limit {
  font-size: 11px;
  color: #d1d5db;
  margin-left: 2px;
}

/* 右侧编辑区 */
.template-editor {
  flex: 1;
  padding: 24px 28px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.editor-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.meta-label {
  font-size: 13px;
  color: #6b7280;
}

.meta-hint {
  font-size: 12px;
  color: #9ca3af;
}

.name-input {
  font-size: 16px;
  font-weight: 600;
}

/* 类型 Tab */
.type-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #f0f0f0;
}

.type-tab {
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
}

.type-tab.active {
  color: #ff2442;
  border-bottom-color: #ff2442;
  font-weight: 500;
}

/* 提示词块 */
.prompt-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.required {
  color: #ff2442;
  margin-left: 2px;
}

/* 底部 */
.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

/* 空状态 */
.editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9ca3af;
  font-size: 14px;
}

.empty-icon {
  font-size: 36px;
}
</style>
