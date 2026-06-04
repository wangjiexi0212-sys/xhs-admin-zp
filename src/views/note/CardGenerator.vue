<template>
  <div class="page">
    <a-card :bordered="false" class="input-card">
      <div class="input-label">输入文字（支持空格和换行）</div>
      <a-textarea
        v-model:value="inputText"
        placeholder="例如：真诚分享经验或咨询&#10;提个问题也不错&#10;聚焦、利他"
        :rows="4"
        :maxlength="500"
        show-count
      />
    </a-card>

    <CardEditor :text="inputText" file-name-prefix="xhs-card" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CardEditor from './CardEditor.vue'

const inputText = ref('')
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.input-card :deep(.ant-card-body) {
  padding: 16px;
}
.input-label {
  font-size: 13px;
  color: #555;
  font-weight: 500;
  margin-bottom: 8px;
}
</style>
