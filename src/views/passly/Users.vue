<template>
  <a-card title="PASSLY 用户管理">
    <a-space style="margin-bottom: 16px">
      <a-input-search v-model:value="query.keyword" placeholder="搜索昵称或备注" allow-clear @search="load" />
      <a-select v-model:value="query.status" style="width: 120px" allow-clear placeholder="状态" @change="load">
        <a-select-option value="1">启用</a-select-option>
        <a-select-option value="0">禁用</a-select-option>
      </a-select>
      <a-select v-model:value="query.channel" style="width: 140px" allow-clear placeholder="来源渠道" @change="load">
        <a-select-option v-for="c in channels" :key="c.value" :value="c.value">{{ c.label }}</a-select-option>
      </a-select>
    </a-space>
    <a-table :data-source="rows" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-switch :checked="record.status === 1" @change="checked => save(record, { status: checked ? 1 : 0 })" />
        </template>
        <template v-else-if="column.key === 'remark'">
          <a-input v-model:value="record.remark" size="small" @pressEnter="save(record, { remark: record.remark || '' })" />
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getPasslyUsers, updatePasslyUser } from '@/api/passly'

const rows = ref([])
const loading = ref(false)
const query = reactive({ keyword: '', status: undefined, channel: undefined, page: 1, pageSize: 20 })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const channels = [
  { label: '小红书', value: 'xiaohongshu' },
  { label: '淘宝', value: 'taobao' },
  { label: '公众号', value: 'wechat_official' },
  { label: '赠送', value: 'gift' },
  { label: '内部测试', value: 'internal_test' },
  { label: '其他', value: 'other' },
]
const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '昵称', dataIndex: 'nickname' },
  { title: '渠道', dataIndex: 'source_channel', width: 120 },
  { title: '状态', key: 'status', width: 90 },
  { title: '登录次数', dataIndex: 'login_count', width: 90 },
  { title: '备注', key: 'remark' },
  { title: '最后登录', dataIndex: 'last_login_at', width: 170 },
]

async function load() {
  loading.value = true
  try {
    const data = await getPasslyUsers(query)
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

async function save(record, data) {
  await updatePasslyUser(record.id, data)
  message.success('已保存')
  load()
}

function onTableChange(p) {
  query.page = p.current
  query.pageSize = p.pageSize
  load()
}

onMounted(load)
</script>
