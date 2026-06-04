<template>
  <div>
    <div class="page-header">
      <a-button @click="goList">
        <template #icon><LeftOutlined /></template>
        返回列表
      </a-button>
      <span class="page-title">{{ isEdit ? '编辑配置' : '新增配置' }}</span>
    </div>

    <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" class="edit-form">
      <a-card title="基本信息" :bordered="false">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="配置名称" name="name">
              <a-input v-model:value="form.name" placeholder="如：OpenAI GPT-4o" :maxlength="50" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="服务商" name="provider">
              <a-select v-model:value="form.provider" placeholder="选择服务商" :options="providerOptions"
                @change="onProviderChange" />
            </a-form-item>
          </a-col>
          <!-- 自定义时显示 API 格式选项 -->
          <a-col v-if="form.provider === 'custom'" :span="12">
            <a-form-item label="API 格式" extra="选 Anthropic 格式可直接对接 Claude 原生接口">
              <a-radio-group v-model:value="form.api_format" button-style="solid">
                <a-radio-button value="openai">OpenAI 兼容</a-radio-button>
                <a-radio-button value="anthropic">Anthropic 格式</a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="API Key" name="api_key">
              <a-input-password v-model:value="form.api_key" placeholder="sk-..." :maxlength="200" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="默认模型" name="default_model">
              <a-auto-complete
                v-model:value="form.default_model"
                :options="modelOptions"
                placeholder="如：deepseek-v4-pro"
                :maxlength="100"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Base URL" name="base_url" extra="代理URL，留空则使用服务商默认地址">
              <a-input v-model:value="form.base_url" placeholder="如：https://api.openai.com/v1" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-card>

      <div class="form-footer">
        <a-button @click="goList">取消</a-button>
        <a-button :loading="testing" @click="onTest">测试链接</a-button>
        <a-button type="primary" :loading="submitting" @click="onSubmit">保存</a-button>
      </div>
    </a-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { LeftOutlined } from '@ant-design/icons-vue'
import { getLlmConfig, createLlmConfig, updateLlmConfig } from '@/api/llmConfig'
import { request } from '@/api/request'

const route = useRoute()
const router = useRouter()

const id = computed(() => route.params.id ? Number(route.params.id) : null)
const isEdit = computed(() => !!id.value)

const submitting = ref(false)
const testing = ref(false)
const formRef = ref(null)

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '自定义', value: 'custom' },
]

const PROVIDER_MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  custom: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'gpt-4o', 'gpt-4o-mini'],
}

const modelOptions = computed(() =>
  (PROVIDER_MODELS[form.provider] || []).map(m => ({ value: m }))
)

const form = reactive({
  name: '',
  provider: undefined,
  api_format: 'openai',     // 仅 provider=custom 时生效，可选 openai | anthropic
  api_key: '',
  default_model: '',
  base_url: '',
})

function onProviderChange(value) {
  if (value === 'custom') {
    // 默认 OpenAI 兼容，用户可自行切换为 Anthropic 格式
    if (!form.api_format) form.api_format = 'openai'
  }
}

const rules = {
  name: [{ required: true, message: '请输入配置名称', whitespace: true }],
  provider: [{ required: true, message: '请选择服务商' }],
  api_key: [{ required: true, message: '请输入 API Key', whitespace: true }],
  default_model: [{ required: true, message: '请输入默认模型', whitespace: true }],
}

function goList() {
  router.push('/system/llm')
}

function loadDetail() {
  const data = getLlmConfig(id.value)
  if (!data) {
    message.error('配置不存在')
    router.replace('/system/llm')
    return
  }
  Object.assign(form, {
    name: data.name ?? '',
    provider: data.provider ?? undefined,
    api_format: data.api_format ?? 'openai',
    api_key: data.api_key ?? '',
    default_model: data.default_model ?? '',
    base_url: data.base_url ?? '',
  })
}

async function onSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      provider: form.provider,
      api_format: form.provider === 'custom' ? form.api_format : undefined,
      api_key: form.api_key.trim(),
      default_model: form.default_model.trim(),
      base_url: form.base_url?.trim() || '',
    }
    if (isEdit.value) {
      updateLlmConfig(id.value, payload)
      message.success('修改成功')
    } else {
      createLlmConfig(payload)
      message.success('新增成功')
    }
    goList()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (isEdit.value) loadDetail()
})

async function onTest() {
  if (!form.provider) { message.warning('请选择服务商'); return }
  if (!form.api_key?.trim()) { message.warning('请填写 API Key'); return }
  if (!form.default_model?.trim()) { message.warning('请填写默认模型'); return }

  testing.value = true
  const hide = message.loading('正在测试链接...', 0)
  try {
    const data = await request('/api/llm/test', {
      method: 'POST',
      body: {
        provider: form.provider,
        api_format: form.provider === 'custom' ? form.api_format : undefined,
        api_key: form.api_key.trim(),
        default_model: form.default_model.trim(),
        base_url: form.base_url?.trim() || '',
      },
    })
    hide()
    Modal.success({
      title: '链接测试成功',
      content: `连通正常，响应耗时 ${data.latency}ms`,
    })
  } catch (e) {
    hide()
    Modal.error({
      title: '链接测试失败',
      content: e.message || '测试失败，请检查 API Key、模型名或 Base URL',
    })
  } finally {
    testing.value = false
  }
}
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
.edit-form :deep(.ant-card-head) {
  min-height: 40px;
  padding: 0 16px;
}
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}
</style>
