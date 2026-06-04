<template>
  <div>
    <div class="toolbar">
      <span style="font-size: 15px; font-weight: 600">LLM 配置</span>
      <a-button type="primary" @click="goCreate">+ 新建配置</a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="list"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'api_key'">
          <span style="letter-spacing: 2px">••••••••</span>
        </template>
        <template v-else-if="column.key === 'in_use'">
          <a-space>
            <a-switch
              :checked="!!record.in_use"
              checked-children="使用中"
              un-checked-children="未启用"
              @change="(checked) => onToggleActive(record, checked)"
            />
            <a-tag v-if="record.in_use" color="green">使用中</a-tag>
          </a-space>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="goEdit(record.id)">编辑</a-button>
            <a-popconfirm title="确定删除？" ok-text="删除" ok-type="danger" @confirm="onDelete(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { getLlmConfigs, deleteLlmConfig } from '@/api/llmConfig'
import { useLlmStore } from '@/stores/llm'

const router = useRouter()
const llmStore = useLlmStore()
const list = ref([])

const columns = [
  { title: 'ID', dataIndex: 'id', width: 130 },
  { title: '配置名称', dataIndex: 'name' },
  { title: '服务商', dataIndex: 'provider', width: 120 },
  { title: '默认模型', dataIndex: 'default_model', width: 200 },
  { title: 'Base URL', dataIndex: 'base_url', ellipsis: true },
  { title: 'API Key', key: 'api_key', width: 120 },
  { title: '使用中', key: 'in_use', width: 160 },
  { title: '操作', key: 'action', width: 130, fixed: 'right' },
]

function fetchList() {
  list.value = getLlmConfigs()
}

function goCreate() {
  router.push('/system/llm/create')
}

function goEdit(id) {
  router.push(`/system/llm/edit/${id}`)
}

function onDelete(id) {
  deleteLlmConfig(id)
  message.success('删除成功')
  fetchList()
}

function onToggleActive(record, checked) {
  if (!checked) {
    llmStore.clearActive()
    message.success(`已停用：${record.name}`)
    fetchList()
    return
  }
  const current = list.value.find(item => item.in_use && item.id !== record.id)
  if (current) {
    Modal.confirm({
      title: '切换使用中的配置',
      content: `当前使用中的是「${current.name}」，切换为「${record.name}」？`,
      okText: '切换',
      cancelText: '取消',
      onOk: () => {
        llmStore.setActive(record.id)
        message.success(`已设为使用中：${record.name}`)
        fetchList()
      },
    })
  } else {
    llmStore.setActive(record.id)
    message.success(`已设为使用中：${record.name}`)
    fetchList()
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
