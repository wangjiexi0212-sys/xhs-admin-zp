<template>
  <div>
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-space>
        <a-select
          v-model:value="filterScene"
          placeholder="全部场景"
          :options="sceneOptions"
          allow-clear
          style="width: 160px"
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
      <a-button type="primary" @click="openCreate">+ 新建提示词</a-button>
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
        <template v-if="column.key === 'scene'">
          <a-tag v-if="record.scene" :color="sceneColor(record.scene)">
            {{ sceneLabel(record.scene) }}
          </a-tag>
          <span v-else style="color: #bbb">-</span>
        </template>
        <template v-else-if="column.key === 'content'">
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
      :title="editingId ? '编辑提示词' : '新建提示词'"
      :confirm-loading="submitting"
      width="720px"
      :destroy-on-close="true"
      @ok="onSubmit"
      @cancel="closeModal"
    >
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" style="margin-top: 8px">
        <a-row :gutter="16">
          <a-col :span="14">
            <a-form-item label="提示词名称" name="name">
              <a-input v-model:value="form.name" placeholder="请输入名称" :maxlength="80" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="使用场景" name="scene">
              <a-select
                v-model:value="form.scene"
                placeholder="请选择"
                :options="sceneOptions"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="排序" name="sort_order">
              <a-input-number v-model:value="form.sort_order" :min="0" style="width: 100%" />
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
import {
  getPromptList,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from '@/api/prompts'

// 场景配置
const SCENES = [
  { label: '生成标题', value: 'title', color: 'blue' },
  { label: '生成正文', value: 'content', color: 'green' },
  { label: '生成面试题', value: 'interview', color: 'orange' },
  { label: '笔试题', value: 'exam', color: 'magenta' },
  { label: '生成图片描述', value: 'image', color: 'purple' },
  { label: '其他', value: 'other', color: 'default' },
]
const sceneOptions = SCENES.map(s => ({ label: s.label, value: s.value }))
const sceneLabel = val => SCENES.find(s => s.value === val)?.label ?? val
const sceneColor = val => SCENES.find(s => s.value === val)?.color ?? 'default'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const filterScene = ref(undefined)

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '名称', dataIndex: 'name', width: 180 },
  { title: '使用场景', key: 'scene', width: 130 },
  { title: '提示词内容', key: 'content', ellipsis: true },
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
    if (filterScene.value) params.scene = filterScene.value
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await getPromptList(params)
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
  name: '',
  scene: undefined,
  content: '',
  description: '',
  sort_order: 0,
})

const rules = {
  name: [{ required: true, message: '请输入提示词名称', whitespace: true }],
  content: [{ required: true, message: '请输入提示词内容', whitespace: true }],
}

function resetForm() {
  form.name = ''
  form.scene = undefined
  form.content = ''
  form.description = ''
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
  form.name = record.name
  form.scene = record.scene ?? undefined
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
  submitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      scene: form.scene ?? '',
      content: form.content.trim(),
      description: form.description.trim(),
      sort_order: form.sort_order,
    }
    if (editingId.value) {
      await updatePrompt(editingId.value, payload)
      message.success('修改成功')
    } else {
      await createPrompt(payload)
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
    await deletePrompt(id)
    message.success('删除成功')
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
