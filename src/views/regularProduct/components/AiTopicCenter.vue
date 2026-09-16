<template>
  <div class="ai-topic-center">
    <div class="topic-toolbar">
      <a-space>
        <a-radio-group v-model:value="activeType" button-style="solid" size="small" @change="onTypeChange">
          <a-radio-button value="">全部</a-radio-button>
          <a-radio-button value="traffic">流量型</a-radio-button>
          <a-radio-button value="search">搜索型</a-radio-button>
          <a-radio-button value="collect">收藏型</a-radio-button>
          <a-radio-button value="professional">专业型</a-radio-button>
          <a-radio-button value="convert">转化型</a-radio-button>
        </a-radio-group>
        <a-select
          v-model:value="activeStatus"
          style="width: 100px"
          size="small"
          @change="loadTopics"
        >
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="candidate">待选</a-select-option>
          <a-select-option value="selected">已选</a-select-option>
          <a-select-option value="discarded">已废弃</a-select-option>
        </a-select>
      </a-space>
      <a-button type="primary" size="small" :loading="generating" @click="openGenModal">
        生成选题
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!topics.length && !loading" description="暂无选题，点击「生成选题」开始" />
      <div v-else class="topic-grid">
        <div
          v-for="topic in topics"
          :key="topic.id"
          :class="['topic-card', { discarded: topic.status === 'discarded' }]"
        >
          <div class="topic-card-top">
            <a-tag :color="typeColor(topic.topic_type)" size="small">{{ typeLabel(topic.topic_type) }}</a-tag>
            <a-tag :color="statusColor(topic.status)" size="small">{{ statusLabel(topic.status) }}</a-tag>
          </div>
          <div class="topic-title">{{ topic.title }}</div>
          <div v-if="topic.core_idea" class="topic-meta">核心：{{ topic.core_idea }}</div>
          <div v-if="topic.content_angle" class="topic-meta">角度：{{ topic.content_angle }}</div>
          <div v-if="topic.reason" class="topic-reason">{{ topic.reason }}</div>
          <div class="topic-actions">
            <a-button
              size="small"
              type="primary"
              :disabled="topic.status === 'discarded'"
              :loading="generatingNoteId === topic.id"
              @click="$emit('generate-note', topic)"
            >
              生成笔记
            </a-button>
            <a-button
              size="small"
              danger
              :disabled="topic.status === 'discarded'"
              @click="discard(topic)"
            >
              废弃
            </a-button>
          </div>
        </div>
      </div>
    </a-spin>

    <a-modal
      v-model:open="genModalOpen"
      title="生成选题配置"
      :confirm-loading="generating"
      ok-text="开始生成"
      @ok="doGenerate"
    >
      <a-form layout="vertical" style="margin-top: 8px">
        <a-form-item label="选题类型">
          <a-checkbox-group v-model:value="genTopicTypes" :options="typeOptions" />
        </a-form-item>
        <a-form-item label="生成数量">
          <a-input-number v-model:value="genCount" :min="1" :max="30" style="width: 120px" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { generateAiTopics, getAiTopics, updateAiTopic } from '@/api/aiContentCenter'
import { useLlmStore } from '@/stores/llm'

const props = defineProps({
  productId: { type: [Number, String], required: true },
})

const emit = defineEmits(['generate-note'])

const llmStore = useLlmStore()

const loading = ref(false)
const topics = ref([])
const activeType = ref('')
const activeStatus = ref('')
const generating = ref(false)
const generatingNoteId = ref(0)
const genModalOpen = ref(false)
const genTopicTypes = ref(['traffic', 'search', 'collect', 'professional', 'convert'])
const genCount = ref(10)

const typeOptions = [
  { label: '流量型', value: 'traffic' },
  { label: '搜索型', value: 'search' },
  { label: '收藏型', value: 'collect' },
  { label: '专业型', value: 'professional' },
  { label: '转化型', value: 'convert' },
]

function typeColor(t) {
  return { traffic: 'red', search: 'blue', collect: 'green', professional: 'purple', convert: 'orange' }[t] || 'default'
}

function typeLabel(t) {
  return { traffic: '流量型', search: '搜索型', collect: '收藏型', professional: '专业型', convert: '转化型' }[t] || t
}

function statusColor(s) {
  return { candidate: 'gold', selected: 'green', discarded: 'default', generating: 'blue', created: 'cyan' }[s] || 'default'
}

function statusLabel(s) {
  return { candidate: '待选', selected: '已选', discarded: '已废弃', generating: '生成中', created: '已创建' }[s] || s
}

async function loadTopics() {
  loading.value = true
  try {
    const res = await getAiTopics(props.productId, { type: activeType.value, status: activeStatus.value })
    topics.value = res.topics || []
  } catch (e) {
    message.error(e.message || '加载选题失败')
  } finally {
    loading.value = false
  }
}

function onTypeChange() {
  loadTopics()
}

function openGenModal() {
  const active = llmStore.active
  if (!active) { message.warning('请先在系统设置中启用大模型配置'); return }
  genModalOpen.value = true
}

async function doGenerate() {
  const active = llmStore.active
  if (!active) return
  generating.value = true
  try {
    const res = await generateAiTopics(props.productId, {
      topic_types: genTopicTypes.value,
      count: genCount.value,
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
    })
    genModalOpen.value = false
    message.success(`已生成 ${(res.topics || []).length} 个选题`)
    await loadTopics()
  } catch (e) {
    message.error(e.message || '生成失败')
  } finally {
    generating.value = false
  }
}

async function discard(topic) {
  try {
    await updateAiTopic(topic.id, { status: 'discarded' })
    topic.status = 'discarded'
  } catch (e) {
    message.error(e.message || '操作失败')
  }
}

onMounted(() => {
  if (!llmStore.checked) llmStore.load()
  loadTopics()
})

defineExpose({ loadTopics })
</script>

<style scoped>
.ai-topic-center {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.topic-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.topic-card {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: box-shadow 0.15s;
}

.topic-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.topic-card.discarded {
  opacity: 0.5;
}

.topic-card-top {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.topic-title {
  font-size: 14px;
  font-weight: 600;
  color: #222;
  line-height: 1.5;
}

.topic-meta {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.topic-reason {
  font-size: 12px;
  color: #999;
  line-height: 1.5;
  border-left: 2px solid #e8e8e8;
  padding-left: 8px;
}

.topic-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
</style>
