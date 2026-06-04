<template>
  <div class="main">
    <!-- 页头 -->
    <div class="page-header">
      <a-button @click="goBack">
        <template #icon>
          <LeftOutlined />
        </template>
        返回列表
      </a-button>
      <span class="page-title">{{ isEditing ? '编辑标题公式' : '标题公式详情' }}</span>
      <a-space v-if="!isEditing">
        <a-button type="primary" @click="startEdit">
          <template #icon>
            <EditOutlined />
          </template>
          编辑
        </a-button>
      </a-space>
      <a-space v-else>
        <a-button @click="cancelEdit">取消</a-button>
        <a-button type="primary" :loading="submitting" @click="onSubmit">保存</a-button>
      </a-space>
    </div>

    <div class="content">
      <a-spin :spinning="loading">
        <!-- 查看模式 -->
        <template v-if="!isEditing">
          <a-card :bordered="false">
            <a-descriptions :column="3" bordered size="small">
              <a-descriptions-item label="公式标题" :span="3">
                {{ data.title || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="商品类型">
                {{ data.job_type_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="排序">
                {{ data.sort_order ?? '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="备注">
                {{ data.description || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="创建人">
                {{ data.created_by_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="创建时间">
                {{ formatTime(data.created_at) }}
              </a-descriptions-item>
              <a-descriptions-item label="最后修改">
                {{ formatTime(data.updated_at) }}
              </a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card title="公式内容" :bordered="false" style="margin-top: 12px">
            <div class="html-content" v-html="data.content" />
          </a-card>
        </template>

        <!-- 编辑模式 -->
        <template v-else>
          <a-card :bordered="false">
            <a-form :model="form" :rules="rules" ref="formRef" layout="vertical">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="商品类型" name="job_type_id">
                    <a-select v-model:value="form.job_type_id" placeholder="请选择商品类型" :options="jobTypeOptions" />
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
                      <Toolbar :editor="editorRef" :defaultConfig="toolbarConfig" mode="default"
                        style="border-bottom: 1px solid #d9d9d9" />
                      <Editor v-model="form.content" :defaultConfig="editorConfig" mode="default"
                        style="height: 400px; overflow-y: hidden" @onCreated="handleEditorCreated" />
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
          </a-card>

          <div class="page-footer">
            <a-button @click="cancelEdit">取消</a-button>
            <a-button type="primary" :loading="submitting" @click="onSubmit">保存</a-button>
          </div>
        </template>
      </a-spin>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LeftOutlined, EditOutlined } from '@ant-design/icons-vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import { getTitleFormulaDetail, updateTitleFormula } from '@/api/titleFormulas'
import { getJobTypeList } from '@/api/jobTypes'

const route = useRoute()
const router = useRouter()

const id = computed(() => Number(route.params.id))
const loading = ref(false)
const data = ref({})
const isEditing = ref(false)

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function goBack() {
  router.push('/note/title-formula')
}

// ---- 商品类型 ----
const jobTypes = ref([])
const jobTypeOptions = computed(() =>
  jobTypes.value.map(t => ({ label: t.name, value: t.id }))
)

async function fetchJobTypes() {
  try {
    const res = await getJobTypeList({ page: 1, pageSize: 100 })
    jobTypes.value = res.list ?? []
  } catch {
    jobTypes.value = []
  }
}

// ---- 详情 ----
async function fetchDetail() {
  loading.value = true
  try {
    data.value = await getTitleFormulaDetail(id.value)
  } catch (e) {
    message.error(e.message || '加载失败')
    router.replace('/note/title-formula')
  } finally {
    loading.value = false
  }
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

// ---- 编辑 ----
const formRef = ref(null)
const submitting = ref(false)
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

function startEdit() {
  form.job_type_id = data.value.job_type_id
  form.title = data.value.title
  form.content = data.value.content
  form.description = data.value.description ?? ''
  form.sort_order = data.value.sort_order ?? 0
  contentError.value = ''
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  formRef.value?.clearValidate()
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
    await updateTitleFormula(id.value, {
      job_type_id: form.job_type_id,
      title: form.title.trim(),
      content: form.content,
      description: form.description.trim(),
      sort_order: form.sort_order,
    })
    message.success('修改成功')
    isEditing.value = false
    await fetchDetail()
  } catch (e) {
    message.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchJobTypes()
  fetchDetail()
})
</script>

<style lang="less" scoped>
.main {
  display: flex;
  flex-flow: column;

  height: 100vh;

  .page-header {
    height: 60px;
  }

  .content {
    overflow-y: scroll;
  }
}

.page-header {
  position: sticky;
  top: 64px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: -16px -16px 16px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.html-content {
  line-height: 1.8;
  font-size: 14px;
}

.html-content :deep(p) {
  margin: 0 0 8px;
}

.html-content :deep(img) {
  max-width: 100%;
}

.page-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}
</style>
