<template>
  <div class="page">
    <div class="toolbar">
      <div>
        <h2>商品图管理</h2>
        <p>集中管理商品详情、宣传素材等图片；上传后仅保存至图库，不会自动关联商品。</p>
      </div>
      <a-upload
        accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
        :show-upload-list="false"
        :multiple="true"
        :before-upload="onBeforeUpload"
      >
        <a-button type="primary" :loading="uploading">
          <template #icon><UploadOutlined /></template>
          上传商品图
        </a-button>
      </a-upload>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!list.length && !loading" description="暂无商品图" class="empty" />
      <div v-else class="grid">
        <article v-for="item in list" :key="item.id" class="card">
          <button class="image-button" type="button" @click="openPreview(item)">
            <img :src="item.url" :alt="item.file_name || '商品图'" @error="onImgError" />
            <span class="image-mask"><ZoomInOutlined /> 预览</span>
          </button>
          <div class="card-body">
            <a-tooltip :title="item.file_name || '未命名图片'">
              <div class="file-name">{{ item.file_name || '未命名图片' }}</div>
            </a-tooltip>
            <div class="meta">{{ formatTime(item.created_at) }}</div>
            <div class="actions">
              <a-button size="small" @click="downloadImage(item)"><DownloadOutlined /> 下载</a-button>
              <a-popconfirm title="确定从商品图库删除这张图片？" ok-text="删除" ok-type="danger" @confirm="removeImage(item.id)">
                <a-button size="small" danger><DeleteOutlined /> 删除</a-button>
              </a-popconfirm>
            </div>
          </div>
        </article>
      </div>
    </a-spin>

    <a-modal v-model:open="previewVisible" :title="previewItem.file_name || '商品图预览'" :footer="null" :width="900" centered>
      <img :src="previewItem.url" class="preview" />
    </a-modal>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { DeleteOutlined, DownloadOutlined, UploadOutlined, ZoomInOutlined } from '@ant-design/icons-vue'
import { uploadImage } from '@/api/upload'
import { createProductImage, deleteProductImage, getProductImageList } from '@/api/productImages'

const loading = ref(false)
const uploading = ref(false)
const list = ref([])
const previewVisible = ref(false)
const previewItem = ref({ url: '', file_name: '' })
let pendingFiles = []
let uploadTimer = null

async function fetchList() {
  loading.value = true
  try {
    const res = await getProductImageList()
    list.value = res.list || []
  } catch (error) {
    message.error(error?.message || '加载商品图失败')
  } finally {
    loading.value = false
  }
}

function onBeforeUpload(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml']
  if (!allowed.includes(file.type)) {
    message.error(`「${file.name}」不是支持的图片类型`)
    return false
  }
  if (file.size > 10 * 1024 * 1024) {
    message.error(`「${file.name}」超过 10MB`)
    return false
  }
  pendingFiles.push(file)
  clearTimeout(uploadTimer)
  uploadTimer = setTimeout(flushUpload, 80)
  return false
}

async function flushUpload() {
  const files = pendingFiles.splice(0)
  if (!files.length) return
  uploading.value = true
  let successCount = 0
  for (const file of files) {
    try {
      const result = await uploadImage(file)
      if (!result?.url) throw new Error('未返回图片地址')
      await createProductImage({ url: result.url, file_name: file.name })
      successCount += 1
    } catch (error) {
      message.error(`「${file.name}」上传失败：${error?.message || '未知错误'}`)
    }
  }
  uploading.value = false
  if (successCount) {
    message.success(`已上传 ${successCount} 张商品图`)
    fetchList()
  }
}

function openPreview(item) {
  previewItem.value = item
  previewVisible.value = true
}

async function downloadImage(item) {
  try {
    const response = await fetch(item.url)
    if (!response.ok) throw new Error('下载失败')
    const blob = await response.blob()
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = item.file_name || `商品图-${item.id}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(href)
  } catch (error) {
    message.error(error?.message || '下载失败')
  }
}

async function removeImage(id) {
  try {
    await deleteProductImage(id)
    list.value = list.value.filter(item => item.id !== id)
    message.success('已从商品图库删除')
  } catch (error) {
    message.error(error?.message || '删除失败')
  }
}

function formatTime(time) {
  return time ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function onImgError(event) {
  event.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect fill="%23f3f4f6" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="16">图片加载失败</text></svg>'
}

onMounted(fetchList)
</script>

<style scoped>
.page { padding: 4px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 20px; }
h2 { margin: 0; font-size: 20px; color: #1f2937; }
p { margin: 6px 0 0; color: #8c8c8c; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.card { overflow: hidden; border: 1px solid #f0f0f0; border-radius: 8px; background: #fff; transition: box-shadow .2s, transform .2s; }
.card:hover { box-shadow: 0 8px 24px rgba(0,0,0,.09); transform: translateY(-2px); }
.image-button { position: relative; display: block; width: 100%; aspect-ratio: 4 / 3; padding: 0; border: 0; background: #f5f5f5; cursor: pointer; overflow: hidden; }
.image-button img { width: 100%; height: 100%; object-fit: cover; display: block; }
.image-mask { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 6px; color: #fff; background: rgba(0,0,0,.42); opacity: 0; transition: opacity .2s; font-size: 14px; }
.image-button:hover .image-mask { opacity: 1; }
.card-body { padding: 10px 12px 12px; }
.file-name { overflow: hidden; color: #262626; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.meta { margin-top: 5px; color: #999; font-size: 12px; }
.actions { display: flex; gap: 8px; margin-top: 10px; }
.preview { display: block; max-width: 100%; max-height: 76vh; margin: 0 auto; object-fit: contain; }
.empty { padding: 72px 0; }
@media (max-width: 640px) { .toolbar { align-items: flex-start; flex-direction: column; } }
</style>
