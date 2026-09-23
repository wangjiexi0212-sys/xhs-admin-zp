<template>
  <div>
    <a-row :gutter="16">
      <a-col v-for="item in stats" :key="item.label" :span="6">
        <a-card class="stat-card">
          <div class="stat-label">{{ item.label }}</div>
          <div class="stat-value">{{ item.value }}</div>
        </a-card>
      </a-col>
    </a-row>
    <a-row :gutter="16" style="margin-top: 16px">
      <a-col :span="12">
        <a-card title="热门PDF">
          <a-table :data-source="dashboard.hotPdfs" :columns="hotColumns" row-key="id" :pagination="false" size="small" />
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="最近登录用户">
          <a-table :data-source="dashboard.recentUsers" :columns="userColumns" row-key="id" :pagination="false" size="small" />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getPasslyDashboard } from '@/api/passly'

const dashboard = ref({})
const hotColumns = [
  { title: '资料', dataIndex: 'name' },
  { title: '浏览', dataIndex: 'view_count', width: 90 },
]
const userColumns = [
  { title: '昵称', dataIndex: 'nickname' },
  { title: '渠道', dataIndex: 'source_channel', width: 100 },
]
const stats = computed(() => [
  { label: '用户总数', value: dashboard.value.userTotal || 0 },
  { label: '今日登录', value: dashboard.value.todayLogin || 0 },
  { label: '登录码 / 可用', value: `${dashboard.value.loginCodeTotal || 0} / ${dashboard.value.loginCodeAvailable || 0}` },
  { label: '资料数量', value: dashboard.value.resourceTotal || 0 },
  { label: '今日浏览', value: dashboard.value.todayView || 0 },
  { label: '累计浏览', value: dashboard.value.totalView || 0 },
  { label: '题目数量', value: dashboard.value.questionTotal || 0 },
  { label: '答题次数', value: dashboard.value.attemptTotal || 0 },
])

async function load() {
  try {
    dashboard.value = await getPasslyDashboard()
  } catch (e) {
    message.error(e.message || '加载失败')
  }
}

onMounted(load)
</script>

<style scoped>
.stat-card {
  margin-bottom: 16px;
}
.stat-label {
  color: #667085;
}
.stat-value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
}
</style>
