<template>
  <a-modal
    v-model:open="visible"
    :title="`笔记编辑 — ${topic?.title || ''}`"
    width="780px"
    :footer="null"
    destroy-on-close
  >
    <div v-if="loading" class="center-spin"><a-spin /></div>
    <div v-else-if="note" class="note-editor">
      <!-- 标题候选 -->
      <div class="section-label">标题候选</div>
      <a-radio-group v-model:value="note.title" class="title-candidates">
        <a-radio
          v-for="(t, i) in titleCandidates"
          :key="i"
          :value="t"
          class="title-radio"
        >{{ t }}</a-radio>
      </a-radio-group>
      <div class="title-actions">
        <a-input v-model:value="note.title" placeholder="或直接输入自定义标题" allow-clear />
        <a-button size="small" :loading="regenTitles" @click="doRegenTitles">重新生成标题</a-button>
      </div>

      <!-- 写作参数 -->
      <div class="params-row">
        <a-form-item label="风格" class="param-item">
          <a-select v-model:value="note.style" style="width: 110px" size="small">
            <a-select-option value="干货">干货</a-select-option>
            <a-select-option value="故事">故事</a-select-option>
            <a-select-option value="清单">清单</a-select-option>
            <a-select-option value="问答">问答</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="字数" class="param-item">
          <a-select v-model:value="note.word_count" style="width: 100px" size="small">
            <a-select-option :value="100">100字</a-select-option>
            <a-select-option :value="150">150字</a-select-option>
            <a-select-option :value="300">300字</a-select-option>
            <a-select-option :value="500">500字</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="转化强度" class="param-item">
          <a-select v-model:value="note.conversion_level" style="width: 110px" size="small">
            <a-select-option value="none">无转化</a-select-option>
            <a-select-option value="weak">弱转化</a-select-option>
            <a-select-option value="medium">中等</a-select-option>
            <a-select-option value="strong">强转化</a-select-option>
          </a-select>
        </a-form-item>
        <a-button size="small" :loading="regenContent" @click="doRegenContent">重新生成正文</a-button>
      </div>

      <!-- 正文 -->
      <div class="section-label">正文</div>
      <a-textarea
        v-model:value="note.content"
        :auto-size="{ minRows: 6, maxRows: 16 }"
        allow-clear
      />

      <!-- 标签 -->
      <div class="section-label">标签</div>
      <a-select
        v-model:value="noteTags"
        mode="tags"
        placeholder="输入标签后回车"
        style="width: 100%"
      />

      <!-- 内容依据 -->
      <a-collapse v-if="contentBasis.length" size="small" style="margin-top: 12px">
        <a-collapse-panel key="basis" header="内容依据（后台审核用）">
          <div v-for="(b, i) in contentBasis" :key="i" class="basis-item">
            <strong>{{ b.name }}</strong>
            <span v-if="b.page" class="muted"> P{{ b.page }}</span>
            <div class="muted">{{ b.source }}</div>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <div class="editor-footer">
        <a-space>
          <a-button :loading="saving" @click="doSave">保存草稿</a-button>
          <a-button type="primary" :loading="saving" @click="doComplete">标记完成</a-button>
          <a-button
            :loading="genScripts"
            @click="doGenScripts"
          >生成图片脚本</a-button>
        </a-space>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  regenerateNoteTitles,
  generateNoteFromTopic,
  updateAiNote,
  generateImageScripts,
} from '@/api/aiContentCenter'
import { useLlmStore } from '@/stores/llm'

const props = defineProps({
  open: { type: Boolean, default: false },
  topic: { type: Object, default: null },
  productId: { type: [Number, String], required: true },
  initialNote: { type: Object, default: null },
})

const emit = defineEmits(['update:open', 'note-saved', 'open-scripts'])

// 用可读写 computed 代理 prop，避免 v-model 直接绑定 prop
const visible = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const llmStore = useLlmStore()

const loading = ref(false)
const saving = ref(false)
const regenTitles = ref(false)
const regenContent = ref(false)
const genScripts = ref(false)
const note = ref(null)

const titleCandidates = computed(() => {
  if (!note.value) return []
  try {
    const arr = JSON.parse(note.value.title_candidates_json || '[]')
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
})

const noteTags = computed({
  get() {
    if (!note.value) return []
    try {
      const arr = JSON.parse(note.value.tags_json || '[]')
      return Array.isArray(arr) ? arr : []
    } catch { return [] }
  },
  set(val) {
    if (note.value) note.value.tags_json = JSON.stringify(val)
  },
})

const contentBasis = computed(() => {
  if (!note.value?.content_basis_json) return []
  try {
    const arr = JSON.parse(note.value.content_basis_json)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
})

watch(() => props.open, async (val) => {
  if (!val) return
  if (props.initialNote) {
    note.value = { ...props.initialNote }
  } else if (props.topic) {
    await generateNote()
  }
})

async function generateNote() {
  const active = llmStore.active
  if (!active) { message.warning('请先配置大模型'); return }
  loading.value = true
  try {
    const res = await generateNoteFromTopic(props.topic.id, {
      provider: active.provider, api_format: active.api_format,
      api_key: active.api_key, base_url: active.base_url || '',
      model: active.default_model,
    })
    note.value = res.note
  } catch (e) {
    message.error(e.message || '生成笔记失败')
    emit('update:open', false)
  } finally {
    loading.value = false
  }
}

async function doRegenTitles() {
  const active = llmStore.active
  if (!active || !note.value) return
  regenTitles.value = true
  try {
    const res = await regenerateNoteTitles(note.value.id, {
      style: note.value.style,
      provider: active.provider, api_format: active.api_format,
      api_key: active.api_key, base_url: active.base_url || '',
      model: active.default_model,
    })
    note.value.title_candidates_json = JSON.stringify(res.titles || [])
    if (res.titles?.length) note.value.title = res.titles[0]
  } catch (e) {
    message.error(e.message || '重新生成标题失败')
  } finally {
    regenTitles.value = false
  }
}

async function doRegenContent() {
  const active = llmStore.active
  if (!active || !props.topic) return
  regenContent.value = true
  try {
    const res = await generateNoteFromTopic(props.topic.id, {
      style: note.value?.style || '干货',
      word_count: note.value?.word_count || 150,
      conversion_level: note.value?.conversion_level || 'weak',
      provider: active.provider, api_format: active.api_format,
      api_key: active.api_key, base_url: active.base_url || '',
      model: active.default_model,
    })
    if (note.value && res.note) {
      note.value.content = res.note.content
      note.value.title_candidates_json = res.note.title_candidates_json
      note.value.content_basis_json = res.note.content_basis_json
      if (!note.value.title) note.value.title = res.note.title
    }
  } catch (e) {
    message.error(e.message || '重新生成正文失败')
  } finally {
    regenContent.value = false
  }
}

async function doSave(status) {
  if (!note.value) return
  saving.value = true
  try {
    await updateAiNote(note.value.id, {
      title: note.value.title,
      content: note.value.content,
      tags: noteTags.value,
      style: note.value.style,
      word_count: note.value.word_count,
      conversion_level: note.value.conversion_level,
      status: typeof status === 'string' ? status : note.value.status,
    })
    message.success('已保存')
    emit('note-saved', note.value)
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function doComplete() {
  await doSave('completed')
}

async function doGenScripts() {
  const active = llmStore.active
  if (!active || !note.value) return
  genScripts.value = true
  try {
    await doSave()
    const res = await generateImageScripts(note.value.id, {
      provider: active.provider, api_format: active.api_format,
      api_key: active.api_key, base_url: active.base_url || '',
      model: active.default_model,
    })
    message.success(`已生成 ${(res.scripts || []).length} 页图片脚本`)
    emit('open-scripts', note.value)
    emit('update:open', false)
  } catch (e) {
    message.error(e.message || '生成图片脚本失败')
  } finally {
    genScripts.value = false
  }
}
</script>

<style scoped>
.center-spin {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.note-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.title-candidates {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title-radio {
  display: block;
  white-space: normal;
  line-height: 1.6;
}

.title-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.params-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.param-item {
  margin: 0;
}

.basis-item {
  margin-bottom: 8px;
  font-size: 13px;
}

.muted {
  color: #999;
  font-size: 12px;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}
</style>
