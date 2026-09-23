<template>
  <a-card title="题库管理">
    <a-space style="margin-bottom: 16px" wrap>
      <a-select v-model:value="query.categoryId" style="width: 180px" allow-clear placeholder="分类" @change="load">
        <a-select-option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</a-select-option>
      </a-select>
      <a-input v-model:value="query.chapter" style="width: 180px" allow-clear placeholder="章节，如 第一章 法理学" @pressEnter="load" />
      <a-input-search v-model:value="query.keyword" placeholder="搜索题干/答案" allow-clear @search="load" />
    </a-space>
    <a-alert
      style="margin-bottom: 16px"
      type="info"
      show-icon
      message="当前样本题库来自本地 OCR，已导入公共基础知识 gongji。解析字段暂为空，后续可导入第二册解析或人工补充。"
    />
    <a-table :data-source="rows" :columns="columns" row-key="id" :loading="loading" :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'stem'">
          <div class="stem-cell">
            <div class="stem-title">{{ record.question_no }}. {{ record.stem }}</div>
            <div class="options-text">{{ formatOptions(record.options_json) }}</div>
          </div>
        </template>
        <template v-else-if="column.key === 'answer'">
          <a-tag color="green">{{ record.answer || '未设置' }}</a-tag>
        </template>
        <template v-else-if="column.key === 'review'">
          <a-tag :color="record.review_status === 'reviewed' ? 'blue' : 'orange'">{{ record.review_status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-switch :checked="record.status === 1" @change="checked => setStatus(record, checked)" />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="editVisible"
      title="编辑题目内容"
      width="760px"
      :confirm-loading="saving"
      @ok="saveQuestion"
    >
      <a-form layout="vertical">
        <a-form-item label="题干">
          <a-textarea v-model:value="editForm.stem" :rows="4" placeholder="请输入题干内容" />
        </a-form-item>
        <a-form-item label="选项">
          <a-space direction="vertical" style="width: 100%">
            <a-input v-for="key in optionKeys" :key="key" v-model:value="editForm.options[key]" :addon-before="key" />
          </a-space>
        </a-form-item>
        <a-form-item label="答案">
          <a-input v-model:value="editForm.answer" placeholder="例如：A" />
        </a-form-item>
        <a-form-item label="解析">
          <a-textarea v-model:value="editForm.explanation" :rows="4" placeholder="请输入解析，可留空" />
        </a-form-item>
        <a-form-item label="复核状态">
          <a-select v-model:value="editForm.reviewStatus">
            <a-select-option value="pending">pending</a-select-option>
            <a-select-option value="reviewed">reviewed</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getPasslyCategories, getPasslyQuestions, updatePasslyQuestion, updatePasslyQuestionStatus } from '@/api/passly'

const rows = ref([])
const categories = ref([])
const loading = ref(false)
const saving = ref(false)
const editVisible = ref(false)
const editingId = ref(null)
const query = reactive({ keyword: '', categoryId: undefined, chapter: '', page: 1, pageSize: 20 })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F']
const editForm = reactive({
  stem: '',
  options: {},
  answer: '',
  explanation: '',
  reviewStatus: 'pending',
})
const columns = [
  { title: '题目', key: 'stem' },
  { title: '分类', dataIndex: 'category_name', width: 120 },
  { title: '章节', dataIndex: 'chapter', width: 150 },
  { title: '模块', dataIndex: 'section', width: 110 },
  { title: '答案', key: 'answer', width: 90 },
  { title: '复核', key: 'review', width: 120 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 90, fixed: 'right' },
]

function parseOptions(json) {
  try {
    const data = JSON.parse(json || '{}')
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

function formatOptions(json) {
  const data = parseOptions(json)
  return Object.entries(data).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([k, v]) => `${k}. ${v}`).join('  ')
}

async function load() {
  loading.value = true
  try {
    const data = await getPasslyQuestions(query)
    rows.value = data.list
    pagination.current = data.page
    pagination.pageSize = data.pageSize
    pagination.total = data.total
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function setStatus(record, checked) {
  await updatePasslyQuestionStatus(record.id, checked ? 1 : 0)
  load()
}

function openEdit(record) {
  editingId.value = record.id
  editForm.stem = record.stem || ''
  const options = parseOptions(record.options_json)
  editForm.options = optionKeys.reduce((acc, key) => {
    acc[key] = options[key] || ''
    return acc
  }, {})
  editForm.answer = record.answer || ''
  editForm.explanation = record.explanation || ''
  editForm.reviewStatus = record.review_status || 'pending'
  editVisible.value = true
}

async function saveQuestion() {
  if (!editingId.value) return
  if (!editForm.stem.trim()) {
    message.warning('题干不能为空')
    return
  }
  const options = Object.fromEntries(
    optionKeys
      .map(key => [key, String(editForm.options[key] || '').trim()])
      .filter(([, value]) => value),
  )
  saving.value = true
  try {
    await updatePasslyQuestion(editingId.value, {
      stem: editForm.stem.trim(),
      options,
      answer: editForm.answer.trim(),
      explanation: editForm.explanation.trim(),
      reviewStatus: editForm.reviewStatus,
    })
    message.success('题目已更新')
    editVisible.value = false
    await load()
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function onTableChange(p) {
  query.page = p.current
  query.pageSize = p.pageSize
  load()
}

onMounted(async () => {
  categories.value = await getPasslyCategories()
  load()
})
</script>

<style scoped>
.stem-cell {
  max-width: 720px;
}
.stem-title {
  font-weight: 600;
  color: #1f2937;
}
.options-text {
  margin-top: 6px;
  color: #667085;
  font-size: 12px;
  line-height: 1.7;
}
</style>
