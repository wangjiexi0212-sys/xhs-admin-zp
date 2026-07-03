<template>
  <div>
    <div class="page-header">
      <span class="page-title">百度网盘授权</span>
    </div>

    <a-card :bordered="false" style="max-width: 640px">
      <a-spin :spinning="statusLoading">
        <div v-if="configured" class="status-box status-ok">
          <CheckCircleOutlined style="color: #52c41a; font-size: 20px" />
          <div class="status-text">
            <div>已完成授权</div>
            <div class="status-sub">Token 更新时间：{{ formatTime(tokenInfo.updated_at) }}　有效期至：{{ formatTime(tokenInfo.expires_at) }}</div>
          </div>
        </div>
        <div v-else class="status-box status-warn">
          <ExclamationCircleOutlined style="color: #faad14; font-size: 20px" />
          <div class="status-text">尚未授权，生成目录图功能不可用</div>
        </div>
      </a-spin>

      <a-divider />

      <div class="step-title">授权步骤</div>
      <a-steps direction="vertical" :current="step" size="small">
        <a-step title="前往百度授权">
          <template #description>
            <a-button type="primary" :loading="urlLoading" @click="openAuthUrl" style="margin-top: 8px">
              打开百度授权页面
            </a-button>
            <div class="hint">点击后会在新窗口打开百度授权页，同意后页面会显示一串授权码</div>
          </template>
        </a-step>
        <a-step title="粘贴授权码">
          <template #description>
            <a-input
              v-model:value="authCode"
              placeholder="将百度显示的授权码粘贴至此"
              style="max-width: 400px; margin-top: 8px"
              allow-clear
            />
          </template>
        </a-step>
        <a-step title="完成授权">
          <template #description>
            <a-button
              type="primary"
              :loading="exchanging"
              :disabled="!authCode.trim()"
              style="margin-top: 8px"
              @click="doExchange"
            >
              提交授权码
            </a-button>
          </template>
        </a-step>
      </a-steps>
    </a-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { getBaiduAuthUrl, exchangeBaiduCode, getBaiduTokenStatus } from '@/api/baidu'

const statusLoading = ref(false)
const configured = ref(false)
const tokenInfo = ref({})
const urlLoading = ref(false)
const exchanging = ref(false)
const authCode = ref('')
const step = ref(0)

async function loadStatus() {
  statusLoading.value = true
  try {
    const res = await getBaiduTokenStatus()
    configured.value = res.configured
    if (res.configured) tokenInfo.value = res
  } catch (e) {
    message.error(e.message || '查询状态失败')
  } finally {
    statusLoading.value = false
  }
}

async function openAuthUrl() {
  urlLoading.value = true
  try {
    const res = await getBaiduAuthUrl()
    window.open(res.url, '_blank', 'width=800,height=600')
    step.value = 1
  } catch (e) {
    message.error(e.message || '获取授权链接失败')
  } finally {
    urlLoading.value = false
  }
}

async function doExchange() {
  if (!authCode.value.trim()) return
  exchanging.value = true
  try {
    await exchangeBaiduCode(authCode.value.trim())
    message.success('授权成功！')
    authCode.value = ''
    step.value = 2
    await loadStatus()
  } catch (e) {
    message.error(e.message || '授权失败，请检查授权码是否正确')
  } finally {
    exchanging.value = false
  }
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

onMounted(loadStatus)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
}
.status-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.status-ok { background: #f6ffed; border: 1px solid #b7eb8f; }
.status-warn { background: #fffbe6; border: 1px solid #ffe58f; }
.status-text { font-size: 14px; line-height: 1.7; }
.status-sub { font-size: 12px; color: #888; }
.step-title { font-weight: 600; margin-bottom: 12px; }
.hint { font-size: 12px; color: #999; margin-top: 4px; }
</style>
