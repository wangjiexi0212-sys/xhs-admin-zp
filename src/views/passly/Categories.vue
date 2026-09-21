<template>
  <a-card title="资料分类">
    <a-button type="primary" style="margin-bottom: 16px" @click="open()">新增分类</a-button>
    <a-table :data-source="rows" :columns="columns" row-key="id" :loading="loading" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-switch :checked="record.status === 1" @change="checked => updateStatus(record, checked)" />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="open(record)">编辑</a-button>
            <a-button size="small" type="primary" :loading="syncing === record.id" @click="sync(record)">立即同步</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="modalOpen" title="资料分类" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="编码"><a-input v-model:value="form.code" /></a-form-item>
        <a-form-item label="图标"><a-input v-model:value="form.icon" /></a-form-item>
        <a-form-item label="描述"><a-textarea v-model:value="form.description" /></a-form-item>
        <a-form-item label="百度网盘目录"><a-input v-model:value="form.panPath" placeholder="/PASSLY/公基" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="form.sort" style="width: 100%" /></a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { createPasslyCategory, getPasslyCategories, syncPasslyCategoryPan, updatePasslyCategory, updatePasslyCategoryStatus } from '@/api/passly'

const rows = ref([])
const loading = ref(false)
const modalOpen = ref(false)
const syncing = ref(null)
const blank = { id: null, name: '', code: '', icon: '', description: '', panPath: '', sort: 0, status: 1, resourceSource: 'baidu_pan', showChildren: true, autoSync: false }
const form = reactive({ ...blank })
const columns = [
  { title: '名称', dataIndex: 'name' },
  { title: '编码', dataIndex: 'code', width: 140 },
  { title: '网盘目录', dataIndex: 'panPath' },
  { title: '排序', dataIndex: 'sort', width: 80 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 180 },
]

async function load() {
  loading.value = true
  try {
    rows.value = await getPasslyCategories()
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function open(record) {
  Object.assign(form, record || blank)
  modalOpen.value = true
}

async function save() {
  if (form.id) await updatePasslyCategory(form.id, form)
  else await createPasslyCategory(form)
  modalOpen.value = false
  message.success('已保存')
  load()
}

async function updateStatus(record, checked) {
  await updatePasslyCategoryStatus(record.id, checked ? 1 : 0)
  load()
}

async function sync(record) {
  syncing.value = record.id
  try {
    const data = await syncPasslyCategoryPan(record.id)
    message.success(`同步完成：已清空 ${data.deleted || 0} 条旧资料，新增 ${data.folders} 个目录，${data.pdfs} 个 PDF`)
    load()
  } catch (e) {
    message.error(e.message || '同步失败')
  } finally {
    syncing.value = null
  }
}

onMounted(load)
</script>
