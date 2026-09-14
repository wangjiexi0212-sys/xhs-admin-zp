<template>
  <div class="regular-product-list">
    <!-- 搜索栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索标题"
          style="width: 240px"
          @search="handleSearch"
          allow-clear
          @change="e => { if (!e.target.value) handleSearch('') }"
        />
      </div>
      <div class="toolbar-right">
        <a-button type="primary" @click="$router.push('/regular-product/create')">
          + 新增常规商品
        </a-button>
      </div>
    </div>

    <!-- 表格 -->
    <a-table
      :columns="columns"
      :data-source="list"
      :pagination="pagination"
      :loading="loading"
      row-key="id"
      @change="handleTableChange"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'disk_path'">
          <span class="disk-path">{{ record.disk_path }}</span>
        </template>
        <template v-else-if="column.key === 'created_at'">
          {{ formatTime(record.created_at) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="$router.push(`/regular-product/detail/${record.id}`)">详情</a-button>
            <a-button type="link" size="small" @click="$router.push(`/regular-product/edit/${record.id}`)">编辑</a-button>
            <a-popconfirm title="确认删除该商品？" @confirm="handleDelete(record.id)" ok-text="删除" ok-type="danger" cancel-text="取消">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { getRegularProductList, deleteRegularProduct } from '@/api/regularProducts'

const keyword = ref('')
const loading = ref(false)
const list = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showSizeChanger: true, showQuickJumper: true })

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '网盘路径', dataIndex: 'disk_path', key: 'disk_path', ellipsis: true },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await getRegularProductList({
      keyword: keyword.value,
      page: pagination.current,
      pageSize: pagination.pageSize,
    })
    list.value = res.list || []
    pagination.total = res.total || 0
  } catch (e) {
    message.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch(val) {
  keyword.value = val
  pagination.current = 1
  fetchList()
}

function handleTableChange(pag) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchList()
}

async function handleDelete(id) {
  try {
    await deleteRegularProduct(id)
    message.success('删除成功')
    fetchList()
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

onMounted(fetchList)
</script>

<style scoped>
.regular-product-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.disk-path {
  font-family: monospace;
  color: #555;
}

.tags-text {
  white-space: normal;
  word-break: break-all;
  line-height: 1.5;
  font-size: 13px;
  color: #333;
}

.text-gray {
  color: #aaa;
}
</style>
