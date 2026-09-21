<template>
  <a-card title="资料库管理">
    <a-space style="margin-bottom: 16px">
      <a-select v-model:value="query.categoryId" style="width: 180px" allow-clear placeholder="分类" @change="load">
        <a-select-option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</a-select-option>
      </a-select>
      <a-input-search v-model:value="query.keyword" placeholder="搜索资料" allow-clear @search="load" />
    </a-space>
    <a-table :data-source="rows" :columns="columns" row-key="id" :loading="loading" :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag>{{ record.resource_type }}</a-tag>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-switch :checked="record.status === 1" @change="checked => setStatus(record, checked)" />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-popconfirm
            title="确定下架该资料？如果是目录，子目录和文件会一并下架。"
            ok-text="下架"
            ok-type="danger"
            cancel-text="取消"
            @confirm="onDelete(record)"
          >
            <a-button size="small" type="link" danger>下架</a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { deletePasslyResource, getPasslyCategories, getPasslyResources, updatePasslyResourceStatus } from '@/api/passly'

const rows = ref([])
const categories = ref([])
const loading = ref(false)
const query = reactive({ keyword: '', categoryId: undefined, page: 1, pageSize: 20 })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const columns = [
  { title: '名称', dataIndex: 'name' },
  { title: '分类', dataIndex: 'category_name', width: 140 },
  { title: '类型', key: 'type', width: 90 },
  { title: '网盘路径', dataIndex: 'pan_path' },
  { title: '浏览', dataIndex: 'view_count', width: 80 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 90 },
]

async function load() {
  loading.value = true
  try {
    const data = await getPasslyResources(query)
    rows.value = data.list
    pagination.current = data.page
    pagination.pageSize = data.pageSize
    pagination.total = data.total
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function setStatus(record, checked) {
  await updatePasslyResourceStatus(record.id, checked ? 1 : 0)
  load()
}

async function onDelete(record) {
  try {
    await deletePasslyResource(record.id)
    message.success('已下架')
    load()
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

function onTableChange(p) {
  query.page = p.current
  query.pageSize = p.pageSize
  load()
}

onMounted(async () => {
  categories.value = await getPasslyCategories()
  load()
})
</script>
