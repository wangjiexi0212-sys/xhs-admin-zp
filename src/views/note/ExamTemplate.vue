<template>
  <div>
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-space>
        <a-select
          v-model:value="filterJobTypeId"
          placeholder="全部商品类型"
          :options="jobTypeOptions"
          allow-clear
          style="width: 180px"
          @change="onFilter"
        />
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索标题/内容"
          allow-clear
          style="width: 220px"
          @search="onFilter"
          @clear="onFilter"
        />
      </a-space>
      <a-button type="primary" @click="openCreate">+ 新建试题模版</a-button>
    </div>

    <!-- 列表 -->
    <a-table
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      @change="onPageChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'content'">
          <a-typography-paragraph
            :ellipsis="{ rows: 2 }"
            :content="record.content"
            style="margin-bottom: 0"
          />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="openEdit(record)">编辑</a-button>
            <a-popconfirm title="确定删除？" ok-text="删除" ok-type="danger" @confirm="onDelete(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新建/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑试题模版' : '新建试题模版'"
      :confirm-loading="submitting"
      width="680px"
      @ok="onSubmit"
      @cancel="closeModal"
    >
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" style="margin-top: 8px">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="商品类型" name="job_type_id">
              <a-select
                v-model:value="form.job_type_id"
                placeholder="请选择商品类型"
                :options="jobTypeOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="排序" name="sort_order">
              <a-input-number v-model:value="form.sort_order" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="年份（如22/23/24/25，模拟题留空）" name="year">
              <a-input-number v-model:value="form.year" :min="0" :max="99" placeholder="如 22" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="模版标题" name="title">
              <a-input v-model:value="form.title" placeholder="请输入模版标题" :maxlength="100" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="模版内容" name="content">
              <a-textarea
                v-model:value="form.content"
                placeholder="请输入模版内容"
                :rows="8"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" name="description">
              <a-input v-model:value="form.description" placeholder="选填" :maxlength="200" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  getExamTemplateList,
  createExamTemplate,
  updateExamTemplate,
  deleteExamTemplate,
} from '@/api/examTemplates'
import { getJobTypeList } from '@/api/jobTypes'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const filterJobTypeId = ref(undefined)

const jobTypes = ref([])
const jobTypeOptions = computed(() =>
  jobTypes.value.map(t => ({ label: t.name, value: t.id }))
)

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '商品类型', dataIndex: 'job_type_name', width: 140 },
  { title: '年份', dataIndex: 'year', width: 70 },
  { title: '模版标题', dataIndex: 'title', width: 200 },
  { title: '内容', key: 'content', ellipsis: true },
  { title: '备注', dataIndex: 'description', width: 160, ellipsis: true },
  { title: '排序', dataIndex: 'sort_order', width: 70 },
  { title: '创建人', dataIndex: 'created_by_name', width: 100 },
  { title: '操作', key: 'action', width: 130, fixed: 'right' },
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: t => `共 ${t} 条`,
}))

async function fetchList() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (filterJobTypeId.value) params.job_type_id = filterJobTypeId.value
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await getExamTemplateList(params)
    list.value = res.list ?? []
    total.value = res.total ?? 0
  } finally {
    loading.value = false
  }
}

async function fetchJobTypes() {
  try {
    const res = await getJobTypeList({ page: 1, pageSize: 30 })
    jobTypes.value = res.list ?? []
  } catch {
    jobTypes.value = []
  }
}

function onFilter() {
  page.value = 1
  fetchList()
}

function onPageChange(p) {
  page.value = p.current
  pageSize.value = p.pageSize
  fetchList()
}

// ---- modal ----
const modalVisible = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const form = reactive({
  job_type_id: undefined,
  title: '',
  content: '',
  description: '',
  year: null,
  sort_order: 0,
})

const rules = {
  job_type_id: [{ required: true, message: '请选择商品类型' }],
  title: [{ required: true, message: '请输入模版标题', whitespace: true }],
  content: [{ required: true, message: '请输入模版内容', whitespace: true }],
}

function resetForm() {
  form.job_type_id = undefined
  form.title = ''
  form.content = ''
  form.description = ''
  form.year = null
  form.sort_order = 0
  editingId.value = null
  formRef.value?.clearValidate()
}

function openCreate() {
  resetForm()
  modalVisible.value = true
}

function openEdit(record) {
  resetForm()
  editingId.value = record.id
  form.job_type_id = record.job_type_id
  form.title = record.title
  form.content = record.content
  form.description = record.description ?? ''
  form.year = record.year ?? null
  form.sort_order = record.sort_order ?? 0
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
  resetForm()
}

async function onSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    const payload = {
      job_type_id: form.job_type_id,
      title: form.title.trim(),
      content: form.content.trim(),
      description: form.description.trim(),
      year: form.year ?? null,
      sort_order: form.sort_order,
    }
    if (editingId.value) {
      await updateExamTemplate(editingId.value, payload)
      message.success('修改成功')
    } else {
      await createExamTemplate(payload)
      message.success('新建成功')
    }
    closeModal()
    fetchList()
  } catch (e) {
    message.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function onDelete(id) {
  try {
    await deleteExamTemplate(id)
    message.success('删除成功')
    fetchList()
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

onMounted(() => {
  fetchJobTypes()
  fetchList()
})
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
