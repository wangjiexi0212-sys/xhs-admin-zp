<template>
  <div>
    <div class="toolbar">
      <a-space>
        <a-select
          v-model:value="filterJobType"
          placeholder="全部商品类型"
          :options="jobTypeOptions"
          allow-clear
          style="width: 180px"
          @change="onFilter"
        />
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索名称/内容"
          allow-clear
          style="width: 220px"
          @search="onFilter"
          @clear="onFilter"
        />
      </a-space>
      <a-button type="primary" @click="openCreate">+ 新建卡片提示词</a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      @change="onPageChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'job_type_name'">
          <a-tag color="blue">{{ record.job_type_name }}</a-tag>
        </template>
        <template v-else-if="column.key === 'content'">
          <a-typography-paragraph
            :ellipsis="{ rows: 2 }"
            :content="record.content"
            style="margin-bottom: 0"
          />
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'success' : 'default'">
            {{ record.status === 1 ? '上架' : '下架' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'sample_image'">
          <template v-if="record.sample_image">
            <a-image
              :src="record.sample_image"
              :width="48"
              :height="48"
              style="object-fit:cover; border-radius:4px; cursor:pointer"
              :preview="{ src: record.sample_image }"
            />
          </template>
          <span v-else style="color:#bbb; font-size:12px">—</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" type="primary" ghost @click="openImageGen(record)">生图</a-button>
            <a-button size="small" @click="openEdit(record)">编辑</a-button>
            <a-upload
              accept="image/*"
              :show-upload-list="false"
              :before-upload="(file) => onUploadSampleImage(file, record)"
            >
              <a-button size="small" :loading="sampleImageUploadingId === record.id">示例图</a-button>
            </a-upload>
            <a-popconfirm
              :title="record.status === 1 ? '确定下架？' : '确定上架？'"
              :ok-text="record.status === 1 ? '下架' : '上架'"
              :ok-type="record.status === 1 ? 'danger' : 'primary'"
              @confirm="onToggleStatus(record)"
            >
              <a-button size="small" :type="record.status === 1 ? 'default' : 'primary'" ghost>
                {{ record.status === 1 ? '下架' : '上架' }}
              </a-button>
            </a-popconfirm>
            <a-popconfirm title="确定删除？" ok-text="删除" ok-type="danger" @confirm="onDelete(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑卡片提示词' : '新建卡片提示词'"
      :confirm-loading="submitting"
      width="720px"
      :destroy-on-close="true"
      @ok="onSubmit"
      @cancel="closeModal"
    >
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" style="margin-top: 8px">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="商品类型" name="job_type_id">
              <a-select
                v-model:value="form.job_type_id"
                placeholder="请选择商品类型"
                :options="jobTypeOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="提示词名称" name="name">
              <a-input v-model:value="form.name" placeholder="请输入名称" :maxlength="80" />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="排序" name="sort_order">
              <a-input-number v-model:value="form.sort_order" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="状态" name="status">
              <a-switch
                v-model:checked="form.status"
                :checked-value="1"
                :un-checked-value="0"
                checked-children="上架"
                un-checked-children="下架"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="提示词内容" name="content">
              <a-textarea
                v-model:value="form.content"
                placeholder="请输入提示词正文"
                :rows="10"
                :maxlength="5000"
                show-count
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" name="description">
              <a-input v-model:value="form.description" placeholder="选填" :maxlength="200" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 生图抽屉 -->
    <a-drawer
      v-model:open="imageGenVisible"
      title="生图提示词"
      width="85%"
      :destroy-on-close="true"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }"
    >
      <!-- 水平布局：左侧输入区，右侧绘图结果区 -->
      <div style="display:flex; gap:16px; flex:1; min-height:0">

        <!-- 左侧：提示词输入 -->
        <div style="width:50%; display:flex; flex-direction:column">
          <a-textarea
            v-model:value="imageGenContent"
            style="font-size:13px; font-family: monospace; resize: none; height: 70%; flex: none"
          />
          <!-- 操作行 -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px">
            <span style="font-size:12px; color:#999">
              当前绘图服务：
              <a-tag v-if="aiImageStore.activeProvider" color="green">{{ aiImageStore.activeProvider }}</a-tag>
              <a-tag v-else color="default">未配置</a-tag>
            </span>
            <a-space>
              <a-button @click="sampleWordsVisible = true">样词</a-button>
              <a-button
                type="primary"
                :loading="imageGenLoading"
                :disabled="!imageGenContent.trim() || !aiImageStore.activeProvider"
                @click="generateImage"
              >生图</a-button>
            </a-space>
          </div>
        </div>

        <!-- 右侧：生成结果 -->
        <div style="flex:1; overflow-y:auto; display:flex; flex-wrap:wrap; align-content:flex-start; gap:12px; justify-content:center; border-left:1px solid #f0f0f0; padding-left:16px">
          <a-empty v-if="!imageGenUrls.length" description="暂无生成结果" style="margin:auto" />
          <div v-for="(url, i) in imageGenUrls" :key="i" style="display:flex; flex-direction:column; align-items:center; gap:6px">
            <img
              :src="url"
              style="max-height:420px; max-width:100%; border-radius:6px; box-shadow:0 2px 12px rgba(0,0,0,0.12); display:block"
            />
            <a-button
              size="small"
              type="link"
              :loading="imageDownloadingIdx === i"
              style="font-size:12px; padding:0"
              @click="downloadGenImage(url, i)"
            >下载</a-button>
          </div>
        </div>

      </div>
    </a-drawer>

    <!-- 样词抽屉 -->
    <a-drawer
      v-model:open="sampleWordsVisible"
      title="样词参考"
      width="480px"
      :body-style="{ padding: '16px 20px', overflow: 'auto' }"
    >
      <pre style="white-space: pre-wrap; word-break: break-all; font-size: 13px; line-height: 1.8; margin: 0; font-family: inherit; color: #333">{{ sampleWordsText }}</pre>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { getJobTypeList } from '@/api/jobTypes'
import {
  getCardPromptList,
  createCardPrompt,
  updateCardPrompt,
  deleteCardPrompt,
  toggleCardPromptStatus,
  updateCardPromptSampleImage,
} from '@/api/cardPrompts'
import { uploadImage } from '@/api/upload'
import { useAiImageStore } from '@/stores/aiImage'
import { drawQuanneng, drawMd2Card } from '@/api/draw'
import { processImageForDownload, triggerBlobDownload } from '@/utils/imageProcess'

const jobTypeOptions = ref([])
const aiImageStore = useAiImageStore()

async function fetchJobTypes() {
  try {
    const res = await getJobTypeList({ pageSize: 200 })
    jobTypeOptions.value = (res.list ?? []).map(t => ({ label: t.name, value: t.id }))
  } catch {}
}

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const filterJobType = ref(undefined)

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '商品类型', key: 'job_type_name', width: 140 },
  { title: '名称', dataIndex: 'name', width: 180 },
  { title: '提示词内容', key: 'content', ellipsis: true },
  { title: '备注', dataIndex: 'description', width: 160, ellipsis: true },
  { title: '示例图', key: 'sample_image', width: 80 },
  { title: '排序', dataIndex: 'sort_order', width: 70 },
  { title: '状态', key: 'status', width: 80 },
  { title: '创建人', dataIndex: 'created_by_name', width: 100 },
  { title: '操作', key: 'action', width: 280, fixed: 'right' },
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: t => `共 ${t} 条`,
}))

async function fetchList() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (filterJobType.value) params.job_type_id = filterJobType.value
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res = await getCardPromptList(params)
    list.value = res.list ?? []
    total.value = res.total ?? 0
  } finally {
    loading.value = false
  }
}

function onFilter() {
  page.value = 1
  fetchList()
}

function onPageChange(p) {
  page.value = p.current
  pageSize.value = p.pageSize
  fetchList()
}

// ---- modal ----
const modalVisible = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const form = reactive({
  job_type_id: undefined,
  name: '',
  content: '',
  description: '',
  sort_order: 0,
  status: 1,
})

const rules = {
  job_type_id: [{ required: true, message: '请选择商品类型' }],
  name: [{ required: true, message: '请输入提示词名称', whitespace: true }],
  content: [{ required: true, message: '请输入提示词内容', whitespace: true }],
}

function resetForm() {
  form.job_type_id = undefined
  form.name = ''
  form.content = ''
  form.description = ''
  form.sort_order = 0
  form.status = 1
  editingId.value = null
  formRef.value?.clearValidate()
}

function openCreate() {
  resetForm()
  modalVisible.value = true
}

function openEdit(record) {
  resetForm()
  editingId.value = record.id
  form.job_type_id = record.job_type_id
  form.name = record.name
  form.content = record.content
  form.description = record.description ?? ''
  form.sort_order = record.sort_order ?? 0
  form.status = record.status ?? 1
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
  resetForm()
}

async function onSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    const payload = {
      job_type_id: form.job_type_id,
      name: form.name.trim(),
      content: form.content.trim(),
      description: form.description.trim(),
      sort_order: form.sort_order,
      status: form.status,
    }
    if (editingId.value) {
      await updateCardPrompt(editingId.value, payload)
      message.success('修改成功')
    } else {
      await createCardPrompt(payload)
      message.success('新建成功')
    }
    closeModal()
    fetchList()
  } catch (e) {
    message.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

// ---- 示例图上传 ----
const sampleImageUploadingId = ref(null)

async function onUploadSampleImage(file, record) {
  sampleImageUploadingId.value = record.id
  try {
    const result = await uploadImage(file)
    const res = await updateCardPromptSampleImage(record.id, result.url)
    record.sample_image = res.sample_image
    message.success('示例图已更新')
  } catch (e) {
    message.error(e.message || '上传失败')
  } finally {
    sampleImageUploadingId.value = null
  }
  return false
}

// ---- 生图弹窗 ----
const imageGenVisible = ref(false)
const imageGenContent = ref('')
const imageGenLoading = ref(false)
const imageGenUrls = ref([])
const imageDownloadingIdx = ref(-1)

// ---- 样词抽屉 ----
const sampleWordsVisible = ref(false)
const sampleWordsText = `一、碎片化轻备考类（1-15）
1. 碎片时间刷题，通勤间隙悄悄提分
2. 课间摸鱼学考点，短时备考效率拉满
3. 零散时间巧利用，不用全天埋头苦学
4. 碎片化速记考点，轻松挤出备考时长
5. 抽空学核心考点，零基础也无备考压力
6. 碎片化速练题库，不用整块时间复习
7. 日常碎片积累知识点，备考毫不费力
8. 碎片时段专攻高频题，低分快速逆袭
9. 通勤碎片化复盘，日积月累稳提分
10. 碎片轻量化学习，告别长时间苦读
11. 零碎时间攻克重难点，备考省时省力
12. 碎片化记忆口诀，背诵不用费大脑
13. 抽空梳理核心考点，备考轻松无负担
14. 碎片化专项刷题，零散时间冲高分
15. 利用碎片吃透考题，零基础轻松备考
二、考前复盘避坑类（16-30）
16. 考前全套复盘笔记，避开九成考场失分坑
17. 考前易错考点合集，进考场少丢冤枉分
18. 冲刺终极复盘清单，高频错题一次性扫清
19. 考前梳理易混考点，考场做题不再踩雷
20. 冲刺复盘核心难点，规避各类答题误区
21. 考前错题集中复盘，减少考场失误失分
22. 终极冲刺复盘手册，直击全部易错题型
23. 考前汇总易丢分考点，答题正确率飙升
24. 考前系统复盘重难点，避开出题人陷阱
25. 冲刺专属复盘素材，考场答题少走弯路
26. 考前梳理高频坑点，做题不再频频出错
27. 全套考前复盘干货，轻松规避答题漏洞
28. 冲刺复盘易混淆知识点，做题思路清晰
29. 考前整理经典错题，考场直接规避失分
30. 终极考前复盘攻略，避开所有考题陷阱
三、高效备考拒绝盲目刷题（31-45）
31. 科学备考新思路，告别无意义海量刷题
32. 精准锁定得分核心，拒绝盲目题海战术
33. 高效备考底层心法，刷题只刷必考题
34. 抓准核心得分考点，不用盲目大量刷题
35. 备考精简学习思路，摒弃低效重复刷题
36. 高分备考核心技巧，精准拿捏采分要点
37. 高效提分学习逻辑，不做无用刷题消耗
38. 直击试卷核心得分点，告别盲目死刷题
39. 实用备考提分心法，精准攻克必考题型
40. 精简高效复习方案，拒绝无目标刷题
41. 找准考题得分命脉，不用盲目刷整套卷
42. 高分备考实用思路，刷题直击分值考点
43. 科学提分备考法则，远离低效盲目刷题
44. 精准对标得分要点，省去海量无用刷题
45. 备考极简高效心法，刷题只练高频考题
四、真题深挖吃透出题逻辑（46-60）
46. 深挖历年真题套路，摸透考官出题思路
47. 拆解真题底层逻辑，一眼看透命题方向
48. 深度剖析历年真题，掌握固定出题规律
49. 吃透真题核心套路，考场答题举一反三
50. 逐道拆解真题考点，摸清全部命题逻辑
51. 深挖真题隐藏考点，精准预判考试题型
52. 研究历年真题规律，读懂出题人侧重点
53. 吃透全套历年真题，掌握稳定出题框架
54. 深度拆解真题题型，抓住核心命题逻辑
55. 深挖真题答题思路，轻松拿捏考试命题
56. 逐套剖析历年真题，摸清每年出题走向
57. 吃透真题底层规律，考场做题游刃有余
58. 深挖真题高频命题点，精准预判考题走向
59. 拆解真题内在逻辑，不用瞎猜考试重点
60. 深耕历年真题题库，吃透整套命题思路
五、专项突破稳步提分（61-70）
61. 分模块专项精准训练，各科分数稳步上涨
62. 薄弱项针对性专项突破，短板快速补齐
63. 分题型专项强化练习，各科分值持续提升
64. 弱项专项集中攻克，稳步拉高笔试总分
65. 分科专项精准刷题，低分稳步冲到高分
66. 针对性攻克薄弱模块，成绩持续稳步提升
67. 高频题型专项特训，分值一路稳步上涨
68. 短板专项集中突破，各科分数稳步提升
69. 分考点专项针对性练习，笔试稳涨分
70. 重难点专项集中攻坚，总分稳步往上走
六、零基础懒人免死记上岸（71-80）
71. 小白零基础上岸攻略，拒绝长篇死记硬背
72. 零基础速成通关技巧，背诵不用死磕书本
73. 纯小白懒人备考秘籍，轻松一战顺利上岸
74. 零基础极简通关方法，不用大量背诵记忆
75. 零基础速成提分套路，告别枯燥死记硬背
76. 懒人专属上岸干货，少背书也能稳通关
77. 零基础简易备考思路，不用死背厚厚教材
78. 小白速成上岸心法，轻松学习不用硬背
79. 零基础懒人通关指南，短时复习顺利上岸
80. 零基础速通备考技巧，摆脱死记硬背模式
七、考情解读抓准考试重点（81-88）
81. 最新官方考情深度解读，找准考试核心重点
82. 全新年度考情分析，摸清每年分值侧重点
83. 最新考情完整拆解，复习备考绝不走弯路
84. 年度考情全面剖析，精准锁定高频考点
85. 全新考势完整解读，避开无用复习内容
86. 最新考试趋势拆解，备考精准直击重点
87. 深度解读本年度考情，复习方向不跑偏
88. 最新考情完整梳理，精准把握出题侧重点
八、裸考 / 少背书刷题速过类（89-100）
89. 考前不用死啃教材，吃透题库轻松通关
90. 临时备考不用背书，刷透真题稳过笔试
91. 短期冲刺不用啃厚书，专攻题库就够用
92. 考前无需通篇背书，吃透题型轻松上岸
93. 懒人极简备考方案，少背书多刷题稳过
94. 临时突击不用苦背书，吃透考题轻松进面
95. 这套高频题库刷熟练，考场答题少失分
96. 考前别盲目啃全书，吃透核心题库足矣
97. 千万别纯裸考，吃透核心考点轻松突围
98. 短期备考听劝，少啃书本多刷真题
99. 刷完这套核心题库，笔试高分稳稳拿捏
100. 拒绝盲目裸考，吃透考题侧重点稳进面`

function openImageGen(record) {
  imageGenContent.value = record.content ?? ''
  imageGenUrls.value = []
  imageGenVisible.value = true
}

async function generateImage() {
  await aiImageStore.ensureLoaded()
  const provider = aiImageStore.activeProvider
  if (!provider) {
    message.warning('请先在「系统配置 > AI绘图」中配置并启用一个绘图服务')
    return
  }
  const prompt = imageGenContent.value.trim()
  if (!prompt) return

  const config = aiImageStore.activeConfig
  imageGenLoading.value = true
  imageGenUrls.value = []
  try {
    let res
    if (provider === 'quanneng') {
      res = await drawQuanneng({
        api_key: config.api_key,
        base_url: config.base_url || '',
        model: config.model || 'gpt-image-2',
        prompt,
        size: config.ratio || '1080x1440',
        response_format: 'url',
        count: 1,
      })
      imageGenUrls.value = res.urls || []
    } else if (provider === 'md2card') {
      res = await drawMd2Card({
        api_key: config.api_key,
        text: prompt,
        keywords: config.model || '',    // model 字段复用存关键词
        count: config.concurrency || 1,  // concurrency 字段复用存张数
      })
      imageGenUrls.value = res.urls || []
    } else if (provider === 'jimeng') {
      message.warning('即梦暂不支持在此处直接调用，请前往商品详情页使用封面生成功能')
      return
    }
    if (!imageGenUrls.value.length) message.warning('未返回图片，请检查配置后重试')
  } catch (e) {
    message.error(e.message || '生图失败')
  } finally {
    imageGenLoading.value = false
  }
}

async function downloadGenImage(url, idx) {
  imageDownloadingIdx.value = idx
  try {
    const blob = await processImageForDownload(url)
    triggerBlobDownload(blob, `card-img-${idx + 1}.jpg`)
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    imageDownloadingIdx.value = -1
  }
}

async function onToggleStatus(record) {
  try {
    const res = await toggleCardPromptStatus(record.id)
    record.status = res.status
    message.success(res.status === 1 ? '已上架' : '已下架')
  } catch (e) {
    message.error(e.message || '操作失败')
  }
}

async function onDelete(id) {
  try {
    await deleteCardPrompt(id)
    message.success('删除成功')
    fetchList()
  } catch (e) {
    message.error(e.message || '删除失败')
  }
}

onMounted(() => {
  fetchJobTypes()
  fetchList()
  aiImageStore.ensureLoaded()
})
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
