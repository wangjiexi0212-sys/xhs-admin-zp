<template>
  <div class="cookie-page">
    <div class="page-section">
      <div class="section-title">小红书 Cookie 配置</div>
      <div class="section-desc">
        解析小红书笔记链接时需要登录态 Cookie。请在浏览器登录小红书后，复制 Cookie 粘贴于此。
      </div>

      <div class="form-card">
        <div class="form-row">
          <div class="form-label">
            <span>Cookie 值</span>
            <span class="required-mark">必填</span>
          </div>
          <a-textarea
            v-model:value="cookie"
            placeholder="粘贴小红书完整 Cookie，格式：key1=val1; key2=val2; ..."
            :rows="8"
            :maxlength="5000"
            show-count
          />
          <div class="form-tip">
            <InfoCircleOutlined style="margin-right: 4px" />
            获取方式：在 Chrome 中打开
            <a href="https://www.xiaohongshu.com" target="_blank" class="link">小红书官网</a>
            并登录 → 按 F12 打开开发者工具 → Application → Cookies →
            复制所有 Cookie 值粘贴此处。
          </div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>有效期提示</span></div>
          <div v-if="savedAt" class="saved-info">
            <CheckCircleOutlined class="saved-icon" />
            已于 {{ savedAt }} 保存，Cookie 通常 7-30 天有效，过期后需重新配置。
          </div>
          <div v-else class="saved-info empty">
            <ExclamationCircleOutlined class="warn-icon" />
            尚未配置 Cookie，改写链接功能将无法使用。
          </div>
        </div>

        <div class="form-footer">
          <a-button :loading="testing" @click="onTest">⚡ 测试 Cookie 有效性</a-button>
          <a-button type="primary" :loading="saving" :disabled="!cookie.trim()" @click="onSave">
            保存
          </a-button>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="page-section">
      <div class="section-title">使用说明</div>
      <div class="tips-list">
        <div class="tip-item">
          <span class="tip-num">1</span>
          <span>Cookie 仅存储在服务端数据库，不会泄露到前端页面。</span>
        </div>
        <div class="tip-item">
          <span class="tip-num">2</span>
          <span>建议使用专门用于抓取的小号 Cookie，避免主账号被限制。</span>
        </div>
        <div class="tip-item">
          <span class="tip-num">3</span>
          <span>Cookie 失效后，解析小红书链接会返回 401/403 错误，届时重新配置即可。</span>
        </div>
        <div class="tip-item">
          <span class="tip-num">4</span>
          <span>仅用于读取公开笔记内容，不会执行任何写操作（点赞、评论、发布等）。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue'
import { getXhsCookie, saveXhsCookie } from '@/api/xhsCookie'

const cookie = ref('')
const savedAt = ref('')
const saving = ref(false)
const testing = ref(false)

async function load() {
  try {
    const res = await getXhsCookie()
    cookie.value = res?.cookie ?? ''
    savedAt.value = res?.updated_at
      ? new Date(res.updated_at).toLocaleString('zh-CN')
      : ''
  } catch {
    // 未配置时忽略错误
  }
}

async function onSave() {
  if (!cookie.value.trim()) {
    message.warning('请先填写 Cookie')
    return
  }
  saving.value = true
  try {
    await saveXhsCookie({ cookie: cookie.value.trim() })
    savedAt.value = new Date().toLocaleString('zh-CN')
    message.success('Cookie 保存成功')
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onTest() {
  if (!cookie.value.trim()) {
    message.warning('请先填写并保存 Cookie')
    return
  }
  testing.value = true
  const hide = message.loading('正在验证 Cookie 有效性…', 0)
  try {
    // 用一条固定链接测试可访问性
    await saveXhsCookie({ cookie: cookie.value.trim(), test: true })
    hide()
    Modal.success({
      title: 'Cookie 验证通过',
      content: '可以正常解析小红书笔记链接。',
    })
  } catch (e) {
    hide()
    Modal.error({
      title: 'Cookie 验证失败',
      content: e.message || '请检查 Cookie 是否完整或已过期。',
    })
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.cookie-page {
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.page-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.section-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.7;
}

.form-card {
  background: #f5f6f7;
  border-radius: 8px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.form-row {
  margin-bottom: 20px;
}

.form-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #1f1f1f;
  margin-bottom: 8px;
}

.required-mark {
  font-size: 12px;
  color: #999;
}

.form-tip {
  font-size: 12px;
  color: #888;
  margin-top: 8px;
  line-height: 1.6;
}

.link {
  color: #ff2442;
  margin: 0 2px;
}

.saved-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #16a34a;
}

.saved-info.empty {
  color: #d97706;
}

.saved-icon {
  color: #16a34a;
}

.warn-icon {
  color: #d97706;
}

.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #e8e8e8;
  margin-top: 4px;
}

/* 说明列表 */
.tips-list {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
}

.tip-num {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  background: #ff2442;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}
</style>
