<template>
  <a-card title="海报管理">
    <template #extra>
      <a-button type="primary" @click="openCreate">新增海报</a-button>
    </template>

    <a-space style="margin-bottom: 16px">
      <a-input-search
        v-model:value="query.keyword"
        placeholder="搜索海报名称"
        allow-clear
        style="width: 260px"
        @search="search"
      />
      <a-select v-model:value="query.status" allow-clear placeholder="状态" style="width: 120px" @change="search">
        <a-select-option :value="1">启用</a-select-option>
        <a-select-option :value="0">停用</a-select-option>
      </a-select>
    </a-space>

    <a-table
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'image'">
          <a-image :src="record.image_url" :width="72" :height="96" style="object-fit: cover; border-radius: 6px" />
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'default'">{{ record.status === 1 ? '启用' : '停用' }}</a-tag>
        </template>
        <template v-else-if="column.key === 'created_at'">
          {{ formatTime(record.created_at) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button type="link" size="small" @click="downloadPoster(record)">下载</a-button>
            <a-popconfirm title="确定删除该海报？图片文件也会一并删除。" @confirm="remove(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑海报' : '新增海报'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="save"
    >
      <a-form layout="vertical">
        <a-form-item label="海报名称" required>
          <a-input v-model:value="form.title" maxlength="80" placeholder="请输入海报名称" />
        </a-form-item>
        <a-form-item label="海报图片" required>
          <a-upload
            accept="image/jpeg,image/png,image/webp"
            :show-upload-list="false"
            :before-upload="beforeUpload"
          >
            <div v-if="form.imageUrl" class="poster-upload-preview">
              <img :src="form.imageUrl" alt="海报预览" />
              <div class="poster-upload-mask">点击更换</div>
            </div>
            <a-button v-else :loading="uploading">选择并上传图片</a-button>
          </a-upload>
          <div class="upload-tip">支持 JPG、PNG、WebP，单张不超过 10MB</div>
        </a-form-item>
        <a-form-item label="说明">
          <a-textarea v-model:value="form.description" :rows="3" maxlength="300" show-count />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="排序">
              <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-switch v-model:checked="form.enabled" checked-children="启用" un-checked-children="停用" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { uploadImage } from '@/api/upload'
import { createPasslyPoster, deletePasslyPoster, getPasslyPosters, updatePasslyPoster } from '@/api/passly'

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const modalOpen = ref(false)
const editingId = ref(null)
const query = reactive({ keyword: '', status: undefined, page: 1, pageSize: 20 })
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showSizeChanger: true })
const form = reactive({ title: '', description: '', imageUrl: '', fileName: '', sortOrder: 0, enabled: true })

const columns = [
  { title: '预览', key: 'image', width: 105 },
  { title: '海报名称', dataIndex: 'title', ellipsis: true },
  { title: '说明', dataIndex: 'description', ellipsis: true },
  { title: '排序', dataIndex: 'sort_order', width: 80 },
  { title: '状态', key: 'status', width: 80 },
  { title: '创建时间', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' },
]

function resetForm() {
  Object.assign(form, { title: '', description: '', imageUrl: '', fileName: '', sortOrder: 0, enabled: true })
}

async function load() {
  loading.value = true
  try {
    const data = await getPasslyPosters(query)
    rows.value = data.list || []
    pagination.current = data.page
    pagination.pageSize = data.pageSize
    pagination.total = data.total
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

function openCreate() {
  editingId.value = null
  resetForm()
  modalOpen.value = true
}

function openEdit(record) {
  editingId.value = record.id
  Object.assign(form, {
    title: record.title,
    description: record.description || '',
    imageUrl: record.image_url,
    fileName: record.file_name || '',
    sortOrder: record.sort_order || 0,
    enabled: record.status === 1,
  })
  modalOpen.value = true
}

async function beforeUpload(file) {
  uploading.value = true
  try {
    const result = await uploadImage(file)
    form.imageUrl = result.url
    form.fileName = result.name || file.name
    if (!form.title) form.title = file.name.replace(/\.[^.]+$/, '')
    message.success('图片上传成功')
  } catch (e) {
    message.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
  return false
}

async function save() {
  if (!form.title.trim()) return message.warning('请输入海报名称')
  if (!form.imageUrl) return message.warning('请上传海报图片')
  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl,
      fileName: form.fileName,
      sortOrder: form.sortOrder,
      status: form.enabled ? 1 : 0,
    }
    if (editingId.value) await updatePasslyPoster(editingId.value, payload)
    else await createPasslyPoster(payload)
    message.success(editingId.value ? '更新成功' : '新增成功')
    modalOpen.value = false
    load()
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(record) {
  try {
    await deletePasslyPoster(record.id)
    message.success('删除成功')
    load()
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

async function downloadPoster(record) {
  try {
    const response = await fetch(record.image_url)
    if (!response.ok) throw new Error('图片读取失败')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = record.file_name || `${record.title}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    message.error(e.message || '下载失败')
  }
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function onTableChange(page) {
  query.page = page.current
  query.pageSize = page.pageSize
  load()
}

onMounted(load)
</script>

<style scoped>
.poster-upload-preview {
  position: relative;
  width: 160px;
  height: 214px;
  overflow: hidden;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  cursor: pointer;
}
.poster-upload-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.poster-upload-mask {
  position: absolute;
  inset: auto 0 0;
  padding: 7px;
  color: #fff;
  text-align: center;
  background: rgba(0, 0, 0, 0.55);
}
.upload-tip {
  margin-top: 6px;
  color: #999;
  font-size: 12px;
}
</style>
