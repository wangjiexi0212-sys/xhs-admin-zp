<template>
  <div>
    <div class="page-header">
      <a-button @click="router.back()">
        <template #icon><LeftOutlined /></template>
        返回
      </a-button>
      <span class="page-title">{{ isEdit ? '编辑商品' : '新增商品' }}</span>
    </div>

    <a-spin :spinning="initLoading">
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" class="edit-form">
        <a-card v-if="!isEdit" title="快速导入" :bordered="false" style="margin-bottom: 12px">
          <a-textarea
            v-model:value="quickImportText"
            :rows="3"
            placeholder="粘贴一行数据（字段间用制表符分隔）：&#10;公告名称  招聘人数  报名时间  笔试时间  面试时间  笔试内容  面试内容  公告原文网址"
            style="font-size: 13px"
          />
          <div class="quick-import-footer">
            <span class="hint">字段顺序：公告名称 / 招聘人数 / 报名时间 / 笔试时间 / 面试时间 / 笔试内容 / 面试内容 / 公告原文网址，用制表符（Tab）分隔</span>
            <a-button type="primary" ghost @click="parseQuickImport">解析并填入</a-button>
          </div>
        </a-card>

        <a-card title="基本信息" :bordered="false">
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="招聘信息公告名称" name="title">
                <a-input v-model:value="form.title" placeholder="如：2026年某省事业单位招聘公告" :maxlength="200" show-count />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="单位名称" name="company_name">
                <a-input v-model:value="form.company_name" placeholder="如：某某人民医院" :maxlength="100" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="招聘人数" name="recruit_count">
                <a-input v-model:value="form.recruit_count" placeholder="如：10人 或 若干" />
              </a-form-item>
            </a-col>
            <a-col :span="4">
              <a-form-item label="商品类型" name="job_type_id">
                <a-select v-model:value="form.job_type_id" placeholder="选择类型" allow-clear :options="jobTypeOptions" />
              </a-form-item>
            </a-col>
            <a-col :span="4">
              <a-form-item label="状态" name="status">
                <a-select v-model:value="form.status" :options="statusOptions" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-card>

        <a-card title="时间信息" :bordered="false" style="margin-top: 12px">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="报名时间" name="apply_time">
                <a-input v-model:value="form.apply_time" placeholder="如：2026-06-01 ~ 2026-06-15" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="笔试时间" name="written_exam_time">
                <a-input v-model:value="form.written_exam_time" placeholder="如：2026-07-10" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="面试时间" name="interview_time">
                <a-input v-model:value="form.interview_time" placeholder="如：2026-08-05" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-card>

        <a-card title="考试内容" :bordered="false" style="margin-top: 12px">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="笔试内容" name="written_exam_content">
                <a-textarea v-model:value="form.written_exam_content" :rows="5" placeholder="笔试科目、范围等" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="面试内容" name="interview_content">
                <a-textarea v-model:value="form.interview_content" :rows="5" placeholder="面试形式、流程等" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-card>

        <a-card title="其他" :bordered="false" style="margin-top: 12px">
          <a-form-item label="公告原文网址" name="source_url">
            <a-input v-model:value="form.source_url" placeholder="https://..." style="max-width: 600px" />
          </a-form-item>
        </a-card>

        <a-card title="百度网盘链接" :bordered="false" style="margin-top: 12px">
          <div class="quick-fill-row">
            <span class="quick-fill-label">快速填充：</span>
            <a-input
              v-model:value="quickFillKeyword"
              placeholder="输入关键词，如：某某单位"
              style="width: 240px"
              allow-clear
              @pressEnter="applyQuickFill"
            />
            <a-button type="primary" ghost @click="applyQuickFill">一键填充目录</a-button>
          </div>
          <a-divider style="margin: 12px 0 16px" />
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="笔试资料目录" name="baidu_path_exam">
                <a-input v-model:value="form.baidu_path_exam" placeholder="如：/我的资源/某单位笔试资料" />
                <div class="hint">填写网盘文件夹的绝对路径，以 / 开头</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="真题目录" name="baidu_path_history">
                <a-input v-model:value="form.baidu_path_history" placeholder="如：/我的资源/某单位历年真题" />
                <div class="hint">填写网盘文件夹的绝对路径，以 / 开头</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="模拟题目录" name="baidu_path_mock">
                <a-input v-model:value="form.baidu_path_mock" placeholder="如：/我的资源/某单位模拟题" />
                <div class="hint">填写网盘文件夹的绝对路径，以 / 开头</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="面试题目录" name="baidu_path_interview">
                <a-input v-model:value="form.baidu_path_interview" placeholder="如：/我的资源/某单位面试题" />
                <div class="hint">填写网盘文件夹的绝对路径，以 / 开头</div>
              </a-form-item>
            </a-col>
          </a-row>

          <a-divider style="margin: 8px 0 16px" />
          <div class="custom-dir-header">
            <span class="custom-dir-title">自定义目录</span>
            <a-button type="dashed" size="small" @click="addCustomDir">
              <template #icon><PlusOutlined /></template>
              添加目录
            </a-button>
          </div>
          <div v-if="form.baidu_custom_dirs.length" class="custom-dir-list">
            <div v-for="(dir, idx) in form.baidu_custom_dirs" :key="idx" class="custom-dir-row">
              <span class="custom-dir-index">{{ idx + 1 }}</span>
              <a-input
                v-model:value="dir.name"
                placeholder="目录名称，如：面试资料"
                style="width: 180px; flex-shrink: 0"
                :maxlength="50"
              />
              <a-input
                v-model:value="dir.path"
                placeholder="网盘路径，如：/我的资源/某单位面试资料"
                style="flex: 1"
              />
              <a-button type="text" danger @click="removeCustomDir(idx)">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="hint" style="margin-top: 4px">名称将显示为目录标签，路径以 / 开头</div>
          </div>
          <div v-else style="color: #bbb; font-size: 13px; padding: 4px 0">暂无自定义目录，点击「添加目录」新增</div>
        </a-card>

        <a-card title="小红书信息" :bordered="false" style="margin-top: 12px">
          <a-form-item label="小红书商品ID" name="xhs_product_id">
            <a-input v-model:value="form.xhs_product_id" placeholder="小红书商品ID" style="max-width: 360px" />
          </a-form-item>

          <a-form-item label="小红书正文">
            <div class="xhs-list">
              <div v-for="(_, idx) in form.xhs_content" :key="idx" class="xhs-row">
                <span class="xhs-index">{{ idx + 1 }}</span>
                <a-textarea
                  v-model:value="form.xhs_content[idx]"
                  :rows="3"
                  placeholder="一条小红书正文"
                />
                <a-button type="text" danger @click="removeContent(idx)">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>
              <a-button type="dashed" block @click="addContent">
                <template #icon><PlusOutlined /></template>
                添加一条正文
              </a-button>
            </div>
          </a-form-item>

          <a-form-item label="小红书标签">
            <div class="quick-fill-row" style="margin-bottom: 8px">
              <span class="quick-fill-label">快速填充：</span>
              <a-input
                v-model:value="xhsTagKeyword"
                placeholder="输入关键词，如：某某单位"
                style="width: 240px"
                allow-clear
                @pressEnter="applyXhsTags"
              />
              <a-button type="primary" ghost @click="applyXhsTags">生成标签</a-button>
            </div>
            <a-textarea
              v-model:value="form.xhs_tags"
              :rows="2"
              placeholder="多个标签用空格或逗号分隔，例如：考公 事业编 招聘"
              :maxlength="500"
              show-count
            />
            <div class="hint">支持空格、逗号、顿号、换行分隔</div>
          </a-form-item>

          <a-form-item label="小红书图片">
            <a-upload
              v-model:file-list="imageFileList"
              list-type="picture-card"
              accept="image/*"
              :custom-request="customUploadImage"
              :before-upload="beforeUploadImage"
              @preview="onPreviewImage"
            >
              <div v-if="imageFileList.length < 30">
                <PlusOutlined />
                <div style="margin-top: 8px">上传</div>
              </div>
            </a-upload>
            <div class="hint">单张 ≤ 10MB，支持 jpg/png/gif/webp/bmp/svg，最多 30 张</div>
          </a-form-item>
        </a-card>

        <div class="form-footer">
          <a-button @click="router.back()">取消</a-button>
          <a-button type="primary" :loading="submitting" @click="onSubmit">保存</a-button>
        </div>
      </a-form>
    </a-spin>

    <a-modal v-model:open="imagePreviewOpen" :footer="null" :title="null" :width="720">
      <img :src="imagePreviewUrl" style="width: 100%; display: block" />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { getProductDetail, createProduct, updateProduct } from '@/api/products'
import { getJobTypeList } from '@/api/jobTypes'
import { uploadImage } from '@/api/upload'

const route = useRoute()
const router = useRouter()

const id = computed(() => route.params.id ? Number(route.params.id) : null)
const isEdit = computed(() => !!id.value)

const initLoading = ref(false)
const submitting = ref(false)
const formRef = ref(null)
const jobTypeOptions = ref([])

const statusOptions = [
  { label: '上架', value: 1 },
  { label: '下架', value: 0 },
]

const form = reactive({
  title: '',
  company_name: '',
  recruit_count: '',
  apply_time: '',
  written_exam_time: '',
  interview_time: '',
  written_exam_content: '',
  interview_content: '',
  source_url: '',
  job_type_id: undefined,
  status: 1,
  baidu_path_exam: '',
  baidu_path_history: '',
  baidu_path_mock: '',
  baidu_path_interview: '',
  baidu_custom_dirs: [],  // [{ name: '', path: '' }]
  xhs_product_id: '',
  xhs_content: [],
  xhs_tags: '',
})

const rules = {
  title: [{ required: true, message: '请输入公告名称', whitespace: true }],
  company_name: [{ required: true, message: '请输入单位名称', whitespace: true }],
  status: [{ required: true, type: 'number', message: '请选择状态' }],
}

async function fetchJobTypes() {
  try {
    const res = await getJobTypeList({ pageSize: 100 })
    jobTypeOptions.value = (res.list || []).map(t => ({ label: t.name, value: t.id }))
  } catch {}
}

async function fetchDetail() {
  initLoading.value = true
  try {
    const data = await getProductDetail(id.value)
    Object.assign(form, {
      title: data.title ?? '',
      company_name: data.company_name ?? '',
      recruit_count: data.recruit_count ?? '',
      apply_time: data.apply_time ?? '',
      written_exam_time: data.written_exam_time ?? '',
      interview_time: data.interview_time ?? '',
      written_exam_content: data.written_exam_content ?? '',
      interview_content: data.interview_content ?? '',
      source_url: data.source_url ?? '',
      job_type_id: data.job_type_id ?? undefined,
      status: data.status ?? 1,
      baidu_path_exam: data.baidu_path_exam ?? '',
      baidu_path_history: data.baidu_path_history ?? '',
      baidu_path_mock: data.baidu_path_mock ?? '',
      baidu_path_interview: data.baidu_path_interview ?? '',
      baidu_custom_dirs: Array.isArray(data.baidu_custom_dirs)
        ? data.baidu_custom_dirs.map(d => ({ name: d.name ?? '', path: d.path ?? '' }))
        : [],
      xhs_product_id: data.xhs_product_id ?? '',
      xhs_content: Array.isArray(data.xhs_content) ? [...data.xhs_content] : [],
      xhs_tags: Array.isArray(data.xhs_tags) ? data.xhs_tags.join(' ') : (data.xhs_tags ?? ''),
    })
    imageFileList.value = urlsToFileList(data.xhs_images)
  } catch (e) {
    message.error(e.message || '加载失败')
    router.replace('/product/list')
  } finally {
    initLoading.value = false
  }
}

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const uploading = imageFileList.value.some(f => f.status === 'uploading')
    if (uploading) {
      message.warning('请等待图片上传完成')
      submitting.value = false
      return
    }
    const trim = v => (v == null ? '' : String(v)).trim()
    const payload = {
      title: trim(form.title),
      company_name: trim(form.company_name),
      recruit_count: trim(form.recruit_count) || null,
      apply_time: trim(form.apply_time) || null,
      written_exam_time: trim(form.written_exam_time) || null,
      interview_time: trim(form.interview_time) || null,
      written_exam_content: trim(form.written_exam_content) || null,
      interview_content: trim(form.interview_content) || null,
      source_url: trim(form.source_url) || null,
      job_type_id: form.job_type_id || null,
      status: form.status,
      baidu_path_exam: trim(form.baidu_path_exam) || null,
      baidu_path_history: trim(form.baidu_path_history) || null,
      baidu_path_mock: trim(form.baidu_path_mock) || null,
      baidu_path_interview: trim(form.baidu_path_interview) || null,
      baidu_custom_dirs: form.baidu_custom_dirs
        .map(d => ({ name: trim(d.name), path: trim(d.path) }))
        .filter(d => d.name || d.path),
      xhs_product_id: trim(form.xhs_product_id) || null,
      xhs_content: form.xhs_content.map(trim).filter(Boolean),
      xhs_tags: trim(form.xhs_tags)
        .split(/[\s,，、]+/)
        .map(s => s.trim())
        .filter(Boolean),
      xhs_images: imageFileList.value
        .filter(f => f.status === 'done')
        .map(f => f.url || f.response?.url)
        .filter(Boolean),
    }
    if (isEdit.value) {
      await updateProduct(id.value, payload)
      message.success('修改成功')
    } else {
      await createProduct(payload)
      message.success('新增成功')
    }
    router.back()
  } catch (e) {
    message.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchJobTypes()
  if (isEdit.value) fetchDetail()
})

// --- 小红书正文 ---
function addContent() {
  form.xhs_content.push('')
}
function removeContent(idx) {
  form.xhs_content.splice(idx, 1)
}

// --- 自定义网盘目录 ---
function addCustomDir() {
  form.baidu_custom_dirs.push({ name: '', path: '' })
}
function removeCustomDir(idx) {
  form.baidu_custom_dirs.splice(idx, 1)
}

// --- 百度网盘快速填充 ---
const quickFillKeyword = ref('')
function applyQuickFill() {
  const kw = quickFillKeyword.value.trim()
  if (!kw) {
    message.warning('请先输入关键词')
    return
  }
  form.baidu_path_exam = `/虚拟资料/2026${kw}备考资料/2026${kw}笔试资料`
  form.baidu_path_history = `/虚拟资料/2026${kw}备考资料/2026${kw}笔试资料/1.2026年${kw}23~25年笔试真题（回忆版）`
  form.baidu_path_mock = `/虚拟资料/2026${kw}备考资料/2026${kw}笔试资料/1.2026年${kw}26年笔试模拟题`
  form.baidu_path_interview = `/虚拟资料/2026${kw}备考资料/2026${kw}面试资料`
}

// --- 小红书标签快速填充 ---
const xhsTagKeyword = ref('')
function applyXhsTags() {
  const kw = xhsTagKeyword.value.trim()
  if (!kw) {
    message.warning('请先输入关键词')
    return
  }
  form.xhs_tags = `#${kw}笔试 #${kw}笔试真题 #${kw}笔试 #${kw}笔试资料 #${kw}笔试备考 #${kw}笔试题库 #${kw} 笔试考什么 #${kw}备考 #${kw}笔试 #${kw} #${kw}招聘`
}

// --- 新增页快速导入 ---
const quickImportText = ref('')
function parseQuickImport() {
  const raw = quickImportText.value
  if (!raw.trim()) {
    message.warning('请先粘贴数据')
    return
  }
  const parts = raw.split('\t').map(s => s.trim())
  if (parts.length < 2) {
    message.error('解析失败：请确认字段间使用 Tab 键分隔')
    return
  }
  const [title, recruit_count, apply_time, written_exam_time, interview_time, written_exam_content, interview_content, source_url] = parts
  if (title) form.title = title
  if (recruit_count) form.recruit_count = recruit_count
  if (apply_time) form.apply_time = apply_time
  if (written_exam_time) form.written_exam_time = written_exam_time
  if (interview_time) form.interview_time = interview_time
  if (written_exam_content) form.written_exam_content = written_exam_content
  if (interview_content) form.interview_content = interview_content
  if (source_url) form.source_url = source_url
  message.success('解析完成，请检查各字段')
}

// --- 小红书图片 ---
const imageFileList = ref([])
const imagePreviewOpen = ref(false)
const imagePreviewUrl = ref('')

function urlsToFileList(urls) {
  return (urls || []).map((url, i) => ({
    uid: `exist-${i}`,
    name: url.split('/').pop() || `image-${i}`,
    status: 'done',
    url,
    thumbUrl: url,
  }))
}

function beforeUploadImage(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml']
  if (!allowed.includes(file.type)) {
    message.error('不支持的文件类型')
    return false
  }
  if (file.size > 10 * 1024 * 1024) {
    message.error('文件超过 10MB')
    return false
  }
  return true
}

async function customUploadImage({ file, onSuccess, onError, onProgress }) {
  try {
    onProgress({ percent: 30 })
    const result = await uploadImage(file)
    onProgress({ percent: 100 })
    const item = imageFileList.value.find(f => f.uid === file.uid)
    if (item) { item.url = result.url; item.thumbUrl = result.url }
    onSuccess(result)
  } catch (e) {
    onError(e)
    message.error(e.message || '上传失败')
  }
}

function onPreviewImage(file) {
  imagePreviewUrl.value = file.url || file.thumbUrl
  imagePreviewOpen.value = true
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
.xhs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.xhs-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.xhs-index {
  flex-shrink: 0;
  width: 20px;
  line-height: 32px;
  color: #999;
  font-size: 13px;
}
.xhs-row textarea {
  flex: 1;
}
.hint {
  margin-top: 4px;
  font-size: 12px;
  color: #999;
}
.custom-dir-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.custom-dir-title {
  font-size: 13px;
  font-weight: 500;
  color: #555;
}
.custom-dir-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.custom-dir-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.custom-dir-index {
  flex-shrink: 0;
  width: 20px;
  line-height: 32px;
  color: #999;
  font-size: 13px;
  text-align: center;
}
.quick-fill-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.quick-fill-label {
  font-size: 13px;
  color: #555;
  flex-shrink: 0;
}
.quick-import-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 12px;
}
</style>
