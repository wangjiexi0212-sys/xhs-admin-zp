<template>
  <div>
    <div class="toolbar">
      <a-space>
        <a-select
          v-model:value="filterJobType"
          placeholder="全部商品类型"
          :options="jobTypeOptions"
          allow-clear
          style="width: 180px"
          @change="onFilter"
        />
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索名称/内容"
          allow-clear
          style="width: 220px"
          @search="onFilter"
          @clear="onFilter"
        />
      </a-space>
      <a-button type="primary" @click="openCreate">+ 新建卡片提示词</a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      @change="onPageChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'job_type_name'">
          <a-tag color="blue">{{ record.job_type_name }}</a-tag>
        </template>
        <template v-else-if="column.key === 'content'">
          <a-typography-paragraph
            :ellipsis="{ rows: 2 }"
            :content="record.content"
            style="margin-bottom: 0"
          />
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'success' : 'default'">
            {{ record.status === 1 ? '上架' : '下架' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="openEdit(record)">编辑</a-button>
            <a-popconfirm
              :title="record.status === 1 ? '确定下架？' : '确定上架？'"
              :ok-text="record.status === 1 ? '下架' : '上架'"
              :ok-type="record.status === 1 ? 'danger' : 'primary'"
              @confirm="onToggleStatus(record)"
            >
              <a-button size="small" :type="record.status === 1 ? 'default' : 'primary'" ghost>
                {{ record.status === 1 ? '下架' : '上架' }}
              </a-button>
            </a-popconfirm>
            <a-popconfirm title="确定删除？" ok-text="删除" ok-type="danger" @confirm="onDelete(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑卡片提示词' : '新建卡片提示词'"
      :confirm-loading="submitting"
      width="720px"
      :destroy-on-close="true"
      @ok="onSubmit"
      @cancel="closeModal"
    >
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" style="margin-top: 8px">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="商品类型" name="job_type_id">
              <a-select
                v-model:value="form.job_type_id"
                placeholder="请选择商品类型"
                :options="jobTypeOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="提示词名称" name="name">
              <a-input v-model:value="form.name" placeholder="请输入名称" :maxlength="80" />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="排序" name="sort_order">
              <a-input-number v-model:value="form.sort_order" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="状态" name="status">
              <a-switch
                v-model:checked="form.status"
                :checked-value="1"
                :un-checked-value="0"
                checked-children="上架"
                un-checked-children="下架"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="提示词内容" name="content">
              <a-textarea
                v-model:value="form.content"
                placeholder="请输入提示词正文"
                :rows="10"
                :maxlength="5000"
                show-count
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
import { getJobTypeList } from '@/api/jobTypes'
import {
  getCardPromptList,
  createCardPrompt,
  updateCardPrompt,
  deleteCardPrompt,
  toggleCardPromptStatus,
} from '@/api/cardPrompts'

const jobTypeOptions = ref([])

async function fetchJobTypes() {
  try {
    const res = await getJobTypeList({ pageSize: 200 })
    jobTypeOptions.value = (res.list ?? []).map(t => ({ label: t.name, value: t.id }))
  } catch {}
}

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const filterJobType = ref(undefined)

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '商品类型', key: 'job_type_name', width: 140 },
  { title: '名称', dataIndex: 'name', width: 180 },
  { title: '提示词内容', key: 'content', ellipsis: true },
  { title: '备注', dataIndex: 'description', width: 160, ellipsis: true },
  { title: '排序', dataIndex: 'sort_order', width: 70 },
  { title: '状态', key: 'status', width: 80 },
  { title: '创建人', dataIndex: 'created_by_name', width: 100 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
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
    if (filterJobType.value) params.job_type_id = filterJobType.value
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await getCardPromptList(params)
    list.value = res.list ?? []
    total.value = res.total ?? 0
  } finally {
    loading.value = false
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
  name: '',
  content: '',
  description: '',
  sort_order: 0,
  status: 1,
})

const rules = {
  job_type_id: [{ required: true, message: '请选择商品类型' }],
  name: [{ required: true, message: '请输入提示词名称', whitespace: true }],
  content: [{ required: true, message: '请输入提示词内容', whitespace: true }],
}

function resetForm() {
  form.job_type_id = undefined
  form.name = ''
  form.content = ''
  form.description = ''
  form.sort_order = 0
  form.status = 1
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
  form.name = record.name
  form.content = record.content
  form.description = record.description ?? ''
  form.sort_order = record.sort_order ?? 0
  form.status = record.status ?? 1
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
      name: form.name.trim(),
      content: form.content.trim(),
      description: form.description.trim(),
      sort_order: form.sort_order,
      status: form.status,
    }
    if (editingId.value) {
      await updateCardPrompt(editingId.value, payload)
      message.success('修改成功')
    } else {
      await createCardPrompt(payload)
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

async function onToggleStatus(record) {
  try {
    const res = await toggleCardPromptStatus(record.id)
    record.status = res.status
    message.success(res.status === 1 ? '已上架' : '已下架')
  } catch (e) {
    message.error(e.message || '操作失败')
  }
}

async function onDelete(id) {
  try {
    await deleteCardPrompt(id)
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
