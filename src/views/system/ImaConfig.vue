<template>
  <div>
    <div class="page-header"><span class="page-title">IMA 配置</span></div>
    <a-card :bordered="false" style="max-width: 680px">
      <a-spin :spinning="loading">
        <div :class="['status-box', configured ? 'status-ok' : 'status-warn']">
          <CheckCircleOutlined v-if="configured" style="color:#52c41a;font-size:20px" />
          <ExclamationCircleOutlined v-else style="color:#faad14;font-size:20px" />
          <div class="status-text">
            <div>{{ configured ? '已配置腾讯 IMA OpenAPI' : '尚未配置腾讯 IMA OpenAPI' }}</div>
            <div v-if="configured" class="status-sub">
              配置来源：{{ sourceText }}<span v-if="savedAt">；最后更新：{{ formatTime(savedAt) }}</span>
            </div>
          </div>
        </div>
      </a-spin>

      <a-divider />
      <div class="section-title">OpenAPI 凭证</div>
      <div class="hint">
        前往 <a href="https://ima.qq.com/agent-interface" target="_blank" rel="noopener">IMA 开放接口页面</a>
        获取 Client ID 和 API Key。API Key 保存后不会再次明文显示。
      </div>

      <a-form :model="form" layout="vertical" style="max-width:520px;margin-top:16px" @finish="onSave">
        <a-form-item label="Client ID" name="client_id" :rules="[{ required: true, message: '请输入 Client ID' }]">
          <a-input v-model:value="form.client_id" placeholder="请输入 IMA Client ID" allow-clear />
        </a-form-item>
        <a-form-item label="API Key" name="api_key" :rules="[{ required: true, message: '请输入 API Key' }]">
          <a-input-password v-model:value="form.api_key" placeholder="请输入 IMA API Key" allow-clear />
          <div class="hint" style="margin-top:4px">显示 ******** 表示已保存；不修改即可继续使用原密钥。</div>
        </a-form-item>
        <a-alert type="info" show-icon message="配置保存在后端数据库中，知识库请求由 Worker 发起，API Key 不会返回给浏览器。" style="margin-bottom:20px" />
        <a-space>
          <a-button type="primary" html-type="submit" :loading="saving">保存配置</a-button>
          <a-button :loading="testing" :disabled="!form.client_id || !form.api_key" @click="onTest">测试连接</a-button>
        </a-space>
      </a-form>
    </a-card>

    <a-card :bordered="false" title="写作母库与画像" style="max-width:680px;margin-top:16px">
      <a-alert type="info" show-icon message="请选择一个 IMA 知识库作为全系统写作母库。商品生成时直接使用保存的画像，不再搜索企业名称。" style="margin-bottom:16px" />
      <a-form layout="vertical" style="max-width:520px">
        <a-form-item label="默认写作母库">
          <a-space style="width:100%">
            <a-select
              v-model:value="form.default_knowledge_base_id"
              placeholder="请选择 IMA 知识库"
              style="width:360px"
              :options="knowledgeBaseOptions"
              :loading="loadingBases"
              show-search
              option-filter-prop="label"
              @change="onKnowledgeBaseChange"
            />
            <a-button :loading="loadingBases" :disabled="!configured" @click="loadKnowledgeBases">刷新</a-button>
          </a-space>
        </a-form-item>
        <a-space wrap style="margin-bottom:14px">
          <a-button type="primary" :loading="analyzing" :disabled="!form.default_knowledge_base_id" @click="analyzeCorpus">
            {{ profile.configured ? '重新分析母库' : '分析母库并生成画像' }}
          </a-button>
          <span v-if="profile.configured" class="hint">已分析 {{ profile.sample_count || 0 }} 篇代表内容；更新于 {{ formatTime(profile.updated_at) }}</span>
        </a-space>
        <a-textarea v-if="profile.profile" v-model:value="profile.profile" :auto-size="{ minRows:8, maxRows:20 }" readonly />
        <a-empty v-else description="尚未生成写作画像" />
      </a-form>
    </a-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { getImaConfig, getImaCorpus, getImaKnowledgeBases, getImaWritingProfile, saveImaConfig, saveImaWritingProfile, testImaConfig } from '@/api/aiContentCenter'
import { chatLlm } from '@/api/llm'
import { useLlmStore } from '@/stores/llm'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const loadingBases = ref(false)
const analyzing = ref(false)
const configured = ref(false)
const savedAt = ref(null)
const credentialSource = ref('')
const form = reactive({ client_id: '', api_key: '', default_knowledge_base_id: '' })
const knowledgeBases = ref([])
const profile = ref({ configured: false, profile: '', sample_count: 0, updated_at: null })
const llmStore = useLlmStore()
const sourceText = computed(() => credentialSource.value === 'database' ? '系统设置' : 'Worker Secret')
const knowledgeBaseOptions = computed(() => knowledgeBases.value.map(item => ({
  value: item.id, label: `${item.name}${item.content_count ? `（${item.content_count}条）` : ''}`,
})))

async function loadConfig() {
  loading.value = true
  try {
    const data = await getImaConfig()
    form.client_id = data.client_id || ''
    form.api_key = data.api_key || ''
    form.default_knowledge_base_id = data.default_knowledge_base_id || ''
    configured.value = Boolean(data.configured)
    savedAt.value = data.updated_at || null
    credentialSource.value = data.credential_source || ''
    if (data.configured) await loadKnowledgeBases()
    if (form.default_knowledge_base_id) await loadProfile()
  } catch (error) {
    message.error(error.message || '读取 IMA 配置失败')
  } finally { loading.value = false }
}

async function loadKnowledgeBases() {
  loadingBases.value = true
  try {
    const data = await getImaKnowledgeBases()
    knowledgeBases.value = data.list || []
  } catch (error) {
    message.error(error.message || '读取 IMA 知识库失败')
  } finally { loadingBases.value = false }
}

async function onKnowledgeBaseChange() {
  profile.value = { configured: false, profile: '', sample_count: 0, updated_at: null }
  if (form.default_knowledge_base_id) await loadProfile()
}

async function loadProfile() {
  profile.value = await getImaWritingProfile(form.default_knowledge_base_id)
}

async function onSave() {
  saving.value = true
  try {
    const data = await saveImaConfig({ ...form })
    configured.value = true
    credentialSource.value = 'database'
    savedAt.value = data.updated_at || Date.now()
    form.api_key = '********'
    if (!knowledgeBases.value.length) await loadKnowledgeBases()
    message.success('IMA 配置保存成功')
  } catch (error) {
    message.error(error.message || '保存失败')
  } finally { saving.value = false }
}

async function analyzeCorpus() {
  const active = llmStore.active
  if (!active) { message.warning('请先在系统设置中启用大模型配置'); return }
  analyzing.value = true
  try {
    await saveImaConfig({ ...form })
    const corpus = await getImaCorpus({ knowledge_base_id: form.default_knowledge_base_id })
    const documents = (corpus.documents || []).filter(item => item.title || item.excerpt)
    if (!documents.length) throw new Error('IMA 母库中没有可分析的笔记内容')
    const materials = documents.map((item, index) => `【样本${index + 1}：${item.title}】\n${item.excerpt || '仅有标题'}`).join('\n\n')
    const result = await chatLlm({
      provider: active.provider, api_format: active.api_format, api_key: active.api_key,
      base_url: active.base_url || '', model: active.default_model,
      messages: [
        { role: 'system', content: '你是国企笔试小红书笔记方法论分析师。请从历史笔记母库中提炼可复用的整体写作画像，不总结具体企业事实。' },
        { role: 'user', content: `请分析以下 IMA 母库代表内容，输出可直接指导新企业笔记创作的写作画像。必须包含：标题公式、正文结构、开头方式、信息组织、语言语气、篇幅与表情习惯、通用备考建议、事实安全边界、禁止表达。不得把样本企业的考试科目、时间、题量或招聘人数写成通用事实。\n\n${materials}` },
      ], max_tokens: 3000, temperature: 0.35,
    })
    const text = String(result.content || '').trim()
    if (!text) throw new Error('模型未返回写作画像')
    const saved = await saveImaWritingProfile({ knowledge_base_id: form.default_knowledge_base_id, profile: text, sample_count: documents.length })
    profile.value = { configured: true, profile: text, sample_count: documents.length, updated_at: saved.updated_at }
    configured.value = true
    credentialSource.value = 'database'
    form.api_key = '********'
    message.success('默认母库与写作画像已保存')
  } catch (error) {
    message.error(error.message || '分析母库失败')
  } finally { analyzing.value = false }
}

async function onTest() {
  testing.value = true
  try {
    await testImaConfig({ ...form })
    message.success('连接成功，IMA 凭证有效')
  } catch (error) {
    message.error(`连接失败：${error.message || '请检查 Client ID 和 API Key'}`)
  } finally { testing.value = false }
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

onMounted(loadConfig)
</script>

<style scoped>
.page-header{display:flex;align-items:center;margin-bottom:16px}.page-title{font-size:16px;font-weight:600}
.status-box{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:6px;margin-bottom:8px}
.status-ok{background:#f6ffed;border:1px solid #b7eb8f}.status-warn{background:#fffbe6;border:1px solid #ffe58f}
.status-text{font-size:14px;line-height:1.7}.status-sub{font-size:12px;color:#888}.section-title{font-weight:600;margin-bottom:8px}
.hint{font-size:12px;color:#888;line-height:1.7}.hint a{color:#1677ff}
</style>
