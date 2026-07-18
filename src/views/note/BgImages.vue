<template>
  <div>
    <div class="toolbar">
      <a-upload
        accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
        :show-upload-list="false"
        :multiple="true"
        :before-upload="onBeforeUpload"
      >
        <a-button type="primary" :loading="uploading">
          <template #icon><UploadOutlined /></template>
          上传图片
        </a-button>
      </a-upload>
    </div>

    <a-spin :spinning="loading">
      <div v-if="!list.length && !loading" class="empty">
        <a-empty description="暂无图片" />
      </div>
      <div v-else class="grid">
        <div v-for="item in list" :key="item.id" class="thumb-card">
          <div class="thumb-wrap" @click="openPreview(item.url)">
            <img :src="item.url" class="thumb-img" />
            <div class="thumb-mask">
              <ZoomInOutlined class="mask-icon" />
            </div>
          </div>
          <div class="thumb-footer">
            <a-popconfirm title="确定删除？" ok-text="删除" ok-type="danger" @confirm="onDelete(item.id)">
              <DeleteOutlined class="del-icon" />
            </a-popconfirm>
          </div>
        </div>
      </div>
    </a-spin>

    <a-modal
      v-model:open="previewVisible"
      :footer="null"
      :body-style="{ padding: '8px', textAlign: 'center', background: '#000' }"
      :width="900"
      centered
    >
      <img :src="previewUrl" style="max-width: 100%; max-height: 80vh; object-fit: contain" />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { UploadOutlined, ZoomInOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { uploadImage } from '@/api/upload'
import { getBgImageList, createBgImage, deleteBgImage } from '@/api/bgImages'

const loading = ref(false)
const uploading = ref(false)
const list = ref([])
const previewVisible = ref(false)
const previewUrl = ref('')

let pendingFiles = []
let uploadTimer = null

async function fetchList() {
  loading.value = true
  try {
    const res = await getBgImageList()
    list.value = res.list || []
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onBeforeUpload(file) {
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
      await createBgImage(result.url)
      successCount++
    } catch (e) {
      message.error(`「${file.name}」上传失败：${e.message}`)
    }
  }
  uploading.value = false
  if (successCount > 0) {
    message.success(`成功上传 ${successCount} 张`)
    fetchList()
  }
}

function openPreview(url) {
  previewUrl.value = url
  previewVisible.value = true
}

async function onDelete(id) {
  try {
    await deleteBgImage(id)
    list.value = list.value.filter(item => item.id !== id)
    message.success('已删除')
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

onMounted(fetchList)
</script>

<style scoped>
.toolbar {
  margin-bottom: 20px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
.thumb-card {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  background: #fafafa;
}
.thumb-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  cursor: pointer;
  overflow: hidden;
  background: #eee;
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s;
}
.thumb-wrap:hover .thumb-img {
  transform: scale(1.05);
}
.thumb-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.thumb-wrap:hover .thumb-mask {
  opacity: 1;
}
.mask-icon {
  font-size: 28px;
  color: #fff;
}
.thumb-footer {
  padding: 6px 10px;
  text-align: right;
}
.del-icon {
  font-size: 16px;
  color: #ff4d4f;
  cursor: pointer;
}
.del-icon:hover {
  color: #cf1322;
}
.empty {
  padding: 60px 0;
}
</style>
