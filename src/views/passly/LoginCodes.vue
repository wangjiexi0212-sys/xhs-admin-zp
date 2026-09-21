<template>
  <a-card title="登录码管理">
    <a-form layout="inline" :model="form" style="margin-bottom: 16px">
      <a-form-item label="数量"><a-input-number v-model:value="form.count" :min="1" :max="200" /></a-form-item>
      <a-form-item label="渠道">
        <a-select v-model:value="form.channel" style="width: 130px">
          <a-select-option v-for="c in channels" :key="c.value" :value="c.value">{{ c.label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="最大绑定"><a-input-number v-model:value="form.maxUsers" :min="1" /></a-form-item>
      <a-form-item label="备注"><a-input v-model:value="form.remark" placeholder="备注" /></a-form-item>
      <a-form-item><a-button type="primary" @click="create">生成登录码</a-button></a-form-item>
      <a-form-item><a-button @click="exportCurrent">导出当前页</a-button></a-form-item>
    </a-form>
    <a-alert v-if="createdCodes.length" type="success" show-icon style="margin-bottom: 16px">
      <template #message>
        已生成：{{ createdCodes.join('，') }}
        <a-button type="link" size="small" @click="copyText(createdCodes.join('\n'))">复制</a-button>
      </template>
    </a-alert>
    <a-table :data-source="rows" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-switch :checked="record.status === 1" @change="checked => setStatus(record, checked)" />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="copyText(record.code)">复制</a-button>
            <a-button size="small" @click="openUsers(record)">使用记录</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="usersOpen" title="登录码使用记录" :footer="null" width="720px">
      <a-table :data-source="codeUsers" :columns="userColumns" row-key="id" :pagination="false" size="small" />
    </a-modal>
  </a-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { createPasslyLoginCodes, getPasslyLoginCodeUsers, getPasslyLoginCodes, updatePasslyLoginCode } from '@/api/passly'

const channels = [
  { label: '小红书', value: 'xiaohongshu' },
  { label: '淘宝', value: 'taobao' },
  { label: '公众号', value: 'wechat_official' },
  { label: '赠送', value: 'gift' },
  { label: '内部测试', value: 'internal_test' },
  { label: '其他', value: 'other' },
]
const rows = ref([])
const loading = ref(false)
const createdCodes = ref([])
const usersOpen = ref(false)
const codeUsers = ref([])
const query = reactive({ page: 1, pageSize: 20 })
const form = reactive({ count: 1, channel: 'xiaohongshu', maxUsers: 1, remark: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const columns = [
  { title: '登录码', dataIndex: 'code' },
  { title: '渠道', dataIndex: 'channel', width: 120 },
  { title: '已用/上限', customRender: ({ record }) => `${record.used_count}/${record.max_users}`, width: 110 },
  { title: '状态', key: 'status', width: 90 },
  { title: '备注', dataIndex: 'remark' },
  { title: '创建时间', dataIndex: 'created_at', width: 170 },
  { title: '操作', key: 'action', width: 150 },
]
const userColumns = [
  { title: '用户ID', dataIndex: 'id', width: 90 },
  { title: '昵称', dataIndex: 'nickname' },
  { title: '渠道', dataIndex: 'source_channel', width: 120 },
  { title: '首次使用', dataIndex: 'first_used_at', width: 150 },
  { title: '最近使用', dataIndex: 'last_used_at', width: 150 },
]

async function load() {
  loading.value = true
  try {
    const data = await getPasslyLoginCodes(query)
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

async function create() {
  const data = await createPasslyLoginCodes(form)
  createdCodes.value = data.codes
  message.success('生成成功')
  load()
}

async function setStatus(record, checked) {
  await updatePasslyLoginCode(record.id, { status: checked ? 1 : 0 })
  load()
}

async function openUsers(record) {
  codeUsers.value = await getPasslyLoginCodeUsers(record.id)
  usersOpen.value = true
}

async function copyText(text) {
  await navigator.clipboard.writeText(text)
  message.success('已复制')
}

function exportCurrent() {
  const header = ['code', 'channel', 'used_count', 'max_users', 'status', 'remark']
  const lines = rows.value.map(row => header.map(k => `"${String(row[k] ?? '').replaceAll('"', '""')}"`).join(','))
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `passly-login-codes-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function onTableChange(p) {
  query.page = p.current
  query.pageSize = p.pageSize
  load()
}

onMounted(load)
</script>
