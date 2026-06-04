<template>
  <div class="ai-image-page">
    <a-tabs v-model:activeKey="activeTab" class="ai-image-tabs">
      <a-tab-pane key="quanneng">
        <template #tab>
          <span class="tab-label">
            全能绘图
            <a-tag v-if="aiImageStore.activeProvider === 'quanneng'" color="green" class="tab-tag">使用中</a-tag>
          </span>
        </template>
      </a-tab-pane>
      <a-tab-pane key="jimeng">
        <template #tab>
          <span class="tab-label">
            即梦
            <a-tag v-if="aiImageStore.activeProvider === 'jimeng'" color="green" class="tab-tag">使用中</a-tag>
          </span>
        </template>
      </a-tab-pane>
      <a-tab-pane key="md2card">
        <template #tab>
          <span class="tab-label">
            md2card
            <a-tag v-if="aiImageStore.activeProvider === 'md2card'" color="green" class="tab-tag">使用中</a-tag>
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>

    <div class="config-card">
      <!-- 全能绘图配置 -->
      <template v-if="activeTab === 'quanneng'">
        <div class="form-row">
          <div class="form-label">
            <span>API Key</span>
            <span class="required-tag">必填</span>
          </div>
          <a-input-password v-model:value="quanneng.api_key" placeholder="请输入 API Key" :maxlength="200" />
          <div class="form-tip">全能绘图服务的 API Key</div>
        </div>

        <div class="form-row">
          <div class="form-label">
            <span>Base URL</span>
          </div>
          <a-input v-model:value="quanneng.base_url" placeholder="留空使用默认地址" />
        </div>

        <div class="form-row">
          <div class="form-label"><span>模型</span></div>
          <div class="option-cards">
            <div
              v-for="opt in QUANNENG_MODELS"
              :key="opt.value"
              class="option-card"
              :class="{ active: quanneng.model === opt.value }"
              @click="quanneng.model = opt.value"
            >
              <div class="option-card__title">{{ opt.label }}</div>
              <div class="option-card__sub">{{ opt.sub }}</div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>画面比例</span></div>
          <div class="option-cards">
            <div
              v-for="opt in QUANNENG_RATIOS"
              :key="opt.value"
              class="option-card"
              :class="{ active: quanneng.ratio === opt.value }"
              @click="quanneng.ratio = opt.value"
            >
              <div class="option-card__title">{{ opt.label }}</div>
              <div class="option-card__sub">{{ opt.sub }}</div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>并发数</span></div>
          <a-input-number v-model:value="quanneng.concurrency" :min="1" :max="20" style="width: 120px" />
          <div class="form-tip">建议 3-5，太高容易触发限流</div>
        </div>

        <div class="form-footer">
          <a-button :loading="testing" @click="onTest('quanneng')">⚡ 测试全能绘图连接</a-button>
          <a-space>
            <a-button v-if="aiImageStore.activeProvider === 'quanneng'" @click="onClearActive">停用</a-button>
            <a-button v-else type="primary" ghost @click="onSetActive('quanneng')">设为使用中</a-button>
            <a-button type="primary" :loading="saving" @click="onSave('quanneng')">保存</a-button>
          </a-space>
        </div>
      </template>

      <!-- 即梦配置 -->
      <template v-else-if="activeTab === 'jimeng'">
        <div class="form-row">
          <div class="form-label">
            <span>Session ID</span>
            <span class="required-tag">必填</span>
          </div>
          <a-input-password v-model:value="jimeng.session_id" placeholder="请输入 sessionid" :maxlength="500" />
          <div class="form-tip">
            即梦 AI · 推荐 · 中文场景理解好
            <a href="https://jimeng.jianying.com/" target="_blank" class="link">前往即梦</a>
          </div>
          <div class="form-tip">登录即梦 Web 端后，从 Cookie 中取得 sessionid 值</div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>模型</span></div>
          <div class="option-cards">
            <div
              v-for="opt in JIMENG_MODELS"
              :key="opt.value"
              class="option-card"
              :class="{ active: jimeng.model === opt.value }"
              @click="jimeng.model = opt.value"
            >
              <div class="option-card__title">{{ opt.label }}</div>
              <div class="option-card__sub">{{ opt.sub }}</div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>画面比例</span></div>
          <div class="option-cards">
            <div
              v-for="opt in RATIOS"
              :key="opt.value"
              class="option-card"
              :class="{ active: jimeng.ratio === opt.value }"
              @click="jimeng.ratio = opt.value"
            >
              <div class="option-card__title">{{ opt.label }}</div>
              <div class="option-card__sub">{{ opt.sub }}</div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>分辨率</span></div>
          <div class="option-cards">
            <div
              v-for="opt in RESOLUTIONS"
              :key="opt.value"
              class="option-card"
              :class="{ active: jimeng.resolution === opt.value }"
              @click="jimeng.resolution = opt.value"
            >
              <div class="option-card__title">{{ opt.label }}</div>
              <div class="option-card__sub">{{ opt.sub }}</div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>并发数</span></div>
          <a-input-number v-model:value="jimeng.concurrency" :min="1" :max="20" style="width: 120px" />
          <div class="form-tip">建议 3-5，太高容易触发限流</div>
        </div>

        <div class="form-footer">
          <a-button @click="onTest('jimeng')">⚡ 测试即梦连接</a-button>
          <a-space>
            <a-button v-if="aiImageStore.activeProvider === 'jimeng'" @click="onClearActive">停用</a-button>
            <a-button v-else type="primary" ghost @click="onSetActive('jimeng')">设为使用中</a-button>
            <a-button type="primary" :loading="saving" @click="onSave('jimeng')">保存</a-button>
          </a-space>
        </div>
      </template>

      <!-- md2card 配置 -->
      <template v-else-if="activeTab === 'md2card'">
        <div class="form-row">
          <div class="form-label">
            <span>API Key</span>
            <span class="required-tag">必填</span>
          </div>
          <a-input-password v-model:value="md2card.api_key" placeholder="请输入 md2card API Key" :maxlength="200" />
          <div class="form-tip">
            md2card 卡片生成服务，使用卡片文字直接出图
            <a href="https://md2card.com/" target="_blank" class="link">前往 md2card</a>
          </div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>默认关键词</span></div>
          <a-input v-model:value="md2card.keywords" placeholder="如：免费、备考、上岸（用于在图上标红的重点词）" :maxlength="100" />
          <div class="form-tip">生成封面时会被强调；可在调用时覆盖</div>
        </div>

        <div class="form-row">
          <div class="form-label"><span>生成张数</span></div>
          <a-input-number v-model:value="md2card.count" :min="1" :max="10" style="width: 120px" />
          <div class="form-tip">每次生成的封面数量（1-10），默认取第 1 张作为封面</div>
        </div>

        <div class="form-footer">
          <a-button :loading="testing" @click="onTest('md2card')">⚡ 测试 md2card 连接</a-button>
          <a-space>
            <a-button v-if="aiImageStore.activeProvider === 'md2card'" @click="onClearActive">停用</a-button>
            <a-button v-else type="primary" ghost @click="onSetActive('md2card')">设为使用中</a-button>
            <a-button type="primary" :loading="saving" @click="onSave('md2card')">保存</a-button>
          </a-space>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { saveAiImageConfig } from '@/api/aiImageConfig'
import { useAiImageStore } from '@/stores/aiImage'
import { drawQuanneng, drawMd2Card } from '@/api/draw'

const aiImageStore = useAiImageStore()
const activeTab = ref('quanneng')
const saving = ref(false)

const QUANNENG_MODELS = [
  { label: 'gpt-image-2', value: 'gpt-image-2', sub: '默认' },
]

const QUANNENG_RATIOS = [
  { label: '1080 × 1440', value: '1080x1440', sub: '小红书竖版' },
]

const JIMENG_MODELS = [
  { label: 'jimeng-4.0', value: 'jimeng-4.0', sub: '基础' },
  { label: 'jimeng-4.1', value: 'jimeng-4.1', sub: '增强' },
  { label: 'jimeng-4.5', value: 'jimeng-4.5', sub: '推荐 · 默认' },
  { label: 'jimeng-4.6', value: 'jimeng-4.6', sub: '次新' },
  { label: 'jimeng-5.0', value: 'jimeng-5.0', sub: '最新' },
]

const RATIOS = [
  { label: '9:16', value: '9:16', sub: '竖屏' },
  { label: '4:3', value: '4:3', sub: '标准' },
  { label: '1:1', value: '1:1', sub: '方形' },
  { label: '16:9', value: '16:9', sub: '横屏' },
]

const RESOLUTIONS = [
  { label: '2K', value: '2k', sub: '默认' },
  { label: '4K', value: '4k', sub: '更清晰' },
]

const quanneng = reactive({
  api_key: '',
  base_url: '',
  model: 'gpt-image-2',
  ratio: '1080x1440',
  concurrency: 2,
})

const jimeng = reactive({
  session_id: '',
  model: 'jimeng-4.5',
  ratio: '9:16',
  resolution: '2k',
  concurrency: 3,
})

const md2card = reactive({
  api_key: '',
  keywords: '',
  count: 3,
})

async function loadConfig() {
  try {
    await aiImageStore.fetchAll()
    const q = aiImageStore.findConfig('quanneng')
    if (q) {
      Object.assign(quanneng, {
        api_key: q.api_key ?? '',
        base_url: q.base_url ?? '',
        model: q.model || 'gpt-image-2',
        ratio: q.ratio || '1080x1440',
        concurrency: q.concurrency ?? 2,
      })
    }
    const j = aiImageStore.findConfig('jimeng')
    if (j) {
      Object.assign(jimeng, {
        session_id: j.session_id ?? '',
        model: j.model || 'jimeng-4.5',
        ratio: j.ratio || '9:16',
        resolution: j.resolution || '2k',
        concurrency: j.concurrency ?? 3,
      })
    }
    const m = aiImageStore.findConfig('md2card')
    if (m) {
      Object.assign(md2card, {
        api_key: m.api_key ?? '',
        // 复用 model 字段存关键词、concurrency 存张数（避免改 schema）
        keywords: m.model ?? '',
        count: m.concurrency ?? 3,
      })
    }
  } catch (e) {
    message.error(e.message || '加载配置失败')
  }
}

async function onSave(provider) {
  let data
  if (provider === 'quanneng') {
    data = {
      api_key: quanneng.api_key,
      base_url: quanneng.base_url,
      model: quanneng.model,
      ratio: quanneng.ratio,
      concurrency: quanneng.concurrency,
    }
  } else if (provider === 'jimeng') {
    data = {
      session_id: jimeng.session_id,
      model: jimeng.model,
      ratio: jimeng.ratio,
      resolution: jimeng.resolution,
      concurrency: jimeng.concurrency,
    }
  } else if (provider === 'md2card') {
    data = {
      api_key: md2card.api_key,
      model: md2card.keywords, // 复用 model 字段存关键词
      concurrency: md2card.count,
    }
  }
  saving.value = true
  try {
    await saveAiImageConfig(provider, data)
    await aiImageStore.fetchAll()
    message.success('保存成功')
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onSetActive(provider) {
  let required
  if (provider === 'quanneng') required = quanneng.api_key
  else if (provider === 'jimeng') required = jimeng.session_id
  else if (provider === 'md2card') required = md2card.api_key
  if (!required?.trim()) {
    const tip = provider === 'jimeng' ? '请先填写 Session ID 并保存' : '请先填写 API Key 并保存'
    message.warning(tip)
    return
  }
  try {
    await aiImageStore.setActive(provider)
    message.success('已设为使用中')
  } catch (e) {
    message.error(e.message || '操作失败')
  }
}

async function onClearActive() {
  try {
    await aiImageStore.clearActive()
    message.success('已停用')
  } catch (e) {
    message.error(e.message || '操作失败')
  }
}

const testing = ref(false)

async function onTest(provider) {
  if (provider === 'quanneng') {
    if (!quanneng.api_key?.trim()) {
      message.warning('请填写 API Key')
      return
    }
    testing.value = true
    const hide = message.loading('正在测试连接...', 0)
    try {
      const res = await drawQuanneng({
        api_key: quanneng.api_key.trim(),
        base_url: quanneng.base_url?.trim() || '',
        model: quanneng.model,
        prompt: '测试连接，请生成一张纯色图片',
        size: quanneng.ratio,
        response_format: 'url',
        count: 1,
      })
      hide()
      Modal.success({
        title: '连接测试成功',
        content: `全能绘图接口连通正常，返回图片 ${res.urls?.length ?? 0} 张`,
      })
    } catch (e) {
      hide()
      Modal.error({
        title: '连接测试失败',
        content: e.message || '请检查 API Key 或 Base URL',
      })
    } finally {
      testing.value = false
    }
  } else if (provider === 'md2card') {
    if (!md2card.api_key?.trim()) {
      message.warning('请填写 API Key')
      return
    }
    testing.value = true
    const hide = message.loading('正在测试连接...', 0)
    try {
      const res = await drawMd2Card({
        api_key: md2card.api_key.trim(),
        text: '连接测试\nMD2Card',
        keywords: md2card.keywords?.trim() || '',
        count: 1,
      })
      hide()
      Modal.success({
        title: '连接测试成功',
        content: `md2card 接口连通正常，返回图片 ${res.urls?.length ?? 0} 张`,
      })
    } catch (e) {
      hide()
      Modal.error({
        title: '连接测试失败',
        content: e.message || '请检查 API Key',
      })
    } finally {
      testing.value = false
    }
  } else {
    if (!jimeng.session_id?.trim()) {
      message.warning('请填写 Session ID')
      return
    }
    message.info('即梦连接测试功能开发中')
  }
}

onMounted(loadConfig)
</script>

<style scoped>
.ai-image-page {
  max-width: 760px;
}

.ai-image-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-tag {
  margin: 0;
  font-weight: 400;
}

.config-card {
  background: #f5f6f7;
  border-radius: 8px;
  padding: 24px;
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

.required-tag {
  font-size: 12px;
  color: #999;
}

.form-tip {
  font-size: 12px;
  color: #888;
  margin-top: 6px;
}

.link {
  color: #13c2a3;
  margin-left: 6px;
}

.option-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.option-card {
  border: 1.5px solid #d9d9d9;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  background: #fff;
  min-width: 80px;
  text-align: center;
  transition: all 0.18s;
  user-select: none;
}

.option-card:hover {
  border-color: #13c2a3;
}

.option-card.active {
  border-color: #13c2a3;
  background: #e6fffb;
}

.option-card__title {
  font-size: 13px;
  font-weight: 600;
  color: #1f1f1f;
}

.option-card.active .option-card__title {
  color: #0f9b82;
}

.option-card__sub {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.option-card.active .option-card__sub {
  color: #0f9b82;
}

.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e8e8e8;
}
</style>
