<template>
  <div class="regular-product-edit">
    <div class="page-header">
      <a-button @click="$router.back()" style="margin-right: 12px">← 返回</a-button>
      <h2 class="page-title">{{ isEdit ? '编辑常规商品' : '新增常规商品' }}</h2>
    </div>

    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
      class="edit-form"
    >
      <a-form-item label="标题" name="title">
        <a-input v-model:value="form.title" placeholder="请输入标题" :maxlength="200" show-count />
      </a-form-item>

      <a-form-item label="网盘链接" name="disk_path">
        <a-input
          v-model:value="form.disk_path"
          placeholder="如 /招聘资料/2025"
          :maxlength="500"
        />
        <div class="form-tip">填写百度网盘内路径，格式：/xxx/yyy（以斜杠开头的完整目录路径）</div>
      </a-form-item>

      <a-form-item label="标签" name="tags">
        <a-input v-model:value="form.tags" placeholder="标签文本，如：2025年 央企 笔试" :maxlength="200" />
        <div class="form-tip">纯文本标签，自由填写</div>
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">保存</a-button>
          <a-button @click="$router.back()">取消</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  getRegularProductDetail,
  createRegularProduct,
  updateRegularProduct,
} from '@/api/regularProducts'

const route = useRoute()
const router = useRouter()

const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value)

const formRef = ref()
const submitting = ref(false)

const form = reactive({
  title: '',
  disk_path: '',
  tags: '',
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  disk_path: [{ required: true, message: '请输入网盘路径', trigger: 'blur' }],
}

async function loadDetail() {
  if (!isEdit.value) return
  try {
    const res = await getRegularProductDetail(id.value)
    form.title = res.title || ''
    form.disk_path = res.disk_path || ''
    form.tags = res.tags || ''
  } catch (e) {
    message.error(e.message || '加载失败')
  }
}

async function handleSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const payload = {
      title: form.title.trim(),
      disk_path: form.disk_path.trim(),
      tags: form.tags.trim(),
    }
    if (isEdit.value) {
      await updateRegularProduct(id.value, payload)
      message.success('更新成功')
    } else {
      await createRegularProduct(payload)
      message.success('创建成功')
    }
    router.push('/regular-product/list')
  } catch (e) {
    message.error(e.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

onMounted(loadDetail)
</script>

<style scoped>
.regular-product-edit {
  max-width: 720px;
}

.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.edit-form {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.form-tip {
  color: #888;
  font-size: 12px;
  margin-top: 4px;
}
</style>
