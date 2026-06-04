<template>
  <div>
    <a-tabs v-model:activeKey="activeCategory" @change="onTabChange">
      <a-tab-pane v-for="cat in CATEGORIES" :key="cat.code" :tab="cat.name" />
    </a-tabs>

    <div class="toolbar">
      <a-input-search
        v-model:value="keyword"
        placeholder="搜索名称/描述"
        allow-clear
        style="width: 240px"
        @search="onSearch"
      />
      <a-button type="primary" @click="openModal()">+ 新增</a-button>
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
        <template v-if="column.key === 'images'">
          <span v-if="!record.images?.length" style="color: #999">暂无图片</span>
          <a-space v-else>
            <span>{{ record.images.length }} 张</span>
            <a-button type="link" size="small" @click="previewImages(record)">预览</a-button>
          </a-space>
        </template>
        <template v-else-if="column.key === 'created_at'">
          {{ formatTime(record.created_at) }}
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

    <!-- 编辑弹窗 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editId ? '编辑' : '新增'"
      :confirm-loading="submitting"
      :width="640"
      @ok="onSubmit"
      @cancel="resetModal"
    >
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" style="margin-top: 8px">
        <a-form-item label="名称" name="title">
          <a-input v-model:value="form.title" placeholder="请输入名称" :maxlength="100" />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="form.description" :rows="2" placeholder="选填" />
        </a-form-item>
        <a-form-item label="排序值" name="sort_order">
          <a-input-number v-model:value="form.sort_order" :min="0" style="width: 150px" />
          <span style="margin-left: 8px; color: #999; font-size: 12px">数字越大越靠前</span>
        </a-form-item>
        <a-form-item label="图片列表">
          <a-upload
            v-model:file-list="fileList"
            list-type="picture-card"
            accept="image/*"
            :custom-request="customUpload"
            :before-upload="beforeUpload"
            @preview="onPreviewFile"
          >
            <div v-if="fileList.length < 30">
              <PlusOutlined />
              <div style="margin-top: 8px">上传</div>
            </div>
          </a-upload>
          <div style="font-size: 12px; color: #aaa">单张 ≤ 10MB，支持 jpg/png/gif/webp/bmp/svg</div>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="filePreviewOpen" :footer="null" :title="null" :width="720">
      <img :src="filePreviewUrl" style="width: 100%" />
    </a-modal>

    <!-- 图片预览 -->
    <a-modal
      v-model:open="previewOpen"
      :title="`图片预览 — ${previewRecord.title}`"
      :footer="null"
      :width="700"
    >
      <div class="preview-grid">
        <div v-for="(url, idx) in previewRecord.images" :key="idx" class="preview-item">
          <img :src="url" :alt="`图片${idx + 1}`" @error="onImgError" />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import {
  NOTE_IMAGE_CATEGORIES as CATEGORIES,
  getNoteImageList,
  createNoteImage,
  updateNoteImage,
  deleteNoteImage,
} from '@/api/noteImages'
import { uploadImage } from '@/api/upload'

const activeCategory = ref(CATEGORIES[0].code)
const keyword = ref('')
const loading = ref(false)
const list = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: t => `共 ${t} 条` })

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '名称', dataIndex: 'title' },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '图片', key: 'images', width: 130 },
  { title: '排序', dataIndex: 'sort_order', width: 80 },
  { title: '创建人', dataIndex: 'created_by_name', width: 110 },
  { title: '创建时间', key: 'created_at', width: 170 },
  { title: '操作', key: 'action', width: 140, fixed: 'right' },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await getNoteImageList({
      category: activeCategory.value,
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

function onTabChange() {
  pagination.current = 1
  keyword.value = ''
  fetchList()
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

// --- 编辑弹窗 ---
const modalOpen = ref(false)
const submitting = ref(false)
const editId = ref(null)
const formRef = ref(null)
const form = reactive({ title: '', description: '', sort_order: 0 })
const fileList = ref([])

const rules = {
  title: [{ required: true, message: '请输入名称', whitespace: true }],
}

function urlsToFileList(urls) {
  return (urls || []).map((url, i) => ({
    uid: `exist-${i}`,
    name: url.split('/').pop() || `image-${i}`,
    status: 'done',
    url,
    thumbUrl: url,
  }))
}

function openModal(record = null) {
  editId.value = record?.id ?? null
  form.title = record?.title ?? ''
  form.description = record?.description ?? ''
  form.sort_order = record?.sort_order ?? 0
  fileList.value = urlsToFileList(record?.images)
  modalOpen.value = true
}

function resetModal() {
  formRef.value?.resetFields()
  editId.value = null
  form.title = ''
  form.description = ''
  form.sort_order = 0
  fileList.value = []
}

async function onSubmit() {
  try { await formRef.value.validate() } catch { return }

  const uploading = fileList.value.some(f => f.status === 'uploading')
  if (uploading) { message.warning('请等待图片上传完成'); return }

  submitting.value = true
  try {
    const images = fileList.value
      .filter(f => f.status === 'done')
      .map(f => f.url || f.response?.url)
      .filter(Boolean)

    const payload = {
      category: activeCategory.value,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      sort_order: form.sort_order ?? 0,
      images,
    }
    if (editId.value) {
      await updateNoteImage(editId.value, payload)
      message.success('修改成功')
    } else {
      await createNoteImage(payload)
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

function beforeUpload(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml']
  if (!allowed.includes(file.type)) {
    message.error('不支持的文件类型')
    return false
  }
  if (file.size > 10 * 1024 * 1024) {
    message.error('文件超过 10MB')
    return false
  }
  return true
}

async function customUpload({ file, onSuccess, onError, onProgress }) {
  try {
    onProgress({ percent: 30 })
    const result = await uploadImage(file)
    onProgress({ percent: 100 })
    // 更新 fileList 中这条记录的 url
    const item = fileList.value.find(f => f.uid === file.uid)
    if (item) { item.url = result.url; item.thumbUrl = result.url }
    onSuccess(result)
  } catch (e) {
    onError(e)
    message.error(e.message || '上传失败')
  }
}

async function onDelete(id) {
  try {
    await deleteNoteImage(id)
    message.success('删除成功')
    if (list.value.length === 1 && pagination.current > 1) pagination.current--
    fetchList()
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

// --- 图片预览（编辑表单内点击预览） ---
const filePreviewOpen = ref(false)
const filePreviewUrl = ref('')
function onPreviewFile(file) {
  filePreviewUrl.value = file.url || file.thumbUrl
  filePreviewOpen.value = true
}

// --- 列表行预览 ---
const previewOpen = ref(false)
const previewRecord = ref({ title: '', images: [] })

function previewImages(record) {
  previewRecord.value = record
  previewOpen.value = true
}

function onImgError(e) {
  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23eee" width="80" height="80"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23aaa" font-size="12">加载失败</text></svg>'
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
.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.preview-item img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  display: block;
}
</style>
