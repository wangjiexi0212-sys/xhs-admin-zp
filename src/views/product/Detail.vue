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
        <a-row v-if="!data.baidu_path_exam && !data.baidu_path_history && !data.baidu_path_mock && !data.baidu_custom_dirs?.length">
          <a-col :span="24" style="color: #999">暂未配置百度网盘目录路径，请在编辑页面填写</a-col>
        </a-row>
        <template v-else>
          <a-row :gutter="24" v-if="data.baidu_path_exam || data.baidu_path_history || data.baidu_path_mock">
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

          <!-- 自定义目录 -->
          <template v-if="data.baidu_custom_dirs?.length">
            <a-divider style="margin: 12px 0" />
            <a-row :gutter="24">
              <a-col :span="8" v-for="(item, idx) in data.baidu_custom_dirs" :key="idx">
                <div class="baidu-dir-item">
                  <div class="baidu-dir-label">{{ item.name || '自定义' }}</div>
                  <div class="baidu-dir-path">{{ item.path }}</div>
                  <a-space style="margin-top: 8px">
                    <a-button :loading="customLoading === idx" @click="openCustomDir(item, idx)">
                      打开
                    </a-button>
                  </a-space>
                </div>
              </a-col>
            </a-row>
          </template>
        </template>
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
          <template v-if="dirDrawer.type === 'exam'">
            <span style="font-size:13px;color:#555;white-space:nowrap">类型：</span>
            <a-select v-model:value="dirDrawer.dirMode" style="width:140px" @change="changeDirMode">
              <a-select-option value="dir">笔记资料目录</a-select-option>
              <a-select-option value="culture">企业文化</a-select-option>
            </a-select>
          </template>
          <template v-if="dirDrawer.type === 'history'">
            <span style="font-size:13px;color:#555;white-space:nowrap">文案预设：</span>
            <a-select
              v-model:value="dirDrawer.title"
              style="width:260px"
              :options="HISTORY_TITLE_OPTIONS"
              @change="refreshDirPreview"
            />
          </template>
          <template v-if="dirDrawer.type === 'mock'">
            <span style="font-size:13px;color:#555;white-space:nowrap">文案预设：</span>
            <a-select
              v-model:value="dirDrawer.title"
              style="width:260px"
              :options="MOCK_TITLE_OPTIONS"
              @change="refreshDirPreview"
            />
          </template>
          <span style="font-size:13px;color:#555;white-space:nowrap">标题文案：</span>
          <a-input v-model:value="dirDrawer.title" style="width:200px" @input="refreshDirPreview" />
          <span style="font-size:13px;color:#555;white-space:nowrap">边框颜色：</span>
          <input type="color" v-model="dirDrawer.borderColor" @input="refreshDirPreview" style="width:40px;height:32px;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;padding:2px" />
          <span style="font-size:13px;color:#555;white-space:nowrap">背景色：</span>
          <input type="color" v-model="dirDrawer.bgColor" @input="refreshDirPreview" style="width:40px;height:32px;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;padding:2px" />
          <span style="font-size:13px;color:#555;white-space:nowrap">透明度：</span>
          <input type="range" v-model.number="dirDrawer.bgOpacity" min="0" max="1" step="0.05" @input="refreshDirPreview" style="width:90px;accent-color:#1677ff;cursor:pointer" />
          <span style="font-size:12px;color:#999;min-width:28px">{{ Math.round(dirDrawer.bgOpacity * 100) }}%</span>
          <template v-if="dirDrawer.type === 'history' || dirDrawer.type === 'mock'">
            <a-divider type="vertical" style="height:20px" />
            <span style="font-size:13px;color:#555;white-space:nowrap">只生成目录图：</span>
            <a-switch v-model:checked="dirDrawer.dirOnly" @change="refreshDirPreview" />
          </template>
          <a-button @click="downloadCompositeImage" :disabled="!dirDrawer.previewUrl">下载目录图</a-button>
          <a-button @click="downloadPdfPage" :disabled="!dirDrawer.pdfPreviewUrl">下载PDF首页</a-button>
          <a-divider type="vertical" style="height:20px" />
          <a-button
            :type="mosaicMode ? 'primary' : 'default'"
            size="small"
            :disabled="!dirDrawer.previewUrl"
            @click="toggleMosaicMode"
          >🖌 马赛克涂鸦{{ mosaicMode ? '（点击关闭）' : '' }}</a-button>
          <template v-if="mosaicMode">
            <span style="font-size:12px;color:#555;white-space:nowrap">笔触大小：</span>
            <input type="range" v-model.number="mosaicBlockSize" min="10" max="80" step="5"
              style="width:80px;accent-color:#1677ff;cursor:pointer" />
            <span style="font-size:12px;color:#999;min-width:32px">{{ mosaicBlockSize }}px</span>
          </template>
          <a-button v-if="mosaicHasPaint" size="small" danger @click="clearMosaic">清除马赛克</a-button>
        </div>

        <!-- 两栏主区域 -->
        <div style="flex:1; display:flex; gap:16px; min-height:0; overflow:hidden">
          <!-- 左栏：目录图预览 -->
          <div style="width:60%; overflow:auto; display:flex; justify-content:center; align-items:flex-start; background:#f0f0f0; border-radius:8px; padding:20px; user-select:none">
            <a-spin v-if="dirDrawer.loading" style="margin-top:60px" />
            <canvas
              v-else-if="dirDrawer.previewUrl"
              ref="previewCanvasRef"
              :style="{
                maxWidth: '100%',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                borderRadius: '4px',
                display: 'block',
                cursor: mosaicMode ? 'crosshair' : 'default'
              }"
              @mousedown="onMosaicStart"
              @mousemove="onMosaicMove"
              @mouseup="onMosaicEnd"
              @mouseleave="onMosaicEnd"
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
          <div v-else-if="generatedTitle">
            <a-input v-model:value="generatedTitle" placeholder="生成的标题" />
            <div style="text-align: right; font-size: 12px; margin-top: 3px;"
              :style="{ color: generatedTitle.length > 20 ? '#ff4d4f' : '#999' }">
              {{ generatedTitle.length }}/20 字
            </div>
          </div>
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
                <a-button type="link" size="small" :loading="coverGenerating" @click="() => generateCoverImage()">
                  {{ coverImageUrls.length ? '重新生成' : '生成封面图' }}
                </a-button>
              </a-space>
            </div>
          </template>
          <div v-if="coverGenerating" class="field-placeholder cover-placeholder loading-box">
            <a-spin /> <span style="margin-left: 8px; color: #999">{{ coverStatusMsg }}</span>
          </div>
          <div v-else-if="coverImageUrls.length || coverPromptUsed" class="cover-result">
            <div v-if="coverImageUrls.length" class="cover-image-list">
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
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { LeftOutlined, EditOutlined, FileTextOutlined, DownloadOutlined, BulbOutlined, FileWordOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, FormOutlined, StopOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { getProductDetail } from '@/api/products'
import { getContentTemplateList } from '@/api/contentTemplates'
import { getPromptList } from '@/api/prompts'
import { chatLlm } from '@/api/llm'
import { drawCoverStream } from '@/api/draw'
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
const coverStatusMsg = ref('正在生成封面图...')
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
  coverStatusMsg.value = '正在生成封面图...'

  // quanneng 且非「用此提示词」点击：先只取提示词供审核
  const promptOnly = activeProvider !== 'md2card' && !useEditedPrompt
  if (promptOnly) params.prompt_only = true

  await drawCoverStream(params, {
    onProgress(event) {
      if (event.step === 'llm') coverStatusMsg.value = '正在适配提示词...'
      else if (event.step === 'llm_done') coverStatusMsg.value = '提示词适配完成，正在生成图片...'
      else if (event.step === 'draw') coverStatusMsg.value = '正在生成图片...'
    },
    onDone(data) {
      if (data?.prompt_only) {
        // 仅返回提示词：展示供审核，不清除旧图
        coverPromptUsed.value = data.prompt || ''
      } else {
        const urls = Array.isArray(data?.urls) ? data.urls.filter(Boolean) : []
        const rawUrls = urls.length ? urls : (data?.url ? [data.url] : [])
        coverImageUrls.value.forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u) })
        coverImageUrls.value = rawUrls
        coverImageUrl.value = rawUrls[0] || ''
        coverPromptUsed.value = data?.prompt || ''
      }
      coverGenerating.value = false
    },
    onError(e) {
      message.error(e.message || '封面图生成失败')
      coverGenerating.value = false
    },
  })
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
      '注意：标题字数不能超过20个字。',
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
    let out = (res.content || '').replace(/^["'「『]+|["'」』]+$/g, '').trim()
    if (!out) {
      message.error('模型未返回内容')
      return
    }
    if (out.length > 20) {
      out = out.slice(0, 20)
      message.warning('标题超过20字，已自动截断至20字')
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
      '注意：正文中不得出现任何诱导性内容或引流内容（如"关注我"、"添加微信"、"点击链接"、"私信我"、"加群"等），只需聚焦内容本身。',
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

// --- 真题目录标题文案预设列表 ---
const HISTORY_TITLE_OPTIONS = [
  '刷真题，吃透核心考点',
  '研真题，洞悉考察方向',
  '析真题，总结答题套路',
  '品真题，掌握命题规律',
  '梳理真题，理清考察重点',
  '复盘真题，弥补知识短板',
  '深挖真题，抓住得分关键',
  '细读真题，熟悉题型结构',
  '拆解真题，归纳解题方法',
  '精读真题，找准出题侧重',
  '复盘真题，规避常见陷阱',
  '吃透真题，稳固知识体系',
  '揣摩真题，把握考察逻辑',
  '整理真题，汇总高频考点',
  '演算真题，提升做题速度',
  '回顾真题，强化记忆印象',
  '深究真题，摸清考察范围',
  '品读真题，规范答题话术',
  '深挖真题，梳理高频题型',
  '复盘真题，找准失分根源',
].map(v => ({ label: v, value: v }))

function pickRandomHistoryTitle() {
  const list = HISTORY_TITLE_OPTIONS
  return list[Math.floor(Math.random() * list.length)].value
}

// --- 模拟题目录标题文案预设列表 ---
const MOCK_TITLE_OPTIONS = [
  '刷模拟题，查漏补缺',
  '练模拟题，把控时限',
  '研模拟题，适应题型',
  '做模拟题，夯实功底',
  '复盘模拟题，补齐短板',
  '吃透模拟题，稳定发挥',
  '梳理模拟题，熟记考点',
  '拆解模拟题，总结思路',
  '演算模拟题，提升速度',
  '精读模拟题，规避陷阱',
  '背诵模拟题，巩固要点',
  '深究模拟题，找准失分点',
  '勤做模拟题，锻炼心态',
  '整理模拟题，归纳技巧',
  '细品模拟题，规范作答',
  '反复模拟题，强化记忆',
  '深挖模拟题，抓住得分点',
  '整套模拟题，全真演练',
  '回看模拟题，梳理框架',
  '吃透模拟题，从容应考',
].map(v => ({ label: v, value: v }))

function pickRandomMockTitle() {
  const list = MOCK_TITLE_OPTIONS
  return list[Math.floor(Math.random() * list.length)].value
}

// --- 百度网盘目录图生成 ---

// 预设淡色背景色池
const BG_COLOR_POOL = [
  '#a8c8f0', '#f0a8b4', '#a8e0c8', '#f0d0a8',
  '#c8b4f0', '#a8d8f0', '#f0e0a8', '#b4f0d0',
  '#f0b4c8', '#b4c8f0', '#d0f0a8', '#f0c8a8',
  // 新增 20 组
  '#ffd6d6', '#d6f0ff', '#d6ffd6', '#fff0d6',
  '#e8d6ff', '#d6ffe8', '#ffecd6', '#d6e8ff',
  '#ffe4f0', '#e4ffe4', '#fff4d6', '#d6f4ff',
  '#f0d6ff', '#d6ffee', '#ffd6ee', '#eeffd6',
  '#dce8ff', '#ffdce8', '#dcffee', '#ffeedd',
]
function pickRandomBgColor() {
  return BG_COLOR_POOL[Math.floor(Math.random() * BG_COLOR_POOL.length)]
}

const dirDrawer = reactive({
  visible: false,
  type: '',
  dirMode: 'dir', // 'dir' | 'culture'，仅 exam 类型可切换
  title: '笔试资料完整目录',
  borderColor: '#F9863B',
  bgColor: pickRandomBgColor(),
  bgOpacity: 0.35,
  dirOnly: false,  // 是否只生成目录图（跳过 PDF 合成）
  files: [],
  loading: false,
  previewUrl: '',
  // PDF 首页截图（右侧手动选择面板）
  pdfFsid: null,
  pdfFileName: '',
  pdfLoading: false,
  pdfPreviewUrl: '',
  // history/culture/custom 类型合成用：存储已渲染的 PDF 首页 data URL
  pdfPageDataUrl: '',
  // 自定义目录专用：记录当前操作的条目下标
  customIndex: -1,
})

// 自定义目录各条目的 loading 状态（按 idx 隔离，不影响固定目录的 dirDrawer.loading）
const customLoading = ref(-1)

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

function drawGridBg(ctx, x, y, w, h, color, opacity, cellSize = 28) {
  if (opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = opacity
  // 底色填充
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
  // 格子线（比底色略亮/略白）
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  for (let cx = x; cx <= x + w; cx += cellSize) {
    ctx.moveTo(cx, y)
    ctx.lineTo(cx, y + h)
  }
  for (let cy = y; cy <= y + h; cy += cellSize) {
    ctx.moveTo(x, cy)
    ctx.lineTo(x + w, cy)
  }
  ctx.stroke()
  ctx.restore()
}

function renderCompositeImage(files, title, borderColor, bgColor, bgOpacity) {
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

  // 格子背景（叠在白色上方）
  drawGridBg(ctx, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, bgColor, bgOpacity)

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
  const usePdf = (dirDrawer.type === 'history' || dirDrawer.type === 'mock' || dirDrawer.type === 'custom' || dirDrawer.dirMode === 'culture')
    && dirDrawer.pdfPageDataUrl
    && !dirDrawer.dirOnly
  if (usePdf) {
    buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity)
      .then(url => { dirDrawer.previewUrl = url })
  } else {
    dirDrawer.previewUrl = renderCompositeImage(dirDrawer.files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity)
  }
}

// 新版：整图 1242×1656，外边框，顶部标题 + PDF 铺满 + 右下角目录浮层
async function buildHistoryComposite(pdfDataUrl, files, borderColor, title, bgColor, bgOpacity) {
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

  // === 格子背景（叠在白色上方）===
  drawGridBg(ctx, innerX, innerY, innerW, innerH, bgColor, bgOpacity, 36)

  // === 标题（红色加粗，白底，居中）===
  ctx.fillStyle = '#FF0000'
  const fontSize = Math.round(TITLE_H * 0.5)
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, CANVAS_W / 2, innerY + TITLE_H / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // === PDF 带随机外边距放入内容区（contain 模式，四周留白）===
  const pdfAreaX = innerX
  const pdfAreaY = innerY + TITLE_H
  const pdfAreaW = innerW
  const pdfAreaH = innerH - TITLE_H

  const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

  // 随机裁边：四边各独立随机裁 30~70px
  const cropL = rndInt(30, 70)
  const cropR = rndInt(30, 70)
  const cropT = rndInt(30, 70)
  const cropB = rndInt(30, 70)
  const srcX = cropL
  const srcY = cropT
  const srcW = pdfImg.width - cropL - cropR
  const srcH = pdfImg.height - cropT - cropB

  // 随机外边距（裁边后的内容再留白）
  const pdfMargin = rndInt(30, 80)
  const pdfMaxW = pdfAreaW - pdfMargin * 2
  const pdfMaxH = pdfAreaH - pdfMargin * 2
  const scaleW = pdfMaxW / srcW
  const scaleH = pdfMaxH / srcH
  const scale = Math.min(scaleW, scaleH)
  const pdfDrawW = srcW * scale
  const pdfDrawH = srcH * scale
  const pdfDrawX = pdfAreaX + (pdfAreaW - pdfDrawW) / 2
  const pdfDrawY = pdfAreaY + (pdfAreaH - pdfDrawH) / 2

  // Z 轴随机缩放：宽度随机偏移 -50~50px，等比作用到高度
  const scaleOffset = rndInt(-50, 50)
  const finalDrawW = pdfDrawW + scaleOffset
  const finalDrawH = pdfDrawH * (finalDrawW / pdfDrawW)
  const finalDrawX = pdfAreaX + (pdfAreaW - finalDrawW) / 2
  const finalDrawY = pdfAreaY + (pdfAreaH - finalDrawH) / 2

  ctx.drawImage(pdfImg, srcX, srcY, srcW, srcH, finalDrawX, finalDrawY, finalDrawW, finalDrawH)

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

  const offsetRight = rndInt(30, 80)
  const offsetBottom = rndInt(30, 80)
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
    history: pickRandomHistoryTitle(),
    mock: pickRandomMockTitle(),
  }
  dirDrawer.type = type
  dirDrawer.dirMode = 'dir'
  dirDrawer.title = titleMap[type]
  dirDrawer.borderColor = '#F9863B'
  dirDrawer.dirOnly = false
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
        dirDrawer.previewUrl = dirDrawer.dirOnly
          ? renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity)
          : await buildHistoryComposite(dirDrawer.pdfPageDataUrl, files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity)
      } else {
        message.warning(`未找到文件名含"${keyword}"的PDF，降级显示目录列表`)
        dirDrawer.previewUrl = renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity)
      }
    } else {
      dirDrawer.previewUrl = renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity)
    }
  } catch (e) {
    message.error(e.message || '生成失败')
  } finally {
    dirDrawer.loading = false
  }
}

async function changeDirMode(mode) {
  dirDrawer.dirMode = mode
  if (mode === 'culture') {
    const culturePdf = dirDrawer.files.find(f => f.isdir === 0 && f.name.includes('企业文化'))
    if (!culturePdf) {
      message.warning('未找到文件名含"企业文化"的PDF')
      dirDrawer.dirMode = 'dir'
      return
    }
    dirDrawer.title = '企业近况及文化'
    dirDrawer.pdfLoading = true
    try {
      const lib = await ensurePdfjs()
      const pdfDoc = await lib.getDocument({
        url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(culturePdf.path)}`,
        httpHeaders: { Authorization: `Bearer ${getToken()}` },
      }).promise
      const page = await pdfDoc.getPage(1)
      const viewport = page.getViewport({ scale: 2 })
      const pdfCanvas = document.createElement('canvas')
      pdfCanvas.width = viewport.width
      pdfCanvas.height = viewport.height
      await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise
      dirDrawer.pdfPageDataUrl = pdfCanvas.toDataURL('image/png')
      dirDrawer.pdfPreviewUrl = dirDrawer.pdfPageDataUrl
      dirDrawer.pdfFsid = culturePdf.fs_id
      dirDrawer.previewUrl = await buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity)
    } catch (e) {
      message.error(e.message || '加载企业文化PDF失败')
    } finally {
      dirDrawer.pdfLoading = false
    }
  } else {
    dirDrawer.title = '笔试资料完整目录'
    dirDrawer.pdfPageDataUrl = ''
    dirDrawer.pdfPreviewUrl = ''
    dirDrawer.pdfFsid = null
    dirDrawer.previewUrl = renderCompositeImage(dirDrawer.files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity)
  }
}

async function downloadCompositeImage() {
  if (!dirDrawer.previewUrl) return
  try {
    // 有马赛克涂鸦时，从 canvas 读取最终图（马赛克已合入）；否则使用原始 previewUrl
    const sourceUrl = (mosaicHasPaint.value && previewCanvasRef.value)
      ? previewCanvasRef.value.toDataURL('image/png')
      : dirDrawer.previewUrl
    const blob = await processImageForDownload(sourceUrl)
    const label = dirDrawer.type === 'exam' ? '笔试资料目录'
      : dirDrawer.type === 'history' ? '真题目录'
      : dirDrawer.type === 'mock' ? '模拟题目录'
      : (dirDrawer.title || '自定义')
    triggerBlobDownload(blob, `${data.value.company_name || 'product'}-${label}.jpg`)
  } catch (e) {
    message.error(e.message || '下载失败')
  }
}

// --- 马赛克涂鸦 ---
const previewCanvasRef = ref(null)
const mosaicMode = ref(false)
const mosaicBlockSize = ref(20)
const mosaicHasPaint = ref(false)
let mosaicIsDrawing = false
let mosaicBaseDataUrl = ''  // 原始图（无马赛克），用于"清除"还原

function toggleMosaicMode() {
  mosaicMode.value = !mosaicMode.value
  if (!mosaicMode.value) mosaicIsDrawing = false
}

function clearMosaic() {
  if (!mosaicBaseDataUrl || !previewCanvasRef.value) return
  const img = new Image()
  img.onload = () => {
    const canvas = previewCanvasRef.value
    if (!canvas) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    mosaicHasPaint.value = false
  }
  img.src = mosaicBaseDataUrl
}

// 每次 previewUrl 更新时，把新图画到 canvas 上并重置马赛克状态
watch(() => dirDrawer.previewUrl, (url) => {
  if (!url) return
  mosaicBaseDataUrl = url
  mosaicHasPaint.value = false
  mosaicIsDrawing = false
  nextTick(() => {
    const canvas = previewCanvasRef.value
    if (!canvas) return
    const img = new Image()
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
    }
    img.src = url
  })
})

// 抽屉关闭时重置马赛克状态
watch(() => dirDrawer.visible, (v) => {
  if (!v) {
    mosaicMode.value = false
    mosaicHasPaint.value = false
    mosaicIsDrawing = false
  }
})

function getMosaicCanvasCoords(event) {
  const canvas = previewCanvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: Math.round((event.clientX - rect.left) * scaleX),
    y: Math.round((event.clientY - rect.top) * scaleY),
  }
}

function applyMosaicAtPoint(cx, cy) {
  const canvas = previewCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const blockSize = mosaicBlockSize.value
  const brushRadius = blockSize * 2  // 涂抹半径，覆盖约 4x4 个像素块

  // 对齐到块边界
  const x0 = Math.max(0, Math.floor((cx - brushRadius) / blockSize) * blockSize)
  const y0 = Math.max(0, Math.floor((cy - brushRadius) / blockSize) * blockSize)
  const x1 = Math.min(canvas.width, Math.ceil((cx + brushRadius) / blockSize) * blockSize)
  const y1 = Math.min(canvas.height, Math.ceil((cy + brushRadius) / blockSize) * blockSize)

  for (let by = y0; by < y1; by += blockSize) {
    for (let bx = x0; bx < x1; bx += blockSize) {
      const bw = Math.min(blockSize, canvas.width - bx)
      const bh = Math.min(blockSize, canvas.height - by)
      if (bw <= 0 || bh <= 0) continue

      // 采样块中心像素颜色，填满整个块（马赛克效果）
      const sx = Math.min(bx + Math.floor(bw / 2), canvas.width - 1)
      const sy = Math.min(by + Math.floor(bh / 2), canvas.height - 1)
      const pixel = ctx.getImageData(sx, sy, 1, 1).data
      ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`
      ctx.fillRect(bx, by, bw, bh)
    }
  }
  mosaicHasPaint.value = true
}

function onMosaicStart(event) {
  if (!mosaicMode.value) return
  event.preventDefault()
  mosaicIsDrawing = true
  const pos = getMosaicCanvasCoords(event)
  if (pos) applyMosaicAtPoint(pos.x, pos.y)
}

function onMosaicMove(event) {
  if (!mosaicMode.value || !mosaicIsDrawing) return
  event.preventDefault()
  const pos = getMosaicCanvasCoords(event)
  if (pos) applyMosaicAtPoint(pos.x, pos.y)
}

function onMosaicEnd() {
  mosaicIsDrawing = false
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
    // history / custom 类型：同步更新合成图
    if (dirDrawer.type === 'history' || dirDrawer.type === 'custom') {
      dirDrawer.pdfPageDataUrl = dirDrawer.pdfPreviewUrl
      dirDrawer.previewUrl = await buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity)
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

// --- 自定义目录：打开并随机预览一个 PDF ---
async function openCustomDir(item, idx) {
  if (!item.path) {
    message.warning('该条目未配置路径')
    return
  }
  customLoading.value = idx
  try {
    const res = await getBaiduFiles(item.path)
    const files = res.files || []
    // 筛选 PDF 文件（isdir===0 且文件名以 .pdf 结尾，不区分大小写）
    const pdfFiles = files.filter(f => f.isdir === 0 && /\.pdf$/i.test(f.name))
    if (!pdfFiles.length) {
      message.warning('该目录下暂无 PDF 文件')
      return
    }

    // 随机选一个 PDF
    const pdfFile = pdfFiles[Math.floor(Math.random() * pdfFiles.length)]

    // 目录文件列表（文件夹在前）
    const sortedFiles = [...files].sort((a, b) => b.isdir - a.isdir)

    // 初始化抽屉状态
    dirDrawer.type = 'custom'
    dirDrawer.customIndex = idx
    dirDrawer.dirMode = 'dir'
    dirDrawer.title = item.name || '自定义'
    dirDrawer.borderColor = '#F9863B'
    // bgColor 复用页面加载时已随机生成的值，无需重新生成
    dirDrawer.bgOpacity = 0.35
    dirDrawer.dirOnly = false
    dirDrawer.files = sortedFiles
    dirDrawer.previewUrl = ''
    dirDrawer.pdfPageDataUrl = ''
    dirDrawer.pdfPreviewUrl = ''
    dirDrawer.pdfFsid = null
    dirDrawer.pdfFileName = ''
    dirDrawer.loading = true
    dirDrawer.visible = true

    // 渲染随机 PDF 首页
    const lib = await ensurePdfjs()
    const pdfDoc = await lib.getDocument({
      url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(pdfFile.path)}`,
      httpHeaders: { Authorization: `Bearer ${getToken()}` },
    }).promise
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const pdfCanvas = document.createElement('canvas')
    pdfCanvas.width = viewport.width
    pdfCanvas.height = viewport.height
    await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise

    dirDrawer.pdfPageDataUrl = pdfCanvas.toDataURL('image/png')
    dirDrawer.pdfPreviewUrl = dirDrawer.pdfPageDataUrl
    dirDrawer.pdfFsid = pdfFile.fs_id
    dirDrawer.pdfFileName = pdfFile.name

    // 生成合成目录图
    dirDrawer.previewUrl = await buildHistoryComposite(
      dirDrawer.pdfPageDataUrl, sortedFiles,
      dirDrawer.borderColor, dirDrawer.title,
      dirDrawer.bgColor, dirDrawer.bgOpacity
    )
  } catch (e) {
    message.error(e.message || '打开失败')
    dirDrawer.visible = false
  } finally {
    dirDrawer.loading = false
    customLoading.value = -1
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
