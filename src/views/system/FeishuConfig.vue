<template>
  <div>
    <div class="page-header">
      <span class="page-title">飞书配置</span>
    </div>

    <a-card :bordered="false" style="max-width: 680px">
      <a-spin :spinning="statusLoading">
        <div v-if="configured" class="status-box status-ok">
          <CheckCircleOutlined style="color: #52c41a; font-size: 20px" />
          <div class="status-text">
            <div>已配置飞书应用</div>
            <div class="status-sub">最后更新：{{ formatTime(savedAt) }}</div>
          </div>
        </div>
        <div v-else class="status-box status-warn">
          <ExclamationCircleOutlined style="color: #faad14; font-size: 20px" />
          <div class="status-text">尚未配置飞书应用，飞书文档功能不可用</div>
        </div>
      </a-spin>

      <a-divider />

      <div class="section-title">应用凭证</div>
      <div class="hint" style="margin-bottom: 16px">
        前往
        <a href="https://open.feishu.cn/app" target="_blank" rel="noopener">飞书开放平台</a>
        创建企业自建应用后，在「凭证与基础信息」页面获取以下信息。
      </div>

      <a-form
        :model="form"
        layout="vertical"
        style="max-width: 520px"
        @finish="onSave"
      >
        <a-form-item label="App ID" name="app_id" :rules="[{ required: true, message: '请输入 App ID' }]">
          <a-input
            v-model:value="form.app_id"
            placeholder="cli_xxxxxxxxxxxxxxx"
            allow-clear
          />
        </a-form-item>

        <a-form-item label="App Secret" name="app_secret" :rules="[{ required: true, message: '请输入 App Secret' }]">
          <a-input-password
            v-model:value="form.app_secret"
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            allow-clear
          />
        </a-form-item>

        <a-divider style="margin: 8px 0 20px" />

        <div class="section-title" style="margin-bottom: 4px">多维表格设置</div>
        <div class="hint" style="margin-bottom: 16px">
          打开飞书多维表格，从 URL 中获取以下两个 ID。<br />
          URL 格式：<code>https://xxx.feishu.cn/base/<b>appToken</b>?table=<b>tableId</b></code>
        </div>

        <a-form-item label="多维表格 App Token" name="bitable_app_token" :rules="[{ required: true, message: '请输入多维表格 App Token' }]">
          <a-input
            v-model:value="form.bitable_app_token"
            placeholder="URL 中 /base/ 后面的部分"
            allow-clear
          />
        </a-form-item>

        <a-form-item label="数据表 ID（Table ID）" name="bitable_table_id" :rules="[{ required: true, message: '请输入 Table ID' }]">
          <a-input
            v-model:value="form.bitable_table_id"
            placeholder="URL 中 ?table= 后面的部分"
            allow-clear
          />
          <div class="hint" style="margin-top: 4px">
            批量生成后若开启飞书同步，笔记标题、正文、话题等字段将自动写入此表。
          </div>
        </a-form-item>

        <a-divider style="margin: 8px 0 20px" />

        <div class="section-title" style="margin-bottom: 4px">权限说明</div>
        <div class="hint" style="margin-bottom: 16px">
          请在飞书开放平台 → 权限管理 中确保已开启以下权限：
        </div>
        <ul class="permission-list">
          <li><code>bitable:app</code> — 查看、编辑和管理多维表格</li>
        </ul>
        <div class="hint" style="margin-bottom: 20px">
          同时需将当前应用机器人添加为目标多维表格的编辑权限成员。
        </div>

        <a-space>
          <a-button type="primary" html-type="submit" :loading="saving">保存配置</a-button>
          <a-button :loading="testing" :disabled="!form.app_id || !form.app_secret" @click="onTest">
            测试连接
          </a-button>
        </a-space>
      </a-form>
    </a-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { getFeishuConfig, saveFeishuConfig, testFeishuConfig } from '@/api/feishuConfig'

const statusLoading = ref(false)
const configured = ref(false)
const savedAt = ref(null)
const saving = ref(false)
const testing = ref(false)

const form = reactive({
  app_id: '',
  app_secret: '',
  bitable_app_token: '',
  bitable_table_id: '',
})

async function loadConfig() {
  statusLoading.value = true
  try {
    const res = await getFeishuConfig()
    if (res && res.app_id) {
      form.app_id = res.app_id || ''
      form.app_secret = res.app_secret || ''
      form.bitable_app_token = res.bitable_app_token || ''
      form.bitable_table_id = res.bitable_table_id || ''
      configured.value = true
      savedAt.value = res.updated_at || null
    }
  } catch (e) {
    // 未配置时接口可能返回 404，不报错
  } finally {
    statusLoading.value = false
  }
}

async function onSave() {
  saving.value = true
  try {
    const res = await saveFeishuConfig({ ...form })
    configured.value = true
    savedAt.value = res?.updated_at || Date.now()
    message.success('保存成功')
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onTest() {
  testing.value = true
  try {
    await testFeishuConfig({ app_id: form.app_id, app_secret: form.app_secret })
    message.success('连接成功，App 凭证有效')
  } catch (e) {
    message.error('连接失败：' + (e.message || '请检查 App ID 与 App Secret'))
  } finally {
    testing.value = false
  }
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

onMounted(loadConfig)
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
.section-title { font-weight: 600; margin-bottom: 12px; }
.hint { font-size: 12px; color: #999; line-height: 1.7; }
.hint a { color: #1677ff; }
.permission-list {
  margin: 0 0 8px 0;
  padding-left: 18px;
  font-size: 12px;
  color: #555;
  line-height: 2;
}
.permission-list code {
  background: #f5f5f5;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 12px;
}
</style>
