<template>
  <div>
    <div class="toolbar">
      <a-space wrap>
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索公告名称/单位"
          allow-clear
          style="width: 240px"
          @search="onSearch"
        />
        <a-select
          v-model:value="filterJobTypeId"
          placeholder="商品类型"
          allow-clear
          style="width: 180px"
          :options="jobTypeOptions"
          @change="onSearch"
        />
        <a-select
          v-model:value="filterStatus"
          placeholder="状态"
          allow-clear
          style="width: 120px"
          :options="statusOptions"
          @change="onSearch"
        />
      </a-space>
      <a-button type="primary" @click="goCreate">+ 新增商品</a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 1400 }"
      row-key="id"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status ? 'green' : 'default'">
            {{ record.status ? '上架' : '下架' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'source_url'">
          <a v-if="record.source_url" :href="record.source_url" target="_blank" rel="noopener">查看</a>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.key === 'created_at'">
          {{ formatTime(record.created_at) }}
        </template>
        <template v-else-if="column.key === 'updated_at'">
          {{ formatTime(record.updated_at) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" type="link" @click="goDetail(record.id)">详情</a-button>
            <a-button size="small" type="link" @click="goEdit(record.id)">编辑</a-button>
            <a-popconfirm title="确定删除？" ok-text="删除" ok-type="danger" @confirm="onDelete(record.id)">
              <a-button size="small" type="link" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { getProductList, deleteProduct } from '@/api/products'
import { getJobTypeList } from '@/api/jobTypes'

const router = useRouter()

const keyword = ref('')
const filterJobTypeId = ref()
const filterStatus = ref()
const loading = ref(false)
const list = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: t => `共 ${t} 条` })

const statusOptions = [
  { label: '上架', value: 1 },
  { label: '下架', value: 0 },
]
const jobTypeOptions = ref([])

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70, fixed: 'left' },
  { title: '公告名称', dataIndex: 'title', width: 240, ellipsis: true },
  { title: '单位', dataIndex: 'company_name', width: 160, ellipsis: true },
  { title: '人数', dataIndex: 'recruit_count', width: 90 },
  { title: '类型', dataIndex: 'job_type_name', width: 120 },
  { title: '报名时间', dataIndex: 'apply_time', width: 160 },
  { title: '笔试时间', dataIndex: 'written_exam_time', width: 140 },
  { title: '面试时间', dataIndex: 'interview_time', width: 140 },
  { title: '原文', key: 'source_url', width: 70 },
  { title: '状态', key: 'status', width: 80 },
  { title: '创建人', dataIndex: 'created_by_name', width: 100 },
  { title: '创建时间', key: 'created_at', width: 170 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

async function fetchList() {
  loading.value = true
  try {
    const res = await getProductList({
      keyword: keyword.value,
      job_type_id: filterJobTypeId.value,
      status: filterStatus.value,
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

async function fetchJobTypes() {
  try {
    const res = await getJobTypeList({ pageSize: 100 })
    jobTypeOptions.value = (res.list || []).map(t => ({ label: t.name, value: t.id }))
  } catch {}
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

function goCreate() {
  router.push('/product/create')
}

function goEdit(id) {
  router.push(`/product/edit/${id}`)
}

function goDetail(id) {
  router.push(`/product/detail/${id}`)
}

async function onDelete(id) {
  try {
    await deleteProduct(id)
    message.success('删除成功')
    if (list.value.length === 1 && pagination.current > 1) pagination.current--
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
  gap: 12px;
  flex-wrap: wrap;
}
</style>
