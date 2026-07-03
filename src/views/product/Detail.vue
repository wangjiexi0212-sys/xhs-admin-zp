<template>
  <div>
    <div class="page-header">
      <a-button @click="goList">
        <template #icon>
          <LeftOutlined />
        </template>
        返回列表
      </a-button>
      <span class="page-title">商品详情</span>
      <a-space>
        <a-button type="primary" ghost @click="openGenerate">
          <template #icon>
            <FileTextOutlined />
          </template>
          生成笔记
        </a-button>
        <a-button type="default" @click="openInterview">
          <template #icon>
            <SyncOutlined v-if="interviewJob?.status === 'pending' || interviewJob?.status === 'running'" :spin="true" />
            <CheckCircleOutlined v-else-if="interviewJob?.status === 'done'" style="color: #52c41a" />
            <CloseCircleOutlined v-else-if="interviewJob?.status === 'failed'" style="color: #ff4d4f" />
            <BulbOutlined v-else />
          </template>
          生成面试题
        </a-button>
        <a-button type="default" @click="openExam">
          <template #icon>
            <SyncOutlined v-if="examJob?.status === 'pending' || examJob?.status === 'running'" :spin="true" />
            <CheckCircleOutlined v-else-if="examJob?.status === 'done'" style="color: #52c41a" />
            <CloseCircleOutlined v-else-if="examJob?.status === 'failed' || examJob?.status === 'partial'" style="color: #ff4d4f" />
            <FormOutlined v-else />
          </template>
          生成笔试题
        </a-button>
        <a-button type="primary" @click="goEdit">
          <template #icon>
            <EditOutlined />
          </template>
          编辑
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <a-card title="基本信息" :bordered="false">
        <a-descriptions :column="3" bordered size="small">
          <a-descriptions-item label="公告名称" :span="3">
            {{ data.title || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="单位名称">{{ data.company_name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="招聘人数">{{ data.recruit_count || '-' }}</a-descriptions-item>
          <a-descriptions-item label="商品类型">{{ data.job_type_name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="data.status ? 'green' : 'default'">
              {{ data.status ? '上架' : '下架' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="公告原文" :span="2">
            <a v-if="data.source_url" :href="data.source_url" target="_blank" rel="noopener">
              {{ data.source_url }}
            </a>
            <span v-else>-</span>
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-card title="时间信息" :bordered="false" style="margin-top: 12px">
        <a-descriptions :column="3" bordered size="small">
          <a-descriptions-item label="报名时间">{{ data.apply_time || '-' }}</a-descriptions-item>
          <a-descriptions-item label="笔试时间">{{ data.written_exam_time || '-' }}</a-descriptions-item>
          <a-descriptions-item label="面试时间">{{ data.interview_time || '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-card title="考试内容" :bordered="false" style="margin-top: 12px">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="笔试内容">
            <div class="content-text">{{ data.written_exam_content || '-' }}</div>
          </a-descriptions-item>
          <a-descriptions-item label="面试内容">
            <div class="content-text">{{ data.interview_content || '-' }}</div>
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-card title="小红书信息" :bordered="false" style="margin-top: 12px">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="小红书商品ID">
            {{ data.xhs_product_id || '-' }}
          </a-descriptions-item>
        </a-descriptions>

        <div v-if="data.xhs_content?.length" style="margin-top: 12px">
          <div class="section-label">小红书正文（{{ data.xhs_content.length }} 条）</div>
          <a-collapse :bordered="false" style="margin-top: 6px">
            <a-collapse-panel v-for="(text, idx) in data.xhs_content" :key="idx" :header="`第 ${idx + 1} 条`">
              <div class="content-text">{{ text }}</div>
            </a-collapse-panel>
          </a-collapse>
        </div>
        <div v-else style="margin-top: 12px; color: #999">暂无小红书正文</div>

        <div style="margin-top: 12px">
          <div class="section-label">小红书标签</div>
          <div style="margin-top: 6px">
            <template v-if="data.xhs_tags?.length">
              <a-tag v-for="tag in data.xhs_tags" :key="tag" color="pink">{{ tag }}</a-tag>
            </template>
            <span v-else style="color: #999">暂无标签</span>
          </div>
        </div>

        <div style="margin-top: 12px">
          <div class="section-label">
            小红书图片<span v-if="data.xhs_images?.length">（{{ data.xhs_images.length }} 张）</span>
          </div>
          <div v-if="data.xhs_images?.length" class="xhs-image-grid">
            <a-image-preview-group>
              <a-image v-for="(url, idx) in data.xhs_images" :key="idx" :src="url" :width="120" :height="120"
                class="xhs-image-item" />
            </a-image-preview-group>
          </div>
          <div v-else style="margin-top: 6px; color: #999">暂无图片</div>
        </div>
      </a-card>

      <a-card title="百度网盘目录" :bordered="false" style="margin-top: 12px">
        <a-row v-if="!data.baidu_path_exam && !data.baidu_path_history && !data.baidu_path_mock">
          <a-col :span="24" style="color: #999">暂未配置百度网盘目录路径，请在编辑页面填写</a-col>
        </a-row>
        <a-row :gutter="24" v-else>
          <a-col :span="8" v-if="data.baidu_path_exam">
            <div class="baidu-dir-item">
              <div class="baidu-dir-label">笔试资料目录</div>
              <div class="baidu-dir-path">{{ data.baidu_path_exam }}</div>
              <a-space style="margin-top: 8px">
                <a-button :loading="dirDrawer.loading && dirDrawer.type === 'exam'" @click="generateDirImage('exam')">
                  生成目录图
                </a-button>
              </a-space>
            </div>
          </a-col>
          <a-col :span="8" v-if="data.baidu_path_history">
            <div class="baidu-dir-item">
              <div class="baidu-dir-label">真题目录</div>
              <div class="baidu-dir-path">{{ data.baidu_path_history }}</div>
              <a-space style="margin-top: 8px">
                <a-button :loading="dirDrawer.loading && dirDrawer.type === 'history'" @click="generateDirImage('history')">
                  生成目录图
                </a-button>
              </a-space>
            </div>
          </a-col>
          <a-col :span="8" v-if="data.baidu_path_mock">
            <div class="baidu-dir-item">
              <div class="baidu-dir-label">模拟题目录</div>
              <div class="baidu-dir-path">{{ data.baidu_path_mock }}</div>
              <a-space style="margin-top: 8px">
                <a-button :loading="dirDrawer.loading && dirDrawer.type === 'mock'" @click="generateDirImage('mock')">
                  生成目录图
                </a-button>
              </a-space>
            </div>
          </a-col>
        </a-row>
      </a-card>

      <!-- 目录图画布抽屉 -->
      <a-drawer
        v-model:open="dirDrawer.visible"
        title="目录图编辑"
        placement="right"
        :width="'95%'"
        :body-style="{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }"
      >
        <!-- 工具栏 -->
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-shrink:0; flex-wrap:wrap">
          <span style="font-size:13px;color:#555;white-space:nowrap">标题文案：</span>
          <a-input v-model:value="dirDrawer.title" style="width:200px" @input="refreshDirPreview" />
          <span style="font-size:13px;color:#555;white-space:nowrap">边框颜色：</span>
          <input type="color" v-model="dirDrawer.borderColor" @input="refreshDirPreview" style="width:40px;height:32px;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;padding:2px" />
          <a-button @click="downloadCompositeImage" :disabled="!dirDrawer.previewUrl">下载目录图</a-button>
          <a-button @click="downloadPdfPage" :disabled="!dirDrawer.pdfPreviewUrl">下载PDF首页</a-button>
        </div>

        <!-- 两栏主区域 -->
        <div style="flex:1; display:flex; gap:16px; min-height:0; overflow:hidden">
          <!-- 左栏：目录图预览 -->
          <div style="width:60%; overflow:auto; display:flex; justify-content:center; align-items:flex-start; background:#f0f0f0; border-radius:8px; padding:20px">
            <a-spin v-if="dirDrawer.loading" style="margin-top:60px" />
            <img
              v-else-if="dirDrawer.previewUrl"
              :src="dirDrawer.previewUrl"
              style="max-width:100%; box-shadow:0 4px 20px rgba(0,0,0,0.15); border-radius:4px; display:block"
            />
            <div v-else style="color:#999;margin-top:60px">暂无预览</div>
          </div>

          <!-- 右栏：PDF首页截图 -->
          <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:10px">
            <div style="font-size:13px;font-weight:500;color:#333">
              PDF首页截图
              <span v-if="dirDrawer.type === 'history'" style="font-size:12px;color:#999;font-weight:400;margin-left:6px">（已自动匹配2025年，点击可切换）</span>
            </div>

            <!-- PDF 文件列表 -->
            <div style="flex-shrink:0; max-height:200px; overflow-y:auto; border:1px solid #f0f0f0; border-radius:6px; background:#fafafa">
              <div
                v-for="f in dirDrawer.files.filter(f => f.isdir === 0)"
                :key="f.fs_id"
                @click="renderPdfFirstPage(f)"
                style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0; font-size:13px; transition:background 0.15s"
                :style="{ background: dirDrawer.pdfFsid === f.fs_id ? '#fff7e6' : '' }"
                @mouseenter="$event.currentTarget.style.background = dirDrawer.pdfFsid === f.fs_id ? '#fff7e6' : '#f5f5f5'"
                @mouseleave="$event.currentTarget.style.background = dirDrawer.pdfFsid === f.fs_id ? '#fff7e6' : ''"
              >
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:#333">📄 {{ f.name }}</span>
                <a-spin v-if="dirDrawer.pdfLoading && dirDrawer.pdfFsid === f.fs_id" size="small" style="margin-left:8px;flex-shrink:0" />
              </div>
              <div v-if="!dirDrawer.files.filter(f => f.isdir === 0).length" style="padding:12px;color:#999;font-size:13px;text-align:center">
                无文件
              </div>
            </div>

            <!-- PDF 预览 -->
            <div style="flex:1; overflow:auto; background:#f0f0f0; border-radius:8px; padding:12px; display:flex; justify-content:center; align-items:flex-start; min-height:0">
              <a-spin v-if="dirDrawer.pdfLoading && !dirDrawer.pdfPreviewUrl" style="margin-top:40px" />
              <img
                v-else-if="dirDrawer.pdfPreviewUrl"
                :src="dirDrawer.pdfPreviewUrl"
                style="max-width:100%; box-shadow:0 2px 12px rgba(0,0,0,0.12); border-radius:4px; display:block"
              />
              <div v-else style="color:#999;font-size:13px;margin-top:40px;text-align:center">点击上方文件截取首页</div>
            </div>
          </div>
        </div>
      </a-drawer>

      <a-card title="记录信息" :bordered="false" style="margin-top: 12px">
        <a-descriptions :column="3" bordered size="small">
          <a-descriptions-item label="创建人">{{ data.created_by_name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatTime(data.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="ID">{{ data.id }}</a-descriptions-item>
          <a-descriptions-item label="修改人">{{ data.updated_by_name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="修改时间">{{ formatTime(data.updated_at) }}</a-descriptions-item>
        </a-descriptions>
      </a-card>

      <div class="page-footer">
        <a-button @click="goList">
          <template #icon>
            <LeftOutlined />
          </template>
          返回列表
        </a-button>
        <a-button type="primary" ghost @click="openGenerate">
          <template #icon>
            <FileTextOutlined />
          </template>
          生成笔记
        </a-button>
        <a-button type="default" @click="openInterview">
          <template #icon>
            <SyncOutlined v-if="interviewJob?.status === 'pending' || interviewJob?.status === 'running'" :spin="true" />
            <CheckCircleOutlined v-else-if="interviewJob?.status === 'done'" style="color: #52c41a" />
            <CloseCircleOutlined v-else-if="interviewJob?.status === 'failed'" style="color: #ff4d4f" />
            <BulbOutlined v-else />
          </template>
          生成面试题
        </a-button>
        <a-button type="default" @click="openExam">
          <template #icon>
            <SyncOutlined v-if="examJob?.status === 'pending' || examJob?.status === 'running'" :spin="true" />
            <CheckCircleOutlined v-else-if="examJob?.status === 'done'" style="color: #52c41a" />
            <CloseCircleOutlined v-else-if="examJob?.status === 'failed' || examJob?.status === 'partial'" style="color: #ff4d4f" />
            <FormOutlined v-else />
          </template>
          生成笔试题
        </a-button>
        <a-button type="primary" @click="goEdit">
          <template #icon>
            <EditOutlined />
          </template>
          编辑
        </a-button>
      </div>
    </a-spin>

    <!-- 生成笔记 抽屉 -->
    <a-drawer v-model:open="generateVisible" title="生成笔记" placement="right" width="80%" :destroy-on-close="false">
      <a-form layout="vertical">
        <a-form-item>
          <template #label>
            <div class="title-label">
              <span>图片</span>
              <a-space>
                <a-button v-if="generatedImages.length" type="link" size="small" @click="downloadAllImages">
                  <DownloadOutlined /> 下载全部
                </a-button>
                <a-button type="link" size="small" :loading="imagesGenerating" @click="generateImages">
                  {{ generatedImages.length ? '重新生成' : '生成图片' }}
                </a-button>
              </a-space>
            </div>
          </template>
          <div v-if="imagesGenerating" class="field-placeholder loading-box">
            <a-spin /> <span style="margin-left: 8px; color: #999">正在生成图片...</span>
          </div>
          <div v-else-if="generatedImages.length" class="gen-image-grid">
            <a-image-preview-group>
              <div v-for="(img, idx) in generatedImages" :key="idx" class="gen-image-item">
                <a-image :src="img.blobUrl" :width="120" :height="160" />
                <a-button type="link" size="small" @click="downloadOne(idx)">
                  <DownloadOutlined /> 下载
                </a-button>
              </div>
            </a-image-preview-group>
          </div>
          <div v-else class="field-placeholder"></div>

          <a-divider style="margin: 16px 0 12px">
            <span style="font-size: 13px; color: #888">标题卡片</span>
          </a-divider>
          <div class="card-text-row">
            <span class="card-text-label">卡片文字</span>
            <a-textarea v-model:value="cardText" placeholder="生成标题后会同步到此处，可手动修改用于卡片"
              :auto-size="{ minRows: 1, maxRows: 4 }" :maxlength="200" style="margin: 20px 0;" />
          </div>
          <CardEditor :text="cardText" placeholder="生成标题后将以标题作为卡片文字"
            :file-name-prefix="`xhs-card-${data.id || 'item'}`" />
        </a-form-item>
        <a-form-item>
          <template #label>
            <div class="title-label">
              <span>标题</span>
              <a-space>
                <a-button v-if="generatedTitle" type="link" size="small" @click="copyText(generatedTitle)">
                  <CopyOutlined /> 复制
                </a-button>
                <a-button type="link" size="small" :loading="titleGenerating" @click="generateTitle">
                  {{ generatedTitle ? '重新生成' : '生成标题' }}
                </a-button>
              </a-space>
            </div>
          </template>
          <div v-if="titleGenerating" class="field-placeholder loading-box">
            <a-spin /> <span style="margin-left: 8px; color: #999">正在生成标题...</span>
          </div>
          <a-input v-else-if="generatedTitle" v-model:value="generatedTitle" placeholder="生成的标题" />
          <div v-else class="field-placeholder"></div>
        </a-form-item>
        <a-form-item>
          <template #label>
            <div class="title-label">
              <span>正文</span>
              <a-space>
                <a-button v-if="generatedBody" type="link" size="small" @click="copyText(generatedBody)">
                  <CopyOutlined /> 复制
                </a-button>
                <a-button type="link" size="small" :loading="bodyGenerating" @click="generateBody">
                  {{ generatedBody ? '重新生成' : '生成正文' }}
                </a-button>
              </a-space>
            </div>
          </template>
          <div v-if="bodyGenerating" class="field-placeholder field-placeholder--lg loading-box">
            <a-spin /> <span style="margin-left: 8px; color: #999">正在生成正文...</span>
          </div>
          <a-textarea v-else-if="generatedBody" v-model:value="generatedBody" placeholder="生成的正文"
            :auto-size="{ minRows: 10, maxRows: 24 }" />
          <div v-else class="field-placeholder field-placeholder--lg"></div>
        </a-form-item>
        <a-form-item>
          <template #label>
            <div class="title-label">
              <span>标签</span>
              <a-button v-if="generatedTags.length" type="link" size="small" @click="copyText(generatedTags.join(' '))">
                <CopyOutlined /> 复制
              </a-button>
            </div>
          </template>
          <div v-if="generatedTags.length" class="gen-tag-list">
            <a-tag v-for="tag in generatedTags" :key="tag" color="pink">{{ tag }}</a-tag>
          </div>
          <div v-else class="field-placeholder">
            <span style="color: #999">暂无标签</span>
          </div>
        </a-form-item>
        <a-form-item>
          <template #label>
            <div class="title-label">
              <span>封面图</span>
              <a-space>
                <a-button v-if="coverImageUrls.length === 1 && coverImageUrl" type="link" size="small" @click="downloadCoverImage()">
                  <DownloadOutlined /> 下载
                </a-button>
                <a-button type="link" size="small" :loading="coverGenerating" @click="generateCoverImage">
                  {{ coverImageUrls.length ? '重新生成' : '生成封面图' }}
                </a-button>
              </a-space>
            </div>
          </template>
          <div v-if="coverGenerating" class="field-placeholder cover-placeholder loading-box">
            <a-spin /> <span style="margin-left: 8px; color: #999">正在生成封面图...</span>
          </div>
          <div v-else-if="coverImageUrls.length" class="cover-result">
            <div class="cover-image-list">
              <div v-for="(u, idx) in coverImageUrls" :key="idx" class="cover-image-item">
                <a-image :src="u" :width="135" :height="180" style="border-radius: 6px; object-fit: cover" />
                <a-button type="link" size="small" @click="downloadCoverImage(u)">
                  <DownloadOutlined /> 下载
                </a-button>
              </div>
            </div>
            <div v-if="coverPromptUsed" class="cover-prompt-tip">
              <div style="font-size: 12px; color: #999; margin: 8px 0 4px">提示词（可编辑后重新生成）：</div>
              <a-textarea
                v-model:value="coverPromptUsed"
                style="font-size: 12px; width: 1048px; height: 500px; resize: none"
              />
              <a-button
                type="link"
                size="small"
                :loading="coverGenerating"
                style="padding: 4px 0"
                @click="generateCoverImage(true)"
              >
                用此提示词生成
              </a-button>
            </div>
          </div>
          <div v-else class="field-placeholder cover-placeholder"></div>
        </a-form-item>
      </a-form>
    </a-drawer>

    <!-- 生成面试题 抽屉 -->
    <a-drawer
      v-model:open="interviewVisible"
      title="生成面试题"
      placement="right"
      width="520"
      :destroy-on-close="false"
    >
      <div class="interview-meta">
        单位：{{ data.company_name || '-' }} ／ 类型：{{ data.job_type_name || '-' }}
      </div>

      <a-alert
        class="interview-tip"
        type="info"
        show-icon
        message="说明"
        description="点击下方按钮后，后台异步生成 50 道面试题。生成完成后可下载 Word 文档，文件 2 小时内有效，过期需重新生成。"
      />

      <!-- 状态卡片 -->
      <div v-if="interviewJob" class="interview-status">
        <div class="status-row">
          <span class="status-label">状态：</span>
          <a-tag v-if="interviewJob.status === 'pending'" color="default">
            <ClockCircleOutlined /> 等待中
          </a-tag>
          <a-tag v-else-if="interviewJob.status === 'running'" color="processing">
            <SyncOutlined :spin="true" /> 生成中
          </a-tag>
          <a-tag v-else-if="interviewJob.status === 'done'" color="success">
            <CheckCircleOutlined /> 已完成
          </a-tag>
          <a-tag v-else-if="interviewJob.status === 'failed'" color="error">
            <CloseCircleOutlined /> 失败
          </a-tag>
        </div>
        <div class="status-row">
          <span class="status-label">进度：</span>
          <span>{{ interviewJob.question_count || 0 }} / 50 题</span>
        </div>
        <div v-if="interviewJob.error" class="status-row">
          <span class="status-label">错误：</span>
          <span class="status-error">{{ interviewJob.error }}</span>
        </div>
        <div v-if="interviewJob.expires_at" class="status-row">
          <span class="status-label">有效期：</span>
          <span>{{ formatTime(interviewJob.expires_at) }} 前</span>
        </div>
      </div>

      <div class="interview-actions">
        <a-button
          type="primary"
          :loading="interviewSubmitting || interviewJob?.status === 'pending' || interviewJob?.status === 'running'"
          :disabled="interviewJob?.status === 'pending' || interviewJob?.status === 'running'"
          @click="generateInterview"
        >
          <template #icon><BulbOutlined /></template>
          {{ interviewJob && interviewJob.status === 'done' ? '重新生成' : (interviewJob?.status === 'failed' ? '重试' : '开始生成') }}
        </a-button>
        <a-button
          v-if="interviewJob?.status === 'done'"
          type="primary"
          ghost
          :loading="interviewDownloading"
          @click="handleDownloadInterview"
        >
          <template #icon><FileWordOutlined /></template>
          下载 Word
        </a-button>
      </div>
    </a-drawer>

    <!-- 生成笔试题 抽屉 -->
    <a-drawer
      v-model:open="examVisible"
      title="生成笔试题"
      placement="right"
      width="640"
      :destroy-on-close="false"
    >
      <div class="interview-meta">
        单位：{{ data.company_name || '-' }} ／ 类型：{{ data.job_type_name || '-' }}
      </div>

      <a-alert
        class="interview-tip"
        type="info"
        show-icon
        message="说明"
        description="共生成 7 份试题：2022～2025 年历年真题（取自试题模版）+ 2026 年模拟卷 3 份（AI 生成）。任一份失败可单独重试，全部完成或部分完成均可下载 ZIP。文件 2 小时内有效。"
      />

      <div v-if="examJob" class="interview-status">
        <div class="status-row">
          <span class="status-label">总体状态：</span>
          <a-tag v-if="examJob.status === 'pending'" color="default">
            <ClockCircleOutlined /> 等待中
          </a-tag>
          <a-tag v-else-if="examJob.status === 'running'" color="processing">
            <SyncOutlined :spin="true" /> 生成中
          </a-tag>
          <a-tag v-else-if="examJob.status === 'done'" color="success">
            <CheckCircleOutlined /> 已完成
          </a-tag>
          <a-tag v-else-if="examJob.status === 'partial'" color="warning">
            <CloseCircleOutlined /> 部分失败
          </a-tag>
          <a-tag v-else-if="examJob.status === 'canceled'" color="default">
            <StopOutlined /> 已停止
          </a-tag>
          <a-tag v-else-if="examJob.status === 'failed'" color="error">
            <CloseCircleOutlined /> 失败
          </a-tag>
        </div>
        <div class="status-row">
          <span class="status-label">进度：</span>
          <span>{{ examDoneCount }} / {{ examJob.parts?.length || 7 }} 份</span>
        </div>
        <div v-if="examJob.error" class="status-row">
          <span class="status-label">错误：</span>
          <span class="status-error">{{ examJob.error }}</span>
        </div>
        <div v-if="examJob.expires_at" class="status-row">
          <span class="status-label">有效期：</span>
          <span>{{ formatTime(examJob.expires_at) }} 前</span>
        </div>
      </div>

      <div v-if="examJob?.parts?.length" class="exam-parts">
        <div v-for="p in examJob.parts" :key="p.index" class="exam-part-row">
          <div class="exam-part-main">
            <div class="exam-part-title">
              <span>{{ p.label }}</span>
              <a-tag v-if="p.status === 'pending'" color="default">等待中</a-tag>
              <a-tag v-else-if="p.status === 'running'" color="processing">
                <SyncOutlined :spin="true" /> 生成中
              </a-tag>
              <a-tag v-else-if="p.status === 'done'" color="success">已完成</a-tag>
              <a-tag v-else-if="p.status === 'failed'" color="error">失败</a-tag>
            </div>
            <div v-if="p.error" class="exam-part-error">{{ p.error }}</div>
          </div>
          <div class="exam-part-actions">
            <a-button
              v-if="p.status === 'failed'"
              size="small"
              :loading="retryingIndex === p.index"
              :disabled="examAnyRunning"
              @click="retryPart(p)"
            >
              <template #icon><SyncOutlined /></template>
              重新生成
            </a-button>
            <a-button
              v-if="p.status === 'done'"
              size="small"
              type="link"
              @click="downloadPart(p)"
            >
              <template #icon><FileWordOutlined /></template>
              下载
            </a-button>
          </div>
        </div>
      </div>

      <div class="interview-actions">
        <a-button
          type="primary"
          :loading="examSubmitting"
          :disabled="examAnyRunning"
          @click="generateExam"
        >
          <template #icon><FormOutlined /></template>
          {{ examJob ? '重新生成全部' : '开始生成' }}
        </a-button>
        <a-button
          v-if="examAnyRunning"
          danger
          :loading="examCanceling"
          @click="handleCancelExam"
        >
          <template #icon><StopOutlined /></template>
          停止生成
        </a-button>
        <a-button
          v-if="examDoneCount > 0"
          type="primary"
          ghost
          :loading="examDownloading"
          @click="handleDownloadExam"
        >
          <template #icon><DownloadOutlined /></template>
          下载 ZIP（{{ examDoneCount }} 份）
        </a-button>
      </div>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { LeftOutlined, EditOutlined, FileTextOutlined, DownloadOutlined, BulbOutlined, FileWordOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, FormOutlined, StopOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { getProductDetail } from '@/api/products'
import { getContentTemplateList } from '@/api/contentTemplates'
import { getPromptList } from '@/api/prompts'
import { chatLlm } from '@/api/llm'
import { drawCover } from '@/api/draw'
import { useLlmStore } from '@/stores/llm'
import { useAiImageStore } from '@/stores/aiImage'
import CardEditor from '@/views/note/CardEditor.vue'
import { getRandomTitleFormula } from '@/api/titleFormulas'
import { createInterviewJob, getLatestInterviewJob, getInterviewJob, downloadInterviewJob } from '@/api/interviewJobs'
import { createExamJob, getLatestExamJob, getExamJob, downloadExamJob, downloadExamPart, retryExamPart, cancelExamJob } from '@/api/examJobs'
import { processImageForDownload, processImageForDisplay, buildRandomGradient, triggerBlobDownload } from '@/utils/imageProcess'
import { getBaiduFiles } from '@/api/baidu'
import { getToken } from '@/api/request'

const route = useRoute()
const router = useRouter()
const llmStore = useLlmStore()
const aiImageStore = useAiImageStore()

const id = computed(() => Number(route.params.id))
const loading = ref(false)
const data = ref({})
const generateVisible = ref(false)
const titleGenerating = ref(false)
const generatedTitle = ref('')
const cardText = ref('')
const bodyGenerating = ref(false)
const generatedBody = ref('')
const imagesGenerating = ref(false)
const generatedImages = ref([])
const generatedTags = ref([])
const coverGenerating = ref(false)
const coverImageUrl = ref('')
const coverImageUrls = ref([])
const coverPromptUsed = ref('')

// --- 生成面试题（后端异步）---
const interviewVisible = ref(false)
const interviewJob = ref(null)      // { id, status, question_count, error, finished_at, expires_at }
const interviewSubmitting = ref(false)
const interviewDownloading = ref(false)
let pollTimer = null

function openInterview() {
  interviewVisible.value = true
}

function clearPollTimer() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function pollJob(jobId) {
  try {
    const row = await getInterviewJob(jobId)
    interviewJob.value = row
    if (row && (row.status === 'done' || row.status === 'failed')) {
      clearPollTimer()
    }
  } catch { /* ignore poll errors */ }
}

function startPolling(jobId) {
  clearPollTimer()
  pollTimer = setInterval(() => pollJob(jobId), 3000)
}

async function generateInterview() {
  const active = llmStore.active
  if (!active) {
    Modal.warning({
      title: '提示',
      content: '请先设置使用中的模型',
      okText: '去设置',
      onOk: () => router.push('/system/llm'),
    })
    return
  }

  interviewSubmitting.value = true
  try {
    const res = await createInterviewJob({
      product_id: id.value,
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
    })
    interviewJob.value = res
    if (res.status === 'pending' || res.status === 'running') {
      startPolling(res.id)
    }
  } catch (e) {
    message.error(e.message || '提交失败')
  } finally {
    interviewSubmitting.value = false
  }
}

async function handleDownloadInterview() {
  if (!interviewJob.value?.id) return
  interviewDownloading.value = true
  try {
    const company = data.value.company_name || '未知单位'
    await downloadInterviewJob(interviewJob.value.id, `面试题-${company}-${interviewJob.value.id}.docx`)
    message.success('下载成功')
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    interviewDownloading.value = false
  }
}

async function fetchLatestInterviewJob() {
  try {
    const row = await getLatestInterviewJob(id.value)
    if (!row) return
    interviewJob.value = row
    if (row.status === 'pending' || row.status === 'running') {
      startPolling(row.id)
    }
  } catch { /* ignore */ }
}

// --- 生成笔试题（后端异步）---
const examVisible = ref(false)
const examJob = ref(null)
const examSubmitting = ref(false)
const examDownloading = ref(false)
const examCanceling = ref(false)
const retryingIndex = ref(-1)
let examPollTimer = null

const examAnyRunning = computed(() => {
  if (examSubmitting.value) return true
  const status = examJob.value?.status
  if (status === 'canceled' || status === 'done' || status === 'partial' || status === 'failed') return false
  return !!(examJob.value?.parts?.some(p => p.status === 'pending' || p.status === 'running'))
})

const examDoneCount = computed(() =>
  examJob.value?.parts?.filter(p => p.status === 'done').length ?? 0
)

function openExam() {
  examVisible.value = true
}

function clearExamPollTimer() {
  if (examPollTimer) { clearInterval(examPollTimer); examPollTimer = null }
}

function examShouldPoll(row) {
  if (!row) return false
  if (row.status === 'pending' || row.status === 'running') return true
  return !!row.parts?.some(p => p.status === 'pending' || p.status === 'running')
}

async function pollExamJob(jobId) {
  try {
    const row = await getExamJob(jobId)
    examJob.value = row
    if (!examShouldPoll(row)) {
      clearExamPollTimer()
    }
  } catch { /* ignore */ }
}

function startExamPolling(jobId) {
  clearExamPollTimer()
  examPollTimer = setInterval(() => pollExamJob(jobId), 3000)
}

async function generateExam() {
  const active = llmStore.active
  if (!active) {
    Modal.warning({
      title: '提示',
      content: '请先设置使用中的模型',
      okText: '去设置',
      onOk: () => router.push('/system/llm'),
    })
    return
  }

  examSubmitting.value = true
  try {
    const res = await createExamJob({
      product_id: id.value,
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
    })
    // 创建接口只返回基础字段，立即拉一次详情拿到 parts
    examJob.value = res
    await pollExamJob(res.id)
    if (examShouldPoll(examJob.value)) {
      startExamPolling(res.id)
    }
  } catch (e) {
    message.error(e.message || '提交失败')
  } finally {
    examSubmitting.value = false
  }
}

async function handleDownloadExam() {
  if (!examJob.value?.id) return
  examDownloading.value = true
  try {
    const company = data.value.company_name || '未知单位'
    await downloadExamJob(examJob.value.id, `笔试题-${company}-${examJob.value.id}.zip`)
    message.success('下载成功')
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    examDownloading.value = false
  }
}

async function handleCancelExam() {
  if (!examJob.value?.id) return
  examCanceling.value = true
  try {
    await cancelExamJob(examJob.value.id)
    clearExamPollTimer()
    await pollExamJob(examJob.value.id)
    message.success('已停止生成')
  } catch (e) {
    message.error(e.message || '取消失败')
  } finally {
    examCanceling.value = false
  }
}

async function fetchLatestExamJob() {
  try {
    const row = await getLatestExamJob(id.value)
    if (!row) return
    examJob.value = row
    if (examShouldPoll(row)) {
      startExamPolling(row.id)
    }
  } catch { /* ignore */ }
}

async function retryPart(part) {
  if (!examJob.value?.id) return
  const active = llmStore.active
  if (!active) {
    Modal.warning({
      title: '提示',
      content: '请先设置使用中的模型',
      okText: '去设置',
      onOk: () => router.push('/system/llm'),
    })
    return
  }
  retryingIndex.value = part.index
  try {
    const body = {
      part_index: part.index,
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
    }
    await retryExamPart(examJob.value.id, body)
    await pollExamJob(examJob.value.id)
    if (examShouldPoll(examJob.value)) {
      startExamPolling(examJob.value.id)
    }
  } catch (e) {
    message.error(e.message || '重试失败')
  } finally {
    retryingIndex.value = -1
  }
}

async function downloadPart(part) {
  if (!examJob.value?.id) return
  try {
    const company = data.value.company_name || '未知单位'
    const filename = `${company}-${part.filename}`
    await downloadExamPart(examJob.value.id, part.index, filename)
  } catch (e) {
    message.error(e.message || '下载失败')
  }
}

onBeforeUnmount(clearExamPollTimer)

function revokeGeneratedImages() {
  generatedImages.value.forEach(g => {
    if (g.blobUrl) URL.revokeObjectURL(g.blobUrl)
  })
  generatedImages.value = []
}

onBeforeUnmount(revokeGeneratedImages)
onBeforeUnmount(clearPollTimer)


function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

function renderOne(srcUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const W = 1080
      const H = 1440
      const PAD = 50
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = buildRandomGradient(ctx, W, H)
      ctx.fillRect(0, 0, W, H)

      const img = await loadImage(srcUrl)
      const maxW = W - PAD * 2
      const maxH = H - PAD * 2
      const ratio = Math.min(maxW / img.width, maxH / img.height)
      const drawW = img.width * ratio
      const drawH = img.height * ratio
      const x = (W - drawW) / 2
      const y = (H - drawH) / 2
      ctx.drawImage(img, x, y, drawW, drawH)

      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('生成失败'))
        const blobUrl = URL.createObjectURL(blob)
        resolve({ srcUrl, blob, blobUrl })
      }, 'image/png')
    } catch (e) {
      reject(e)
    }
  })
}

async function generateImages() {
  const list = data.value.xhs_images
  if (!Array.isArray(list) || !list.length) {
    message.warning('该商品暂无小红书图片')
    return
  }
  imagesGenerating.value = true
  try {
    revokeGeneratedImages()
    const results = []
    let failed = 0
    for (const url of list) {
      try {
        const item = await renderOne(url)
        results.push(item)
      } catch (e) {
        failed++
        console.error('生成失败', url, e)
      }
    }
    generatedImages.value = results
    if (!results.length) {
      message.error('图片生成失败，请检查图片是否允许跨域')
    } else if (failed) {
      message.warning(`已生成 ${results.length} 张，${failed} 张失败`)
    } else {
      message.success(`已生成 ${results.length} 张图片`)
    }
  } finally {
    imagesGenerating.value = false
  }
}

async function downloadOne(idx) {
  const item = generatedImages.value[idx]
  if (!item) return
  try {
    const blob = await processImageForDownload(item.blobUrl)
    triggerBlobDownload(blob, `xhs-${data.value.id || 'img'}-${idx + 1}.jpg`)
  } catch (e) {
    message.error(e.message || '下载失败')
  }
}

async function downloadAllImages() {
  for (let idx = 0; idx < generatedImages.value.length; idx++) {
    await downloadOne(idx)
    await new Promise(r => setTimeout(r, 200))
  }
}

async function copyText(text) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

function openGenerate() {
  const tags = Array.isArray(data.value.xhs_tags) ? [...data.value.xhs_tags] : []
  for (let i = tags.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tags[i], tags[j]] = [tags[j], tags[i]]
  }
  generatedTags.value = tags
  generateVisible.value = true
}

async function generateCoverImage(useEditedPrompt = false) {
  const text = (cardText.value || '').trim()
  if (!text) {
    message.warning('请先填写卡片文字（可点击「生成标题」自动填充）')
    return
  }

  await aiImageStore.ensureLoaded()
  const activeProvider = aiImageStore.activeProvider
  if (!activeProvider) {
    Modal.warning({
      title: '提示',
      content: '请先在「系统设置 → AI绘图」中将某个渠道设为使用中',
      okText: '去设置',
      onOk: () => router.push('/system/ai-image'),
    })
    return
  }

  const params = { product_id: id.value, card_text: text }

  if (useEditedPrompt && coverPromptUsed.value) {
    params.prompt = coverPromptUsed.value
  }

  if (activeProvider === 'md2card') {
    const cfg = aiImageStore.activeConfig
    // 复用：model 字段存关键词、concurrency 存张数
    if (cfg?.model) params.keywords = cfg.model
    if (cfg?.concurrency) params.count = cfg.concurrency
  } else {
    const active = llmStore.active
    if (!active) {
      Modal.warning({
        title: '提示',
        content: '请先在「系统设置 → 大模型」中设置使用中的模型',
        okText: '去设置',
        onOk: () => router.push('/system/llm'),
      })
      return
    }
    params.llm_provider = active.provider
    params.llm_api_format = active.api_format
    params.llm_api_key = active.api_key
    params.llm_base_url = active.base_url || ''
    params.llm_model = active.default_model
  }

  coverGenerating.value = true
  try {
    const res = await drawCover(params)
    const urls = Array.isArray(res?.urls) ? res.urls.filter(Boolean) : []
    if (!urls.length && !res?.url) throw new Error('未返回图片')
    const rawUrls = urls.length ? urls : (res?.url ? [res.url] : [])

    // 旧 blob URL 释放，防内存泄漏
    coverImageUrls.value.forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u) })

    coverImageUrls.value = rawUrls
    coverImageUrl.value = rawUrls[0] || ''
    coverPromptUsed.value = res.prompt || ''
  } catch (e) {
    message.error(e.message || '封面图生成失败')
  } finally {
    coverGenerating.value = false
  }
}

async function downloadCoverImage(url) {
  const target = url || coverImageUrl.value
  if (!target) return
  try {
    const blob = await processImageForDownload(target)
    triggerBlobDownload(blob, `cover-${data.value.id || 'img'}.jpg`)
  } catch (e) {
    message.error(e.message || '下载失败')
  }
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

async function generateTitle() {
  const active = llmStore.active
  if (!active) {
    Modal.warning({
      title: '提示',
      content: '请先设置使用中的模型',
      okText: '去设置',
      onOk: () => router.push('/system/llm'),
    })
    return
  }

  titleGenerating.value = true
  try {
    // 1) 提示词管理：生成标题场景的提示词
    const promptRes = await getPromptList({
      scene: 'title',
      page: 1,
      pageSize: 1,
    })
    const promptItem = promptRes.list?.[0]
    if (!promptItem) {
      message.error('未找到「生成标题」场景的提示词')
      return
    }

    // 2) 随机取一条标题公式作为参考
    let formulaHint = ''
    if (data.value.job_type_id) {
      try {
        const formulaRes = await getRandomTitleFormula(data.value.job_type_id)
        if (formulaRes?.formula) {
          formulaHint = `\n\n请参考以下标题公式生成（将其中的 {单位} 替换为实际单位名称，风格、节奏与公式保持一致，不要照搬原句）：\n${formulaRes.formula}`
        }
      } catch (_) { /* 取不到公式时跳过，不影响主流程 */ }
    }

    // 3) 组装用户消息并调用 LLM
    const userContent = [
      `单位名称：${data.value.company_name || ''}`,
      `商品类型：${data.value.job_type_name || ''}`,
      data.value.written_exam_content ? `笔试内容：${data.value.written_exam_content}` : '',
      data.value.interview_content ? `面试内容：${data.value.interview_content}` : '',
    ].filter(Boolean).join('\n') + formulaHint

    const res = await chatLlm({
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
      messages: [
        { role: 'system', content: promptItem.content },
        { role: 'user', content: userContent },
      ],
      max_tokens: 512,
      temperature: 0.7,
    })
    const out = (res.content || '').replace(/^["'「『]+|["'」』]+$/g, '').trim()
    if (!out) {
      message.error('模型未返回内容')
      return
    }
    generatedTitle.value = out
    cardText.value = out
    message.success('标题生成成功')
  } catch (e) {
    message.error(e.message || '生成失败')
  } finally {
    titleGenerating.value = false
  }
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

async function generateBody() {
  const active = llmStore.active
  if (!active) {
    Modal.warning({
      title: '提示',
      content: '请先设置使用中的模型',
      okText: '去设置',
      onOk: () => router.push('/system/llm'),
    })
    return
  }

  bodyGenerating.value = true
  try {
    // 1) 优先从商品自带的小红书正文里随机取一条
    let sourceText = ''
    let sourceFrom = ''
    const xhsList = data.value.xhs_content
    if (Array.isArray(xhsList) && xhsList.length) {
      sourceText = pickRandom(xhsList) || ''
      sourceFrom = '小红书正文'
    }

    // 2) 没有则从内容模板按商品类型随机取一条
    if (!sourceText) {
      if (!data.value.job_type_id) {
        message.warning('该商品未配置商品类型，且无小红书正文，无法生成')
        return
      }
      const tplRes = await getContentTemplateList({
        job_type_id: data.value.job_type_id,
        page: 1,
        pageSize: 100,
      })
      const tpl = pickRandom(tplRes.list || [])
      if (!tpl) {
        message.error(`未找到「${data.value.job_type_name || '该类型'}」的内容模板`)
        return
      }
      sourceText = tpl.content || ''
      sourceFrom = `内容模板「${tpl.title || tpl.id}」`
    }

    // 3) 提示词：生成正文场景的第一条
    const promptRes = await getPromptList({
      scene: 'content',
      page: 1,
      pageSize: 1,
    })
    const promptItem = promptRes.list?.[0]
    if (!promptItem) {
      message.error('未找到「生成正文」场景的提示词')
      return
    }

    const userContent = [
      `单位名称：${data.value.company_name || ''}`,
      `商品类型：${data.value.job_type_name || ''}`,
      `笔记标题：${generatedTitle.value || '（未生成，请围绕单位与商品类型自行展开）'}`,
      `参考来源：${sourceFrom}`,
      '',
      '请参考以下文本，紧扣"笔记标题"，重新润色撰写一条小红书笔记正文：',
      sourceText,
      '',
      '只输出正文本身，不要重复标题，不要任何额外说明。',
    ].join('\n')

    const res = await chatLlm({
      provider: active.provider,
      api_format: active.api_format,
      api_key: active.api_key,
      base_url: active.base_url || '',
      model: active.default_model,
      messages: [
        { role: 'system', content: promptItem.content },
        { role: 'user', content: userContent },
      ],
      max_tokens: 3000,
      temperature: 0.8,
    })
    const out = (res.content || '').trim()
    if (!out) {
      message.error('模型未返回内容')
      return
    }
    generatedBody.value = out
    message.success('正文生成成功')
  } catch (e) {
    message.error(e.message || '生成失败')
  } finally {
    bodyGenerating.value = false
  }
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function goList() {
  router.push('/product/list')
}

function goEdit() {
  router.push(`/product/edit/${id.value}`)
}

async function fetchDetail() {
  loading.value = true
  try {
    data.value = await getProductDetail(id.value)
    fetchLatestInterviewJob()
    fetchLatestExamJob()
  } catch (e) {
    message.error(e.message || '加载失败')
    router.replace('/product/list')
  } finally {
    loading.value = false
  }
}

onMounted(fetchDetail)

// --- 百度网盘目录图生成 ---
const dirDrawer = reactive({
  visible: false,
  type: '',
  title: '笔试资料完整目录',
  borderColor: '#F9863B',
  files: [],
  loading: false,
  previewUrl: '',
  // PDF 首页截图（右侧手动选择面板）
  pdfFsid: null,
  pdfFileName: '',
  pdfLoading: false,
  pdfPreviewUrl: '',
  // history 类型合成用：存储已渲染的 PDF 首页 data URL
  pdfPageDataUrl: '',
})

function drawFolderIcon(ctx, x, y, size) {
  const s = size
  ctx.fillStyle = '#F5A623'
  ctx.beginPath()
  ctx.roundRect(x, y, s * 0.45, s * 0.22, 3)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(x, y + s * 0.18, s, s * 0.74, 4)
  ctx.fill()
}

function drawPdfIcon(ctx, x, y, size) {
  const s = size
  ctx.fillStyle = '#FF6B6B'
  ctx.beginPath()
  ctx.roundRect(x, y, s, s, 5)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.round(s * 0.38)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PDF', x + s / 2, y + s / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function renderCompositeImage(files, title, borderColor) {
  const DPR = 2
  const W = 600
  const BORDER = 10
  const PADDING = 28
  const ICON_SIZE = 30
  const ROW_H = 52
  const TITLE_H = 88
  const H = BORDER + TITLE_H + ROW_H * files.length + PADDING + BORDER

  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)

  // 边框背景
  ctx.fillStyle = borderColor
  ctx.fillRect(0, 0, W, H)

  // 内部白色区域
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2)

  // 标题
  ctx.fillStyle = '#FF0000'
  ctx.font = `bold 34px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, W / 2, BORDER + TITLE_H / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // 标题下分隔线
  ctx.strokeStyle = '#eeeeee'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(BORDER + PADDING, BORDER + TITLE_H)
  ctx.lineTo(W - BORDER - PADDING, BORDER + TITLE_H)
  ctx.stroke()

  // 文件列表
  const listTop = BORDER + TITLE_H
  files.forEach((file, i) => {
    const y = listTop + i * ROW_H
    const iconY = y + (ROW_H - ICON_SIZE) / 2

    if (file.isdir === 1) {
      drawFolderIcon(ctx, BORDER + PADDING, iconY, ICON_SIZE)
    } else {
      drawPdfIcon(ctx, BORDER + PADDING, iconY, ICON_SIZE)
    }

    ctx.fillStyle = '#333333'
    ctx.font = `15px "PingFang SC", "Microsoft YaHei", sans-serif`
    const maxWidth = W - BORDER * 2 - PADDING * 2 - ICON_SIZE - 12
    let name = file.name
    while (ctx.measureText(name).width > maxWidth && name.length > 1) {
      name = name.slice(0, -1)
    }
    if (name !== file.name) name = name.slice(0, -1) + '...'
    ctx.fillText(name, BORDER + PADDING + ICON_SIZE + 12, y + ROW_H / 2 + 6)

    if (i < files.length - 1) {
      ctx.strokeStyle = '#f5f5f5'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(BORDER + PADDING, y + ROW_H)
      ctx.lineTo(W - BORDER - PADDING, y + ROW_H)
      ctx.stroke()
    }
  })

  return canvas.toDataURL('image/png')
}

function refreshDirPreview() {
  if (!dirDrawer.files.length) return
  if (dirDrawer.type === 'history' && dirDrawer.pdfPageDataUrl) {
    buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title)
      .then(url => { dirDrawer.previewUrl = url })
  } else {
    dirDrawer.previewUrl = renderCompositeImage(dirDrawer.files, dirDrawer.title, dirDrawer.borderColor)
  }
}

// 新版：整图 1242×1656，外边框，顶部标题 + PDF 铺满 + 右下角目录浮层
async function buildHistoryComposite(pdfDataUrl, files, borderColor, title) {
  const pdfImg = await loadImage(pdfDataUrl)

  const CANVAS_W = 1242
  const CANVAS_H = 1656
  const BORDER = 12
  const TITLE_H = 120  // 标题区高度

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  // === 整图边框（填满后覆盖内部白色）===
  ctx.fillStyle = borderColor
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // === 白色内部区域 ===
  const innerX = BORDER
  const innerY = BORDER
  const innerW = CANVAS_W - BORDER * 2
  const innerH = CANVAS_H - BORDER * 2
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(innerX, innerY, innerW, innerH)

  // === 标题（红色加粗，白底，居中）===
  ctx.fillStyle = '#FF0000'
  const fontSize = Math.round(TITLE_H * 0.5)
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, CANVAS_W / 2, innerY + TITLE_H / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // === PDF 铺满剩余内容区（cover 模式，超出部分裁剪）===
  const pdfAreaX = innerX
  const pdfAreaY = innerY + TITLE_H
  const pdfAreaW = innerW
  const pdfAreaH = innerH - TITLE_H

  const scaleW = pdfAreaW / pdfImg.width
  const scaleH = pdfAreaH / pdfImg.height
  const scale = Math.max(scaleW, scaleH)
  const pdfDrawW = pdfImg.width * scale
  const pdfDrawH = pdfImg.height * scale
  const pdfDrawX = pdfAreaX + (pdfAreaW - pdfDrawW) / 2
  const pdfDrawY = pdfAreaY + (pdfAreaH - pdfDrawH) / 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(pdfAreaX, pdfAreaY, pdfAreaW, pdfAreaH)
  ctx.clip()
  ctx.drawImage(pdfImg, pdfDrawX, pdfDrawY, pdfDrawW, pdfDrawH)
  ctx.restore()

  // === 右下角目录浮层 ===
  const ICON_SIZE = 36
  const ROW_H = 72
  const OVERLAY_PAD = 20
  const FONT_SIZE = 20
  const pdfFiles = files.filter(f => f.isdir === 0)

  // 先测量最长文件名，动态计算浮层宽度
  ctx.font = `${FONT_SIZE}px "PingFang SC", "Microsoft YaHei", sans-serif`
  const maxTextW = pdfFiles.reduce((max, f) => Math.max(max, ctx.measureText(f.name).width), 0)
  const OVERLAY_W = Math.max(
    400,
    Math.min(
      CANVAS_W - BORDER * 2 - 40,
      Math.ceil(maxTextW) + ICON_SIZE + OVERLAY_PAD * 2 + 10
    )
  )
  const OVERLAY_H = pdfFiles.length * ROW_H + OVERLAY_PAD * 2

  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const offsetRight = rnd(30, 80)
  const offsetBottom = rnd(30, 80)
  const overlayX = CANVAS_W - BORDER - OVERLAY_W - offsetRight
  const overlayY = CANVAS_H - BORDER - OVERLAY_H - offsetBottom

  // 阴影 + 白底圆角浮层
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(overlayX, overlayY, OVERLAY_W, OVERLAY_H, 10)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  pdfFiles.forEach((file, i) => {
    const y = overlayY + OVERLAY_PAD + i * ROW_H
    drawPdfIcon(ctx, overlayX + OVERLAY_PAD, y + (ROW_H - ICON_SIZE) / 2, ICON_SIZE)

    ctx.fillStyle = '#333333'
    ctx.font = `${FONT_SIZE}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.fillText(file.name, overlayX + OVERLAY_PAD + ICON_SIZE + 10, y + ROW_H / 2 + 6)

    if (i < pdfFiles.length - 1) {
      ctx.strokeStyle = '#eeeeee'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(overlayX + OVERLAY_PAD, y + ROW_H)
      ctx.lineTo(overlayX + OVERLAY_W - OVERLAY_PAD, y + ROW_H)
      ctx.stroke()
    }
  })

  return canvas.toDataURL('image/png')
}

async function generateDirImage(type) {
  const path = type === 'exam' ? data.value.baidu_path_exam
    : type === 'history' ? data.value.baidu_path_history
    : data.value.baidu_path_mock
  if (!path) return

  const titleMap = {
    exam: '笔试资料完整目录',
    history: '历年真题（回忆版）',
    mock: '刷模拟题，巩固知识点',
  }
  dirDrawer.type = type
  dirDrawer.title = titleMap[type]
  dirDrawer.borderColor = '#F9863B'
  dirDrawer.files = []
  dirDrawer.previewUrl = ''
  dirDrawer.pdfPageDataUrl = ''
  dirDrawer.pdfPreviewUrl = ''
  dirDrawer.pdfFsid = null
  dirDrawer.loading = true
  dirDrawer.visible = true

  try {
    const res = await getBaiduFiles(path)
    const files = res.files || []
    if (!files.length) {
      message.warning('该目录下暂无文件')
      return
    }
    files.sort((a, b) => b.isdir - a.isdir)
    dirDrawer.files = files

    if (type === 'history' || type === 'mock') {
      // history 找含「2025」的 PDF，mock 找含「2026」的 PDF
      const keyword = type === 'mock' ? '2026' : '2025'
      const targetPdf = files.find(f => f.isdir === 0 && f.name.includes(keyword))
      if (targetPdf) {
        const lib = await ensurePdfjs()
        const pdfDoc = await lib.getDocument({
          url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(targetPdf.path)}`,
          httpHeaders: { Authorization: `Bearer ${getToken()}` },
        }).promise
        const page = await pdfDoc.getPage(1)
        const viewport = page.getViewport({ scale: 2 })
        const pdfCanvas = document.createElement('canvas')
        pdfCanvas.width = viewport.width
        pdfCanvas.height = viewport.height
        await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise
        dirDrawer.pdfPageDataUrl = pdfCanvas.toDataURL('image/png')
        dirDrawer.previewUrl = await buildHistoryComposite(dirDrawer.pdfPageDataUrl, files, dirDrawer.borderColor, dirDrawer.title)
      } else {
        message.warning(`未找到文件名含"${keyword}"的PDF，降级显示目录列表`)
        dirDrawer.previewUrl = renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor)
      }
    } else {
      dirDrawer.previewUrl = renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor)
    }
  } catch (e) {
    message.error(e.message || '生成失败')
  } finally {
    dirDrawer.loading = false
  }
}

function downloadCompositeImage() {
  if (!dirDrawer.previewUrl) return
  const a = document.createElement('a')
  a.href = dirDrawer.previewUrl
  const label = dirDrawer.type === 'exam' ? '笔试资料目录' : '真题目录'
  a.download = `${data.value.company_name || 'product'}-${label}.png`
  a.click()
}

let pdfjsLib = null
async function ensurePdfjs() {
  if (pdfjsLib) return pdfjsLib
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  pdfjsLib = window.pdfjsLib
  return pdfjsLib
}

async function renderPdfFirstPage(file) {
  dirDrawer.pdfFsid = file.fs_id
  dirDrawer.pdfFileName = file.name
  dirDrawer.pdfLoading = true
  dirDrawer.pdfPreviewUrl = ''
  try {
    const lib = await ensurePdfjs()
    const pdf = await lib.getDocument({
      url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(file.path)}`,
      httpHeaders: { Authorization: `Bearer ${getToken()}` },
    }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    dirDrawer.pdfPreviewUrl = canvas.toDataURL('image/png')
    // history 类型：同步更新合成图
    if (dirDrawer.type === 'history') {
      dirDrawer.pdfPageDataUrl = dirDrawer.pdfPreviewUrl
      dirDrawer.previewUrl = await buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title)
    }
  } catch (e) {
    message.error('PDF渲染失败：' + (e.message || '未知错误'))
  } finally {
    dirDrawer.pdfLoading = false
  }
}

function downloadPdfPage() {
  if (!dirDrawer.pdfPreviewUrl) return
  const a = document.createElement('a')
  a.href = dirDrawer.pdfPreviewUrl
  a.download = `${dirDrawer.pdfFileName.replace(/\.pdf$/i, '')}-首页.png`
  a.click()
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
  flex: 1;
}

.content-text {
  white-space: pre-wrap;
  line-height: 1.7;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.xhs-image-grid {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.xhs-image-item :deep(img) {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.page-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.field-placeholder {
  min-height: 80px;
  background: #fafafa;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
}

.field-placeholder--lg {
  min-height: 240px;
}

.gen-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: #fafafa;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
}

.cover-placeholder {
  min-height: 180px;
}

.cover-result {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.cover-prompt-tip {
  max-width: 480px;
}

.loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

:deep(.ant-form-vertical .ant-form-item-label > label) {
  width: 100%;
}

.card-text-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}
.card-text-label {
  flex-shrink: 0;
  line-height: 32px;
  font-size: 13px;
  color: #555;
  font-weight: 500;
}
.gen-image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.gen-image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.gen-image-item :deep(.ant-image img) {
  width: 120px;
  height: 160px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}
.interview-meta {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
}
.interview-tip {
  margin-bottom: 16px;
}
.interview-status {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  line-height: 28px;
}
.status-label {
  color: #888;
  flex-shrink: 0;
}
.status-error {
  color: #ff4d4f;
  word-break: break-all;
}
.interview-actions {
  display: flex;
  gap: 12px;
}
.exam-parts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.exam-part-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}
.exam-part-main {
  flex: 1;
  min-width: 0;
}
.exam-part-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #333;
}
.exam-part-error {
  margin-top: 4px;
  font-size: 12px;
  color: #ff4d4f;
  word-break: break-all;
}
.exam-part-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.baidu-dir-item {
  padding: 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}
.baidu-dir-label {
  font-size: 13px;
  font-weight: 500;
  color: #555;
  margin-bottom: 4px;
}
.baidu-dir-path {
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
  word-break: break-all;
}
</style>
