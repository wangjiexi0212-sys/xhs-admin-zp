<template>
  <div>
    <div class="toolbar">
      <a-input-search
        v-model:value="keyword"
        placeholder="搜索类型名称"
        allow-clear
        style="width: 240px"
        @search="onSearch"
      />
      <a-button type="primary" @click="openModal()">+ 新增类型</a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'created_at'">
          {{ formatTime(record.created_at) }}
        </template>
        <template v-else-if="column.key === 'updated_at'">
          {{ formatTime(record.updated_at) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="openModal(record)">编辑</a-button>
            <a-popconfirm title="确定删除？" ok-text="删除" ok-type="danger" @confirm="onDelete(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalOpen"
      :title="editId ? '编辑类型' : '新增类型'"
      :confirm-loading="submitting"
      @ok="onSubmit"
      @cancel="resetModal"
    >
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" style="margin-top: 8px">
        <a-form-item label="类型名称" name="name">
          <a-input v-model:value="form.name" placeholder="如：国企央企、事业单位、教师、考公" :maxlength="50" show-count />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { getJobTypeList, createJobType, updateJobType, deleteJobType } from '@/api/jobTypes'

const keyword = ref('')
const loading = ref(false)
const list = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: t => `共 ${t} 条` })

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '类型名称', dataIndex: 'name' },
  { title: '创建人', dataIndex: 'created_by_name', width: 120 },
  { title: '创建时间', key: 'created_at', width: 170 },
  { title: '修改人', dataIndex: 'updated_by_name', width: 120 },
  { title: '修改时间', key: 'updated_at', width: 170 },
  { title: '操作', key: 'action', width: 130, fixed: 'right' },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await getJobTypeList({
      keyword: keyword.value,
      page: pagination.current,
      pageSize: pagination.pageSize,
    })
    list.value = res.list
    pagination.total = res.total
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.current = 1
  fetchList()
}

function onTableChange(pag) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchList()
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

// --- modal ---
const modalOpen = ref(false)
const submitting = ref(false)
const editId = ref(null)
const form = reactive({ name: '' })
const formRef = ref(null)
const rules = { name: [{ required: true, message: '请输入类型名称', whitespace: true }] }

function openModal(record = null) {
  editId.value = record?.id ?? null
  form.name = record?.name ?? ''
  modalOpen.value = true
}

function resetModal() {
  formRef.value?.resetFields()
  editId.value = null
  form.name = ''
}

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (editId.value) {
      await updateJobType(editId.value, form.name.trim())
      message.success('修改成功')
    } else {
      await createJobType(form.name.trim())
      message.success('新增成功')
    }
    modalOpen.value = false
    resetModal()
    fetchList()
  } catch (e) {
    message.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function onDelete(id) {
  try {
    await deleteJobType(id)
    message.success('删除成功')
    if (list.value.length === 1 && pagination.current > 1) pagination.current--
    fetchList()
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

onMounted(fetchList)
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
