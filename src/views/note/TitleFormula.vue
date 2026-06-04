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
          placeholder="搜索标题/备注"
          allow-clear
          style="width: 220px"
          @search="onFilter"
          @clear="onFilter"
        />
      </a-space>
      <a-button type="primary" @click="openCreate">+ 新建标题公式</a-button>
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
          <div class="html-preview" v-html="record.content" />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="goDetail(record.id)">查看</a-button>
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
      :title="editingId ? '编辑标题公式' : '新建标题公式'"
      :confirm-loading="submitting"
      width="800px"
      :destroy-on-close="true"
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
          <a-col :span="6">
            <a-form-item label="排序" name="sort_order">
              <a-input-number v-model:value="form.sort_order" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="公式标题" name="title">
              <a-input v-model:value="form.title" placeholder="请输入公式标题" :maxlength="100" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="公式内容" name="content">
              <div style="border: 1px solid #d9d9d9; border-radius: 6px; overflow: hidden">
                <Toolbar
                  :editor="editorRef"
                  :defaultConfig="toolbarConfig"
                  mode="default"
                  style="border-bottom: 1px solid #d9d9d9"
                />
                <Editor
                  v-model="form.content"
                  :defaultConfig="editorConfig"
                  mode="default"
                  style="height: 320px; overflow-y: hidden"
                  @onCreated="handleEditorCreated"
                />
              </div>
              <div v-if="contentError" style="color: #ff4d4f; font-size: 12px; margin-top: 4px">
                {{ contentError }}
              </div>
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
import { ref, reactive, computed, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import {
  getTitleFormulaList,
  createTitleFormula,
  updateTitleFormula,
  deleteTitleFormula,
} from '@/api/titleFormulas'
import { getJobTypeList } from '@/api/jobTypes'

const router = useRouter()

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
  { title: '公式标题', dataIndex: 'title', width: 200 },
  { title: '内容预览', key: 'content', ellipsis: true },
  { title: '备注', dataIndex: 'description', width: 160, ellipsis: true },
  { title: '排序', dataIndex: 'sort_order', width: 70 },
  { title: '创建人', dataIndex: 'created_by_name', width: 100 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' },
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
    const res = await getTitleFormulaList(params)
    list.value = res.list ?? []
    total.value = res.total ?? 0
  } finally {
    loading.value = false
  }
}

async function fetchJobTypes() {
  try {
    const res = await getJobTypeList({ page: 1, pageSize: 100 })
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

function goDetail(id) {
  router.push(`/note/title-formula/detail/${id}`)
}

// ---- 富文本编辑器 ----
const editorRef = shallowRef(null)
const toolbarConfig = {}
const editorConfig = { placeholder: '请输入公式内容...' }

function handleEditorCreated(editor) {
  editorRef.value = editor
}

onBeforeUnmount(() => {
  editorRef.value?.destroy()
})

// ---- modal ----
const modalVisible = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const contentError = ref('')

const form = reactive({
  job_type_id: undefined,
  title: '',
  content: '',
  description: '',
  sort_order: 0,
})

const rules = {
  job_type_id: [{ required: true, message: '请选择商品类型' }],
  title: [{ required: true, message: '请输入公式标题', whitespace: true }],
}

function resetForm() {
  form.job_type_id = undefined
  form.title = ''
  form.content = ''
  form.description = ''
  form.sort_order = 0
  contentError.value = ''
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
  form.sort_order = record.sort_order ?? 0
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
  resetForm()
}

async function onSubmit() {
  try { await formRef.value.validate() } catch { return }

  const plainText = editorRef.value?.getText?.() ?? form.content.replace(/<[^>]+>/g, '').trim()
  if (!plainText) {
    contentError.value = '请输入公式内容'
    return
  }
  contentError.value = ''

  submitting.value = true
  try {
    const payload = {
      job_type_id: form.job_type_id,
      title: form.title.trim(),
      content: form.content,
      description: form.description.trim(),
      sort_order: form.sort_order,
    }
    if (editingId.value) {
      await updateTitleFormula(editingId.value, payload)
      message.success('修改成功')
    } else {
      await createTitleFormula(payload)
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
    await deleteTitleFormula(id)
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

.html-preview {
  max-height: 60px;
  overflow: hidden;
  font-size: 12px;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.html-preview :deep(p) {
  margin: 0;
}
</style>
