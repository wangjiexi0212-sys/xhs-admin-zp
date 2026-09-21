<template>
  <a-card title="PASSLY设置">
    <a-form :model="form" layout="vertical" style="max-width: 720px">
      <a-form-item label="中文名"><a-input v-model:value="form.app_name" /></a-form-item>
      <a-form-item label="英文名"><a-input v-model:value="form.app_name_en" /></a-form-item>
      <a-form-item label="Slogan"><a-input v-model:value="form.slogan" /></a-form-item>
      <a-form-item label="Logo"><a-input v-model:value="form.logo" /></a-form-item>
      <a-form-item label="允许游客"><a-switch v-model:checked="allowGuest" /></a-form-item>
      <a-form-item label="允许下载PDF"><a-switch v-model:checked="allowDownload" /></a-form-item>
      <a-button type="primary" :loading="saving" @click="save">保存设置</a-button>
    </a-form>
  </a-card>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getPasslySettings, updatePasslySettings } from '@/api/passly'

const form = reactive({
  app_name: '上岸刷',
  app_name_en: 'PASSLY',
  slogan: '每天刷一点，离上岸近一点',
  logo: '',
  allow_guest: 'false',
  allow_pdf_download: 'false',
})
const saving = ref(false)
const allowGuest = computed({
  get: () => form.allow_guest === 'true',
  set: v => (form.allow_guest = v ? 'true' : 'false'),
})
const allowDownload = computed({
  get: () => form.allow_pdf_download === 'true',
  set: v => (form.allow_pdf_download = v ? 'true' : 'false'),
})

async function load() {
  Object.assign(form, await getPasslySettings())
}

async function save() {
  saving.value = true
  try {
    await updatePasslySettings(form)
    message.success('已保存')
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
