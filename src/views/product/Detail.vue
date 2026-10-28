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
        <a-dropdown>
          <a-button>
            <template #icon><PictureOutlined /></template>
            生图 <DownOutlined style="font-size:11px;margin-left:3px" />
          </a-button>
          <template #overlay>
            <a-menu @click="onImageMenuClick">
              <a-menu-item key="cover">🖼️ 主封面图</a-menu-item>
              <a-menu-divider />
              <a-menu-item key="exam_info">📋 考情</a-menu-item>
              <a-menu-item key="sprint">🚀 冲刺</a-menu-item>
              <a-menu-item key="advice">💡 备考建议</a-menu-item>
              <a-menu-item key="intensity">💪 强度</a-menu-item>
              <a-menu-item key="timeline_score">📊 时间轴/分值</a-menu-item>
              <a-menu-divider />
              <a-menu-item key="note_image_set">📚 整组笔记配图</a-menu-item>
              <template v-if="isCommunityWorkerProduct">
                <a-menu-divider />
                <a-menu-item key="community_worker_set">🏘️ 社区工作者图文模板</a-menu-item>
                <a-menu-item key="community_mind_map_set">🧠 社区工作者思维导图模板</a-menu-item>
              </template>
            </a-menu>
          </template>
        </a-dropdown>
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
        <template #extra>
          <a-space>
            <span style="font-size:13px;color:#555">使用背景图</span>
            <a-switch v-model:checked="useBgImage" size="small" @change="onUseBgImageChange" />
            <template v-if="useBgImage">
              <img v-if="selectedBgImageUrl" :src="selectedBgImageUrl" style="height:28px;width:21px;object-fit:cover;border-radius:3px;border:1px solid #d9d9d9;vertical-align:middle" />
              <a-button size="small" :loading="bgImageLoading" @click="rePickBgImage">换一张</a-button>
            </template>
            <a-button
              v-if="data.baidu_path_exam || data.baidu_path_history || data.baidu_path_mock || data.baidu_path_interview || data.baidu_custom_dirs?.length"
              type="primary"
              :loading="batchDownloading"
              @click="batchDownloadAllDirImages"
            >
              <template #icon><DownloadOutlined /></template>
              {{ batchDownloading ? `生成中 ${batchProgress.done}/${batchProgress.total}...` : '打包下载全部目录图' }}
            </a-button>
          </a-space>
        </template>
        <a-row v-if="!data.baidu_path_exam && !data.baidu_path_history && !data.baidu_path_mock && !data.baidu_path_interview && !data.baidu_custom_dirs?.length">
          <a-col :span="24" style="color: #999">暂未配置百度网盘目录路径，请在编辑页面填写</a-col>
        </a-row>
        <template v-else>
          <a-row :gutter="24" v-if="data.baidu_path_exam || data.baidu_path_history || data.baidu_path_mock || data.baidu_path_interview">
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
            <a-col :span="8" v-if="data.baidu_path_interview">
              <div class="baidu-dir-item">
                <div class="baidu-dir-label">面试题目录</div>
                <div class="baidu-dir-path">{{ data.baidu_path_interview }}</div>
                <a-space style="margin-top: 8px">
                  <a-button :loading="dirDrawer.loading && dirDrawer.type === 'interview'" @click="generateDirImage('interview')">
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
          <span style="font-size:13px;color:#555;white-space:nowrap">目录模板：</span>
          <a-select v-model:value="dirDrawer.dirStyle" style="width:150px" @change="refreshDirPreview">
            <a-select-option v-for="tpl in DIR_IMAGE_STYLE_OPTIONS" :key="tpl.value" :value="tpl.value">
              {{ tpl.label }}
            </a-select-option>
          </a-select>
          <span style="font-size:13px;color:#555;white-space:nowrap">标题文案：</span>
          <a-input v-model:value="dirDrawer.title" style="width:200px" @input="refreshDirPreview" />
          <span style="font-size:13px;color:#555;white-space:nowrap">标题Y轴：</span>
          <a-input-number
            v-model:value="dirDrawer.titleY"
            :min="0"
            :max="1656"
            :step="1"
            placeholder="自动"
            allow-clear
            style="width:100px"
            @change="refreshDirPreview"
          />
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
          <template v-if="(dirDrawer.type === 'history' || dirDrawer.type === 'mock' || dirDrawer.type === 'custom' || dirDrawer.dirMode === 'culture') && !dirDrawer.dirOnly">
            <span style="font-size:13px;color:#555;white-space:nowrap">PDF首页模板：</span>
            <a-select v-model:value="dirDrawer.pdfSingleStyle" style="width:150px" @change="refreshDirPreview">
              <a-select-option v-for="tpl in PDF_SINGLE_STYLE_OPTIONS" :key="tpl.value" :value="tpl.value">
                {{ tpl.label }}
              </a-select-option>
            </a-select>
          </template>
          <a-button @click="downloadCompositeImage" :disabled="!dirDrawer.previewUrl">下载目录图</a-button>
          <a-button @click="downloadPdfPage" :disabled="!dirDrawer.pdfPreviewUrl">下载PDF首页</a-button>
          <a-divider type="vertical" style="height:20px" />
          <span style="font-size:13px;color:#555;white-space:nowrap">PDF拼图模式：</span>
          <a-switch v-model:checked="dirDrawer.pdfGridMode" />
          <span v-if="dirDrawer.pdfGridMode" style="font-size:12px;color:#1677ff;white-space:nowrap">点击PDF可查看4页拼图</span>
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
          <a-divider type="vertical" style="height:20px" />
          <a-switch v-model:checked="autoMosaicEnabled" size="small" />
          <span style="font-size:12px;color:#555;white-space:nowrap">生图自动遮盖敏感词</span>
          <a-tooltip v-if="autoMosaicEnabled" title="已内置敏感词列表，生图时自动遮码；切换开关后重新点击「生成目录图」生效">
            <span style="font-size:12px;color:#1677ff;cursor:default;user-select:none">(?)</span>
          </a-tooltip>
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
                @click="onPdfFileClick(f)"
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

      <!-- PDF 4页拼图预览抽屉 -->
      <a-drawer
        v-model:open="pdfGridDrawer.visible"
        :title="`PDF 4页拼图 · ${pdfGridDrawer.file?.name || ''}`"
        placement="right"
        width="80%"
        :body-style="{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: '#f0f0f0', overflow: 'auto' }"
      >
        <!-- 加载中 -->
        <div v-if="pdfGridDrawer.loading" style="display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:80px">
          <a-spin size="large" />
          <span style="color:#666;font-size:14px">正在渲染 PDF 前 4 页，请稍候…</span>
        </div>

        <!-- 合成图预览 -->
        <template v-else-if="pdfGridDrawer.gridUrl">

          <!-- ① 标题文案面板 -->
          <div style="width:100%;background:#fff;border-radius:10px;padding:14px 20px;box-shadow:0 1px 6px rgba(0,0,0,0.08);flex-shrink:0">
            <!-- 开关 + 文本输入 -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              <span style="font-size:13px;color:#555;white-space:nowrap;font-weight:500">标题文案</span>
              <a-switch v-model:checked="pdfGridDrawer.titleEnabled" size="small" @change="refreshGridComposite" />
              <a-input
                v-model:value="pdfGridDrawer.titleText"
                :disabled="!pdfGridDrawer.titleEnabled"
                placeholder="输入标题文案…"
                style="flex:1"
                @input="debouncedRefreshGridComposite"
              />
            </div>
            <!-- 样式选择 -->
            <div v-if="pdfGridDrawer.titleEnabled" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
              <span style="font-size:12px;color:#888;white-space:nowrap">文字样式：</span>
              <div
                v-for="s in PDF_TITLE_STYLES"
                :key="s.value"
                @click="pdfGridDrawer.titleStyle = s.value; refreshGridComposite()"
                :style="{
                  cursor: 'pointer',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  border: pdfGridDrawer.titleStyle === s.value ? '2px solid #1677ff' : '2px solid #e8e8e8',
                  background: pdfGridDrawer.titleStyle === s.value ? '#e6f4ff' : '#fafafa',
                  color: pdfGridDrawer.titleStyle === s.value ? '#1677ff' : '#555',
                  userSelect: 'none',
                  transition: 'all 0.15s',
                  fontWeight: pdfGridDrawer.titleStyle === s.value ? '500' : '400',
                }"
              >{{ s.label }}</div>
            </div>
            <!-- 垂直位置滑道 -->
            <div v-if="pdfGridDrawer.titleEnabled" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <template v-if="pdfGridDrawer.editMode === 'custom'">
                <span style="font-size:12px;color:#888;white-space:nowrap">水平位置：</span>
                <input
                  type="range"
                  v-model.number="pdfGridDrawer.titleX"
                  min="5"
                  max="95"
                  step="1"
                  style="width:120px;accent-color:#1677ff;cursor:pointer"
                  @input="debouncedRefreshGridComposite"
                />
                <span style="font-size:12px;color:#1677ff;min-width:34px;font-variant-numeric:tabular-nums">{{ pdfGridDrawer.titleX }}%</span>
              </template>
              <span style="font-size:12px;color:#888;white-space:nowrap">垂直位置：</span>
              <input
                type="range"
                v-model.number="pdfGridDrawer.titleY"
                min="10"
                max="90"
                step="1"
                style="width:140px;accent-color:#1677ff;cursor:pointer"
                @input="debouncedRefreshGridComposite"
              />
              <span style="font-size:12px;color:#1677ff;min-width:36px;font-variant-numeric:tabular-nums">
                {{ pdfGridDrawer.titleY === 50 ? '居中' : `${pdfGridDrawer.titleY}%` }}
              </span>
              <span style="font-size:12px;color:#888;white-space:nowrap;margin-left:8px">字体大小：</span>
              <input
                type="range"
                v-model.number="pdfGridDrawer.titleSize"
                min="36"
                max="180"
                step="2"
                style="width:140px;accent-color:#ff6b35;cursor:pointer"
                @input="debouncedRefreshGridComposite"
              />
              <span style="font-size:12px;color:#ff6b35;min-width:40px;font-variant-numeric:tabular-nums">{{ pdfGridDrawer.titleSize }} px</span>
            </div>
          </div>

          <!-- ② 模糊 + 下载控制行 -->
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;background:#fff;padding:10px 20px;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,0.08);flex-wrap:wrap">
            <span style="font-size:13px;color:#555;white-space:nowrap">编辑模式：</span>
            <a-radio-group v-model:value="pdfGridDrawer.editMode" size="small" @change="onPdfGridEditModeChange">
              <a-radio-button value="template">模板</a-radio-button>
              <a-radio-button value="custom">自定义</a-radio-button>
            </a-radio-group>
            <a-divider type="vertical" style="height:20px" />
            <span style="font-size:13px;color:#555;white-space:nowrap">拼图模版：</span>
            <a-select
              v-model:value="pdfGridDrawer.gridTemplate"
              style="width:180px"
              size="small"
              :disabled="pdfGridDrawer.editMode === 'custom'"
              @change="onPdfGridTemplateChange"
            >
              <a-select-option v-for="tpl in PDF_GRID_TEMPLATES" :key="tpl.value" :value="tpl.value">
                {{ tpl.label }}
              </a-select-option>
            </a-select>
            <a-divider type="vertical" style="height:20px" />
            <span style="font-size:13px;color:#555;white-space:nowrap">模糊程度：</span>
            <input
              type="range"
              v-model.number="pdfGridDrawer.blurAmount"
              min="0"
              max="20"
              step="0.5"
              style="width:160px;accent-color:#1677ff;cursor:pointer"
              @input="debouncedRefreshGridComposite"
            />
            <span style="font-size:13px;color:#1677ff;min-width:44px;font-variant-numeric:tabular-nums">
              {{ pdfGridDrawer.blurAmount === 0 ? '不模糊' : `${pdfGridDrawer.blurAmount} px` }}
            </span>
            <a-divider type="vertical" style="height:20px" />
            <span style="font-size:13px;color:#555;white-space:nowrap">边框颜色：</span>
            <input
              type="color"
              v-model="pdfGridDrawer.gridBorderColor"
              @input="onGridBorderColorChange"
              style="width:36px;height:32px;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;padding:2px"
            />
            <template v-if="pdfGridDrawer.editMode === 'custom'">
              <a-divider type="vertical" style="height:20px" />
              <span style="font-size:13px;color:#555;white-space:nowrap">当前页缩放：</span>
              <input
                type="range"
                :value="selectedPdfGridItemScale"
                min="0.35"
                max="2.4"
                step="0.02"
                style="width:130px;accent-color:#ff6b35;cursor:pointer"
                :disabled="pdfGridDrawer.selectedItemIndex < 0"
                @input="onSelectedPdfGridScaleInput"
              />
              <span style="font-size:13px;color:#ff6b35;min-width:42px;font-variant-numeric:tabular-nums">
                {{ Math.round(selectedPdfGridItemScale * 100) }}%
              </span>
              <a-divider type="vertical" style="height:20px" />
              <span style="font-size:13px;color:#555;white-space:nowrap">层级：</span>
              <a-button size="small" :disabled="pdfGridDrawer.selectedItemIndex < 0" @click="moveCustomPdfGridLayer('bottom')">置底</a-button>
              <a-button size="small" :disabled="pdfGridDrawer.selectedItemIndex <= 0" @click="moveCustomPdfGridLayer('down')">下移</a-button>
              <a-button size="small" :disabled="pdfGridDrawer.selectedItemIndex < 0 || pdfGridDrawer.selectedItemIndex >= pdfGridDrawer.customItems.length - 1" @click="moveCustomPdfGridLayer('up')">上移</a-button>
              <a-button size="small" :disabled="pdfGridDrawer.selectedItemIndex < 0 || pdfGridDrawer.selectedItemIndex >= pdfGridDrawer.customItems.length - 1" @click="moveCustomPdfGridLayer('top')">置顶</a-button>
              <a-button size="small" @click="resetCustomPdfGridLayout">重置布局</a-button>
            </template>
            <a-button type="primary" size="large" @click="downloadPdfGrid">
              ⬇ 下载拼图（PNG）
            </a-button>
          </div>

          <!-- ③ 预览图 -->
          <canvas
            v-if="pdfGridDrawer.editMode === 'custom'"
            ref="pdfGridCanvasRef"
            :style="{
              maxWidth: 'min(100%, 560px)',
              boxShadow: '0 6px 28px rgba(0,0,0,0.18)',
              borderRadius: '12px',
              display: 'block',
              flexShrink: 0,
              cursor: pdfGridDrawer.draggingType ? 'grabbing' : 'grab',
              touchAction: 'none',
            }"
            @mousedown="onCustomPdfGridMouseDown"
            @mousemove="onCustomPdfGridMouseMove"
            @mouseup="onCustomPdfGridMouseUp"
            @mouseleave="onCustomPdfGridMouseUp"
            @wheel.prevent="onCustomPdfGridWheel"
          />
          <img
            v-else
            :src="pdfGridDrawer.displayUrl || pdfGridDrawer.gridUrl"
            :style="{
              maxWidth: 'min(100%, 560px)',
              boxShadow: '0 6px 28px rgba(0,0,0,0.18)',
              borderRadius: '12px',
              display: 'block',
              flexShrink: 0,
            }"
          />
        </template>

        <!-- 空状态 -->
        <div v-else style="color:#999;margin-top:80px;font-size:14px">暂无预览</div>
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
      <template #extra>
        <a-button :loading="noteDownloading" @click="downloadNoteContent">
          <template #icon><FileWordOutlined /></template>
          下载笔记内容
        </a-button>
      </template>
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
            <a-button
              :loading="cardImgGenerating"
              :disabled="!cardText"
              style="flex-shrink:0; margin-top:20px"
              @click="generateCardImage"
            >AI 生图</a-button>
            <a-button
              :loading="batchCardGenerating"
              :disabled="!cardText"
              style="flex-shrink:0; margin-top:20px"
              @click="() => generateBatchStyleCardImage()"
            >批量同款卡片图</a-button>
            <a-button
              :disabled="!cardText"
              style="flex-shrink:0; margin-top:20px"
              @click="openCardTemplatePicker"
            >选择模板</a-button>
          </div>
          <div v-if="cardGeneratedImgUrl" style="margin-bottom:12px; display:flex; flex-direction:column; align-items:center; gap:8px">
            <a-image
              :src="cardGeneratedImgUrl"
              :preview="{ src: cardGeneratedImgUrl }"
              style="max-height:200px; max-width:100%; border-radius:8px; box-shadow:0 2px 12px rgba(0,0,0,0.12); display:block; cursor:pointer"
            />
            <a-button size="small" :loading="cardDownloading" @click="downloadCardImage">下载图片</a-button>
          </div>
          <div v-if="batchCardImageUrl" class="batch-card-result">
            <a-image
              :src="batchCardImageUrl"
              :preview="{ src: batchCardImageUrl }"
              :width="210"
              :height="280"
              class="batch-card-result__image"
            />
            <a-space>
              <a-button size="small" :loading="batchCardDownloading" @click="downloadBatchCardImage">
                下载卡片图
              </a-button>
              <a-button size="small" :loading="batchCardGenerating" @click="() => generateBatchStyleCardImage()">
                换一个模板
              </a-button>
            </a-space>
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
                <a-button type="link" size="small" @click="generateTitle">
                  {{ generatedTitle ? '重新生成' : '生成标题' }}
                </a-button>
              </a-space>
            </div>
          </template>
          <div v-if="generatedTitle">
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
                <a-button type="link" size="small" :loading="bodyGenerating" @click="templateModalVisible = true">
                  模版生成
                </a-button>
              </a-space>
            </div>
          </template>
          <div v-if="bodyGenerating" class="field-placeholder field-placeholder--lg loading-box">
            <a-spin /> <span style="margin-left: 8px; color: #999">正在生成正文...</span>
          </div>
          <template v-else-if="generatedBody">
            <a-textarea v-model:value="generatedBody" placeholder="生成的正文"
              :auto-size="{ minRows: 10, maxRows: 24 }" />
            <div style="text-align: right; font-size: 12px; margin-top: 3px;"
              :style="{ color: generatedBody.length > 300 ? '#ff4d4f' : '#999' }">
              {{ generatedBody.length }}/300 字
            </div>
          </template>
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
                <a-button
                  type="link"
                  size="small"
                  :loading="coverGenerating"
                  :disabled="coverPromptMode === 'specified' && !selectedCoverPromptId"
                  @click="() => generateCoverImage()"
                >
                  {{ coverImageUrls.length ? '重新生成' : '生成封面图' }}
                </a-button>
              </a-space>
            </div>
          </template>
          <div class="cover-prompt-picker">
            <div class="cover-prompt-picker__header">
              <span class="cover-prompt-picker__label">提示词方式</span>
              <a-radio-group v-model:value="coverPromptMode" button-style="solid" size="small">
                <a-radio-button value="random">随机提示词</a-radio-button>
                <a-radio-button value="specified">指定提示词</a-radio-button>
              </a-radio-group>
              <a-button
                v-if="coverPromptMode === 'specified'"
                type="link"
                size="small"
                :loading="coverPromptOptionsLoading"
                @click="loadCoverCardPrompts"
              >刷新</a-button>
            </div>
            <div v-if="coverPromptMode === 'specified'" class="cover-prompt-options">
              <a-spin v-if="coverPromptOptionsLoading" />
              <a-empty v-else-if="!coverPromptOptions.length" description="暂无可用的卡片提示词" />
              <button
                v-for="item in coverPromptOptions"
                v-else
                :key="item.id"
                type="button"
                class="cover-prompt-option"
                :class="{ 'cover-prompt-option--active': selectedCoverPromptId === item.id }"
                @click="selectedCoverPromptId = item.id"
              >
                <div class="cover-prompt-option__image">
                  <img v-if="item.sample_image" :src="item.sample_image" :alt="`${item.name}示例图`" />
                  <PictureOutlined v-else />
                </div>
                <div class="cover-prompt-option__meta">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.job_type_name || '通用提示词' }}</span>
                </div>
                <CheckCircleOutlined v-if="selectedCoverPromptId === item.id" class="cover-prompt-option__check" />
              </button>
            </div>
          </div>
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

    <a-modal
      v-model:open="cardTemplatePickerVisible"
      title="选择卡片图模板"
      width="980px"
      ok-text="使用此模板生成"
      cancel-text="取消"
      :confirm-loading="batchCardGenerating"
      :ok-button-props="{ disabled: !selectedCardTemplateId }"
      @ok="generateSelectedCardTemplate"
    >
      <div class="card-template-picker__toolbar">
        <span>卡片文字：{{ cardText }}</span>
        <a-button size="small" :loading="cardTemplatePickerLoading" @click="loadCardTemplatePickerPreviews">
          刷新预览
        </a-button>
      </div>
      <a-spin :spinning="cardTemplatePickerLoading">
        <div class="card-template-picker__grid">
          <button
            v-for="item in cardTemplatePickerPreviews"
            :key="item.id"
            type="button"
            class="card-template-picker__item"
            :class="{ 'card-template-picker__item--active': selectedCardTemplateId === item.id }"
            @click="selectedCardTemplateId = item.id"
          >
            <img :src="`data:image/png;base64,${item.base64}`" :alt="item.name" />
            <span>{{ item.name }}</span>
            <CheckCircleOutlined v-if="selectedCardTemplateId === item.id" />
          </button>
        </div>
        <a-empty
          v-if="!cardTemplatePickerPreviews.length && !cardTemplatePickerLoading"
          description="暂无模板预览"
        />
      </a-spin>
    </a-modal>

    <!-- 模版生成正文 选择弹窗 -->
    <a-modal
      v-model:open="templateModalVisible"
      title="选择正文模版"
      :footer="null"
      width="680px"
      destroy-on-close
    >
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 8px 0;">
        <div
          v-for="tpl in BODY_TEMPLATES"
          :key="tpl.id"
          style="border: 1px solid #e8e8e8; border-radius: 8px; padding: 14px 16px; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s;"
          @mouseenter="e => e.currentTarget.style.borderColor = '#1677ff'"
          @mouseleave="e => e.currentTarget.style.borderColor = '#e8e8e8'"
          @click="generateBodyFromTemplate(tpl)"
        >
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">{{ tpl.title }}</div>
          <div style="font-size: 12px; color: #999;">{{ tpl.desc }}</div>
        </div>
      </div>
    </a-modal>


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

    <!-- 备考海报生图抽屉 -->
    <a-drawer
      v-model:open="examCardState.visible"
      title="备考海报生成"
      placement="right"
      width="60%"
      :body-style="{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: '#f5f5f5', overflow: 'auto' }"
    >
      <!-- 生成中（LLM 备考建议 / 获取绘图提示词 / 实际绘图） -->
      <div
        v-if="examCardState.step === 'llm' || examCardState.step === 'drawing'"
        style="display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:60px;width:100%"
      >
        <a-spin size="large" />
        <span style="color:#555;font-size:14px">{{ examCardState.statusMsg }}</span>
        <!-- 备考建议已生成时提前展示 -->
        <div
          v-if="examCardState.advice"
          style="max-width:500px;width:100%;background:#fff;border-radius:8px;padding:12px 16px;
                 font-size:13px;color:#333;line-height:1.8;box-shadow:0 1px 6px rgba(0,0,0,0.08)"
        >
          <div style="font-weight:500;color:#ff2d55;margin-bottom:6px">📝 备考建议（已生成，等待绘图…）</div>
          {{ examCardState.advice }}
        </div>
      </div>

      <!-- 提示词审核（prompt_ready）：可编辑后用此提示词生成 -->
      <template v-else-if="examCardState.step === 'prompt_ready'">
        <!-- 备考建议展示 -->
        <div style="width:100%;max-width:700px;background:#fff;border-radius:8px;
                    padding:12px 16px;font-size:13px;color:#333;line-height:1.8;
                    box-shadow:0 1px 6px rgba(0,0,0,0.08);flex-shrink:0">
          <div style="font-weight:500;color:#ff2d55;margin-bottom:6px">📝 备考建议</div>
          {{ examCardState.advice }}
        </div>
        <!-- 绘图提示词编辑区 -->
        <div style="width:100%;max-width:700px;background:#fff;border-radius:8px;
                    padding:14px 16px;box-shadow:0 1px 6px rgba(0,0,0,0.08);flex-shrink:0">
          <div style="font-size:12px;color:#999;margin-bottom:6px">
            绘图提示词（可编辑后点击「用此提示词生成」）：
          </div>
          <a-textarea
            v-model:value="examCardState.promptText"
            :auto-size="{ minRows: 8, maxRows: 20 }"
            style="font-size:12px;resize:none"
          />
          <div style="display:flex;gap:10px;margin-top:10px">
            <a-button type="primary" @click="generateExamCard(true)">
              ✅ 用此提示词生成
            </a-button>
            <a-button @click="generateExamCard(false)">
              🔄 重新生成提示词
            </a-button>
          </div>
        </div>
      </template>

      <!-- 生成完成 -->
      <template v-else-if="examCardState.step === 'done' && examCardState.imageUrl">
        <!-- 备考建议 -->
        <div style="width:100%;max-width:560px;background:#fff;border-radius:8px;
                    padding:12px 16px;font-size:13px;color:#333;line-height:1.8;
                    box-shadow:0 1px 6px rgba(0,0,0,0.08);flex-shrink:0">
          <div style="font-weight:500;color:#ff2d55;margin-bottom:6px">📝 备考建议</div>
          {{ examCardState.advice }}
        </div>
        <!-- 绘图提示词（可折叠查看 / 再次编辑） -->
        <div
          v-if="examCardState.promptText"
          style="width:100%;max-width:560px;background:#fff;border-radius:8px;
                 padding:10px 14px;box-shadow:0 1px 6px rgba(0,0,0,0.08);flex-shrink:0"
        >
          <div style="font-size:12px;color:#999;margin-bottom:4px">提示词（可编辑后重新生成）：</div>
          <a-textarea
            v-model:value="examCardState.promptText"
            :auto-size="{ minRows: 4, maxRows: 12 }"
            style="font-size:12px;resize:none"
          />
          <a-button
            type="link"
            size="small"
            style="padding:4px 0"
            @click="generateExamCard(true)"
          >用此提示词生成</a-button>
        </div>
        <!-- 海报预览 -->
        <img
          :src="examCardState.imageUrl"
          style="max-width:min(100%,560px);border-radius:12px;
                 box-shadow:0 6px 28px rgba(0,0,0,0.18);display:block;flex-shrink:0"
        />
        <!-- 操作按钮 -->
        <div style="display:flex;gap:12px;flex-shrink:0">
          <a-button
            type="primary"
            size="large"
            :loading="examCardState.downloading"
            @click="downloadExamCard"
          >⬇ 下载海报（去重处理）</a-button>
          <a-button size="large" @click="generateExamCard(false)">🔄 重新生成</a-button>
        </div>
      </template>

      <!-- 出错 -->
      <div
        v-else-if="examCardState.step === 'error'"
        style="display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:60px"
      >
        <span style="color:#ff4d4f;font-size:14px">{{ examCardState.errorMsg }}</span>
        <a-button @click="generateExamCard(false)">🔄 重试</a-button>
      </div>

      <!-- idle 初始 -->
      <div v-else style="color:#999;margin-top:60px;font-size:14px">准备就绪，正在启动…</div>
    </a-drawer>

    <!-- HTML图片生成（考情 / 冲刺 / 备考建议 / 强度） -->
    <HtmlCardImages
      v-model:visible="htmlImageVisible"
      :data="data"
      :init-type="htmlImageInitType"
    />

    <NoteImageSetDrawer
      v-model:visible="noteImageSetVisible"
      :data="data"
    />

    <!-- 社区工作者专用图文模板 -->
    <a-drawer
      v-model:open="communityImageDrawer.visible"
      title="社区工作者图文模板"
      placement="right"
      width="86%"
      :destroy-on-close="false"
      :mask-closable="false"
    >
      <template #extra>
        <a-space>
          <span class="community-template-label">版式</span>
          <a-select
            v-model:value="communityImageDrawer.template"
            size="small"
            style="width: 132px"
            :options="communityWorkerTemplateOptions"
          />
          <a-button
            v-if="communityImageDrawer.images.length"
            :loading="communityImageDrawer.downloading"
            @click="downloadCommunityWorkerImages"
          >
            <DownloadOutlined /> 下载全部
          </a-button>
          <a-button
            type="primary"
            :loading="communityImageDrawer.generating"
            @click="generateCommunityWorkerImages"
          >
            {{ communityImageDrawer.images.length ? '重新生成' : '生成图片' }}
          </a-button>
        </a-space>
      </template>

      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 14px"
        :message="`单位：${communityImageMeta.orgLine} ／ 商品类型：${data.job_type_name || '-'}`"
        description="根据商品详情中的单位名称、公告名称、笔试内容、招聘人数与时间信息生成 6 张社区工作者图文资料图。"
      />

      <div v-if="communityImageDrawer.generating" class="field-placeholder loading-box community-loading">
        <a-spin /> <span style="margin-left: 8px; color: #999">正在生成社区工作者图文图片...</span>
      </div>
      <div v-else-if="communityImageDrawer.images.length" class="community-result-grid">
        <div v-for="(img, idx) in communityImageDrawer.images" :key="idx" class="community-result-item">
          <a-image :src="img.blobUrl" :width="180" :height="240" />
          <a-button size="small" type="link" @click="downloadCommunityWorkerImage(idx)">
            <DownloadOutlined /> 下载第 {{ idx + 1 }} 张
          </a-button>
        </div>
      </div>
      <a-empty v-else description="点击右上角生成图片" />

      <div class="community-render-host" aria-hidden="true">
        <div
          v-for="page in communityWorkerPages"
          :key="page.no"
          class="community-poster"
          :class="[communityImageDrawer.theme, communityImageDrawer.activeTemplate, page.type === 'overview' ? 'cw-page-overview' : 'cw-page-detail']"
          :data-community-page="page.no"
        >
          <section class="cw-header">
            <div class="cw-kicker">{{ communityImageMeta.orgLine }} · 社区专职工作者</div>
            <div class="cw-title">{{ page.title }}</div>
            <div v-if="page.badge" class="cw-badge">{{ page.badge }}</div>
            <div class="cw-subrow">
              <span>{{ page.subtitle }}</span>
              <strong>{{ String(page.no).padStart(2, '0') }} / 06</strong>
            </div>
          </section>

          <section v-if="page.type === 'overview'" class="cw-body cw-body-overview">
            <div class="cw-blackbar">
              笔试共考 <b>四大模块</b>：综合知识 + 社会工作知识 + 能力素质 + 写作
            </div>
            <div class="cw-section-title">笔试范围 · 4 大模块</div>
            <div class="cw-overview-grid">
              <div class="cw-module-list">
                <div v-for="mod in page.modules" :key="mod" class="cw-module-pill">{{ mod }}</div>
              </div>
              <div class="cw-module-points">
                <div v-for="line in page.moduleLines" :key="line" class="cw-dot-line" v-html="line"></div>
              </div>
            </div>
            <div class="cw-section-title">备考时间线</div>
            <div class="cw-timeline">
              <div v-for="item in page.timeline" :key="item.title" class="cw-time-point">
                <span></span>
                <strong>{{ item.title }}</strong>
                <em>{{ item.text }}</em>
              </div>
            </div>
            <div class="cw-section-title">备考关键</div>
            <div class="cw-key-list">
              <div v-for="line in page.keys" :key="line" v-html="line"></div>
            </div>
          </section>

          <section v-else class="cw-body">
            <div v-for="block in page.blocks" :key="block.label" class="cw-row">
              <div class="cw-row-label">{{ block.label }}</div>
              <div class="cw-row-content">
                <div v-for="line in block.lines" :key="line" class="cw-dot-line" v-html="line"></div>
              </div>
            </div>
          </section>

          <section class="cw-footer">
            <strong>完整版资料戳主页</strong>
            <span>|</span>
            <em>{{ page.footer }}</em>
          </section>
        </div>
      </div>
    </a-drawer>

    <!-- 社区工作者专用思维导图模板 -->
    <a-drawer
      v-model:open="communityMindMapDrawer.visible"
      title="社区工作者思维导图模板"
      placement="right"
      width="86%"
      :destroy-on-close="false"
      :mask-closable="false"
    >
      <template #extra>
        <a-space>
          <a-button
            v-if="communityMindMapDrawer.images.length"
            :loading="communityMindMapDrawer.downloading"
            @click="downloadCommunityMindMapImages"
          >
            <DownloadOutlined /> 下载全部
          </a-button>
          <a-button
            type="primary"
            :loading="communityMindMapDrawer.generating"
            @click="generateCommunityMindMapImages"
          >
            {{ communityMindMapDrawer.images.length ? '重新生成' : '生成图片' }}
          </a-button>
        </a-space>
      </template>

      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 14px"
        :message="`单位：${communityImageMeta.orgLine} ／ 商品类型：${data.job_type_name || '-'}`"
        description="独立生成 6 张社区工作者思维导图资料图，节点文案会按模块随机组合。"
      />

      <div v-if="communityMindMapDrawer.generating" class="field-placeholder loading-box community-loading">
        <a-spin /> <span style="margin-left: 8px; color: #999">正在生成社区工作者思维导图图片...</span>
      </div>
      <div v-else-if="communityMindMapDrawer.images.length" class="community-result-grid">
        <div v-for="(img, idx) in communityMindMapDrawer.images" :key="idx" class="community-result-item">
          <a-image :src="img.blobUrl" :width="180" :height="240" />
          <a-button size="small" type="link" @click="downloadCommunityMindMapImage(idx)">
            <DownloadOutlined /> 下载第 {{ idx + 1 }} 张
          </a-button>
        </div>
      </div>
      <a-empty v-else description="点击右上角生成思维导图" />

      <div class="community-render-host" aria-hidden="true">
        <div
          v-for="page in communityMindMapPages"
          :key="page.no"
          class="community-mind-poster"
          :class="communityMindMapDrawer.theme"
          :data-community-mind-page="page.no"
        >
          <section class="cmm-header">
            <div class="cmm-kicker">{{ communityImageMeta.year }}年{{ communityImageMeta.orgLine }} · 专职化城市社区工作者</div>
            <div class="cmm-title">{{ page.title }}</div>
            <div class="cmm-line"></div>
            <div class="cmm-subrow">
              <span>{{ page.subtitle }}</span>
              <strong>{{ String(page.no).padStart(2, '0') }} / 06</strong>
            </div>
          </section>

          <section class="cmm-body" :class="page.type === 'overview' ? 'cmm-body-overview' : 'cmm-body-branch'">
            <template v-if="page.type === 'overview'">
              <svg class="cmm-overview-lines" viewBox="0 0 960 620" preserveAspectRatio="none">
                <path d="M480 408 C420 320 360 180 296 121" fill="none" :stroke="communityMindMapPalette.green" stroke-width="4" stroke-linecap="round" />
                <path d="M480 408 C410 352 360 280 296 277" fill="none" :stroke="communityMindMapPalette.green" stroke-width="4" stroke-linecap="round" />
                <path d="M480 408 C410 442 360 438 296 433" fill="none" :stroke="communityMindMapPalette.green" stroke-width="4" stroke-linecap="round" />
                <path d="M480 408 C540 315 595 210 660 201" fill="none" :stroke="communityMindMapPalette.green" stroke-width="4" stroke-linecap="round" />
                <path d="M480 408 C545 392 600 358 660 355" fill="none" :stroke="communityMindMapPalette.green" stroke-width="4" stroke-linecap="round" />
              </svg>
              <div
                v-for="node in page.nodes"
                :key="node.title"
                class="cmm-node cmm-overview-node"
                :class="`cmm-node-${node.tone}`"
                :style="{ left: `${node.x}px`, top: `${node.y}px` }"
              >
                <div class="cmm-node-title">{{ node.title }}</div>
                <div class="cmm-node-text">{{ node.text }}</div>
              </div>
              <div class="cmm-center-node">
                <strong>{{ communityImageMeta.jobName }}</strong>
                <span>{{ page.centerBadge }}</span>
              </div>
              <div class="cmm-overview-summary">
                <strong>{{ page.summaryTitle }}</strong>
                <span>{{ page.summaryText }}</span>
              </div>
              <div class="cmm-phase-row">
                <div v-for="phase in page.phases" :key="phase.title" class="cmm-phase-card">
                  <strong>{{ phase.title }}</strong>
                  <span>{{ phase.text }}</span>
                </div>
              </div>
              <div class="cmm-tag-row">
                <span v-for="tag in page.tags" :key="tag">{{ tag }}</span>
              </div>
            </template>

            <template v-else>
              <svg class="cmm-branch-lines" viewBox="0 0 952 890" preserveAspectRatio="none">
                <path
                  v-for="line in page.lines"
                  :key="line.d"
                  :d="line.d"
                  :class="line.tone ? `cmm-line-${line.tone}` : ''"
                  fill="none"
                  :stroke="line.tone === 'red' ? communityMindMapPalette.red : communityMindMapPalette.green"
                  stroke-width="4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <div class="cmm-root-node">{{ page.root }}</div>
              <div
                v-for="node in page.nodes"
                :key="node.title"
                class="cmm-node cmm-branch-node"
                :class="`cmm-node-${node.tone}`"
                :style="{ left: `${node.x}px`, top: `${node.y}px` }"
              >
                <div class="cmm-node-title">{{ node.title }}</div>
                <div class="cmm-node-lines">
                  <div v-for="line in node.lines" :key="line">{{ line }}</div>
                </div>
              </div>
              <div v-if="page.tip" class="cmm-tip" :class="`cmm-tip-${page.tip.tone || 'gold'}`">
                <strong>{{ page.tip.title }}</strong>
                <span v-for="line in page.tip.lines" :key="line">{{ line }}</span>
              </div>
            </template>
          </section>

          <section class="cmm-footer">
            <strong>完整版资料戳主页</strong>
            <span>|</span>
            <em>{{ page.footer }}</em>
          </section>
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { LeftOutlined, EditOutlined, FileTextOutlined, DownloadOutlined, BulbOutlined, FileWordOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, FormOutlined, StopOutlined, CopyOutlined, PictureOutlined, DownOutlined } from '@ant-design/icons-vue'
import HtmlCardImages from './components/HtmlCardImages.vue'
import NoteImageSetDrawer from './components/NoteImageSetDrawer.vue'
import { getProductDetail } from '@/api/products'
import { getContentTemplateList } from '@/api/contentTemplates'
import { getPromptList } from '@/api/prompts'
import { getCardPromptList } from '@/api/cardPrompts'
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
import { rewriteImage, proxyImageForDownload } from '@/api/xhsRewrite'
import { getBgImageList } from '@/api/bgImages'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import { BODY_TEMPLATES } from '@/utils/bodyTemplates'
import { toPng } from 'html-to-image'

const route = useRoute()
const router = useRouter()
const llmStore = useLlmStore()
const aiImageStore = useAiImageStore()

const id = computed(() => Number(route.params.id))
const loading = ref(false)
const data = ref({})
const generateVisible = ref(false)
const generatedTitle = ref('')
const cardText = ref('')
const cardImgGenerating = ref(false)
const cardDownloading = ref(false)
const cardGeneratedImgUrl = ref('')
const batchCardGenerating = ref(false)
const batchCardDownloading = ref(false)
const batchCardImageUrl = ref('')
const cardTemplatePickerVisible = ref(false)
const cardTemplatePickerLoading = ref(false)
const cardTemplatePickerPreviews = ref([])
const selectedCardTemplateId = ref('')
const bodyGenerating = ref(false)
const noteDownloading = ref(false)
const generatedBody = ref('')
const imagesGenerating = ref(false)
const generatedImages = ref([])
const generatedTags = ref([])
const coverGenerating = ref(false)
const coverStatusMsg = ref('正在生成封面图...')
const coverImageUrl = ref('')
const coverImageUrls = ref([])
const coverPromptUsed = ref('')
const coverPromptMode = ref('random')
const coverPromptOptions = ref([])
const coverPromptOptionsLoading = ref(false)
const selectedCoverPromptId = ref(null)
const selectedCoverPrompt = computed(() =>
  coverPromptOptions.value.find(item => item.id === selectedCoverPromptId.value) || null
)
const templateModalVisible = ref(false)
const communityImageDrawer = reactive({
  visible: false,
  generating: false,
  downloading: false,
  theme: 'cw-theme-red',
  template: 'random',
  activeTemplate: 'cw-template-classic',
  contentSeed: Date.now(),
  images: [],
})
const communityMindMapDrawer = reactive({
  visible: false,
  generating: false,
  downloading: false,
  theme: 'cmm-theme-default',
  contentSeed: Date.now(),
  images: [],
})

// ─── 备考海报一键生图 ──────────────────────────────────────
const examCardState = reactive({
  visible: false,       // 抽屉开关
  step: 'idle',         // 'idle'|'llm'|'prompt_ready'|'drawing'|'done'|'error'
  statusMsg: '',        // 进度提示
  advice: '',           // LLM 生成的备考建议
  promptText: '',       // 后端 LLM 生成的绘图提示词（可编辑后用此生成）
  imageUrl: '',         // 生成图片 URL
  downloading: false,
  errorMsg: '',
})

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

// emoji 分段：docx 默认字体不含 emoji 字形，需单独指定 Segoe UI Emoji 字体，否则 Word 内显示为方块或空白
const EMOJI_SPLIT = /(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/gu
const EMOJI_TEST = /^(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)$/u

function textToRuns(text, extraProps = {}) {
  if (!text) return [new TextRun({ text: '', ...extraProps })]
  return text.split(EMOJI_SPLIT).filter(Boolean).map(part =>
    EMOJI_TEST.test(part)
      ? new TextRun({ text: part, font: 'Segoe UI Emoji', ...extraProps })
      : new TextRun({ text: part, ...extraProps })
  )
}

async function downloadNoteContent() {
  if (noteDownloading.value) return
  noteDownloading.value = true
  try {
    if (!generatedTitle.value) await generateTitle()
    if (!generatedBody.value) await generateBody()

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: textToRuns(generatedTitle.value || '（无标题）') }),
          ...String(generatedBody.value || '（无正文）').split('\n').map(line => new Paragraph({ children: textToRuns(line) })),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: textToRuns(generatedTags.value.length ? generatedTags.value.join(' ') : '（无标签）', { color: 'FF6699' }),
          }),
        ],
      }],
    })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `笔记-${data.value.company_name || data.value.id || 'note'}.docx`)
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    noteDownloading.value = false
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
  loadCoverCardPrompts()
}

// ─── 备考海报一键生图 ──────────────────────────────────────

function openExamCard() {
  Object.assign(examCardState, {
    step: 'idle', statusMsg: '', advice: '',
    promptText: '', imageUrl: '', downloading: false, errorMsg: '',
  })
  examCardState.visible = true
  generateExamCard()
}

async function generateExamCard(useEditedPrompt = false) {
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
  await aiImageStore.ensureLoaded()
  if (!aiImageStore.activeProvider) {
    Modal.warning({
      title: '提示',
      content: '请先在「系统设置 → AI绘图」中将某个渠道设为使用中',
      okText: '去设置',
      onOk: () => router.push('/system/ai-image'),
    })
    return
  }

  const d = data.value

  // ① LLM 生成备考建议（仅首次，或非 useEditedPrompt 时重新生成）
  if (!useEditedPrompt) {
    examCardState.step = 'llm'
    examCardState.statusMsg = '正在生成备考建议…'
    const userPrompt = [
      '【强制要求】全部内容总字数必须严格在200字以内，不得超出。',
      '',
      d.company_name        ? `单位：${d.company_name}` : '',
      d.job_type_name       ? `招聘岗位类型：${d.job_type_name}` : '',
      d.recruit_count       ? `招聘人数：${d.recruit_count}` : '',
      d.written_exam_time   ? `笔试时间：${d.written_exam_time}` : '',
      d.written_exam_content ? `笔试内容：${d.written_exam_content}` : '',
      buildWrittenExamConstraint(),
      '',
      '请根据以下信息输出笔试备考建议，只输出纯文字，不带任何Markdown符号，不要出现"第X天"等按天拆分的内容：',
      '',
      '笔试备考建议',
      '[结合笔试内容和单位行业特点，整体说明备考重点、核心知识方向、刷题建议及备考注意事项]',
      '',
      '注意：',
      '1. 内容必须结合实际笔试内容（如燃气行业则聚焦燃气专业，IT行业聚焦技术知识等），不得生成与笔试无关的通用内容',
      '1.1 如果商品详情已写明具体笔试内容，必须只围绕该内容生成；未写明的科目不要自行扩展',
      '2. 严禁出现任何涉及政治人物、领导人姓名、中央政府政策文件名称、党政纪律等政治敏感内容',
      '3. 若笔试含"时事政治"，只写"关注近期社会热点、民生经济动态"等通用表述，不得提及具体政治人物或文件',
      '4. 输出纯文字，总字数严格不超过200字，超出200字即视为不合格，宁可删减也不超字数',
      '5. 再次强调：全文必须在200字以内',
    ].filter(s => s !== null).join('\n')

    try {
      const llmRes = await chatLlm({
        provider:    active.provider,
        api_format:  active.api_format,
        api_key:     active.api_key,
        base_url:    active.base_url || '',
        model:       active.default_model,
        messages: [
          { role: 'system', content: '你是一名专业的企业招聘考试辅导老师，擅长根据笔试科目制定实用的分天备考计划。你的输出必须是纯文字，按照用户指定格式，内容具体、实用、有针对性。严禁涉及政治人物、领导人姓名、党政文件名称等政治敏感内容。【核心约束】你的全部回复总字数必须严格控制在200字以内，这是最高优先级要求，任何情况下都不得超过200字，宁可内容精简也不能超字数。' },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens:  350,
        temperature: 0.7,
      })
      examCardState.advice = (llmRes.content || '').trim()
    } catch (e) {
      examCardState.step = 'error'
      examCardState.errorMsg = '备考建议生成失败：' + (e.message || '未知')
      return
    }
  }

  // ② 前端直接构造绘图提示词（参照参考图布局，不走后端随机模版）
  const yearMatch = (d.written_exam_time || '').match(/\d{4}/)
  const year = yearMatch ? yearMatch[0] : new Date().getFullYear()

  if (!useEditedPrompt) {
    // 按参考图布局精确描述：深红标题区 + 橙色区块头 + 白底内容 + 金色高亮建议 + 红底底栏
    const timeLines = [
      d.apply_time        ? `报名时间：${d.apply_time}` : '',
      d.written_exam_time ? `笔试时间：${d.written_exam_time}` : '',
    ].filter(Boolean).join('，')

    const detailLines = [
      d.recruit_count  ? `招聘人数：${d.recruit_count}人` : '',
    ].filter(Boolean).join('，')

    const examContent = (d.written_exam_content || '').trim()
    const advice = examCardState.advice || ''

    examCardState.promptText = [
      `Design a vertical Chinese exam preparation info-graphic poster (1080×1440px), NO cartoon mascot, NO illustrations, pure text-based layout, professional and clean.`,
      ``,
      `Layout from top to bottom:`,
      `1. [Header] Dark crimson red gradient background (height ~180px). Large white bold Chinese text centered: "${d.company_name || ''}笔试". Below it: orange text "${year}招聘${d.recruit_count || ''}人".`,
      `2. [Section 时间安排] White background. Left: orange rounded-rectangle label "时间安排". Content: ${timeLines || '暂定'}`,
      `3. [Section 考试详情] White background. Left: orange rounded-rectangle label "考试详情". Content: ${detailLines || examContent.slice(0, 60)}`,
      `4. [Section 笔试内容] White background. Left: orange rounded-rectangle label "笔试内容". Then exam content text: ${examContent.slice(0, 100)}`,
      `5. [Advice box] Light gold/yellow background box. Text content (exam prep advice): ${advice.slice(0, 150)}`,
      `6. [Footer] Dark red background bar. Gold bold text: "备考攻略+真题资料分享！"`,
      ``,
      `Color palette: dark red #8B0000, orange #FF6600, gold #FFD700, white #FFFFFF, light gray #F5F5F5.`,
      `Style: flat design, no gradients except header, information-dense, Chinese typography, clean section dividers, no border decorations, structured data visualization card.`,
      ``,
      buildWrittenExamConstraint(),
      `All text and visual content must follow the above written exam scope. Do not mention exam modules not present in the product details.`,
    ].join('\n')

    // 直接跳到提示词审核步骤，不再调用 prompt_only
    examCardState.step = 'prompt_ready'
    examCardState.statusMsg = '提示词已就绪，请确认后生成海报'
    return
  }

  // ③ 用编辑后的提示词正式绘图
  examCardState.step = 'drawing'
  examCardState.statusMsg = '正在生成备考海报…'

  const refImageUrl = `${window.location.origin}/exam-card-ref.png`

  await drawCoverStream({
    product_id:            id.value,
    card_text:             `${d.company_name || ''}笔试备考海报`,
    prompt:                appendWrittenExamConstraintToPrompt(examCardState.promptText),
    reference_image_url:   refImageUrl,
    llm_provider:          active.provider,
    llm_api_format:        active.api_format,
    llm_api_key:           active.api_key,
    llm_base_url:          active.base_url || '',
    llm_model:             active.default_model,
  }, {
    onProgress(event) {
      if (event.step === 'draw') examCardState.statusMsg = 'AI绘图中，请稍候…'
    },
    onDone(res) {
      const urls = Array.isArray(res?.urls) ? res.urls.filter(Boolean) : []
      examCardState.imageUrl = urls[0] || res?.url || ''
      examCardState.promptText = res?.prompt || examCardState.promptText
      examCardState.step = 'done'
      examCardState.statusMsg = '生成完成'
    },
    onError(e) {
      examCardState.step = 'error'
      examCardState.errorMsg = '绘图失败：' + (e.message || '未知')
    },
  })
}

/** 下载备考海报（去重 + 去AI处理） */
async function downloadExamCard() {
  if (!examCardState.imageUrl || examCardState.downloading) return
  examCardState.downloading = true
  const filename = `exam-card-${data.value.id || Date.now()}.jpg`
  try {
    const blob = await processImageForDownload(examCardState.imageUrl)
    triggerBlobDownload(blob, filename)
  } catch {
    // CORS 场景：先代理再处理
    try {
      const { proxyImageForDownload } = await import('@/api/xhsRewrite')
      const proxied = await proxyImageForDownload(examCardState.imageUrl)
      const blob    = await processImageForDownload(proxied.url)
      triggerBlobDownload(blob, filename)
    } catch (e2) {
      message.error('下载失败：' + (e2.message || '未知'))
    }
  } finally {
    examCardState.downloading = false
  }
}

async function generateCoverImage(useEditedPrompt = false) {
  const companyName = String(data.value.company_name || '').trim()
  const rawText = (cardText.value || generatedTitle.value || (companyName ? `${companyName}笔试` : data.value.title || '笔试封面图')).trim()
  const text = sanitizeCoverPromptText(rawText)

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

  coverGenerating.value = true
  coverStatusMsg.value = '正在生成封面图...'

  if (useEditedPrompt && coverPromptUsed.value) {
    params.prompt = sanitizeCoverPromptText(appendWrittenExamConstraintToPrompt(coverPromptUsed.value))
  } else {
    try {
      coverStatusMsg.value = coverPromptMode.value === 'specified'
        ? '正在读取指定提示词...'
        : '正在随机抽取卡片提示词...'
      const cardPrompt = coverPromptMode.value === 'specified'
        ? selectedCoverPrompt.value
        : await pickRandomCardPrompt()
      if (!cardPrompt) {
        message.error(coverPromptMode.value === 'specified'
          ? '请先选择一个提示词模板'
          : (data.value.job_type_name ? `未找到「${data.value.job_type_name}」可用的卡片提示词` : '未找到可用的卡片提示词'))
        coverGenerating.value = false
        return
      }
      params.prompt = sanitizeCoverPromptText(buildCoverPromptFromCardPrompt(cardPrompt))
      coverPromptUsed.value = params.prompt
    } catch (e) {
      message.error(e.message || '获取卡片提示词失败')
      coverGenerating.value = false
      return
    }
  }

  if (activeProvider === 'md2card') {
    const cfg = aiImageStore.activeConfig
    if (cfg?.model) params.keywords = cfg.model
    if (cfg?.concurrency) params.count = cfg.concurrency
  } else {
    const active = llmStore.active
    if (!active) {
      coverGenerating.value = false
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

  await drawCoverStream(params, {
    onProgress(event) {
      if (event.step === 'llm') coverStatusMsg.value = '正在适配提示词...'
      else if (event.step === 'llm_done') coverStatusMsg.value = '提示词适配完成，正在生成图片...'
      else if (event.step === 'draw') coverStatusMsg.value = '正在生成图片...'
    },
    onDone(data) {
      if (data?.prompt_only) {
        // 仅返回提示词：展示供审核，不清除旧图
        coverPromptUsed.value = sanitizeCoverPromptText(appendWrittenExamConstraintToPrompt(data.prompt || ''))
      } else {
        const urls = Array.isArray(data?.urls) ? data.urls.filter(Boolean) : []
        const rawUrls = urls.length ? urls : (data?.url ? [data.url] : [])
        coverImageUrls.value.forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u) })
        coverImageUrls.value = rawUrls
        coverImageUrl.value = rawUrls[0] || ''
        coverPromptUsed.value = sanitizeCoverPromptText(data?.prompt || '')
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

// ─── 卡片大字报生图 ────────────────────────────────────────────────
// 18 种风格，核心原则：背景浅色/纯色，标题文字必须深色/高对比，绝不同色系
const CARD_POSTER_STYLES = [
  // 0 白底+超大红字+黄色高亮（济南水务参考图同款）
  '竖版备考海报，纯白方格纸背景，超大加粗黑红双色主标题（上行黑色+下行红色），中间明黄色椭圆圈住副标题黑色文字，黄色手绘波浪下划线，下方彩色扁平卡通插图（彩色书本堆叠、笔记本、举拳加油卡通小人），整体白底高对比，文字醒目',

  // 1 白底+深蓝大字+黄色色块（吉林省参考图同款）
  '竖版备考海报，纯白背景，顶部黄色圆角矩形色块衬底内有超大加粗深蓝色主标题，白色区域蓝色副标题，橙色手绘波浪线分隔，右侧扁平卡通学生或老师人物，左侧蓝色圆形图标+要点黑色文字，绿色手绘箭头，白底深字高对比',

  // 2 绿边框+白内页+超大黑字（滕州市参考图同款）
  '竖版备考海报，外层草绿色圆角笔记本边框，内层纯白纸张顶部打孔装饰，超大加粗黑色主标题居中（黑字白底极高对比），粉色手绘椭圆圈住关键词黑字，绿色手绘箭头，右下角可爱卡通铅笔人物，干净清晰可爱',

  // 3 蓝灰摄影背景+黑色大字压图（郑城县参考图同款）
  '竖版备考海报，下半部柔焦蓝灰学习桌面摄影虚化背景（书本绿植钢笔），上半部纯白或浅色遮罩区域叠加超大加粗深蓝色/黑色主标题，蓝色笔刷色块衬托白色副标题，顶部小书本图标+细字标签，文字区域底色浅让黑字清晰突出',

  // 4 白底+超大红色冲刺大字+黄色圈
  '竖版备考海报，纯白背景，超大加粗大红色主标题铺满上半版面（白底红字强对比），黄色圆角椭圆框住副标题黑字，黑色粗波浪下划线，下方卡通学生跳跃冲刺扁平插图+书本堆叠，红色"上岸"小标签，激励感强',

  // 5 浅黄底+黑色超大标题+红色标签
  '竖版备考海报，浅柠檬黄/米黄背景，超大加粗黑色主标题（黄底黑字高对比），红色圆角矩形标签内白色副标题文字，黑色手绘下划线，角落橙色五角星装饰，下方卡通书本文具扁平插图，明快活泼备考风',

  // 6 白底+深蓝黑双色标题+橙色波浪线
  '竖版备考海报，白色背景，超大加粗主标题上行深蓝色下行黑色（高对比度），橙色手绘粗波浪线分隔主副标题，副标题黑色字体，右侧扁平卡通讲师人物，下方备考书本插图，橙色圆点散布，蓝橙白三色搭配清爽',

  // 7 浅蓝白渐变+黑色大字+白色气泡副标题
  '竖版备考海报，极浅天蓝白渐变背景，超大加粗黑色主标题（浅蓝底黑字高对比），白色云朵气泡形状框内黑色副标题，蓝色手绘箭头和星形装饰，下方扁平卡通学习插图（书桌书本），整体蓝白清爽，字体清晰醒目',

  // 8 白底+黑色大字+粉色荧光高亮圈
  '竖版备考海报，纯白背景，超大加粗黑色主标题（最高对比度），粉色马克笔荧光高亮色块涂在关键词背后（文字仍是黑色），绿色手绘波浪下划线，蓝色手绘箭头，下方可爱卡通学生坐着读书扁平插图，手账风格亲切',

  // 9 浅橙白底+深色大字+橙色圆角标签
  '竖版备考海报，浅橙白渐变背景，超大加粗深褐色/黑色主标题（橙白底深字高对比），橙色实心圆角标签内白色副标题，绿色小箭头装饰，下方扁平卡通书本文具暖橙色插图，整体暖意充满活力，文字主次分明',

  // 10 白底+主标题黑字+蓝色方框副标题
  '竖版备考海报，白色背景，超大加粗黑色主标题（白底黑字最强对比），蓝色圆角矩形实色框内白色副标题，蓝色圆形图标+黑色要点列表，橙色波浪线装饰，右侧扁平卡通学生举书人物，专业整洁备考风',

  // 11 浅粉白底+黑色大字+深色高亮框
  '竖版备考海报，极浅粉白背景，超大加粗黑色/深灰色主标题（高对比清晰），深玫红圆角色块内白色副标题，粉色手绘椭圆虚线圈装饰，可爱星星爱心手绘点缀，下方卡通女学生扁平人物+书本，甜而不腻清爽备考风',

  // 12 米白底+深蓝标题+绿色圆角标签
  '竖版备考海报，温暖米白奶油色背景，超大加粗深蓝色主标题（米白底深蓝字高对比），绿色实心圆角标签内白色副标题，咖啡色手绘下划线，下方扁平卡通学习书桌场景插图（书本笔记本绿植），温馨有质感',

  // 13 白底+红黑主标题+黄底黑字副标题圆框
  '竖版备考海报，纯白或极浅灰白背景，超大加粗主标题前两行黑色后一行红色（高对比），下方黄色填充圆角框内黑色加粗副标题，红色粗线下划线，下方彩色卡通书本资料堆叠插图，干净明快配色',

  // 14 白底+超大深蓝标题+橙黄弧形色块
  '竖版备考海报，白色背景，超大加粗深蓝色主标题占上半版（白底深蓝高对比），橙黄色弧形大色块横跨中部衬托白色副标题，绿色小箭头和圆点，下方扁平卡通学生和书本，蓝橙撞色活泼专业感',

  // 15 浅绿白底+黑色大字+白色色块副标题（修正单色问题）
  '竖版备考海报，极浅薄荷绿白渐变背景（接近白色非纯绿），超大加粗黑色主标题（浅底黑字强对比，绝非绿底绿字），白色实心圆角云朵形状内黑色副标题，深绿色手绘箭头，下方绿白配色卡通插图，清新不失对比度',

  // 16 白底+黑字标题+多色荧光标注
  '竖版备考海报，白色背景，超大加粗黑色主标题，关键字分别有黄色/粉色/蓝色荧光笔底色（字仍黑色高对比），蓝色手绘方框圈住副标题，手绘星星箭头涂鸦，下方卡通学生学习插图，手帐笔记风格活泼',

  // 17 浅蓝底+白色大字色块+黑色副标题（蓝白高对比）
  '竖版备考海报，天蓝渐变背景，超大加粗白色主标题放在深蓝圆角大色块内（深蓝块衬白字强对比），白色区域黑色副标题，蓝白分区清晰，橙色小标签装饰，下方卡通学生书本扁平插图，蓝白橙三色专业备考风',
]

async function generateCardImage() {
  const text = (cardText.value || '').trim()
  if (!text) { message.warning('请先填写卡片文字'); return }
  cardImgGenerating.value = true
  try {
    const styleDesc = CARD_POSTER_STYLES[Math.floor(Math.random() * CARD_POSTER_STYLES.length)]
    const image_prompt = `小红书备考笔记封面大字海报，竖版9:16比例，${styleDesc}，画面核心是超大加粗醒目的标题文字【${text}】，文字占据画面主体（60%以上空间），标题文字颜色与背景颜色必须形成强烈对比（深色字配浅背景，或浅色字配深色块），层次分明一眼抓人，文字清晰锐利不模糊`
    const res = await rewriteImage({ image_prompt })
    cardGeneratedImgUrl.value = res?.url || ''
    if (!cardGeneratedImgUrl.value) message.warning('生图成功但未返回图片地址')
  } catch (e) {
    message.error(e.message || '生图失败')
  } finally {
    cardImgGenerating.value = false
  }
}

function generateBatchStyleCardImage(templateStyle = '') {
  const text = (cardText.value || '').trim()
  if (!text) {
    message.warning('请先填写卡片文字')
    return
  }
  if (batchCardGenerating.value) return

  batchCardGenerating.value = true
  const worker = new Worker(
    new URL('../../workers/batchDirGen.worker.js', import.meta.url),
  )
  const finish = () => {
    batchCardGenerating.value = false
    worker.terminate()
  }
  worker.onmessage = (event) => {
    const result = event.data || {}
    if (result.type === 'single-card-image') {
      batchCardImageUrl.value = `data:image/png;base64,${result.base64}`
      if (templateStyle) cardTemplatePickerVisible.value = false
      finish()
    } else if (result.type === 'single-card-image-error') {
      message.error(result.message || '卡片图生成失败')
      finish()
    }
  }
  worker.onerror = (error) => {
    message.error(error?.message || '卡片图生成失败')
    finish()
  }
  worker.postMessage({ type: 'generate-card-image', text, templateStyle })
}

function openCardTemplatePicker() {
  if (!(cardText.value || '').trim()) {
    message.warning('请先填写卡片文字')
    return
  }
  cardTemplatePickerVisible.value = true
  loadCardTemplatePickerPreviews()
}

function loadCardTemplatePickerPreviews() {
  if (cardTemplatePickerLoading.value) return
  cardTemplatePickerLoading.value = true
  const worker = new Worker(
    new URL('../../workers/batchDirGen.worker.js', import.meta.url),
  )
  const finish = () => {
    cardTemplatePickerLoading.value = false
    worker.terminate()
  }
  worker.onmessage = (event) => {
    const result = event.data || {}
    if (result.type === 'card-template-previews') {
      cardTemplatePickerPreviews.value = result.previews || []
      if (selectedCardTemplateId.value && !cardTemplatePickerPreviews.value.some(item => item.id === selectedCardTemplateId.value)) {
        selectedCardTemplateId.value = ''
      }
      finish()
    } else if (result.type === 'card-template-preview-error') {
      message.error(result.message || '模板预览生成失败')
      finish()
    }
  }
  worker.onerror = (error) => {
    message.error(error?.message || '模板预览生成失败')
    finish()
  }
  worker.postMessage({
    type: 'preview-card-templates',
    sampleText: (cardText.value || '').trim(),
  })
}

function generateSelectedCardTemplate() {
  if (!selectedCardTemplateId.value) {
    message.warning('请选择一个卡片模板')
    return
  }
  generateBatchStyleCardImage(selectedCardTemplateId.value)
}

async function downloadBatchCardImage() {
  if (!batchCardImageUrl.value || batchCardDownloading.value) return
  batchCardDownloading.value = true
  try {
    const response = await fetch(batchCardImageUrl.value)
    const blob = await response.blob()
    triggerBlobDownload(blob, `card-${data.value.id || 'item'}.png`)
  } catch (e) {
    message.error(e.message || '下载失败')
  } finally {
    batchCardDownloading.value = false
  }
}

async function downloadCardImage() {
  const url = cardGeneratedImgUrl.value
  if (!url) return
  cardDownloading.value = true
  try {
    const blob = await processImageForDownload(url)
    triggerBlobDownload(blob, `card-poster-${data.value.id || 'img'}.jpg`)
  } catch {
    // CORS 场景：先代理到 R2 再处理
    try {
      const proxied = await proxyImageForDownload(url)
      const blob = await processImageForDownload(proxied.url)
      triggerBlobDownload(blob, `card-poster-${data.value.id || 'img'}.jpg`)
    } catch (e2) {
      message.error('下载失败：' + (e2.message || '未知'))
    }
  } finally {
    cardDownloading.value = false
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

const TITLE_POOL = [
  '碎片时间刷题',
  '通勤间隙悄悄提分',
  '课间摸鱼学考点',
  '短时备考效率拉满',
  '零散时间巧利用',
  '不用全天埋头苦学',
  '碎片化速记考点',
  '轻松挤出备考时长',
  '抽空学核心考点',
  '零基础也无备考压力',
  '碎片化速练题库',
  '不用整块时间复习',
  '日常碎片积累知识点',
  '备考毫不费力',
  '碎片时段专攻高频题',
  '低分快速逆袭',
  '通勤碎片化复盘',
  '日积月累稳提分',
  '碎片轻量化学习',
  '告别长时间苦读',
  '零碎时间攻克重难点',
  '备考省时省力',
  '碎片化记忆口诀',
  '背诵不用费大脑',
  '抽空梳理核心考点',
  '备考轻松无负担',
  '碎片化专项刷题',
  '零散时间冲高分',
  '利用碎片吃透考题',
  '零基础轻松备考',
  '考前全套复盘笔记',
  '避开九成考场失分坑',
  '考前易错考点合集',
  '进考场少丢冤枉分',
  '冲刺终极复盘清单',
  '高频错题一次性扫清',
  '考前梳理易混考点',
  '考场做题不再踩雷',
  '冲刺复盘核心难点',
  '规避各类答题误区',
  '考前错题集中复盘',
  '减少考场失误失分',
  '终极冲刺复盘手册',
  '直击全部易错题型',
  '考前汇总易丢分考点',
  '答题正确率飙升',
  '考前系统复盘重难点',
  '避开出题人陷阱',
  '冲刺专属复盘素材',
  '考场答题少走弯路',
  '考前梳理高频坑点',
  '做题不再频频出错',
  '全套考前复盘干货',
  '轻松规避答题漏洞',
  '冲刺复盘易混淆知识点',
  '做题思路清晰',
  '考前整理经典错题',
  '考场直接规避失分',
  '终极考前复盘攻略',
  '避开所有考题陷阱',
  '科学备考新思路',
  '告别无意义海量刷题',
  '精准锁定得分核心',
  '拒绝盲目题海战术',
  '高效备考底层心法',
  '刷题只刷必考题',
  '抓准核心得分考点',
  '不用盲目大量刷题',
  '备考精简学习思路',
  '摒弃低效重复刷题',
  '高分备考核心技巧',
  '精准拿捏采分要点',
  '高效提分学习逻辑',
  '不做无用刷题消耗',
  '直击试卷核心得分点',
  '告别盲目死刷题',
  '实用备考提分心法',
  '精准攻克必考题型',
  '精简高效复习方案',
  '拒绝无目标刷题',
  '找准考题得分命脉',
  '不用盲目刷整套卷',
  '高分备考实用思路',
  '刷题直击分值考点',
  '科学提分备考法则',
  '远离低效盲目刷题',
  '精准对标得分要点',
  '省去海量无用刷题',
  '备考极简高效心法',
  '刷题只练高频考题',
  '深挖历年真题套路',
  '摸透考官出题思路',
  '拆解真题底层逻辑',
  '一眼看透命题方向',
  '深度剖析历年真题',
  '掌握固定出题规律',
  '吃透真题核心套路',
  '考场答题举一反三',
  '逐道拆解真题考点',
  '摸清全部命题逻辑',
  '深挖真题隐藏考点',
  '精准预判考试题型',
  '研究历年真题规律',
  '读懂出题人侧重点',
  '吃透全套历年真题',
  '掌握稳定出题框架',
  '深度拆解真题题型',
  '抓住核心命题逻辑',
  '深挖真题答题思路',
  '轻松拿捏考试命题',
  '逐套剖析历年真题',
  '摸清每年出题走向',
  '吃透真题底层规律',
  '考场做题游刃有余',
  '深挖真题高频命题点',
  '精准预判考题走向',
  '拆解真题内在逻辑',
  '不用瞎猜考试重点',
  '深耕历年真题题库',
  '吃透整套命题思路',
  '分模块专项精准训练',
  '各科分数稳步上涨',
  '薄弱项针对性专项突破',
  '短板快速补齐',
  '分题型专项强化练习',
  '各科分值持续提升',
  '弱项专项集中攻克',
  '稳步拉高笔试总分',
  '分科专项精准刷题',
  '低分稳步冲到高分',
  '针对性攻克薄弱模块',
  '成绩持续稳步提升',
  '高频题型专项特训',
  '分值一路稳步上涨',
  '短板专项集中突破',
  '各科分数稳步提升',
  '分考点专项针对性练习',
  '笔试稳涨分',
  '重难点专项集中攻坚',
  '总分稳步往上走',
  '小白零基础上岸攻略',
  '拒绝长篇死记硬背',
  '零基础速成通关技巧',
  '背诵不用死磕书本',
  '纯小白懒人备考秘籍',
  '轻松一战顺利上岸',
  '零基础极简通关方法',
  '不用大量背诵记忆',
  '零基础速成提分套路',
  '告别枯燥死记硬背',
  '懒人专属上岸干货',
  '少背书也能稳通关',
  '零基础简易备考思路',
  '不用死背厚厚教材',
  '小白速成上岸心法',
  '轻松学习不用硬背',
  '零基础懒人通关指南',
  '短时复习顺利上岸',
  '零基础速通备考技巧',
  '摆脱死记硬背模式',
  '最新官方考情深度解读',
  '找准考试核心重点',
  '全新年度考情分析',
  '摸清每年分值侧重点',
  '最新考情完整拆解',
  '复习备考绝不走弯路',
  '年度考情全面剖析',
  '精准锁定高频考点',
  '全新考势完整解读',
  '避开无用复习内容',
  '最新考试趋势拆解',
  '备考精准直击重点',
  '深度解读本年度考情',
  '复习方向不跑偏',
  '最新考情完整梳理',
  '精准把握出题侧重点',
  '考前不用死啃教材',
  '吃透题库轻松通关',
  '临时备考不用背书',
  '刷透真题稳过笔试',
  '短期冲刺不用啃厚书',
  '专攻题库就够用',
  '考前无需通篇背书',
  '吃透题型轻松上岸',
  '懒人极简备考方案',
  '少背书多刷题稳过',
  '临时突击不用苦背书',
  '吃透考题轻松进面',
  '这套高频题库刷熟练',
  '考场答题少失分',
  '考前别盲目啃全书',
  '吃透核心题库足矣',
  '千万别纯裸考',
  '吃透核心考点轻松突围',
  '短期备考听劝',
  '少啃书本多刷真题',
  '刷完这套核心题库',
  '笔试高分稳稳拿捏',
  '拒绝盲目裸考',
  '吃透考题侧重点稳进面',
]

function generateTitle() {
  const companyName = data.value.company_name || ''
  const randomTitle = TITLE_POOL[Math.floor(Math.random() * TITLE_POOL.length)]
  const out = `${companyName}笔试，${randomTitle}`
  generatedTitle.value = out
  cardText.value = out
  message.success('标题生成成功')
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildWrittenExamConstraint() {
  const content = String(data.value.written_exam_content || '').trim()
  if (!content) {
    return [
      '【笔试内容约束】',
      '商品详情未填写明确的笔试内容，可按商品类型和参考文本的现有逻辑生成，但不要无依据写得过于具体。',
    ].join('\n')
  }
  return [
    '【笔试内容约束】',
    `商品详情里的笔试内容：${content}`,
    '生成内容必须严格围绕上述笔试内容展开；如果只写了某一科或某一类内容，就只写该范围。',
    '不要主动扩展到未出现的考试科目或模块。例如只写“公共基础/公共基础知识”时，不要写行测、申论、面试、专业知识等无关内容。',
  ].join('\n')
}

function appendWrittenExamConstraintToPrompt(prompt) {
  return [
    String(prompt || '').trim(),
    '',
    buildWrittenExamConstraint(),
    '【生图内容约束】图片里的文案、学习建议、科目名称、关键词和视觉元素都必须遵守上面的笔试内容约束；不要出现未标注的考试科目或模块。',
  ].filter(Boolean).join('\n')
}

function sanitizeCoverPromptText(text) {
  let result = String(text || '')
  const words = [...SENSITIVE_WORD_LIST].sort((a, b) => b.length - a.length)
  for (const word of words) {
    if (!word) continue
    result = result.split(word).join('')
  }
  return result
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/【】/g, '')
    .trim()
}

async function pickRandomCardPrompt() {
  const activeList = await fetchAvailableCardPrompts()
  return pickRandom(activeList)
}

async function fetchAvailableCardPrompts() {
  const pageSize = 100
  const fetchByJobType = async (jobTypeId) => {
    if (!jobTypeId) return []
    const res = await getCardPromptList({ job_type_id: jobTypeId, page: 1, pageSize })
    return Array.isArray(res?.list) ? res.list : []
  }

  let list = await fetchByJobType(data.value.job_type_id)
  if (!list.length) {
    const res = await getCardPromptList({ page: 1, pageSize })
    list = Array.isArray(res?.list) ? res.list : []
  }

  return list.filter(item => item && item.status !== 0 && String(item.content || '').trim())
}

async function loadCoverCardPrompts() {
  if (coverPromptOptionsLoading.value) return
  coverPromptOptionsLoading.value = true
  try {
    coverPromptOptions.value = await fetchAvailableCardPrompts()
    if (selectedCoverPromptId.value && !selectedCoverPrompt.value) {
      selectedCoverPromptId.value = null
    }
  } catch (e) {
    coverPromptOptions.value = []
    message.error(e.message || '提示词列表加载失败')
  } finally {
    coverPromptOptionsLoading.value = false
  }
}

function buildCoverPromptFromCardPrompt(cardPrompt) {
  const companyName = String(data.value.company_name || '').trim()
  const cardTextForCover = (cardText.value || generatedTitle.value || (companyName ? `${companyName}笔试` : data.value.title || '笔试资料')).trim()
  const promptContent = String(cardPrompt?.content || '').trim()

  return [
    '请根据单位名称生成小红书封面图。',
    '',
    `封面核心主题：${cardTextForCover}`,
    companyName ? `封面中必须突出单位名称：${companyName}` : '',
    '',
    '【选用的卡片提示词】',
    promptContent,
    '',
    '要求：直接按选用的卡片提示词风格出图，画面适合作为小红书封面，文字清晰醒目，竖版比例。',
  ].filter(Boolean).join('\n')
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
      buildWrittenExamConstraint(),
      `笔记标题：${generatedTitle.value || '（未生成，请围绕单位与商品类型自行展开）'}`,
      `参考来源：${sourceFrom}`,
      '',
      '请参考以下文本，紧扣"笔记标题"，重新润色撰写一条小红书笔记正文：',
      sourceText,
      '',
      '只输出正文本身，不要重复标题，不要任何额外说明。',
      '注意：正文中不得出现任何诱导性内容或引流内容（如"关注我"、"添加微信"、"点击链接"、"私信我"、"加群"等），只需聚焦内容本身。',
      '【硬性字数要求】正文总字数必须严格控制在200字以内，内容简洁精炼，宁可删减也不超字数，超过200字即视为不合格。',
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
      max_tokens: 800,
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

async function generateBodyFromTemplate(tpl) {
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
  templateModalVisible.value = false
  bodyGenerating.value = true
  try {
    const promptRes = await getPromptList({ scene: 'content', page: 1, pageSize: 1 })
    const promptItem = promptRes.list?.[0]
    if (!promptItem) {
      message.error('未找到「生成正文」场景的提示词')
      return
    }
    const userContent = [
      '以下是一段小红书正文模版，请严格保留其结构、分段方式和写作风格，',
      '将模版中的企业名称和考试内容替换为下方商品信息，重新创作一条全新的小红书正文。',
      '',
      '【参考模版】',
      tpl.content,
      '',
      '【商品信息】',
      `企业名称：${data.value.company_name || ''}`,
      `商品类型：${data.value.job_type_name || ''}`,
      buildWrittenExamConstraint(),
      `笔记标题：${generatedTitle.value || '（未生成，请围绕企业名称与笔试内容自行展开）'}`,
      '',
      '要求：只输出正文，不重复标题，不含任何引流内容（关注我、加微信、私信等），数字和表情符号的使用风格与模版保持一致。',
      '禁止使用网络口头禅或夸张感叹句，例如"谁懂啊家人们"、"后台被问麻了"、"救命"、"真的绷不住"等，语气保持实用、亲切即可。',
      '【硬性字数要求】正文总字数必须严格控制在200字以内，内容简洁精炼，宁可删减也不超字数，超过200字即视为不合格。',
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
      max_tokens: 800,
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

// ─── HTML图片生成（考情 / 冲刺 / 备考建议 / 强度） ────────────
const htmlImageVisible = ref(false)
const htmlImageInitType = ref('exam_info')
const noteImageSetVisible = ref(false)
const communityWorkerKeywords = ['社区工作者', '社区专职工作者', '社工岗', '社区招聘', '基层治理', '居委会', '社区工作']
const communityWorkerThemes = [
  'cw-theme-red',
  'cw-theme-blue',
  'cw-theme-green',
  'cw-theme-purple',
  'cw-theme-orange',
  'cw-theme-teal',
  'cw-theme-brown',
  'cw-theme-rose',
]
const communityMindMapThemes = [
  'cmm-theme-default',
  'cmm-theme-emerald',
  'cmm-theme-indigo',
  'cmm-theme-brown',
  'cmm-theme-ocean',
  'cmm-theme-cyan',
  'cmm-theme-wine',
  'cmm-theme-violet',
  'cmm-theme-olive',
  'cmm-theme-graphite',
  'cmm-theme-coral',
  'cmm-theme-pine',
]
const communityWorkerTemplates = [
  { label: '经典重点', value: 'cw-template-classic' },
  { label: '紧凑清单', value: 'cw-template-compact' },
  { label: '卡片分组', value: 'cw-template-card' },
  { label: '表格分割', value: 'cw-template-table' },
  { label: '细线档案', value: 'cw-template-outline' },
]
const communityWorkerTemplateOptions = [
  { label: '随机版式', value: 'random' },
  ...communityWorkerTemplates,
]

const isCommunityWorkerProduct = computed(() => {
  const d = data.value || {}
  const text = [
    d.job_type_name,
    d.title,
    d.company_name,
    d.written_exam_content,
    d.interview_content,
  ].filter(Boolean).join(' ')
  return communityWorkerKeywords.some(k => text.includes(k))
})

const communityImageMeta = computed(() => buildCommunityWorkerMeta(data.value || {}))
const communityWorkerPages = computed(() => buildCommunityWorkerPages(communityImageMeta.value, communityImageDrawer.contentSeed))
const communityMindMapPages = computed(() => buildCommunityMindMapPages(communityImageMeta.value, communityMindMapDrawer.contentSeed))
const communityMindMapPalette = computed(() => {
  const palettes = {
    'cmm-theme-default': { green: '#108460', red: '#d9372d' },
    'cmm-theme-emerald': { green: '#0f8a68', red: '#c94b36' },
    'cmm-theme-indigo': { green: '#16806d', red: '#d23a55' },
    'cmm-theme-brown': { green: '#2f7a55', red: '#c64132' },
    'cmm-theme-ocean': { green: '#0f7f91', red: '#d45536' },
    'cmm-theme-cyan': { green: '#109a8f', red: '#cf3d4f' },
    'cmm-theme-wine': { green: '#2f8a61', red: '#b92d4f' },
    'cmm-theme-violet': { green: '#2f8374', red: '#c43f6f' },
    'cmm-theme-olive': { green: '#6f7f2a', red: '#c95a2c' },
    'cmm-theme-graphite': { green: '#4f7d72', red: '#c7473f' },
    'cmm-theme-coral': { green: '#23876f', red: '#e05a45' },
    'cmm-theme-pine': { green: '#17715a', red: '#bd3b2f' },
  }
  return palettes[communityMindMapDrawer.theme] || palettes['cmm-theme-default']
})

function onImageMenuClick({ key }) {
  if (key === 'cover') {
    openExamCard()
  } else if (key === 'note_image_set') {
    noteImageSetVisible.value = true
  } else if (key === 'community_worker_set') {
    openCommunityWorkerImages()
  } else if (key === 'community_mind_map_set') {
    openCommunityMindMapImages()
  } else {
    htmlImageInitType.value = key
    htmlImageVisible.value = true
  }
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function extractRegionText(d) {
  const title = cleanText(d.title)
  const company = cleanText(d.company_name)
  const source = `${title} ${company}`
  const match = source.match(/(\d{4}年?)?([\u4e00-\u9fa5]{2,16}(?:省|市|区|县|旗|州|盟|开发区|经开区|高新区|街道|镇|乡))/)
  if (match?.[2]) return match[2].replace(/^年/, '')
  return company || title || '社区工作者'
}

function extractYearText(d) {
  const text = `${d.title || ''} ${d.written_exam_time || ''} ${d.apply_time || ''}`
  const match = text.match(/20\d{2}/)
  return match?.[0] || new Date().getFullYear()
}

function hasExamTopic(text, patterns) {
  return patterns.some(p => text.includes(p))
}

function buildCommunityWorkerMeta(d) {
  const examText = cleanText(d.written_exam_content || '')
  const allText = cleanText([d.title, d.company_name, d.job_type_name, d.written_exam_content, d.interview_content].filter(Boolean).join(' '))
  const region = extractRegionText(d)
  const year = extractYearText(d)
  const jobName = allText.includes('专职工作者') ? '社区专职工作者' : '社区工作者'
  const orgLine = `${region}`
  const recruitLine = d.recruit_count ? `招聘 ${d.recruit_count} 人` : '以公告岗位表为准'
  const timeLine = d.written_exam_time ? `笔试时间：${d.written_exam_time}` : (d.apply_time ? `报名时间：${d.apply_time}` : '考试时间以公告为准')
  const contentLine = examText || '综合知识、社会工作知识、能力素质与写作'
  const hasWriting = hasExamTopic(contentLine, ['写作', '作文', '公文', '申论', '应用文'])
  const hasSocWork = hasExamTopic(contentLine, ['社会工作', '社工', '社区', '基层治理'])
  const hasLaw = hasExamTopic(contentLine, ['法律', '民法典', '宪法', '法规', '法'])
  const hasAbility = hasExamTopic(contentLine, ['能力', '行测', '职业能力', '判断推理', '言语理解'])
  const modules = [
    '综合知识',
    hasSocWork ? '社会工作知识' : '社区工作知识',
    hasAbility ? '能力素质' : '能力测验',
    hasWriting ? '写作能力' : '应用写作',
  ]
  return { region, year, jobName, orgLine, recruitLine, timeLine, contentLine, modules, hasWriting, hasSocWork, hasLaw, hasAbility }
}

function blue(text) {
  return `<span class="cw-blue">${text}</span>`
}

function red(text) {
  return `<span class="cw-red">${text}</span>`
}

function pickCommunityWorkerTheme() {
  const idx = Math.floor(Math.random() * communityWorkerThemes.length)
  return communityWorkerThemes[idx] || 'cw-theme-red'
}

function pickCommunityMindMapTheme() {
  const idx = Math.floor(Math.random() * communityMindMapThemes.length)
  return communityMindMapThemes[idx] || 'cmm-theme-default'
}

function pickCommunityWorkerTemplate() {
  const idx = Math.floor(Math.random() * communityWorkerTemplates.length)
  return communityWorkerTemplates[idx]?.value || 'cw-template-classic'
}

function resolveCommunityWorkerTemplate() {
  return communityImageDrawer.template === 'random'
    ? pickCommunityWorkerTemplate()
    : (communityImageDrawer.template || 'cw-template-classic')
}

function hashCommunityWorkerText(value) {
  let hash = 2166136261
  const text = String(value || '')
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickCommunityWorkerVariant(seed, key, variants, ctx = {}) {
  if (!variants?.length) return []
  const idx = hashCommunityWorkerText(`${seed}:${key}`) % variants.length
  const picked = variants[idx]
  return typeof picked === 'function' ? picked(ctx) : picked
}

const communityWorkerOverviewVariants = {
  moduleLines: [
    [
      `政治理论 · 法律常识 · 经济科技人文 · ${blue('公文基础')}`,
      `概述 · 专业伦理与价值观 · ${blue('三大方法')}`,
      `言语理解 · 判断推理 · 沟通协调 · ${blue('应急处置')}`,
      `应用文写作 · 大作文 · ${blue('格式规范')}`,
    ],
    [
      `时政热点 · 法律基础 · 公共管理 · ${blue('市情区情')}`,
      `社工价值观 · 个案小组社区 · ${blue('实务流程')}`,
      `言语判断 · 资料分析 · 沟通表达 · ${blue('现场处置')}`,
      `通知报告 · 方案简报 · ${blue('议论文写作')}`,
    ],
    [
      `综合常识 · 基层治理 · 法治知识 · ${blue('公文规范')}`,
      `社会工作理论 · 服务伦理 · ${blue('三大直接方法')}`,
      `职业能力 · 群众沟通 · 矛盾协调 · ${blue('应急响应')}`,
      `应用文格式 · 写作素材 · ${blue('答题框架')}`,
    ],
  ],
  keys: [
    ({ safeRegion }) => [
      `■ 社会工作知识是拉分核心，${blue('三大方法 + 专业伦理')}反复过`,
      `■ 个案 = ${red('1对1')} · 小组 = ${red('多人互助')} · 社区 = ${red('整体介入')}，别搞混`,
      `■ 应用文写作是易拿分项，${blue('通知 · 请示 · 报告 · 函')}背模板稳拿分`,
      `■ 招考细则、岗位条件以${blue(safeRegion)}官方公告为准`,
    ],
    ({ safeRegion }) => [
      `■ 先把${blue('综合知识 + 社工知识')}框架搭牢，再做真题回填`,
      `■ 社区工作常考${red('居民自治、网格治理、矛盾调解')}，要能举例`,
      `■ 写作题优先保证${blue('格式、层次、对策')}，不要只堆口号`,
      `■ 地区信息以${blue(safeRegion)}公告和附件为准，避免记错条件`,
    ],
    ({ safeRegion }) => [
      `■ 复习顺序建议：${blue('法律常识 → 社工方法 → 能力题 → 写作')}`,
      `■ 专业伦理抓住${red('尊重、接纳、保密、自决')}几个关键词`,
      `■ 案例题按${blue('问题识别、依据分析、措施落地')}展开`,
      `■ ${blue(safeRegion)}岗位要求、时间节点以官方发布为准`,
    ],
  ],
}

const communityWorkerBlockLineVariants = {
  政治理论与时政: [
    ['党的创新理论与重要精神', '时事政治与最新会议精神', '基层治理、共同富裕重要论述'],
    ['最新会议精神与政策热点', '基层党建、群众路线与治理现代化', '共同富裕、民生服务相关表述'],
    ['政治理论基础与时政热点', '党和国家重大方针政策', '社区治理、公共服务高频表述'],
  ],
  法律常识: [
    [`宪法 · 民法典 · ${blue('城市居民委员会组织法')}`, '未成年人保护法 · 人民调解法', '治安管理处罚法 · 劳动法'],
    [`民法典社区场景 · ${blue('居委会组织法')}`, '人民调解、物业服务与邻里纠纷', '劳动就业、社会保障相关法规'],
    [`宪法基础 · ${blue('基层群众自治制度')}`, '婚姻家庭、侵权责任常见考点', '治安管理、未成年人保护常识'],
  ],
  经济科技人文: [
    ['基本经济制度与市场经济常识', '科技常识 · 生活常识', '历史文化 · 地理国情 · 区情市情'],
    ['经济常识、产业政策与民生热点', '科技生活、公共安全与生态环保', '历史人文、地理国情与地方概况'],
    ['市场经济基础与宏观政策', '常识判断中的科技、人文、生活知识', '省市区情、地方发展关键词'],
  ],
  公文基础知识: [
    ['公文的种类与格式要素', '行文规则 · 常见文种辨析', '事务文书：总结 · 简报 · 活动方案'],
    ['通知、报告、请示、函等文种', '标题、主送、正文、落款格式', '简报、总结、方案的结构要点'],
    ['法定公文与事务文书区分', '行文关系、语言规范与格式规范', '基层工作常用材料写作'],
  ],
  区情市情: [
    ({ safeRegion, safeRecruitLine, safeTimeLine }) => [`地区：${safeRegion}`, safeRecruitLine, safeTimeLine],
    ({ safeRegion, safeRecruitLine, safeTimeLine }) => [`报考地区：${safeRegion}`, `岗位信息：${safeRecruitLine}`, safeTimeLine],
    ({ safeRegion, safeRecruitLine, safeTimeLine }) => [`重点关注：${safeRegion}区情`, safeRecruitLine, safeTimeLine],
  ],
  社会工作概述: [
    [`专业助人活动，目标是${blue('助人自助')}`, '功能：预防 · 恢复 · 发展', '角色：服务提供者 · 支持者 · 倡导者'],
    [`核心目标：促进服务对象${blue('自助与发展')}`, '主要功能：救助、预防、发展', '常见角色：资源链接者、支持者、协调者'],
    [`以专业方法回应服务需求，强调${blue('助人自助')}`, '服务过程重视评估、介入与跟进', '工作角色包含倡导、支持、服务与管理'],
  ],
  专业价值观与伦理: [
    [`核心：尊重 · 接纳 · 个别化 · ${blue('保密')}`, '对服务对象、对同事、对机构的伦理', '伦理困境与处理原则'],
    [`尊重服务对象，兼顾${blue('自决与保密')}`, '处理多方关系时坚持专业边界', '遇到伦理冲突按原则排序判断'],
    [`价值基础：平等、接纳、尊严与${blue('个别化')}`, '保护隐私，避免标签化服务对象', '伦理困境看责任、风险与合法性'],
  ],
  社会工作理论: [
    ['系统理论与生态系统理论', `${blue('优势视角')}与增能（赋权）理论`, '危机干预 · 认知行为理论'],
    ['人在环境中、系统互动视角', `${blue('增能理论')}与优势视角常考`, '认知行为、危机介入与社会支持'],
    ['生态系统理论强调环境影响', `${blue('优势视角')}关注资源和潜能`, '危机干预重在及时稳定与支持'],
  ],
  人类行为与社会环境: [
    ['人生发展阶段与各阶段任务', '家庭 · 群体 · 组织 · 社区', '社会环境对个人行为的影响'],
    ['婴幼儿、青少年、中老年发展特点', '家庭系统、学校单位与社区环境', '个人行为与社会支持网络相关'],
    ['发展阶段、角色变化与需求差异', '微观到宏观环境层层影响', '社区资源会影响居民问题解决'],
  ],
  社会政策与法规: [
    ['社会救助 · 社会保险 · 社会福利', '老年人 · 未成年人 · 残疾人政策', '劳动就业 · 医疗卫生政策'],
    ['救助、养老、就业、医疗政策', '特殊群体保障与权益维护', '政策对象、申请条件、服务流程'],
    ['社会保障体系与民生政策', '儿童、老人、残疾人服务要点', '社区政策宣传与资源转介'],
  ],
  个案工作: [
    [`特点：${blue('一对一')} · 个性化服务`, '过程：接案→预估→计划→介入→评估→结案', '技巧：倾听 · 同理 · 澄清 · 面质'],
    [`服务形式强调${blue('一人一案')}`, '流程：建立关系、评估需求、制定计划', '技巧：共情、引导、反馈与资源链接'],
    [`针对个人或家庭问题开展${blue('个别化介入')}`, '重视专业关系、目标设定和跟踪评估', '常用会谈、支持、协调和转介技巧'],
  ],
  小组工作: [
    ['类型：教育 · 成长 · 支持 · 治疗', '小组动力与小组过程（五阶段）', '领导者角色与带领技巧'],
    ['常见类型：成长小组、支持小组、教育小组', '关注组员互动、规范形成与凝聚力', '带领者要促进参与、处理冲突'],
    ['以群体互动促进改变和成长', '准备期、开始期、中期、后期、结束期', '技巧包括破冰、讨论、反馈和总结'],
  ],
  社区工作: [
    [`三大模式：${blue('地区发展 · 社会策划 · 社区照顾')}`, '过程：社区分析 → 计划 → 动员 → 评估', '与居民自治、网格化治理相结合'],
    [`重点掌握${blue('社区分析、资源动员、居民参与')}`, '服务从需求调查到项目评估闭环', '结合议事协商、志愿服务和网格治理'],
    [`地区发展重参与，社会策划重方案，${blue('社区照顾')}重支持网络`, '常用方法：走访、访谈、会议、倡导', '目标是提升社区能力和居民参与'],
  ],
  高频提示: [
    [`${red('个案 = 1对1 · 小组 = 多人互助 · 社区 = 整体介入')}`, `社会工作行政、督导属${blue('间接方法')}，别混为一谈`],
    [`三大直接方法要按${red('对象范围')}区分`, `案例题先定问题，再写${blue('服务目标和介入措施')}`],
    [`看到居民、楼栋、社区资源，多半联想到${red('社区工作')}`, `看到一对一访谈和家庭问题，优先考虑${blue('个案工作')}`],
  ],
  基本职业能力: [
    ['言语理解与表达', '判断推理：图形 · 定义 · 类比 · 逻辑', '数量关系与资料分析'],
    ['阅读理解、语句排序与逻辑填空', '图形推理、定义判断、类比推理', '资料分析、简单计算与比较'],
    ['言语表达、判断推理、资料处理', '数量关系看速度和准确率', '题干关键词、选项排除要熟练'],
  ],
  沟通协调能力: [
    ['群众沟通与矛盾调解', '团队协作 · 资源链接整合', '倾听共情 · 表达说服'],
    ['群众诉求回应与情绪安抚', '跨部门协调、信息同步与跟进反馈', '先倾听再解释，先共情再处理'],
    ['沟通要讲事实、讲政策、讲方法', '协调资源时明确责任和时限', '处理分歧时重视换位思考'],
  ],
  应变与处置: [
    ['突发事件应对与应急响应流程', '现场处置 · 信息上报', '舆情感知与初步应对'],
    ['先稳现场，再核信息，再报流程', '突发矛盾、投诉舆情、公共安全', '注意依法依规和分级响应'],
    ['风险识别、快速研判、及时处置', '信息收集、上报、协同和复盘', '群众安抚与秩序维护同步推进'],
  ],
  心理素质: [
    ['抗压能力与情绪管理', '自我调适 · 积极心态', '服务意识 · 责任担当'],
    ['面对复杂群众工作保持耐心', '压力情境下稳定表达和判断', '岗位意识、纪律意识和担当意识'],
    ['耐心细致、情绪稳定、服务主动', '遇到冲突不激化、不回避', '在规则内解决问题、回应诉求'],
  ],
  答题要点: [
    [`案例分析按"${blue('定性 → 依据 → 措施')}"三步走`, `处置题${blue('分条作答')}、要点齐全`, '结合社工理念，体现"助人自助"'],
    [`作答要体现${blue('群众立场 + 依法处理')}`, '先写原则，再列步骤，最后补长效机制', `措施要有${red('主体、动作、结果')}`],
    ['案例题避免空泛表态，要写可执行动作', `高频词：${blue('走访、评估、协调、转介、反馈')}`, '结尾补复盘、宣传、制度完善'],
  ],
  应用文写作: [
    ['通知 · 请示 · 报告 · 函等法定文种', '工作总结 · 简报 · 活动方案', '格式：标题 · 主送 · 正文 · 落款'],
    ['通知、报告、请示、函重点区分', '方案、总结、简报常用于社区场景', '格式正确、语言简洁、事项明确'],
    ['应用文先判文种，再套结构', '主送、正文、落款、日期别遗漏', '正文按背景、事项、要求展开'],
  ],
  大作文: [
    [`立意紧扣${blue('基层治理 · 为民服务')}`, '结构：总—分—总，对策型框架', '素材：时政金句 · 社区治理案例'],
    [`主题常围绕${blue('群众工作、社区服务、基层治理')}`, '开头点题，中间分论点，结尾升华', '素材可用志愿服务、网格治理、协商议事'],
    [`观点要落到${blue('服务居民和解决问题')}`, '分论点建议并列清晰、句式统一', '对策写具体，避免只喊口号'],
  ],
  报考基本条件: [
    ['拥护党的领导，遵守法律法规', `年满 ${blue('18 周岁')}，具有中国国籍`, '学历以公告为准 · 身心健康'],
    ['政治素质、纪律意识和服务意识达标', `年龄、学历、户籍等以${blue('公告条件')}为准`, '岗位表、资格复审材料要逐项核对'],
    ['遵纪守法，具备岗位履职能力', `报考资格以${blue('公告和岗位表')}为准`, '学历、专业、年龄、地区条件需核验'],
  ],
  备考顺序: [
    ['先搭四大模块框架，通读讲义', `再专攻${blue('社会工作知识与写作')}`, '最后冲刺时政与省市区情'],
    [`先过${blue('综合知识和法律常识')}`, '中期刷社工方法与案例题', '临考整理错题、模板和区情'],
    ['基础阶段建框架，专项阶段抓高频', `冲刺阶段强化${blue('写作模板和真题复盘')}`, '考前回看公告、政策和地方信息'],
  ],
  资料与信息: [
    ({ safeRegion }) => [`以${blue(safeRegion)}官方渠道公告为准`, '招考细则、岗位表以公告附件为主', `${red('警惕非官方来源的"内部信息"')}`],
    ({ safeRegion }) => [`关注${blue(safeRegion)}人社、民政等官方发布`, '报名、缴费、准考证和笔试时间要复核', `${red('非官方承诺包过信息不要轻信')}`],
    ({ safeRegion }) => [`岗位条件以${blue(safeRegion)}公告原文为准`, '资料复习围绕公告科目和岗位要求', `${red('内部资料、押题承诺需谨慎甄别')}`],
  ],
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildCommunityWorkerPages(meta, seed = 0) {
  const modules = meta.modules
  const safeRegion = escapeHtml(meta.region)
  const safeRecruitLine = escapeHtml(meta.recruitLine)
  const safeTimeLine = escapeHtml(meta.timeLine)
  const variantCtx = { safeRegion, safeRecruitLine, safeTimeLine }
  const pages = [
    {
      no: 1,
      type: 'overview',
      title: `${meta.region}${meta.jobName}`,
      badge: '破局指南',
      subtitle: '笔试范围逐项拆解 · 6 张图讲透',
      modules,
      moduleLines: [
        `政治理论 · 法律常识 · 经济科技人文 · ${blue('公文基础')}`,
        `概述 · 专业伦理与价值观 · ${blue('三大方法')}`,
        `言语理解 · 判断推理 · 沟通协调 · ${blue('应急处置')}`,
        `应用文写作 · 大作文 · ${blue('格式规范')}`,
      ],
      timeline: [
        { title: '基础', text: '四大模块 搭建框架' },
        { title: '专项', text: '社工方法 实务突破' },
        { title: '冲刺', text: '写作模板 套题训练' },
        { title: '临考', text: '时政背诵 卷面打磨' },
      ],
      keys: [
        `■ 社会工作知识是拉分核心，${blue('三大方法 + 专业伦理')}反复过`,
        `■ 个案 = ${red('1对1')} · 小组 = ${red('多人互助')} · 社区 = ${red('整体介入')}，别搞混`,
        `■ 应用文写作是易拿分项，${blue('通知 · 请示 · 报告 · 函')}背模板稳拿分`,
        `■ 招考细则、岗位条件以${blue(safeRegion)}官方公告为准`,
      ],
      footer: '考点速记 + 真题题库',
    },
    {
      no: 2,
      title: '综合知识',
      subtitle: '笔试范围逐项拆解',
      blocks: [
        { label: '政治理论与时政', lines: ['党的创新理论与重要精神', '时事政治与最新会议精神', '基层治理、共同富裕重要论述'] },
        { label: '法律常识', lines: [`宪法 · 民法典 · ${blue('城市居民委员会组织法')}`, '未成年人保护法 · 人民调解法', '治安管理处罚法 · 劳动法'] },
        { label: '经济科技人文', lines: ['基本经济制度与市场经济常识', '科技常识 · 生活常识', `历史文化 · 地理国情 · ${safeRegion}区情`] },
        { label: '公文基础知识', lines: ['公文的种类与格式要素', '行文规则 · 常见文种辨析', '事务文书：总结 · 简报 · 活动方案'] },
        { label: '区情市情', lines: [`地区：${safeRegion}`, safeRecruitLine, safeTimeLine] },
      ],
      footer: '综合知识手册 + 公文模板',
    },
    {
      no: 3,
      title: '社会工作知识（上）',
      subtitle: '笔试范围逐项拆解',
      blocks: [
        { label: '社会工作概述', lines: [`专业助人活动，目标是${blue('助人自助')}`, '功能：预防 · 恢复 · 发展', '角色：服务提供者 · 支持者 · 倡导者'] },
        { label: '专业价值观与伦理', lines: [`核心：尊重 · 接纳 · 个别化 · ${blue('保密')}`, '对服务对象、对同事、对机构的伦理', '伦理困境与处理原则'] },
        { label: '社会工作理论', lines: ['系统理论与生态系统理论', `${blue('优势视角')}与增能（赋权）理论`, '危机干预 · 认知行为理论'] },
        { label: '人类行为与社会环境', lines: ['人生发展阶段与各阶段任务', '家庭 · 群体 · 组织 · 社区', '社会环境对个人行为的影响'] },
        { label: '社会政策与法规', lines: ['社会救助 · 社会保险 · 社会福利', '老年人 · 未成年人 · 残疾人政策', '劳动就业 · 医疗卫生政策'] },
      ],
      footer: '社工理论精讲 + 专业伦理速记',
    },
    {
      no: 4,
      title: '社会工作知识（下）',
      subtitle: '笔试范围逐项拆解',
      blocks: [
        { label: '个案工作', lines: [`特点：${blue('一对一')} · 个性化服务`, '过程：接案→预估→计划→介入→评估→结案', '技巧：倾听 · 同理 · 澄清 · 面质'] },
        { label: '小组工作', lines: ['类型：教育 · 成长 · 支持 · 治疗', '小组动力与小组过程（五阶段）', '领导者角色与带领技巧'] },
        { label: '社区工作', lines: [`三大模式：${blue('地区发展 · 社会策划 · 社区照顾')}`, '过程：社区分析 → 计划 → 动员 → 评估', '与居民自治、网格化治理相结合'] },
        { label: '高频提示', lines: [`${red('个案 = 1对1 · 小组 = 多人互助 · 社区 = 整体介入')}`, `社会工作行政、督导属${blue('间接方法')}，别混为一谈`] },
      ],
      footer: '三大方法真题 + 案例精讲',
    },
    {
      no: 5,
      title: '能力素质',
      subtitle: '笔试范围逐项拆解',
      blocks: [
        { label: '基本职业能力', lines: ['言语理解与表达', '判断推理：图形 · 定义 · 类比 · 逻辑', '数量关系与资料分析'] },
        { label: '沟通协调能力', lines: ['群众沟通与矛盾调解', '团队协作 · 资源链接整合', '倾听共情 · 表达说服'] },
        { label: '应变与处置', lines: ['突发事件应对与应急响应流程', '现场处置 · 信息上报', '舆情感知与初步应对'] },
        { label: '心理素质', lines: ['抗压能力与情绪管理', '自我调适 · 积极心态', '服务意识 · 责任担当'] },
        { label: '答题要点', lines: [`案例分析按"${blue('定性 → 依据 → 措施')}"三步走`, `处置题${blue('分条作答')}、要点齐全`, '结合社工理念，体现"助人自助"'] },
      ],
      footer: '能力题库 + 案例分析精讲',
    },
    {
      no: 6,
      title: '写作能力 · 划重点',
      subtitle: '笔试范围逐项拆解',
      blocks: [
        { label: '应用文写作', lines: ['通知 · 请示 · 报告 · 函等法定文种', '工作总结 · 简报 · 活动方案', '格式：标题 · 主送 · 正文 · 落款'] },
        { label: '大作文', lines: [`立意紧扣${blue('基层治理 · 为民服务')}`, '结构：总—分—总，对策型框架', '素材：时政金句 · 社区治理案例'] },
        { label: '报考基本条件', lines: ['拥护党的领导，遵守法律法规', `年满 ${blue('18 周岁')}，具有中国国籍`, '学历以公告为准 · 身心健康'] },
        { label: '备考顺序', lines: ['先搭四大模块框架，通读讲义', `再专攻${blue('社会工作知识与写作')}`, '最后冲刺时政与省市区情'] },
        { label: '资料与信息', lines: [`以${blue(safeRegion)}官方渠道公告为准`, '招考细则、岗位表以公告附件为主', `${red('警惕非官方来源的"内部信息"')}`] },
      ],
      footer: '写作模板 + 全套备考计划表',
    },
  ]
  return pages.map(page => {
    if (page.type === 'overview') {
      return {
        ...page,
        moduleLines: pickCommunityWorkerVariant(seed, 'overview-module-lines', communityWorkerOverviewVariants.moduleLines, variantCtx),
        keys: pickCommunityWorkerVariant(seed, 'overview-keys', communityWorkerOverviewVariants.keys, variantCtx),
      }
    }
    return {
      ...page,
      blocks: page.blocks.map(block => {
        const variants = communityWorkerBlockLineVariants[block.label]
        if (!variants) return block
        return {
          ...block,
          lines: pickCommunityWorkerVariant(seed, `${page.no}-${block.label}`, variants, variantCtx),
        }
      }),
    }
  })
}

function pickMindMapLines(seed, key, variants) {
  return pickCommunityWorkerVariant(seed, `mind-${key}`, variants)
}

function pickMindMapText(seed, key, variants) {
  return pickMindMapLines(seed, key, variants)?.[0] || variants?.[0] || ''
}

function pickMindMapItem(seed, key, variants) {
  return pickCommunityWorkerVariant(seed, `mind-${key}`, variants) || variants?.[0]
}

function buildMindMapNode(title, lines, x, y, tone = 'green') {
  return { title, lines, x, y, tone }
}

function buildMindMapBranchLines(nodes) {
  return nodes.map((node, idx) => {
    const endX = node.x + 150
    const endY = node.y
    const sideOffset = endX < 476 ? -90 : 90
    const lift = 38 + idx * 8
    return {
      d: `M476 104 C476 ${150 + lift} ${endX + sideOffset} ${Math.max(136, endY - 56)} ${endX} ${endY}`,
      tone: node.tone === 'red' ? 'red' : '',
    }
  })
}

function buildCommunityMindMapPages(meta, seed = 0) {
  const region = meta.region || '本地区'
  const cityText = `${meta.year}年${region} · 专职化城市社区工作者`
  const overviewPhases = pickMindMapItem(seed, 'overview-phases', [
    [
      { title: '① 基础期', text: '五大模块打框架' },
      { title: '② 专项期', text: '法律·公文·社区实务' },
      { title: '③ 冲刺期', text: '时政背诵 + 套题' },
      { title: '④ 临考', text: '错题回看 + 卷面' },
    ],
    [
      { title: '① 通读', text: '公告科目先拆清' },
      { title: '② 精刷', text: '社工·法律·党建' },
      { title: '③ 背诵', text: '时政区情集中记' },
      { title: '④ 模考', text: '限时训练稳节奏' },
    ],
    [
      { title: '① 建表', text: '知识点分类归档' },
      { title: '② 补弱', text: '错题模块逐项破' },
      { title: '③ 写作', text: '公文模板天天练' },
      { title: '④ 回看', text: '考前只抓高频点' },
    ],
  ])
  const overviewTags = pickMindMapItem(seed, 'overview-tags', [
    ['城市居民委员会组织法', '三会一课', '网格化管理', '共建共治共享', '五社联动', `${region}概况`, '公文写作'],
    ['居民自治', '基层党建', '社区服务', '人民调解', '时政热点', '岗位公告', '应用文写作'],
    ['居委会职责', '党员管理', '社区治理', '民生服务', '区情市情', '网格员职责', '真题复盘'],
  ])
  const pageTips = {
    public: pickMindMapItem(seed, 'tip-public', [
      { title: '公共基础重在广不在深', lines: ['法律 + 公文是提分重点'], tone: 'gold' },
      { title: '先抓高频再补细节', lines: ['法律常识、公文格式、区情信息'], tone: 'gold' },
      { title: '公共基础别平均用力', lines: ['公告科目 + 真题高频优先'], tone: 'gold' },
    ]),
    party: pickMindMapItem(seed, 'tip-party', [
      { title: '党建知识点 + 党章速记', lines: ['基层党组织、三会一课、纪律处分高频'], tone: 'gold' },
      { title: '党建题看关键词', lines: ['组织生活、党员发展、纪律处分'], tone: 'gold' },
      { title: '社区党建常结合案例', lines: ['党建引领、网格治理、居民自治'], tone: 'gold' },
    ]),
    politics: pickMindMapItem(seed, 'tip-politics', [
      { title: '时政月报 + 区情市情一页纸', lines: ['近一年热点、地方公告、重要会议'], tone: 'gold' },
      { title: '时政冲刺别铺太宽', lines: ['会议精神 + 本地区热点'], tone: 'gold' },
      { title: '地方信息最容易丢分', lines: ['公告、岗位表、官方新闻要核对'], tone: 'gold' },
    ]),
    practice: pickMindMapItem(seed, 'tip-practice', [
      { title: '高频考点提示', lines: ['① 居委会 = 自治组织，非政府机关', '② 街道办与居委会是指导关系'], tone: 'red' },
      { title: '实务题按流程作答', lines: ['① 识别问题 ② 对接资源 ③ 跟踪反馈'], tone: 'red' },
      { title: '社区场景要写具体', lines: ['走访、建档、调解、转介、复盘'], tone: 'red' },
    ]),
    build: pickMindMapItem(seed, 'tip-build', [
      { title: '备考三大重点', lines: ['① 党建 + 社区实务是核心', '② 公文写作 = 送分题，背模板', '③ 时政 + 区情考前集中突击'], tone: 'gold' },
      { title: '上岸复习节奏', lines: ['① 先框架 ② 再专项 ③ 最后真题', '每天留 20 分钟背时政区情'], tone: 'gold' },
      { title: '临考抓分项', lines: ['公文格式、社工方法、居委会法', '错题和模板比新题更重要'], tone: 'gold' },
    ]),
  }
  const footers = {
    overview: pickMindMapText(seed, 'footer-overview', ['思维导图 + 考点速记 + 题库', '模块拆解 + 高频考点 + 真题', '导图速记 + 冲刺清单 + 题库']),
    public: pickMindMapText(seed, 'footer-public', ['公共基础考点手册 + 公文模板', '法律常识 + 公文格式速记', '综合知识手册 + 真题题库']),
    party: pickMindMapText(seed, 'footer-party', ['党建知识点 + 党章速记', '基层党建速记 + 组织制度', '党务常识 + 高频判断题']),
    politics: pickMindMapText(seed, 'footer-politics', ['时政月报 + 区情市情一页纸', '近期时政 + 本地热点清单', '时政背诵表 + 区情速记']),
    practice: pickMindMapText(seed, 'footer-practice', ['社区实务真题 + 案例精讲', '居委会法 + 社区案例题', '实务流程 + 高频场景题']),
    build: pickMindMapText(seed, 'footer-build', ['全套备考计划表 + 真题模拟', '上岸时间线 + 模考题库', '冲刺计划 + 错题复盘表']),
  }
  return [
    {
      no: 1,
      type: 'overview',
      title: `${region}${meta.jobName}`,
      subtitle: '一张图看懂考什么 · 6 图拆到底',
      centerBadge: '5 大模块',
      summaryTitle: '5 大模块 · 逐项拆解',
      summaryText: pickMindMapText(seed, 'overview-summary', [
        '公共基础 ｜ 基层党建 ｜ 时事政治 ｜ 社区实务 ｜ 社区建设',
        '法律公文 ｜ 党建党务 ｜ 本地时政 ｜ 居民自治 ｜ 网格治理',
        '综合常识 ｜ 党务知识 ｜ 政策热点 ｜ 社区服务 ｜ 上岸规划',
      ]),
      nodes: [
        { title: '公共基础知识', text: pickMindMapLines(seed, 'ov-public', [['法律·经济·科技·公文'], ['法治常识·公文写作'], ['综合常识·区情市情']])[0], x: 4, y: 92, tone: 'green' },
        { title: '基层党建', text: pickMindMapLines(seed, 'ov-party', [['党的组织制度·党员管理'], ['基层党组织·党务常识'], ['党建引领·社区治理']])[0], x: 4, y: 248, tone: 'green' },
        { title: '时事政治', text: pickMindMapLines(seed, 'ov-politics', [['区情市情·时政热点'], ['近期时政·地方发展'], ['会议精神·热点政策']])[0], x: 4, y: 404, tone: 'green' },
        { title: '社区工作实务', text: pickMindMapLines(seed, 'ov-practice', [['居委会·自治·网格化'], ['服务群众·矛盾调解'], ['社区服务·居民自治']])[0], x: 660, y: 172, tone: 'blue' },
        { title: '社区建设', text: pickMindMapLines(seed, 'ov-build', [['治理格局·五社联动'], ['共建共治共享'], ['社区治理·协商议事']])[0], x: 660, y: 326, tone: 'blue' },
      ],
      phases: overviewPhases,
      tags: overviewTags,
      footer: footers.overview,
    },
    {
      no: 2,
      type: 'branch',
      title: '模块一 · 公共基础知识',
      subtitle: '思维导图拆解',
      root: '公共基础知识',
      nodes: [
        buildMindMapNode('法律常识', pickMindMapLines(seed, 'public-law', [
          ['宪法·民法典·劳动法', '人民调解法·未成年人保护', '居委会组织法必看'],
          ['民法典社区场景', '治安管理与人民调解', '基层群众自治制度'],
          ['宪法基础·民事责任', '婚姻家庭·物业纠纷', '居委会法新修订'],
        ]), 48, 160, 'green'),
        buildMindMapNode('公文写作', pickMindMapLines(seed, 'public-doc', [
          ['常用文种：通知·请示·报告·函', '工作总结·简报·活动方案', '格式规范·行文规则'],
          ['标题·主送·正文·落款', '通知报告请示重点区分', '社区场景材料写作'],
          ['法定公文与事务文书', '结构清楚·语言规范', '基层常用材料模板'],
        ]), 610, 255, 'blue'),
        buildMindMapNode('政治经济常识', pickMindMapLines(seed, 'public-economy', [
          ['基本经济制度·市场经济', '国情国力·时事经济数据'],
          ['宏观政策·民生热点', '公共管理与社会治理'],
          ['经济常识·产业政策', '基层治理相关政策表达'],
        ]), 48, 410, 'green'),
        buildMindMapNode('区情市情', pickMindMapLines(seed, 'public-region', [
          [`地区：${region}`, meta.recruitLine, meta.timeLine],
          [`关注${region}公告`, '岗位表与报考条件', '本地发展关键词'],
          [`${region}区情概况`, '官方公告与附件', '报名和笔试时间节点'],
        ]), 610, 570, 'blue'),
        buildMindMapNode('科技人文常识', pickMindMapLines(seed, 'public-human', [
          ['前沿科技·生活科技', '历史文化·地理环境', '安全常识·应急避险'],
          ['科技生活与公共安全', '人文历史和地理国情', '环保、卫生、应急常识'],
          ['常识判断高频素材', '科技、人文、生活知识', '地方文化与区域概况'],
        ]), 48, 670, 'green'),
      ],
      tip: pageTips.public,
      footer: footers.public,
    },
    {
      no: 3,
      type: 'branch',
      title: '模块二 · 基层党建',
      subtitle: '思维导图拆解',
      root: '基层党建',
      nodes: [
        buildMindMapNode('党的组织制度', pickMindMapLines(seed, 'party-org', [
          ['民主集中制·党的组织体系', '正式党员 3 人以上成立党支部', '党支部职责·支部委员会'],
          ['基层党组织设置与职责', '支部党员大会·支委会', '党小组和党课制度'],
          ['组织体系、组织生活、党员管理', '支部建设是高频考点', '社区党组织是领导核心'],
        ]), 48, 160, 'green'),
        buildMindMapNode('党建引领基层治理', pickMindMapLines(seed, 'party-govern', [
          ['社区党组织是领导核心', '区域化党建·联建共建', '网格党建·党员双报到'],
          ['党组织领导居民自治', '党建带社建、带群建', '红色物业、网格治理'],
          ['党建引领多方协同', '社区议事协商机制', '服务群众最后一公里'],
        ]), 610, 245, 'blue'),
        buildMindMapNode('党内政治生活', pickMindMapLines(seed, 'party-life', [
          ['三会一课：支部党员大会', '支部委员会·党小组会·党课', '主题党日·组织生活会'],
          ['民主评议党员', '谈心谈话与组织生活会', '党内政治生活制度化'],
          ['支部活动、党课学习', '党员教育管理监督', '组织生活要规范记录'],
        ]), 48, 405, 'green'),
        buildMindMapNode('党的六项纪律', pickMindMapLines(seed, 'party-discipline', [
          ['政治纪律·组织纪律·廉洁纪律', '群众纪律·工作纪律·生活纪律', '处分：警告到开除党籍'],
          ['纪律建设常见考点', '群众纪律和工作纪律易结合社区场景', '处分种类要记牢'],
          ['严明政治纪律和政治规矩', '廉洁自律、服务群众', '违规违纪处理流程'],
        ]), 610, 555, 'red'),
        buildMindMapNode('党员发展与权利', pickMindMapLines(seed, 'party-member', [
          ['申请→积极分子→发展对象', '预备党员（预备期 1 年）→转正', '党员八项义务·八项权利'],
          ['入党流程与预备党员管理', '党员权利义务对应记忆', '发展党员坚持标准'],
          ['党员教育、管理、监督和服务', '发展流程要按阶段记', '权利义务常出判断题'],
        ]), 48, 670, 'blue'),
      ],
      tip: pageTips.party,
      footer: footers.party,
    },
    {
      no: 4,
      type: 'branch',
      title: '模块三 · 时事政治',
      subtitle: '思维导图拆解',
      root: '时事政治',
      nodes: [
        buildMindMapNode('重要会议与精神', pickMindMapLines(seed, 'politics-meeting', [
          ['最新重要会议精神', '中央经济工作会议', '两会与政府工作报告'],
          ['近期重大会议原文', '政策关键词与民生表述', '基层治理相关论述'],
          ['全国两会、重要讲话', '会议主题和核心表述', '高频金句用于写作'],
        ]), 48, 160, 'green'),
        buildMindMapNode(`${region}热点`, pickMindMapLines(seed, 'politics-region', [
          [`关注${region}官方发布`, '本地新闻和民生工程', '基层治理、公共服务动态'],
          [`${region}区情市情热点`, '招聘公告中的岗位信息', '近期政策与项目建设'],
          [`${region}发展关键词`, '社区治理、民生服务', '官方渠道公告为准'],
        ]), 610, 245, 'blue'),
        buildMindMapNode('国家与区域战略', pickMindMapLines(seed, 'politics-strategy', [
          ['国家重大战略部署', '区域协调发展', '新型城镇化和基层治理'],
          ['现代化治理体系', '城乡社区服务体系建设', '公共服务均等化'],
          ['民生保障、公共安全', '数字治理、网格治理', '基层治理现代化'],
        ]), 48, 405, 'blue'),
        buildMindMapNode('备考冲刺建议', pickMindMapLines(seed, 'politics-sprint', [
          ['近一年时政要闻滚动复习', '本地新闻重点关注', '考前一周集中突击背诵'],
          ['按月份整理热点', '按主题归类会议精神', '写作可积累政策表述'],
          ['重要会议看标题和关键词', '地方时政看官方渠道', '易考热点做成速记卡'],
        ]), 610, 555, 'red'),
        buildMindMapNode('重大活动与政策', pickMindMapLines(seed, 'politics-policy', [
          ['民生工程·公共服务', '社区治理·网格化管理', '应急管理·安全生产'],
          ['就业、养老、托育、医疗', '城市更新与基层治理', '志愿服务和文明创建'],
          ['高频政策主题', '群众工作和社区服务', '公共管理案例素材'],
        ]), 48, 670, 'green'),
      ],
      tip: pageTips.politics,
      footer: footers.politics,
    },
    {
      no: 5,
      type: 'branch',
      title: '模块四 · 社区工作实务',
      subtitle: '思维导图拆解',
      root: '社区工作实务',
      nodes: [
        buildMindMapNode('法律依据（必背）', pickMindMapLines(seed, 'practice-law', [
          ['《城市居民委员会组织法》', '居委会性质：基层群众性自治组织', '每届任期 5 年·可连选连任'],
          ['居民会议和居民代表会议', '自治章程、居民公约', '居委会不得提供担保'],
          ['设立撤销与规模调整', '街道提出、政府批准', '主任为法定代表人'],
        ]), 48, 160, 'red'),
        buildMindMapNode('社区服务', pickMindMapLines(seed, 'practice-service', [
          ['公共服务·便民利民服务', '志愿服务·结对帮扶', '老年人·未成年人·残疾人关爱'],
          ['政策宣传、就业服务', '矛盾调解、困难帮扶', '资源链接与转介服务'],
          ['服务需求调查', '分类建档、精准帮扶', '跟进反馈与效果评估'],
        ]), 610, 245, 'blue'),
        buildMindMapNode('居民自治', pickMindMapLines(seed, 'practice-autonomy', [
          ['四个民主：选举·决策·管理·监督', '自我管理·自我教育', '自我服务·自我监督'],
          ['居民会议、居民代表会议', '议事协商、民主监督', '居民公约和自治章程'],
          ['群众参与是关键', '社区协商解决公共事务', '依法自治、公开透明'],
        ]), 48, 405, 'green'),
        buildMindMapNode('网格化管理', pickMindMapLines(seed, 'practice-grid', [
          ['网格划分·网格员职责', '信息采集·巡查走访上报', '矛盾纠纷排查·隐患上报'],
          ['一网统管、多网合一', '事件发现、派单、处置、反馈', '重点人员和重点场所管理'],
          ['党建引领网格治理', '群众诉求闭环办理', '信息台账动态更新'],
        ]), 610, 530, 'green'),
        buildMindMapNode('社区工作者职责', pickMindMapLines(seed, 'practice-duty', [
          ['宣传党的政策·联系服务群众', '办理公共事务·调解矛盾纠纷', '网格巡查·应急响应处置'],
          ['协助政府公共服务', '开展群众工作和居民服务', '维护社区秩序和公共安全'],
          ['政策宣传、民情收集', '服务代办、矛盾调处', '协同治理、应急处置'],
        ]), 48, 670, 'blue'),
      ],
      tip: pageTips.practice,
      footer: footers.practice,
    },
    {
      no: 6,
      type: 'branch',
      title: '模块五 · 社区建设与上岸',
      subtitle: '思维导图拆解',
      root: '社区建设',
      nodes: [
        buildMindMapNode('治理格局（必背）', pickMindMapLines(seed, 'build-pattern', [
          ['共建共治共享的社会治理格局', '党委领导·政府负责·民主协商', '社会协同·公众参与·法治保障'],
          ['党建引领、政府负责', '社会组织和居民共同参与', '法治、德治、自治融合'],
          ['基层治理现代化', '多元主体协同治理', '公共服务和社区自治结合'],
        ]), 48, 160, 'green'),
        buildMindMapNode('报考基本条件', pickMindMapLines(seed, 'build-condition', [
          ['拥护党的领导·遵纪守法', '年满 18 周岁·中国国籍', '学历要求以招考公告为准'],
          ['政治素质和服务意识', '年龄、学历、户籍看岗位表', '身体健康、无违法犯罪记录'],
          ['报考资格以公告为准', '岗位条件逐项核对', '资格复审材料提前准备'],
        ]), 610, 245, 'green'),
        buildMindMapNode('五社联动', pickMindMapLines(seed, 'build-five', [
          ['社区·社会组织·社会工作者', '社区志愿者·社会慈善资源', '由“三社联动”升级而来'],
          ['社区为平台、社工为支撑', '社会组织和志愿者参与', '慈善资源助力服务项目'],
          ['整合多方资源', '回应居民多元需求', '提升社区服务专业化'],
        ]), 48, 405, 'red'),
        buildMindMapNode('备考时间线', pickMindMapLines(seed, 'build-timeline', [
          ['基础期：五大模块打框架', '专项期：法律 + 公文 + 社区实务', '冲刺期：时政背诵 + 套题', '临考：错题回看 + 卷面训练'],
          ['先通读公告和科目', '再刷社工实务与法律题', '最后背时政、练写作模板'],
          ['第一轮建框架', '第二轮做专项', '第三轮套题冲刺', '考前回看错题和区情'],
        ]), 610, 520, 'blue'),
        buildMindMapNode('社会工作三大方法', pickMindMapLines(seed, 'build-methods', [
          ['个案工作（一对一服务）', '小组工作（互助成长）', '社区工作（介入社区）'],
          ['个案看个人和家庭', '小组看互动和成长', '社区看资源和居民参与'],
          ['直接方法高频考', '对象范围要区分', '案例题要能对应方法'],
        ]), 48, 670, 'blue'),
      ],
      tip: pageTips.build,
      footer: footers.build,
    },
  ].map(page => ({
    ...page,
    kicker: cityText,
    lines: page.type === 'branch' ? buildMindMapBranchLines(page.nodes) : page.lines,
  }))
}

function revokeCommunityWorkerImages() {
  communityImageDrawer.images.forEach(img => {
    if (img.blobUrl) URL.revokeObjectURL(img.blobUrl)
  })
  communityImageDrawer.images = []
}

function revokeCommunityMindMapImages() {
  communityMindMapDrawer.images.forEach(img => {
    if (img.blobUrl) URL.revokeObjectURL(img.blobUrl)
  })
  communityMindMapDrawer.images = []
}

onBeforeUnmount(revokeCommunityWorkerImages)
onBeforeUnmount(revokeCommunityMindMapImages)

function openCommunityWorkerImages() {
  if (!isCommunityWorkerProduct.value) {
    message.warning('当前商品类型未识别为社区工作者')
    return
  }
  if (!communityImageDrawer.images.length) {
    communityImageDrawer.theme = pickCommunityWorkerTheme()
    communityImageDrawer.activeTemplate = resolveCommunityWorkerTemplate()
    communityImageDrawer.contentSeed = Date.now()
  }
  communityImageDrawer.visible = true
}

async function generateCommunityWorkerImages() {
  communityImageDrawer.generating = true
  try {
    revokeCommunityWorkerImages()
    communityImageDrawer.theme = pickCommunityWorkerTheme()
    communityImageDrawer.activeTemplate = resolveCommunityWorkerTemplate()
    communityImageDrawer.contentSeed = Date.now() + Math.floor(Math.random() * 100000)
    await nextTick()
    const nodes = Array.from(document.querySelectorAll('[data-community-page]'))
    if (!nodes.length) throw new Error('未找到社区工作者模板节点')
    const results = []
    for (const node of nodes) {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: 1440,
        backgroundColor: '#ffffff',
        style: { transform: 'none' },
      })
      const blob = await (await fetch(dataUrl)).blob()
      results.push({ blob, blobUrl: URL.createObjectURL(blob) })
    }
    communityImageDrawer.images = results
    message.success(`已生成 ${results.length} 张社区工作者图文图片`)
  } catch (e) {
    message.error(e.message || '社区工作者图文图片生成失败')
  } finally {
    communityImageDrawer.generating = false
  }
}

async function downloadCommunityWorkerImage(idx) {
  const item = communityImageDrawer.images[idx]
  if (!item) return
  try {
    const blob = await processImageForDownload(item.blobUrl)
    triggerBlobDownload(blob, `社区工作者图文-${data.value.id || 'item'}-${idx + 1}.jpg`)
  } catch (e) {
    message.error(e.message || '下载失败')
  }
}

async function downloadCommunityWorkerImages() {
  communityImageDrawer.downloading = true
  try {
    for (let i = 0; i < communityImageDrawer.images.length; i++) {
      await downloadCommunityWorkerImage(i)
      await new Promise(resolve => setTimeout(resolve, 180))
    }
  } finally {
    communityImageDrawer.downloading = false
  }
}

function openCommunityMindMapImages() {
  if (!isCommunityWorkerProduct.value) {
    message.warning('当前商品类型未识别为社区工作者')
    return
  }
  if (!communityMindMapDrawer.images.length) {
    communityMindMapDrawer.theme = pickCommunityMindMapTheme()
    communityMindMapDrawer.contentSeed = Date.now()
  }
  communityMindMapDrawer.visible = true
}

async function generateCommunityMindMapImages() {
  communityMindMapDrawer.generating = true
  try {
    revokeCommunityMindMapImages()
    communityMindMapDrawer.theme = pickCommunityMindMapTheme()
    communityMindMapDrawer.contentSeed = Date.now() + Math.floor(Math.random() * 100000)
    await nextTick()
    const nodes = Array.from(document.querySelectorAll('[data-community-mind-page]'))
    if (!nodes.length) throw new Error('未找到社区工作者思维导图模板节点')
    const results = []
    for (const node of nodes) {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: 1440,
        backgroundColor: '#ffffff',
        style: { transform: 'none' },
      })
      const blob = await (await fetch(dataUrl)).blob()
      results.push({ blob, blobUrl: URL.createObjectURL(blob) })
    }
    communityMindMapDrawer.images = results
    message.success(`已生成 ${results.length} 张社区工作者思维导图图片`)
  } catch (e) {
    message.error(e.message || '社区工作者思维导图生成失败')
  } finally {
    communityMindMapDrawer.generating = false
  }
}

async function downloadCommunityMindMapImage(idx) {
  const item = communityMindMapDrawer.images[idx]
  if (!item) return
  try {
    const blob = await processImageForDownload(item.blobUrl)
    triggerBlobDownload(blob, `社区工作者思维导图-${data.value.id || 'item'}-${idx + 1}.jpg`)
  } catch (e) {
    message.error(e.message || '下载失败')
  }
}

async function downloadCommunityMindMapImages() {
  communityMindMapDrawer.downloading = true
  try {
    for (let i = 0; i < communityMindMapDrawer.images.length; i++) {
      await downloadCommunityMindMapImage(i)
      await new Promise(resolve => setTimeout(resolve, 180))
    }
  } finally {
    communityMindMapDrawer.downloading = false
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

// 背景图开关 + 图片池
const useBgImage = ref(false)
const bgImageLoading = ref(false)
const selectedBgImageUrl = ref('')
let bgImagePool = []

async function ensureBgImagePool() {
  if (bgImagePool.length) return
  try {
    const res = await getBgImageList()
    bgImagePool = (res.list || []).map(item => item.url).filter(Boolean)
  } catch { /* ignore */ }
}

function pickRandomBgImageUrl() {
  if (!bgImagePool.length) return ''
  return bgImagePool[Math.floor(Math.random() * bgImagePool.length)]
}

async function onUseBgImageChange(val) {
  if (!val) { selectedBgImageUrl.value = ''; return }
  bgImageLoading.value = true
  await ensureBgImagePool()
  selectedBgImageUrl.value = pickRandomBgImageUrl()
  bgImageLoading.value = false
  if (!selectedBgImageUrl.value) message.warning('背景图管理中暂无图片，请先上传')
}

async function rePickBgImage() {
  bgImageLoading.value = true
  await ensureBgImagePool()
  const current = selectedBgImageUrl.value
  if (bgImagePool.length > 1) {
    let next = current
    while (next === current) next = pickRandomBgImageUrl()
    selectedBgImageUrl.value = next
  } else {
    selectedBgImageUrl.value = pickRandomBgImageUrl()
  }
  bgImageLoading.value = false
}

function getActiveBgImageUrl() {
  return useBgImage.value ? (selectedBgImageUrl.value || null) : null
}

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
  titleY: null,  // 标题Y坐标（null=自动居中，可手动指定像素值覆盖）
  dirStyle: 'classic', // 目录图模板，默认保持原来的经典模板
  pdfSingleStyle: 'classic', // 单张 PDF 首页合成模板
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
  // PDF 拼图模式开关：打开后点击 PDF 文件弹出 4 页拼图预览抽屉
  pdfGridMode: false,
})

const DIR_IMAGE_STYLE_OPTIONS = [
  { value: 'classic', label: '经典原版' },
  { value: 'drive', label: '网盘窗口' },
  { value: 'sheet', label: '表格纸' },
  { value: 'table', label: '表格清单' },
  { value: 'checklist', label: '勾选清单' },
  { value: 'sticky', label: '便利贴' },
  { value: 'dark', label: '深色报告' },
  { value: 'magazine', label: '杂志分栏' },
  { value: 'soft', label: '柔和卡片' },
  { value: 'split', label: '左右分栏' },
  { value: 'terminal', label: '终端清单' },
  { value: 'blueprint', label: '蓝图网格' },
  { value: 'receipt', label: '小票清单' },
  { value: 'book', label: '书页目录' },
  { value: 'index', label: '索引目录' },
  { value: 'bubble', label: '气泡卡片' },
  { value: 'stamp', label: '红章资料' },
  { value: 'mint', label: '薄荷清单' },
  { value: 'calendar', label: '日历卡片' },
  { value: 'folder_wall', label: '文件夹墙' },
  { value: 'rainbow', label: '彩色卡片' },
  { value: 'outline', label: '竖线编号' },
  { value: 'cream', label: '奶油纸张' },
  { value: 'mono', label: '黑白极简' },
  { value: 'year_card', label: '大号序号卡片' },
  { value: 'timeline_card', label: '年份时间轴' },
  { value: 'ticket_card', label: '横向票据卡片' },
  { value: 'tag_card', label: '考试标签卡片' },
  { value: 'stagger_card', label: '左右错位卡片' },
  { value: 'grouped_card', label: '年份分组面板' },
  { value: 'border_card', label: '极简描边卡片' },
  { value: 'block_grid', label: '模块方格' },
  { value: 'ledger_table', label: '账本表格' },
  { value: 'folder_tabs_square', label: '文件夹标签' },
  { value: 'side_panel_square', label: '左右分栏方版' },
  { value: 'exam_checklist', label: '试卷清单' },
  { value: 'kanban_columns', label: '看板三栏' },
  { value: 'index_columns', label: '索引双列' },
  { value: 'stamp_blocks', label: '印章方块' },
  { value: 'barcode_list', label: '条码列表' },
  { value: 'calendar_grid_square', label: '日历宫格' },
  { value: 'blueprint_rect', label: '蓝图矩形' },
  { value: 'rank_board', label: '榜单排行' },
  { value: 'file_stack_square', label: '资料叠页' },
  { value: 'step_bars', label: '阶梯横条' },
  { value: 'block_overview', label: '方块总览' },
]
const DIR_IMAGE_STYLES = DIR_IMAGE_STYLE_OPTIONS.map(item => item.value)

const PDF_SINGLE_STYLE_OPTIONS = [
  { value: 'classic', label: '经典原版' },
  { value: 'folder', label: '资料夹风' },
  { value: 'desk', label: '桌面散页' },
  { value: 'stamp', label: '红章档案' },
  { value: 'split', label: '左右分栏' },
  { value: 'phone', label: '手机截图' },
  { value: 'blueprint', label: '蓝图分析' },
  { value: 'minimal', label: '极简白底' },
  { value: 'examRed', label: '考前红榜' },
  { value: 'fileStack', label: '文件堆叠' },
  { value: 'memoBoard', label: '备考便签墙' },
  { value: 'greenPlan', label: '绿色计划表' },
  { value: 'newspaper', label: '报纸头版' },
  { value: 'blackGold', label: '黑金冲刺' },
  { value: 'blueRibbon', label: '蓝色卷宗' },
  { value: 'pinkHighlighter', label: '荧光笔记' },
  { value: 'indexTabs', label: '索引标签' },
  { value: 'gridCard', label: '网格资料卡' },
  { value: 'clipboard', label: '夹板清单' },
  { value: 'lectureSlide', label: '课堂投影' },
  { value: 'ticket', label: '准考证票据' },
  { value: 'magazine', label: '杂志封面' },
  { value: 'focusRing', label: '聚焦放大' },
  { value: 'aurora', label: '极光渐变' },
  { value: 'lawPaper', label: '法律文书' },
  { value: 'sciLab', label: '实验记录' },
  { value: 'metro', label: '地铁导视' },
  { value: 'receiptLong', label: '长票据' },
  { value: 'glassLayer', label: '玻璃浮层' },
  { value: 'notebookBlue', label: '蓝线笔记' },
  { value: 'kraftSeal', label: '牛皮纸封蜡' },
  { value: 'radialFocus', label: '径向聚焦' },
  { value: 'purplePortal', label: '紫色门户' },
  { value: 'greenChalk', label: '黑板粉笔' },
  { value: 'windowDesk', label: '桌面窗口' },
  { value: 'archiveBox', label: '档案盒' },
  { value: 'orangeBurst', label: '橙色爆发' },
  { value: 'calmGray', label: '冷静灰阶' },
  { value: 'blueprintDark', label: '深蓝网格' },
  { value: 'foldedCorner', label: '折角文件' },
  { value: 'comicMarker', label: '手绘马克笔' },
  { value: 'sideCatalog', label: '侧边目录' },
  { value: 'redLedger', label: '红色账本' },
]
const PDF_SINGLE_STYLES = PDF_SINGLE_STYLE_OPTIONS.map(item => item.value)

// PDF 4页拼图预览抽屉状态
const pdfGridDrawer = reactive({
  visible: false,
  file: null,          // 当前选中的 PDF 文件 { name, path, fs_id }
  loading: false,
  gridUrl: '',         // 原始合成拼图 dataURL（无标题）
  displayUrl: '',      // 标题叠加后的预览 dataURL
  pageDataUrls: [],    // PDF 前 4 页截图，供自定义模式复排
  editMode: 'template', // 'template' | 'custom'
  blurAmount: 0,       // 模糊程度（px），0 = 不模糊
  // 标题覆层
  titleEnabled: true,  // 是否显示标题
  titleText: '',       // 标题文案（默认继承 dirDrawer.title）
  titleStyle: 'solidRed', // 文字样式预设
  titleX: 50,          // 自定义模式标题水平位置（百分比）
  titleY: 50,          // 垂直位置（百分比，0~100，50=居中）
  titleSize: 82,       // 字体大小（px，基于 1242px 画布）
  gridBorderColor: '#FF2D55', // 拼图外围边框颜色
  gridTemplate: 'classic', // PDF 拼图底图模版
  customItems: [],     // [{ src, x, y, w, h, baseW, baseH }]
  selectedItemIndex: 0,
  draggingType: '',
  dragOffsetX: 0,
  dragOffsetY: 0,
})
const pdfGridCanvasRef = ref(null)
const selectedPdfGridItemScale = computed(() => {
  const item = pdfGridDrawer.customItems[pdfGridDrawer.selectedItemIndex]
  return item?.baseW ? item.w / item.baseW : 1
})
const pdfGridImageCache = new Map()

// PDF 拼图底图模版列表（标题文案仍沿用 titleText/titleStyle/titleY/titleSize 逻辑）
const PDF_GRID_TEMPLATES = [
  { value: 'classic',   label: '经典四宫格' },
  { value: 'desk',      label: '错位桌面' },
  { value: 'folder',    label: '文件夹归档' },
  { value: 'phone',     label: '手机文档预览' },
  { value: 'mask',      label: '中央遮罩' },
  { value: 'waterfall', label: '长图瀑布' },
  { value: 'stamp',     label: '红章资料' },
  { value: 'checklist', label: '重点清单' },
  { value: 'blueprint', label: '蓝图分析' },
  { value: 'album',     label: '相册胶片' },
  { value: 'indexTabs', label: '彩色索引标签' },
  { value: 'newspaper', label: '报纸专栏' },
  { value: 'spiral',    label: '活页笔记本' },
  { value: 'chalkboard', label: '黑板讲解' },
  { value: 'binder',    label: '双页资料夹' },
  { value: 'polaroid',  label: '拍立得散页' },
  { value: 'blueCard',  label: '蓝色信息卡' },
  { value: 'sideNote',  label: '侧栏重点笔记' },
  { value: 'diagonal',  label: '斜切红条' },
  { value: 'pinboard',  label: '图钉公告板' },
  { value: 'darkReport', label: '深色报告板' },
  { value: 'cornerStamp', label: '角落红章' },
  { value: 'tornPaper', label: '撕纸资料页' },
  { value: 'softGradient', label: '柔和渐变卡' },
  { value: 'stackedFocus', label: '层叠重点页' },
  { value: 'minimalLine', label: '极简黑线版' },
]

// 标题样式预设列表
const PDF_TITLE_STYLES = [
  { value: 'shadow',    label: '✨ 白字阴影' },
  { value: 'pill',      label: '🏷️ 深底胶囊' },
  { value: 'stroke',    label: '🖋️ 描边字体' },
  { value: 'gradient',  label: '🌈 渐变暖色' },
  { value: 'card',      label: '📌 白底卡片' },
  { value: 'solidRed',  label: '🔴 红底白字' },
  { value: 'gradBg',    label: '🌅 彩底白字' },
  { value: 'stamp',     label: '🔖 印章红框' },
  { value: 'neon',      label: '💫 霓虹发光' },
]

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

function wrapDirText(ctx, text, maxWidth) {
  const lines = []
  let current = ''
  for (const ch of String(text || '')) {
    const next = current + ch
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function measureDirRows(files, maxWidth, fontSize = 17) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  return files.map(file => {
    const lines = wrapDirText(ctx, file.name, maxWidth)
    return { file, lines, height: Math.max(50, lines.length * (fontSize + 7) + 20) }
  })
}

function drawDirLines(ctx, lines, x, y, lineHeight, fontSize, blockSize = 10) {
  lines.forEach((line, i) => {
    const yy = y + i * lineHeight
    ctx.fillText(line, x, yy)
    _mosaicSensitiveInText(ctx, line, x, yy, fontSize, blockSize)
  })
}

function drawDirTemplateBg(ctx, W, H, style, borderColor, bgColor, bgOpacity) {
  if (style === 'drive') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#f7fbff'); grad.addColorStop(1, '#eef6ff')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  } else if (style === 'sheet') {
    ctx.fillStyle = '#fffefa'; ctx.fillRect(0, 0, W, H)
    drawGridBg(ctx, 0, 0, W, H, '#d8ecff', 0.45, 26)
  } else if (style === 'table') {
    ctx.fillStyle = '#18c38a'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffdfa'; ctx.fillRect(12, 12, W - 24, H - 24)
  } else if (style === 'checklist') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#f4fff9'); grad.addColorStop(1, '#ffffff')
    ctx.fillStyle = '#35c98a'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = grad; ctx.fillRect(12, 12, W - 24, H - 24)
  } else if (style === 'sticky') {
    ctx.fillStyle = '#fff8e8'; ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.45
    ctx.fillStyle = '#ffdd6c'; ctx.beginPath(); ctx.arc(W * 0.86, H * 0.12, 110, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ff96aa'; ctx.beginPath(); ctx.arc(W * 0.12, H * 0.86, 120, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  } else if (style === 'dark') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#111827'); grad.addColorStop(1, '#1f2937')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  } else if (style === 'magazine') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#ffe9ec'
    ctx.beginPath(); ctx.moveTo(W * 0.62, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.86, H); ctx.closePath(); ctx.fill()
  } else if (style === 'split') {
    ctx.fillStyle = '#fff7e6'; ctx.fillRect(0, 0, W * 0.36, H)
    ctx.fillStyle = '#eef7ff'; ctx.fillRect(W * 0.36, 0, W * 0.64, H)
  } else if (style === 'terminal') {
    ctx.fillStyle = '#101722'; ctx.fillRect(0, 0, W, H)
  } else if (style === 'blueprint') {
    ctx.fillStyle = '#123b66'; ctx.fillRect(0, 0, W, H)
    drawGridBg(ctx, 0, 0, W, H, '#ffffff', 0.12, 28)
  } else if (style === 'receipt') {
    ctx.fillStyle = '#f7f1e5'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffdf7'; ctx.beginPath(); ctx.roundRect(26, 24, W - 52, H - 48, 8); ctx.fill()
    ctx.setLineDash([8, 8]); ctx.strokeStyle = '#b7a98d'; ctx.stroke(); ctx.setLineDash([])
  } else if (style === 'book') {
    ctx.fillStyle = '#f4ead6'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(34, 24, W - 58, H - 48)
    ctx.fillStyle = '#b45309'; ctx.fillRect(34, 24, 14, H - 48)
  } else if (style === 'bubble') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.62
    ctx.fillStyle = '#dff7ff'; ctx.beginPath(); ctx.arc(W * 0.18, H * 0.14, 120, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffe2eb'; ctx.beginPath(); ctx.arc(W * 0.9, H * 0.15, 120, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  } else if (style === 'stamp') {
    ctx.fillStyle = '#de2f2f'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff8f8'; ctx.fillRect(12, 12, W - 24, H - 24)
  } else if (style === 'mint') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#eafff5'); grad.addColorStop(1, '#f8fffc')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  } else if (style === 'cream') {
    ctx.fillStyle = '#e8cfa7'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff8ed'; ctx.fillRect(12, 12, W - 24, H - 24)
  } else if (style === 'mono') {
    ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, W, H)
  } else if (style === 'index' || style === 'calendar' || style === 'folder_wall' || style === 'rainbow' || style === 'outline') {
    ctx.fillStyle = style === 'folder_wall' ? '#f8fafc' : '#ffffff'; ctx.fillRect(0, 0, W, H)
  } else {
    ctx.fillStyle = borderColor; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(10, 10, W - 20, H - 20)
    drawGridBg(ctx, 10, 10, W - 20, H - 20, bgColor, bgOpacity)
  }
}

function drawDirTemplateTitle(ctx, title, style, W, y) {
  const leftTitle = ['magazine', 'terminal', 'book', 'mono'].includes(style)
  ctx.textAlign = leftTitle ? 'left' : 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style === 'dark' ? '#ff6b6b'
    : style === 'terminal' ? '#78ffbd'
      : style === 'blueprint' ? '#ffffff'
        : style === 'mint' ? '#059669'
          : style === 'cream' ? '#8a4b18'
            : style === 'mono' ? '#111111'
              : '#ff0000'
  ctx.font = `bold ${leftTitle ? 32 : 34}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.fillText(title, leftTitle ? 40 : W / 2, y)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawDirTemplateIcon(ctx, file, style, x, y, size, index) {
  if (style === 'checklist' || style === 'outline') {
    ctx.fillStyle = style === 'outline' ? '#2f7cf6' : '#22c55e'
    ctx.beginPath(); ctx.roundRect(x, y, size, size, 8); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(size * 0.56)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(style === 'outline' ? String(index + 1) : '✓', x + size / 2, y + size / 2)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    return
  }
  if (style === 'terminal') {
    ctx.fillStyle = '#78ffbd'
    ctx.font = 'bold 18px ui-monospace, monospace'
    ctx.fillText('>', x, y + 20)
    return
  }
  if (['table', 'sheet', 'dark', 'soft', 'magazine', 'split', 'blueprint', 'receipt', 'book', 'index', 'bubble', 'stamp', 'mint', 'cream', 'mono'].includes(style)) {
    const badgeW = style === 'soft' ? size + 10 : 56
    ctx.fillStyle = ['blueprint', 'receipt', 'stamp', 'mono'].includes(style) ? 'transparent' : file.isdir === 1 ? '#f6aa22' : '#ff6470'
    ctx.beginPath(); ctx.roundRect(x, y, badgeW, Math.max(24, size - 2), 8); ctx.fill()
    if (['blueprint', 'receipt', 'stamp', 'mono'].includes(style)) {
      ctx.strokeStyle = style === 'blueprint' ? 'rgba(255,255,255,0.72)' : style === 'stamp' ? '#de2f2f' : '#333333'
      ctx.stroke()
    }
    ctx.fillStyle = style === 'blueprint' ? '#ffffff' : style === 'receipt' || style === 'mono' ? '#333333' : style === 'stamp' ? '#de2f2f' : '#fff'
    ctx.font = 'bold 12px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(style === 'soft' ? String(index + 1).padStart(2, '0') : (file.isdir === 1 ? '文件夹' : 'PDF'), x + badgeW / 2, y + Math.max(24, size - 2) / 2)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    return
  }
  file.isdir === 1 ? drawFolderIcon(ctx, x, y, size) : drawPdfIcon(ctx, x, y, size)
}

const SQUARE_DIR_STYLES = [
  'block_grid', 'ledger_table', 'folder_tabs_square', 'side_panel_square', 'exam_checklist',
  'kanban_columns', 'index_columns', 'stamp_blocks', 'barcode_list', 'calendar_grid_square',
  'blueprint_rect', 'rank_board', 'file_stack_square', 'step_bars', 'block_overview',
]

function getSquareDirHeight(style, count) {
  const n = Math.max(1, count)
  if (['block_grid', 'stamp_blocks', 'blueprint_rect'].includes(style)) return 168 + Math.ceil(n / 2) * 112
  if (['kanban_columns', 'calendar_grid_square', 'block_overview'].includes(style)) return 206 + Math.ceil(n / 3) * 124
  if (style === 'index_columns') return 172 + Math.ceil(n / 2) * 112
  if (style === 'ledger_table') return 206 + n * 66
  if (style === 'side_panel_square') return 210 + n * 72
  if (style === 'exam_checklist') return 198 + n * 68
  if (style === 'folder_tabs_square') return 188 + n * 76
  if (style === 'file_stack_square') return 206 + n * 66
  return 190 + n * 66
}

function drawSquareTitle(ctx, title, style) {
  const dark = style === 'blueprint_rect'
  const accentMap = {
    block_grid: '#2563eb', ledger_table: '#ea580c', folder_tabs_square: '#0f766e',
    side_panel_square: '#e11d48', exam_checklist: '#4f46e5', kanban_columns: '#14b8a6',
    index_columns: '#be123c', stamp_blocks: '#ca8a04', barcode_list: '#0f172a',
    calendar_grid_square: '#2563eb', blueprint_rect: '#38bdf8', rank_board: '#65a30d',
    file_stack_square: '#9333ea', step_bars: '#f97316', block_overview: '#0ea5e9',
  }
  ctx.fillStyle = dark ? '#f8fafc' : '#111827'
  ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(title, 42, 58)
  ctx.fillStyle = accentMap[style] || '#2563eb'
  ctx.fillRect(42, 92, 96, 8)
  ctx.textBaseline = 'alphabetic'
}

function squareDirText(ctx, text, maxWidth, x, y, lineHeight = 20, fontSize = 14, maxLines = 2) {
  const rawLines = wrapDirText(ctx, text, maxWidth)
  const lines = rawLines.slice(0, maxLines)
  if (rawLines.length > maxLines && lines.length) {
    let last = lines[lines.length - 1]
    while (last.length > 1 && ctx.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last}...`
  }
  drawDirLines(ctx, lines, x, y, lineHeight, fontSize, 9)
}

async function renderSquareDirComposite(files, title, bgImageUrl, style) {
  const DPR = 2
  const W = 600
  const H = getSquareDirHeight(style, files.length)
  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)
  if (bgImageUrl) {
    try {
      const bgImg = await loadImage(bgImageUrl)
      const scale = Math.max(W / bgImg.width, H / bgImg.height)
      const bw = bgImg.width * scale
      const bh = bgImg.height * scale
      ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.fillRect(0, 0, W, H)
    } catch {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, W, H)
    }
  } else {
    const bg = style === 'ledger_table' ? '#fff7ed' : style === 'exam_checklist' ? '#eef2ff' : style === 'index_columns' ? '#fff1f2'
      : style === 'stamp_blocks' ? '#fefce8' : style === 'calendar_grid_square' ? '#eff6ff' : style === 'blueprint_rect' ? '#0f172a'
        : style === 'rank_board' ? '#f7fee7' : style === 'file_stack_square' ? '#faf5ff' : style === 'step_bars' ? '#fff7ed' : '#f8fafc'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
  }
  if (style === 'blueprint_rect') drawGridBg(ctx, 42, 128, W - 84, H - 176, '#60a5fa', 0.2, 36)
  drawSquareTitle(ctx, title, style)
  ctx.lineWidth = 2

  const numbered = (num, x, y, w, h, color, r = 4) => {
    ctx.fillStyle = color
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 17px Arial, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(num).padStart(2, '0'), x + w / 2, y + h / 2)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  }

  if (style === 'ledger_table') {
    const x = 58, y = 132, w = 484, rowH = 66
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, rowH * (files.length + 1))
    ctx.strokeStyle = '#fed7aa'; ctx.strokeRect(x, y, w, rowH * (files.length + 1))
    ctx.fillStyle = '#ffedd5'; ctx.fillRect(x, y, w, rowH)
    ctx.fillStyle = '#111827'; ctx.font = 'bold 17px "PingFang SC", sans-serif'; ctx.fillText('序号', x + 42, y + 30); ctx.fillText('资料内容', x + 150, y + 30)
    files.forEach((file, i) => {
      const yy = y + rowH * (i + 1)
      ctx.strokeStyle = '#fed7aa'; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke()
      ctx.fillStyle = '#111827'; ctx.font = 'bold 18px Arial'; ctx.fillText(String(i + 1).padStart(2, '0'), x + 42, yy + 31)
      ctx.font = 'bold 16px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 318, x + 150, yy + 27, 21, 16)
    })
    ctx.beginPath(); ctx.moveTo(x + 106, y); ctx.lineTo(x + 106, y + rowH * (files.length + 1)); ctx.stroke()
  } else if (style === 'side_panel_square') {
    const x = 52, y = 132, panelW = 160, rowH = 72, totalH = rowH * files.length + 26
    ctx.fillStyle = '#111827'; ctx.fillRect(x, y, panelW, totalH)
    ctx.fillStyle = '#fff'; ctx.fillRect(x + panelW, y, 314, totalH)
    ctx.strokeStyle = '#e5e7eb'; ctx.strokeRect(x + panelW, y, 314, totalH)
    files.forEach((file, i) => {
      const yy = y + 20 + i * rowH
      numbered(i + 1, x + 42, yy - 12, 66, 32, i % 2 ? '#f43f5e' : '#fb7185', 4)
      ctx.fillStyle = '#ffe4e6'; ctx.fillRect(x + panelW + 40, yy - 8, 190, 6)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 16px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 270, x + panelW + 32, yy + 16, 21, 16)
    })
  } else if (style === 'exam_checklist') {
    const x = 96, y = 126, w = 408, rowH = 68
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, w, rowH * files.length + 44, 4); ctx.fill()
    ctx.strokeStyle = '#c7d2fe'; ctx.stroke()
    ctx.fillStyle = '#e0e7ff'; ctx.fillRect(x, y, w, 44)
    files.forEach((file, i) => {
      const yy = y + 62 + i * rowH
      ctx.strokeStyle = '#6366f1'; ctx.strokeRect(x + 32, yy - 24, 28, 28)
      ctx.beginPath(); ctx.moveTo(x + 38, yy - 10); ctx.lineTo(x + 46, yy - 2); ctx.lineTo(x + 58, yy - 20); ctx.stroke()
      ctx.fillStyle = '#111827'; ctx.font = 'bold 16px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 284, x + 82, yy - 8, 21, 16)
      ctx.strokeStyle = '#e0e7ff'; ctx.beginPath(); ctx.moveTo(x + 82, yy + 25); ctx.lineTo(x + 350, yy + 25); ctx.stroke()
    })
  } else if (style === 'kanban_columns') {
    const heads = [['真题', '#06b6d4', '#ecfeff'], ['考点', '#22c55e', '#f0fdf4'], ['冲刺', '#f97316', '#fff7ed']]
    heads.forEach(([h, c, bg], col) => {
      const x = 58 + col * 162
      ctx.fillStyle = bg; ctx.fillRect(x, 132, 136, H - 182)
      ctx.strokeStyle = '#d1d5db'; ctx.strokeRect(x, 132, 136, H - 182)
      ctx.fillStyle = c; ctx.fillRect(x, 132, 136, 42)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(h, x + 68, 160); ctx.textAlign = 'left'
    })
    files.forEach((file, i) => {
      const x = 70 + (i % 3) * 162, y = 198 + Math.floor(i / 3) * 118
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, 112, 88, 3); ctx.fill(); ctx.strokeStyle = '#e5e7eb'; ctx.stroke()
      ctx.fillStyle = '#111827'; ctx.font = 'bold 15px Arial'; ctx.fillText(String(i + 1).padStart(2, '0'), x + 16, y + 28)
      ctx.font = 'bold 14px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 82, x + 16, y + 52, 18, 14)
    })
  } else if (style === 'index_columns') {
    const colH = H - 198
    ctx.fillStyle = '#fff'; ctx.fillRect(58, 132, 216, colH); ctx.strokeStyle = '#fecdd3'; ctx.strokeRect(58, 132, 216, colH)
    ctx.fillStyle = '#fff'; ctx.fillRect(326, 132, 216, colH); ctx.strokeRect(326, 132, 216, colH)
    files.forEach((file, i) => {
      const x = i % 2 ? 344 : 76, y = 170 + Math.floor(i / 2) * 108
      numbered(i + 1, x, y - 24, 48, 42, '#be123c', 0)
      ctx.fillStyle = '#ffe4e6'; ctx.fillRect(x + 48, y - 24, 148, 62)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 14px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 116, x + 66, y - 2, 18, 14)
    })
  } else if (style === 'barcode_list') {
    files.forEach((file, i) => {
      const y = 130 + i * 66
      ctx.fillStyle = '#fff'; ctx.fillRect(58, y, 484, 52); ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(58, y, 484, 52)
      ctx.fillStyle = '#0f172a'; for (let b = 0; b < 8; b++) ctx.fillRect(78 + b * 6, y + 8, b % 2 ? 2 : 4, 18)
      numbered(i + 1, 164, y + 6, 48, 22, '#0f172a', 2)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 15px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 270, 242, y + 24, 20, 15)
    })
  } else if (style === 'rank_board' || style === 'step_bars') {
    files.forEach((file, i) => {
      const x = style === 'step_bars' ? 84 + i * 8 : 84
      const y = 130 + i * 66
      const w = style === 'rank_board' ? Math.max(300, 430 - i * 14) : 430
      const accent = style === 'rank_board' ? '#4d7c0f' : '#f97316'
      ctx.fillStyle = style === 'rank_board' ? (i % 2 ? '#d9f99d' : '#bef264') : (i % 2 ? '#fed7aa' : '#ffedd5')
      ctx.fillRect(x, y, w, 52)
      numbered(i + 1, x, y, 58, 52, accent, 0)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 15px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, w - 82, x + 82, y + 22, 20, 15)
    })
  } else if (style === 'file_stack_square') {
    files.forEach((file, i) => {
      const x = 72 + i * 10, y = 132 + i * 66
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 420, 58); ctx.strokeStyle = '#d8b4fe'; ctx.strokeRect(x, y, 420, 58)
      numbered(i + 1, x, y, 62, 58, i % 2 ? '#a855f7' : '#7e22ce', 0)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 15px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 318, x + 82, y + 25, 20, 15)
    })
  } else if (style === 'calendar_grid_square' || style === 'block_overview') {
    if (style === 'block_overview') {
      ctx.fillStyle = '#e0f2fe'; ctx.fillRect(58, 124, 484, 58)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 26px "PingFang SC", sans-serif'; ctx.fillText(`${files.length}份资料`, 84, 162)
    }
    files.forEach((file, i) => {
      const x = 58 + (i % 3) * 166, y = (style === 'block_overview' ? 212 : 140) + Math.floor(i / 3) * 116
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 134, 92); ctx.strokeStyle = style === 'calendar_grid_square' ? '#bfdbfe' : '#bae6fd'; ctx.strokeRect(x, y, 134, 92)
      numbered(i + 1, x + 14, y + 12, 36, 28, '#0ea5e9', 2)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 14px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 104, x + 14, y + 58, 17, 14)
    })
  } else {
    files.forEach((file, i) => {
      const gridLike = ['block_grid', 'stamp_blocks', 'blueprint_rect'].includes(style)
      const x = gridLike ? 66 + (i % 2) * 250 : 78 + (i % 2) * 250
      const y = gridLike ? 136 + Math.floor(i / 2) * 112 : 130 + i * 76
      const dark = style === 'blueprint_rect'
      const accent = style === 'block_grid' ? ['#2563eb', '#16a34a', '#f97316', '#dc2626', '#7c3aed', '#0891b2'][i % 6]
        : style === 'stamp_blocks' ? '#ca8a04' : style === 'folder_tabs_square' ? '#0f766e' : '#2563eb'
      if (style === 'folder_tabs_square') {
        ctx.fillStyle = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#ede9fe', '#cffafe'][i % 6]
        ctx.beginPath(); ctx.roundRect(58, 128 + i * 76, 120, 22, 4); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.fillRect(58, 146 + i * 76, 484, 56); ctx.strokeStyle = '#cbd5e1'; ctx.strokeRect(58, 146 + i * 76, 484, 56)
        numbered(i + 1, 82, 160 + i * 76, 38, 26, accent, 2)
        ctx.fillStyle = '#111827'; ctx.font = 'bold 15px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 350, 144, 170 + i * 76, 20, 15)
      } else {
        ctx.fillStyle = dark ? '#172554' : '#fff'; ctx.fillRect(x, y, 214, 88); ctx.strokeStyle = dark ? '#38bdf8' : style === 'stamp_blocks' ? '#ca8a04' : '#dbeafe'; ctx.strokeRect(x, y, 214, 88)
        numbered(i + 1, x, y, 62, 88, accent, 0)
        ctx.fillStyle = dark ? '#e0f2fe' : '#111827'; ctx.font = 'bold 14px "PingFang SC", sans-serif'; squareDirText(ctx, file.name, 130, x + 78, y + 35, 18, 14)
      }
    })
  }
  return canvas.toDataURL('image/png')
}

async function renderStyledCompositeImage(files, title, borderColor, bgColor, bgOpacity, bgImageUrl, titleY, style) {
  const DPR = 2
  const W = 600
  const activeStyle = DIR_IMAGE_STYLES.includes(style) ? style : 'classic'
  if (SQUARE_DIR_STYLES.includes(activeStyle)) {
    return renderSquareDirComposite(files, title, bgImageUrl, activeStyle)
  }
  const BORDER = bgImageUrl ? 0 : 0
  const infoCardStyles = ['year_card', 'timeline_card', 'ticket_card', 'tag_card', 'stagger_card', 'grouped_card', 'border_card']
  const gridStyles = ['sticky', 'calendar', 'folder_wall', 'rainbow', ...infoCardStyles]
  const PADDING = ['magazine', 'terminal', 'book', 'mono'].includes(activeStyle) ? 40 : 34
  const ICON_SIZE = activeStyle === 'drive' ? 30 : 32
  const BADGE_W = ['table', 'sheet', 'dark', 'magazine', 'split', 'blueprint', 'receipt', 'book', 'index', 'bubble', 'stamp', 'mint', 'cream', 'mono'].includes(activeStyle)
    ? 56
    : activeStyle === 'soft' ? ICON_SIZE + 10 : ICON_SIZE
  const ICON_TEXT_GAP = activeStyle === 'drive' ? 26 : 22
  const TITLE_H = activeStyle === 'split' ? 170 : ['magazine', 'terminal', 'book', 'mono'].includes(activeStyle) ? 118 : 102
  const textX = ['table', 'sheet', 'dark', 'split', 'blueprint', 'receipt', 'book', 'index', 'bubble', 'stamp', 'mint', 'cream', 'mono'].includes(activeStyle)
    ? BORDER + PADDING + (activeStyle === 'book' ? 154 : 130)
    : BORDER + PADDING + BADGE_W + ICON_TEXT_GAP
  const maxTextW = W - textX - PADDING - BORDER
  const fontSize = ['drive', 'table', 'sheet', 'dark', 'terminal', 'blueprint', 'mono'].includes(activeStyle) ? 18 : 17
  const rows = measureDirRows(files, maxTextW, fontSize)
  const rowGap = ['soft', 'checklist', 'bubble', 'mint'].includes(activeStyle) ? 14 : 0
  const measureCtx = document.createElement('canvas').getContext('2d')
  measureCtx.font = '600 15px "PingFang SC", "Microsoft YaHei", sans-serif'
  const infoCardW = (W - 84) / 2
  const infoCardRows = infoCardStyles.includes(activeStyle)
    ? files.map(file => wrapDirText(measureCtx, file.name, infoCardW - (activeStyle === 'year_card' ? 86 : 30)))
    : []
  const infoRowHeights = infoCardStyles.includes(activeStyle)
    ? Array.from({ length: Math.ceil(files.length / 2) }, (_, rowIndex) => {
        const maxLines = Math.max(infoCardRows[rowIndex * 2]?.length || 1, infoCardRows[rowIndex * 2 + 1]?.length || 1)
        const verticalSpace = activeStyle === 'year_card' ? 54 : 78
        return Math.max(108, maxLines * 22 + verticalSpace)
      })
    : []
  const gridCardH = activeStyle === 'calendar' || activeStyle === 'folder_wall' || activeStyle === 'rainbow' ? 128 : 126
  const bodyH = gridStyles.includes(activeStyle)
    ? infoCardStyles.includes(activeStyle) ? infoRowHeights.reduce((sum, height) => sum + height, 0) : Math.ceil(files.length / 2) * gridCardH
    : rows.reduce((sum, row) => sum + row.height + rowGap, 0)
  const H = BORDER + TITLE_H + bodyH + PADDING + BORDER + (activeStyle === 'drive' ? 44 : 0)
  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)

  if (bgImageUrl) {
    try {
      const bgImg = await loadImage(bgImageUrl)
      const scale = Math.max(W / bgImg.width, H / bgImg.height)
      const bw = bgImg.width * scale
      const bh = bgImg.height * scale
      ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
    } catch {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
    }
  } else {
    drawDirTemplateBg(ctx, W, H, activeStyle, borderColor, bgColor, bgOpacity)
  }

  drawDirTemplateTitle(ctx, title, activeStyle, W, titleY ?? (BORDER + TITLE_H / 2))
  if (activeStyle === 'drive') {
    const winX = BORDER + 20
    const winY = BORDER + 88
    const winW = W - BORDER * 2 - 40
    const winH = H - winY - 24
    ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.beginPath(); ctx.roundRect(winX, winY, winW, winH, 12); ctx.fill()
    ctx.strokeStyle = 'rgba(30,41,59,0.12)'; ctx.stroke()
    ctx.fillStyle = '#ff5f57'; ctx.beginPath(); ctx.arc(winX + 18, winY + 18, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffbd2e'; ctx.beginPath(); ctx.arc(winX + 34, winY + 18, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#28c840'; ctx.beginPath(); ctx.arc(winX + 50, winY + 18, 5, 0, Math.PI * 2); ctx.fill()
  }
  if (activeStyle === 'split') {
    ctx.fillStyle = '#9a4e00'
    ctx.font = 'bold 22px "PingFang SC", sans-serif'
    ctx.fillText('2026', 40, 126)
    ctx.fillText('备考资料包', 40, 154)
  }
  if (activeStyle === 'table' || activeStyle === 'dark') {
    const headerY = BORDER + TITLE_H - 18
    ctx.fillStyle = activeStyle === 'dark' ? 'rgba(255,255,255,0.1)' : '#243044'
    ctx.fillRect(BORDER + PADDING - 10, headerY, W - BORDER * 2 - PADDING * 2 + 20, 36)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "PingFang SC", sans-serif'
    ctx.fillText('序号', BORDER + PADDING, headerY + 23)
    ctx.fillText('类型', BORDER + PADDING + 58, headerY + 23)
    ctx.fillText('文件名称', textX, headerY + 23)
  }

  const listTop = BORDER + TITLE_H
  let y = listTop + (activeStyle === 'table' || activeStyle === 'dark' ? 24 : 0)
  const stickyColors = ['#fff3b0', '#d8f5ff', '#dff8d8', '#ffe0ea', '#eadfff', '#fff0d2', '#e7f7ed', '#f4e7ff']
  const rainbowColors = ['#fff1f0', '#e6f7ff', '#f6ffed', '#fff7e6', '#f9f0ff', '#e6fffb', '#fffbe6', '#f0f5ff']
  rows.forEach((row, i) => {
    const { file, lines, height } = row
    if (gridStyles.includes(activeStyle)) {
      const col = i % 2
      const cardW = (W - 84) / 2
      const cardX = 34 + col * (cardW + 16)
      const infoRow = Math.floor(i / 2)
      const cardY = infoCardStyles.includes(activeStyle)
        ? listTop + infoRowHeights.slice(0, infoRow).reduce((sum, value) => sum + value, 0) + (activeStyle === 'stagger_card' && col ? 12 : 0)
        : listTop + infoRow * gridCardH
      const cardH = infoCardStyles.includes(activeStyle) ? infoRowHeights[infoRow] - 16 : gridCardH - 22
      ctx.save()
      if (infoCardStyles.includes(activeStyle)) {
        const palette = ['#fff0f0', '#e7f6ff', '#f3fbea', '#fff6e5']
        const accent = ['#ff5d70', '#3e8edb', '#55a96b', '#e29a25'][i % 4]
        const yearMatch = String(file.name || '').match(/20\d{2}/)
        const year = yearMatch ? yearMatch[0] : String(i + 1).padStart(2, '0')
        if (activeStyle === 'timeline_card') {
          ctx.strokeStyle = '#d6dfeb'; ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(cardX + 26, cardY); ctx.lineTo(cardX + 26, cardY + cardH); ctx.stroke()
          ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cardX + 26, cardY + 28, 8, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = palette[i % palette.length]; ctx.beginPath(); ctx.roundRect(cardX + 46, cardY, cardW - 46, cardH, 14); ctx.fill()
          ctx.fillStyle = accent; ctx.font = 'bold 20px "PingFang SC", sans-serif'; ctx.fillText(year, cardX + 62, cardY + 30)
          ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
          drawDirLines(ctx, wrapDirText(ctx, file.name, cardW - 76), cardX + 62, cardY + 58, 22, 15)
        } else {
          ctx.fillStyle = activeStyle === 'border_card' ? '#ffffff' : palette[i % palette.length]
          ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, activeStyle === 'ticket_card' ? 4 : 16); ctx.fill()
          if (activeStyle === 'border_card') {
            ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke()
          }
          if (activeStyle === 'ticket_card') {
            ctx.fillStyle = accent; ctx.fillRect(cardX, cardY, 6, cardH)
          }
          if (activeStyle === 'year_card') {
            ctx.fillStyle = accent; ctx.font = 'bold 24px "PingFang SC", sans-serif'; ctx.fillText(String(i + 1).padStart(2, '0'), cardX + 14, cardY + 34)
            ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
            drawDirLines(ctx, wrapDirText(ctx, file.name, cardW - 86), cardX + 72, cardY + 29, 22, 15)
          } else {
            ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(cardX + 14, cardY + 13, activeStyle === 'grouped_card' ? 72 : 46, 25, 8); ctx.fill()
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "PingFang SC", sans-serif'; ctx.textAlign = 'center'
            ctx.fillText(activeStyle === 'grouped_card' ? `${year} 真题` : (file.isdir === 1 ? '文件夹' : 'PDF'), cardX + 14 + (activeStyle === 'grouped_card' ? 36 : 23), cardY + 30); ctx.textAlign = 'left'
            ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
            drawDirLines(ctx, wrapDirText(ctx, file.name, cardW - 28), cardX + 14, cardY + 62, 22, 15)
          }
        }
      } else if (activeStyle === 'sticky') {
        ctx.translate(cardX + cardW / 2, cardY + cardH / 2)
        ctx.rotate(i % 2 ? 0.012 : -0.012)
        ctx.fillStyle = stickyColors[i % stickyColors.length]
        ctx.beginPath(); ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 9); ctx.fill()
        ctx.fillStyle = '#243044'; ctx.font = '600 15px "PingFang SC", "Microsoft YaHei", sans-serif'
        drawDirLines(ctx, wrapDirText(ctx, file.name, cardW - 26), -cardW / 2 + 13, -18, 21, 15)
      } else if (activeStyle === 'calendar') {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill()
        ctx.strokeStyle = 'rgba(30,41,59,0.12)'; ctx.stroke()
        ctx.fillStyle = '#e92222'; ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, 30, 14); ctx.fill()
        ctx.fillRect(cardX, cardY + 16, cardW, 14)
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "PingFang SC", sans-serif'; ctx.fillText(`${String(i + 1).padStart(2, '0')} ${file.isdir === 1 ? '文件夹' : 'PDF'}`, cardX + 12, cardY + 20)
        ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
        drawDirLines(ctx, wrapDirText(ctx, file.name, cardW - 24), cardX + 12, cardY + 54, 21, 15)
      } else if (activeStyle === 'folder_wall') {
        ctx.fillStyle = '#fff7d6'
        ctx.beginPath(); ctx.roundRect(cardX, cardY + 10, cardW, cardH - 10, 18); ctx.fill()
        ctx.strokeStyle = '#f5d980'; ctx.stroke()
        ctx.fillStyle = '#ffe082'; ctx.beginPath(); ctx.roundRect(cardX + 18, cardY, 70, 22, 8); ctx.fill()
        ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
        drawDirLines(ctx, wrapDirText(ctx, file.name, cardW - 30), cardX + 15, cardY + 50, 21, 15)
      } else {
        ctx.fillStyle = rainbowColors[i % rainbowColors.length]
        ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill()
        ctx.fillStyle = file.isdir === 1 ? '#f6aa22' : '#ff6470'
        ctx.beginPath(); ctx.roundRect(cardX + 12, cardY + 12, 46, 24, 8); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(file.isdir === 1 ? '夹' : 'PDF', cardX + 35, cardY + 29); ctx.textAlign = 'left'
        ctx.fillStyle = '#202938'; ctx.font = '600 15px "PingFang SC", sans-serif'
        drawDirLines(ctx, wrapDirText(ctx, file.name, cardW - 30), cardX + 15, cardY + 60, 21, 15)
      }
      ctx.restore()
      return
    }
    if (['soft', 'checklist', 'bubble', 'mint'].includes(activeStyle)) {
      const x = BORDER + PADDING - 4
      const w = W - BORDER * 2 - PADDING * 2 + 8
      ctx.fillStyle = activeStyle === 'mint' ? '#ffffff' : activeStyle === 'bubble' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.78)'
      ctx.beginPath(); ctx.roundRect(x, y + 7, w, height - 8, activeStyle === 'bubble' ? 24 : 14); ctx.fill()
      if (activeStyle === 'mint') {
        ctx.fillStyle = '#10b981'; ctx.fillRect(x, y + 7, 6, height - 8)
      }
      ctx.strokeStyle = 'rgba(30,41,59,0.08)'; ctx.stroke()
    }
    if (activeStyle === 'outline' && i < rows.length - 1) {
      ctx.strokeStyle = 'rgba(30,41,59,0.15)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(BORDER + PADDING + 16, y + 32); ctx.lineTo(BORDER + PADDING + 16, y + height + rowGap + 20); ctx.stroke()
    }
    const tabularStyles = ['table', 'sheet', 'dark', 'split', 'blueprint', 'receipt', 'book', 'index', 'bubble', 'stamp', 'mint', 'cream', 'mono']
    const iconX = tabularStyles.includes(activeStyle) ? BORDER + PADDING + (activeStyle === 'book' ? 78 : 58) : BORDER + PADDING
    const noX = activeStyle === 'book' ? BORDER + PADDING + 24 : BORDER + PADDING
    if (tabularStyles.includes(activeStyle)) {
      ctx.fillStyle = activeStyle === 'dark' ? 'rgba(237,242,255,0.78)' : '#6c7482'
      ctx.font = 'bold 15px "PingFang SC", sans-serif'
      ctx.fillText(String(i + 1).padStart(2, '0'), noX, y + 34)
    }
    drawDirTemplateIcon(ctx, file, activeStyle, iconX, y + 15, ICON_SIZE, i)
    ctx.fillStyle = activeStyle === 'dark' || activeStyle === 'terminal' || activeStyle === 'blueprint' ? '#f8fbff' : activeStyle === 'cream' ? '#6f3f14' : '#333333'
    ctx.font = `${activeStyle === 'magazine' || activeStyle === 'terminal' ? '600' : '500'} ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    drawDirLines(ctx, lines, textX, y + 35, fontSize + 7, fontSize, 10)
    if (!['soft', 'checklist'].includes(activeStyle) && i < rows.length - 1) {
      ctx.strokeStyle = activeStyle === 'dark' || activeStyle === 'terminal' || activeStyle === 'blueprint' ? 'rgba(255,255,255,0.10)' : activeStyle === 'stamp' ? 'rgba(222,47,47,0.16)' : '#eeeeee'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(BORDER + PADDING, y + height); ctx.lineTo(W - BORDER - PADDING, y + height); ctx.stroke()
    }
    y += height + rowGap
  })
  return canvas.toDataURL('image/png')
}

function renderCompositeImage(files, title, borderColor, bgColor, bgOpacity, bgImageUrl = null, titleY = null, style = 'classic') {
  const activeStyle = DIR_IMAGE_STYLES.includes(style) ? style : 'classic'
  if (activeStyle !== 'classic') {
    return renderStyledCompositeImage(files, title, borderColor, bgColor, bgOpacity, bgImageUrl, titleY, activeStyle)
  }
  const DPR = 2
  const W = 600
  const BORDER = bgImageUrl ? 0 : 10
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

  if (bgImageUrl) {
    // 背景图模式：异步，返回 Promise
    return new Promise(async (resolve) => {
      try {
        const img = await loadImage(bgImageUrl)
        ctx.drawImage(img, 0, 0, W, H)
      } catch {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)
      }
      _drawCompositeContent(ctx, files, title, W, H, BORDER, PADDING, ICON_SIZE, ROW_H, TITLE_H, bgColor, bgOpacity, titleY)
      resolve(canvas.toDataURL('image/png'))
    })
  }

  // 普通模式：同步
  ctx.fillStyle = borderColor
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2)
  drawGridBg(ctx, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, bgColor, bgOpacity)
  _drawCompositeContent(ctx, files, title, W, H, BORDER, PADDING, ICON_SIZE, ROW_H, TITLE_H, bgColor, bgOpacity, titleY)
  return canvas.toDataURL('image/png')
}

function _drawCompositeContent(ctx, files, title, W, H, BORDER, PADDING, ICON_SIZE, ROW_H, TITLE_H, bgColor, bgOpacity, titleY = null) {
  // 标题
  ctx.fillStyle = '#FF0000'
  ctx.font = `bold 34px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, W / 2, titleY ?? (BORDER + TITLE_H / 2))
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
    // 自动遮盖敏感词（ctx 已 scale(DPR,DPR)，坐标/字号均为逻辑像素，blockSize=10 等效物理 20px）
    _mosaicSensitiveInText(ctx, name, BORDER + PADDING + ICON_SIZE + 12, y + ROW_H / 2 + 6, 15, 10)

    if (i < files.length - 1) {
      ctx.strokeStyle = '#f5f5f5'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(BORDER + PADDING, y + ROW_H)
      ctx.lineTo(W - BORDER - PADDING, y + ROW_H)
      ctx.stroke()
    }
  })
}

function refreshDirPreview() {
  if (!dirDrawer.files.length) return
  const bgImg = getActiveBgImageUrl()
  const usePdf = (dirDrawer.type === 'history' || dirDrawer.type === 'mock' || dirDrawer.type === 'custom' || dirDrawer.dirMode === 'culture')
    && dirDrawer.pdfPageDataUrl
    && !dirDrawer.dirOnly
  if (usePdf) {
    buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY, dirDrawer.pdfSingleStyle)
      .then(url => { dirDrawer.previewUrl = url })
  } else {
    const result = renderCompositeImage(dirDrawer.files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY, dirDrawer.dirStyle)
    if (result instanceof Promise) {
      result.then(url => { dirDrawer.previewUrl = url })
    } else {
      dirDrawer.previewUrl = result
    }
  }
}

// 新版：整图 1242×1656，外边框，顶部标题 + PDF 铺满 + 右下角目录浮层
async function buildHistoryComposite(pdfDataUrl, files, borderColor, title, bgColor, bgOpacity, bgImageUrl = null, titleY = null, style = 'classic') {
  const pdfImg = await loadImage(pdfDataUrl)

  const CANVAS_W = 1242
  const CANVAS_H = 1656
  const BORDER = bgImageUrl ? 0 : 12
  const TITLE_H = 120
  const activeStyle = PDF_SINGLE_STYLES.includes(style) ? style : 'classic'

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  if (activeStyle !== 'classic') {
    return renderStyledPdfSingleComposite(ctx, canvas, pdfImg, files, borderColor, title, bgColor, bgOpacity, bgImageUrl, titleY, activeStyle)
  }

  if (bgImageUrl) {
    try {
      const bgImg = await loadImage(bgImageUrl)
      ctx.drawImage(bgImg, 0, 0, CANVAS_W, CANVAS_H)
    } catch {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }
  } else {
    ctx.fillStyle = borderColor
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    const innerX = BORDER, innerY = BORDER
    const innerW = CANVAS_W - BORDER * 2, innerH = CANVAS_H - BORDER * 2
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(innerX, innerY, innerW, innerH)
    drawGridBg(ctx, innerX, innerY, innerW, innerH, bgColor, bgOpacity, 36)
  }

  const innerX = BORDER, innerY = BORDER
  const innerW = CANVAS_W - BORDER * 2, innerH = CANVAS_H - BORDER * 2

  // === 标题（红色加粗，居中）===
  ctx.fillStyle = '#FF0000'
  const fontSize = Math.round(TITLE_H * 0.5)
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, CANVAS_W / 2, titleY ?? (innerY + TITLE_H / 2))
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
    // 自动遮盖敏感词（此处无 DPR 缩放，坐标为物理像素，blockSize=12）
    _mosaicSensitiveInText(ctx, file.name, overlayX + OVERLAY_PAD + ICON_SIZE + 10, y + ROW_H / 2 + 6, FONT_SIZE, 12)

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

async function renderStyledPdfSingleComposite(ctx, canvas, pdfImg, files, borderColor, title, bgColor, bgOpacity, bgImageUrl, titleY, style) {
  const CANVAS_W = canvas.width
  const CANVAS_H = canvas.height
  const pdfFiles = files.filter(f => f.isdir === 0)
  const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

  const drawBg = async (fill, border = null) => {
    if (bgImageUrl) {
      try {
        const bgImg = await loadImage(bgImageUrl)
        ctx.drawImage(bgImg, 0, 0, CANVAS_W, CANVAS_H)
        return
      } catch {}
    }
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    if (border) {
      ctx.strokeStyle = border
      ctx.lineWidth = 12
      ctx.strokeRect(6, 6, CANVAS_W - 12, CANVAS_H - 12)
    }
  }

  const drawTitle = (x, y, color = '#FF0000', size = 58, align = 'center') => {
    ctx.fillStyle = color
    ctx.font = `bold ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillText(title, x, titleY ?? y)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  const drawPdfPage = (rect, options = {}) => {
    const { x, y, w, h, r = 16, rotate = 0, shadow = true, fit = 'contain', crop = true } = rect
    const cx = x + w / 2
    const cy = y + h / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotate * Math.PI / 180)
    if (shadow) {
      ctx.shadowColor = options.shadowColor || 'rgba(0,0,0,0.22)'
      ctx.shadowBlur = options.shadowBlur ?? 18
      ctx.shadowOffsetY = options.shadowOffsetY ?? 8
    }
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, r)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, r)
    ctx.clip()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(-w / 2, -h / 2, w, h)
    const cropL = crop ? rndInt(20, 60) : 0
    const cropR = crop ? rndInt(20, 60) : 0
    const cropT = crop ? rndInt(20, 60) : 0
    const cropB = crop ? rndInt(20, 60) : 0
    const srcX = cropL
    const srcY = cropT
    const srcW = Math.max(1, pdfImg.width - cropL - cropR)
    const srcH = Math.max(1, pdfImg.height - cropT - cropB)
    const scale = fit === 'cover' ? Math.max(w / srcW, h / srcH) : Math.min(w / srcW, h / srcH)
    const dw = srcW * scale
    const dh = srcH * scale
    ctx.drawImage(pdfImg, srcX, srcY, srcW, srcH, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }

  const drawFileOverlay = (x, y, opts = {}) => {
    const fontSize = opts.fontSize || 24
    const rowH = opts.rowH || 76
    const iconSize = opts.iconSize || 40
    const pad = opts.pad || 24
    const maxW = opts.width || 560
    const bg = opts.bg || '#ffffff'
    const textColor = opts.textColor || '#333333'
    const border = opts.border || 'rgba(0,0,0,0.06)'
    ctx.save()
    ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    const measured = pdfFiles.reduce((max, f) => Math.max(max, ctx.measureText(f.name).width), 0)
    const w = opts.width || Math.max(430, Math.min(maxW, Math.ceil(measured) + iconSize + pad * 2 + 16))
    const maxTextWidth = Math.max(120, w - pad * 2 - iconSize - 14)
    const rows = pdfFiles.map(file => {
      const lines = wrapDirText(ctx, file.name, maxTextWidth)
      return {
        file,
        lines,
        height: Math.max(rowH, lines.length * (fontSize + 8) + 22),
      }
    })
    const h = rows.reduce((sum, row) => sum + row.height, 0) + pad * 2
    x = Math.min(Math.max(24, x), CANVAS_W - w - 24)
    y = Math.min(Math.max(24, y), CANVAS_H - h - 24)
    const textX = x + pad + iconSize + 14
    ctx.shadowColor = opts.shadow === false ? 'transparent' : 'rgba(0,0,0,0.24)'
    ctx.shadowBlur = opts.shadow === false ? 0 : 18
    ctx.shadowOffsetY = opts.shadow === false ? 0 : 6
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, opts.radius || 14)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    ctx.stroke()
    let cursorY = y + pad
    rows.forEach((row, i) => {
      const { file, lines, height } = row
      const yy = cursorY
      drawPdfIcon(ctx, x + pad, yy + (rowH - iconSize) / 2, iconSize)
      ctx.fillStyle = textColor
      ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
      drawDirLines(ctx, lines, textX, yy + Math.max(fontSize + 8, (height - lines.length * (fontSize + 8)) / 2 + fontSize), fontSize + 8, fontSize, 12)
      if (i < rows.length - 1) {
        ctx.strokeStyle = opts.line || '#eeeeee'
        ctx.beginPath()
        ctx.moveTo(x + pad, yy + height)
        ctx.lineTo(x + w - pad, yy + height)
        ctx.stroke()
      }
      cursorY += height
    })
    ctx.restore()
    return { w, h }
  }

  const drawPlainText = (text, x, y, color = '#111827', size = 34, weight = 'bold', align = 'left') => {
    ctx.fillStyle = color
    ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  const drawStyleFrame = (accent, alpha = 0.48, lineWidth = 4) => {
    ctx.save()
    ctx.strokeStyle = accent
    ctx.globalAlpha = alpha
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.roundRect(58, 58, CANVAS_W - 116, CANVAS_H - 116, 34)
    ctx.stroke()
    ctx.restore()
  }

  const drawPlanLabel = (label, x, y, accent, color = '#ffffff') => {
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(x, y, 184, 46, 23)
    ctx.fill()
    drawPlainText(label, x + 92, y + 23, color, 22, 'bold', 'center')
  }

  if (style === 'examRed') {
    await drawBg('#fff8f5')
    drawStyleFrame('#d71920', 0.95, 12)
    ctx.fillStyle = '#ffebe8'; ctx.beginPath(); ctx.arc(1030, 188, 120, 0, Math.PI * 2); ctx.fill()
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 246, y: 300, w: 730, h: 900, r: 20 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
    drawPlanLabel('考前急救', 76, 1450, '#f7caca', '#d71920')
  } else if (style === 'fileStack') {
    await drawBg('#f7fbff')
    drawStyleFrame('#60a5fa', 0.6)
    ctx.fillStyle = '#dbeafe'; ctx.beginPath(); ctx.arc(1030, 188, 116, 0, Math.PI * 2); ctx.fill()
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 340, y: 270, w: 700, h: 880, r: 18, rotate: -8 })
    drawPdfPage({ x: 312, y: 295, w: 700, h: 880, r: 18, rotate: -4 })
    drawPdfPage({ x: 286, y: 318, w: 700, h: 880, r: 18, rotate: -3 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'memoBoard') {
    await drawBg('#fffaf0')
    drawStyleFrame('#f59e0b', 0.55)
    ctx.fillStyle = '#fde68a'; ctx.save(); ctx.translate(84, 250); ctx.rotate(-0.14); ctx.beginPath(); ctx.roundRect(0, 0, 180, 150, 12); ctx.fill(); ctx.restore()
    ctx.fillStyle = '#bfdbfe'; ctx.save(); ctx.translate(936, 145); ctx.rotate(0.12); ctx.beginPath(); ctx.roundRect(0, 0, 170, 126, 12); ctx.fill(); ctx.restore()
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 302, y: 342, w: 660, h: 850, r: 20, rotate: 3 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'greenPlan') {
    await drawBg('#f1fbf5')
    drawStyleFrame('#22c55e', 0.46)
    ctx.fillStyle = '#dcfce7'; ctx.beginPath(); ctx.arc(1030, 188, 120, 0, Math.PI * 2); ctx.fill()
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 226, y: 306, w: 690, h: 910, r: 18 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'newspaper') {
    await drawBg('#f8f5ef')
    drawTitle(92, 180, '#111827', 52, 'left')
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(92, 232); ctx.lineTo(1150, 232); ctx.stroke()
    drawPdfPage({ x: 296, y: 330, w: 650, h: 870, r: 8, shadow: false })
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(296, 330, 650, 870)
    drawFileOverlay(650, 1126, { width: 520, fontSize: 20, rowH: 60 })
  } else if (style === 'blackGold') {
    await drawBg('#111111')
    drawStyleFrame('#d4af37', 0.65)
    ctx.fillStyle = 'rgba(212,175,55,0.18)'; ctx.beginPath(); ctx.arc(1020, 180, 92, 0, Math.PI * 2); ctx.fill()
    drawTitle(92, 180, '#ffffff', 52, 'left')
    drawPdfPage({ x: 286, y: 328, w: 690, h: 890, r: 20, rotate: -2 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'blueRibbon') {
    await drawBg('#eff6ff')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#0f4c81', 0.08, 44)
    drawStyleFrame('#0f4c81', 0.52)
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 340, y: 305, w: 650, h: 900, r: 16 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'pinkHighlighter') {
    await drawBg('#fff1f6')
    drawStyleFrame('#f472b6', 0.58)
    ctx.fillStyle = '#fbcfe8'; ctx.beginPath(); ctx.arc(1030, 188, 120, 0, Math.PI * 2); ctx.fill()
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 286, y: 328, w: 690, h: 880, r: 20, rotate: -3 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
    drawPlanLabel('重点速看', 76, 1450, '#f9c7dd', '#be185d')
  } else if (style === 'indexTabs') {
    await drawBg('#f8fafc')
    drawStyleFrame('#8b5cf6', 0.58)
    ;['#ddd6fe', '#bfdbfe', '#fecdd3', '#bbf7d0', '#fde68a'].forEach((c, i) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(978 + i * 28, 330 + i * 78, 112, 54, 12); ctx.fill()
    })
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 268, y: 318, w: 690, h: 900, r: 18 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'gridCard') {
    await drawBg('#f6f7fb')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#ef4444', 0.07, 44)
    drawStyleFrame('#ef4444', 0.45)
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 300, y: 330, w: 650, h: 870, r: 18 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'clipboard') {
    await drawBg('#f5f0e8')
    drawStyleFrame('#92400e', 0.46)
    ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.roundRect(366, 86, 510, 96, 32); ctx.fill()
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.roundRect(512, 54, 220, 80, 28); ctx.fill()
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 266, y: 250, w: 710, h: 970, r: 16 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'lectureSlide') {
    await drawBg('#eef2ff')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#4338ca', 0.06, 44)
    drawStyleFrame('#6366f1', 0.48)
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 216, y: 318, w: 760, h: 850, r: 16 })
    drawFileOverlay(620, 1130, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'ticket') {
    await drawBg('#fffbeb')
    ctx.fillStyle = '#fed7aa'; ctx.beginPath(); ctx.roundRect(86, 248, CANVAS_W - 172, 1172, 24); ctx.fill()
    drawStyleFrame('#ea580c', 0.52)
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 286, y: 326, w: 680, h: 880, r: 18, rotate: 2 })
    drawFileOverlay(650, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'magazine') {
    await drawBg('#fdf2f8')
    drawStyleFrame('#be123c', 0.52)
    ctx.fillStyle = '#ffe4e6'; ctx.beginPath(); ctx.arc(1030, 188, 120, 0, Math.PI * 2); ctx.fill()
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 336, y: 280, w: 640, h: 930, r: 18 })
    drawFileOverlay(86, 1188, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'focusRing') {
    await drawBg('#ecfeff')
    drawStyleFrame('#0891b2', 0.48)
    ctx.strokeStyle = 'rgba(8,145,178,0.22)'; ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(822, 778, 410, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(8,145,178,0.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(822, 778, 330, 0, Math.PI * 2); ctx.stroke()
    drawTitle(92, 180, '#111827', 52, 'left')
    drawPdfPage({ x: 326, y: 350, w: 650, h: 840, r: 18 })
    drawFileOverlay(92, 1164, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'aurora') {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, 520)
    grad.addColorStop(0, '#22d3ee'); grad.addColorStop(0.55, '#a78bfa'); grad.addColorStop(1, '#f472b6')
    await drawBg('#0f172a')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(CANVAS_W, 0); ctx.lineTo(CANVAS_W, 260); ctx.bezierCurveTo(960, 40, 760, 520, 560, 260); ctx.bezierCurveTo(340, 20, 210, 470, 0, 320); ctx.closePath(); ctx.fill()
    drawTitle(92, 208, '#ffffff', 56, 'left')
    drawPdfPage({ x: 300, y: 350, w: 650, h: 850, r: 20, rotate: -2 })
    drawFileOverlay(640, 1115, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'lawPaper') {
    await drawBg('#f7f2e8')
    ctx.strokeStyle = '#dec8a3'; ctx.lineWidth = 8; ctx.strokeRect(70, 80, 1102, 1496)
    drawTitle(92, 150, '#111827', 58, 'left')
    ctx.strokeStyle = '#8b1e1e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(92, 252); ctx.lineTo(1150, 252); ctx.stroke()
    drawPdfPage({ x: 278, y: 322, w: 680, h: 900, r: 4, shadow: false })
    ctx.strokeStyle = '#8b1e1e'; ctx.lineWidth = 3; ctx.strokeRect(278, 322, 680, 900)
    drawFileOverlay(620, 1132, { width: 520, fontSize: 22, rowH: 70, shadow: false, radius: 6 })
  } else if (style === 'sciLab') {
    await drawBg('#f8fffb')
    ctx.strokeStyle = '#059669'; ctx.lineWidth = 2; ctx.globalAlpha = 0.45
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(980 + i * 28, 140 + i * 34, 18 + i * 3, 0, Math.PI * 2); ctx.stroke() }
    ctx.globalAlpha = 1
    drawTitle(92, 178, '#111827', 56, 'left')
    drawPdfPage({ x: 245, y: 320, w: 705, h: 900, r: 18 })
    drawFileOverlay(640, 1120, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'metro') {
    await drawBg('#f8fafc')
    ctx.fillStyle = '#ef4444'; ctx.fillRect(0, 0, CANVAS_W, 36)
    ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0, 36, CANVAS_W, 24)
    drawTitle(92, 175, '#111827', 56, 'left')
    drawPdfPage({ x: 300, y: 310, w: 650, h: 890, r: 18 })
    drawFileOverlay(626, 1120, { width: 530, fontSize: 22, rowH: 70 })
    ctx.lineCap = 'round'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(92, 1430); ctx.lineTo(1150, 1430); ctx.stroke()
    ctx.strokeStyle = '#1d4ed8'; ctx.beginPath(); ctx.moveTo(210, 1430); ctx.lineTo(650, 1430); ctx.stroke(); ctx.lineCap = 'butt'
  } else if (style === 'receiptLong') {
    await drawBg('#fffdf4')
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(92, 92, 1058, 1468, 4); ctx.fill()
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.strokeRect(92, 92, 1058, 1468)
    drawTitle(92, 188, '#111827', 56, 'left')
    drawPdfPage({ x: 290, y: 315, w: 650, h: 890, r: 4, shadow: false })
    drawFileOverlay(610, 1128, { width: 520, fontSize: 22, rowH: 70, shadow: false, radius: 6 })
  } else if (style === 'glassLayer') {
    await drawBg('#e0f2fe')
    ctx.fillStyle = '#bae6fd'; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(210, 220, 230, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#7dd3fc'; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(1060, 1280, 280, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 0.34; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(86, 92, 1070, 1470, 34); ctx.fill(); ctx.globalAlpha = 1
    drawTitle(92, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 286, y: 330, w: 680, h: 880, r: 20, rotate: 3 })
    drawFileOverlay(640, 1122, { width: 520, fontSize: 22, rowH: 70, bg: 'rgba(255,255,255,0.8)' })
  } else if (style === 'notebookBlue') {
    await drawBg('#f7fbff')
    ctx.strokeStyle = '#bfdbfe'; ctx.lineWidth = 2
    for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.moveTo(80, 250 + i * 48); ctx.lineTo(1160, 250 + i * 48); ctx.stroke() }
    ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(168, 96); ctx.lineTo(168, 1560); ctx.stroke()
    drawTitle(92, 175, '#111827', 56, 'left')
    drawPdfPage({ x: 285, y: 318, w: 675, h: 895, r: 18, rotate: -1 })
    drawFileOverlay(640, 1120, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'kraftSeal') {
    await drawBg('#f2e4c8')
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 4; ctx.setLineDash([18, 12]); ctx.beginPath(); ctx.roundRect(82, 92, 1078, 1472, 28); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(1040, 250, 92, 0, Math.PI * 2); ctx.fill()
    drawTitle(92, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 280, y: 326, w: 680, h: 890, r: 18, rotate: 2 })
    drawFileOverlay(635, 1124, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'radialFocus') {
    await drawBg('#fff7ed')
    ctx.fillStyle = '#fed7aa'; ctx.beginPath(); ctx.arc(820, 780, 520, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(249,115,22,0.3)'; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(820, 780, 410, 0, Math.PI * 2); ctx.stroke()
    drawTitle(92, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 326, y: 350, w: 650, h: 840, r: 18 })
    drawFileOverlay(94, 1165, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'purplePortal') {
    await drawBg('#f5f3ff')
    ctx.fillStyle = '#ede9fe'; ctx.beginPath(); ctx.roundRect(72, 72, 1098, 1512, 48); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.66)'; ctx.beginPath(); ctx.roundRect(132, 150, 978, 1350, 46); ctx.fill()
    drawTitle(92, 190, '#111827', 56, 'left')
    drawPdfPage({ x: 300, y: 342, w: 650, h: 850, r: 18 })
    drawFileOverlay(640, 1125, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'greenChalk') {
    await drawBg('#12352f')
    ctx.strokeStyle = '#d9f99d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(70, 82, 1102, 1492, 20); ctx.stroke()
    drawTitle(92, 180, '#f8fafc', 56, 'left')
    drawPdfPage({ x: 290, y: 330, w: 660, h: 870, r: 18, rotate: -2 })
    drawFileOverlay(620, 1128, { width: 540, fontSize: 22, rowH: 70, bg: '#f8fafc' })
    ctx.strokeStyle = 'rgba(248,250,252,0.8)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(120, 1430); ctx.lineTo(520, 1430); ctx.stroke(); ctx.lineCap = 'butt'
  } else if (style === 'windowDesk') {
    await drawBg('#eef2f7')
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(118, 120, 1006, 1320, 22); ctx.fill()
    ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.roundRect(118, 120, 1006, 72, 22); ctx.fill()
    drawTitle(92, 284, '#111827', 54, 'left')
    drawPdfPage({ x: 282, y: 405, w: 670, h: 780, r: 16, shadow: false })
    drawFileOverlay(630, 1118, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'archiveBox') {
    await drawBg('#f8fafc')
    ctx.fillStyle = 'rgba(204,251,241,0.7)'; ctx.beginPath(); ctx.roundRect(96, 240, 1050, 1110, 26); ctx.fill()
    ctx.fillStyle = 'rgba(15,118,110,0.9)'; ctx.beginPath(); ctx.roundRect(96, 170, 410, 130, 28); ctx.fill()
    drawTitle(92, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 310, y: 340, w: 640, h: 850, r: 18 })
    drawFileOverlay(640, 1118, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'orangeBurst') {
    await drawBg('#fff7ed')
    ctx.fillStyle = 'rgba(254,215,170,0.8)'
    for (let i = 0; i < 18; i++) { ctx.save(); ctx.translate(620, 780); ctx.rotate(i / 18 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(620, -18); ctx.lineTo(250, 18); ctx.closePath(); ctx.fill(); ctx.restore() }
    drawTitle(92, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 300, y: 330, w: 650, h: 860, r: 18, rotate: -3 })
    drawFileOverlay(638, 1120, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'calmGray') {
    await drawBg('#f3f4f6')
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(70, 70, 1102, 1516, 34); ctx.fill()
    drawTitle(92, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 292, y: 320, w: 660, h: 880, r: 14, shadow: false })
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(292, 320, 660, 880)
    drawFileOverlay(640, 1125, { width: 520, fontSize: 22, rowH: 70, shadow: false, radius: 8 })
  } else if (style === 'blueprintDark') {
    await drawBg('#0b2447')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#38bdf8', 0.08, 48)
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3; ctx.strokeRect(66, 66, 1110, 1524)
    drawTitle(92, 180, '#f8fafc', 56, 'left')
    drawPdfPage({ x: 292, y: 330, w: 660, h: 870, r: 18 })
    drawFileOverlay(638, 1126, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'foldedCorner') {
    await drawBg('#fdfdfb')
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(92, 92); ctx.lineTo(1010, 92); ctx.lineTo(1150, 232); ctx.lineTo(1150, 1564); ctx.lineTo(92, 1564); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fee2e2'; ctx.beginPath(); ctx.moveTo(1010, 92); ctx.lineTo(1010, 232); ctx.lineTo(1150, 232); ctx.closePath(); ctx.fill()
    drawTitle(92, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 300, y: 330, w: 650, h: 860, r: 18 })
    drawFileOverlay(638, 1120, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'comicMarker') {
    await drawBg('#fffbeb')
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(85, 116, 1065, 1424, 38); ctx.stroke()
    drawTitle(92, 190, '#111827', 56, 'left')
    drawPdfPage({ x: 288, y: 328, w: 670, h: 875, r: 18, rotate: -2 })
    drawFileOverlay(636, 1122, { width: 520, fontSize: 22, rowH: 70 })
    ctx.strokeStyle = 'rgba(253,230,138,0.8)'; ctx.lineWidth = 32; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(110, 1340); ctx.quadraticCurveTo(410, 1280, 740, 1346); ctx.stroke(); ctx.lineCap = 'butt'
  } else if (style === 'sideCatalog') {
    await drawBg('#f8fafc')
    ctx.fillStyle = '#cffafe'; ctx.fillRect(0, 0, 260, CANVAS_H)
    drawTitle(310, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 386, y: 330, w: 610, h: 850, r: 18 })
    drawFileOverlay(92, 1100, { width: 500, fontSize: 22, rowH: 70 })
  } else if (style === 'redLedger') {
    await drawBg('#fff5f5')
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.roundRect(76, 70, 170, 1516, 26); ctx.fill()
    ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 10; ctx.beginPath(); ctx.roundRect(76, 70, 1090, 1516, 26); ctx.stroke()
    drawTitle(300, 180, '#111827', 56, 'left')
    drawPdfPage({ x: 360, y: 320, w: 620, h: 880, r: 18 })
    drawFileOverlay(600, 1122, { width: 520, fontSize: 22, rowH: 70 })
  } else if (style === 'folder') {
    await drawBg('#f1c46b')
    ctx.fillStyle = '#ffe0a3'
    ctx.beginPath(); ctx.roundRect(118, 72, 430, 112, 22); ctx.fill()
    ctx.fillStyle = '#fff2cf'
    ctx.beginPath(); ctx.roundRect(70, 150, CANVAS_W - 140, CANVAS_H - 220, 34); ctx.fill()
    drawTitle(158, 145, '#7a4306', 54, 'left')
    drawPdfPage({ x: 285, y: 300, w: 650, h: 950, r: 18 })
    drawFileOverlay(655, 1150, { width: 510, fontSize: 22, rowH: 70 })
  } else if (style === 'desk') {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
    grad.addColorStop(0, '#eef7f2'); grad.addColorStop(1, '#f8e2cf')
    await drawBg(grad)
    ctx.fillStyle = 'rgba(194,117,64,0.16)'
    ctx.save(); ctx.translate(-140, 1060); ctx.rotate(-0.14); ctx.fillRect(0, 0, 1120, 320); ctx.restore()
    drawTitle(90, 120, '#814c1d', 54, 'left')
    drawPdfPage({ x: 120, y: 230, w: 660, h: 980, r: 18, rotate: -3 })
    drawFileOverlay(645, 1120, { width: 520, fontSize: 22, rowH: 70 })
    ctx.fillStyle = '#fff4c4'
    ctx.beginPath(); ctx.roundRect(102, 1455, 420, 70, 35); ctx.fill()
    ctx.fillStyle = '#814c1d'; ctx.font = 'bold 34px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('回忆版真题预览', 312, 1490)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  } else if (style === 'stamp') {
    await drawBg('#fff8f1', borderColor)
    ctx.strokeStyle = '#d92727'; ctx.lineWidth = 6; ctx.strokeRect(42, 42, CANVAS_W - 84, CANVAS_H - 84)
    drawTitle(CANVAS_W / 2, 96, '#d92727', 58)
    drawPdfPage({ x: 130, y: 205, w: 680, h: 1045, r: 10 })
    drawFileOverlay(655, 1135, { width: 520, fontSize: 22, rowH: 70 })
    ctx.save(); ctx.translate(960, 240); ctx.rotate(-0.22)
    ctx.strokeStyle = '#d92727'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 128, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#d92727'; ctx.font = 'bold 44px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('回忆版', 0, -26); ctx.fillText('真题', 0, 34); ctx.restore()
  } else if (style === 'split') {
    await drawBg('#eef7ff')
    ctx.fillStyle = '#fff7e6'; ctx.fillRect(0, 0, 430, CANVAS_H)
    ctx.fillStyle = '#9a4e00'; ctx.font = 'bold 58px "PingFang SC", sans-serif'; ctx.fillText('2026', 88, 150)
    ctx.font = 'bold 44px "PingFang SC", sans-serif'; ctx.fillText('真题目录', 88, 210)
    drawPdfPage({ x: 485, y: 130, w: 650, h: 965, r: 18 })
    ctx.fillStyle = '#9a4e00'; ctx.font = 'bold 36px "PingFang SC", sans-serif'; ctx.fillText('文件清单', 88, 895)
    drawFileOverlay(88, 945, { width: 430, fontSize: 21, rowH: 70, shadow: false })
  } else if (style === 'phone') {
    await drawBg('#101827')
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(210, 58, 820, 1540, 70); ctx.fill()
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 18; ctx.beginPath(); ctx.roundRect(210, 58, 820, 1540, 70); ctx.stroke()
    ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.roundRect(480, 90, 282, 28, 14); ctx.fill()
    drawTitle(290, 190, '#111827', 44, 'left')
    drawPdfPage({ x: 315, y: 275, w: 610, h: 895, r: 14 })
    drawFileOverlay(330, 1215, { width: 580, fontSize: 21, rowH: 66 })
  } else if (style === 'blueprint') {
    await drawBg('#123b66')
    drawGridBg(ctx, 0, 0, CANVAS_W, CANVAS_H, '#ffffff', 0.10, 42)
    ctx.fillStyle = 'rgba(18,59,102,0.58)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(56, 56, CANVAS_W - 112, CANVAS_H - 112)
    drawTitle(92, 138, '#ffffff', 48, 'left')
    drawPdfPage({ x: 115, y: 240, w: 670, h: 980, r: 10 }, { shadowColor: 'rgba(0,0,0,0.34)' })
    drawFileOverlay(660, 1110, { width: 510, fontSize: 21, rowH: 68, bg: 'rgba(255,255,255,0.94)' })
  } else if (style === 'minimal') {
    await drawBg('#ffffff')
    ctx.fillStyle = '#111827'; ctx.fillRect(72, 0, 28, CANVAS_H)
    drawTitle(150, 122, '#111827', 48, 'left')
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(150, 172); ctx.lineTo(930, 172); ctx.stroke()
    drawPdfPage({ x: 150, y: 240, w: 650, h: 970, r: 2, shadow: false, crop: true })
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.strokeRect(150, 240, 650, 970)
    drawFileOverlay(610, 1120, { width: 520, fontSize: 21, rowH: 68, shadow: false, radius: 4, border: '#111827' })
  }

  return canvas.toDataURL('image/png')
}

function filterDirFilesByType(files, type) {
  if (type === 'history') {
    return (files || []).filter(file => !/模拟题|模拟试卷/.test(String(file?.name || '')))
  }
  if (type === 'mock') {
    return (files || []).filter(file => !String(file?.name || '').includes('真题'))
  }
  return files || []
}

async function generateDirImage(type) {
  const path = type === 'exam' ? data.value.baidu_path_exam
    : type === 'history' ? data.value.baidu_path_history
    : type === 'mock' ? data.value.baidu_path_mock
    : data.value.baidu_path_interview
  if (!path) return

  const bgImg = getActiveBgImageUrl()

  const titleMap = {
    exam: '笔试资料完整目录',
    history: pickRandomHistoryTitle(),
    mock: pickRandomMockTitle(),
    interview: '面试题完整目录',
  }
  dirDrawer.type = type
  dirDrawer.dirMode = 'dir'
  dirDrawer.title = titleMap[type]
  dirDrawer.titleY = null
  dirDrawer.dirStyle = 'classic'
  dirDrawer.pdfSingleStyle = 'classic'
  dirDrawer.borderColor = '#F9863B'
  dirDrawer.dirOnly = false
  dirDrawer.files = []
  dirDrawer.previewUrl = ''
  dirDrawer.pdfPageDataUrl = ''
  dirDrawer.pdfPreviewUrl = ''
  dirDrawer.pdfFsid = null
  dirDrawer.loading = true
  dirDrawer.visible = true

  const MAX_RETRY = 5
  let lastErr = null
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await getBaiduFiles(path)
      const files = filterDirFilesByType(res.files, type)
      if (!files.length) {
        message.warning('该目录下暂无文件')
        dirDrawer.loading = false
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
          await applyPdfSensitiveMosaic(pdfCanvas, page, viewport)
          dirDrawer.pdfPageDataUrl = pdfCanvas.toDataURL('image/png')
          dirDrawer.previewUrl = dirDrawer.dirOnly
            ? await Promise.resolve(renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY, dirDrawer.dirStyle))
            : await buildHistoryComposite(dirDrawer.pdfPageDataUrl, files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY, dirDrawer.pdfSingleStyle)
        } else {
          message.warning(`未找到文件名含"${keyword}"的PDF，降级显示目录列表`)
          dirDrawer.previewUrl = await Promise.resolve(renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY, dirDrawer.dirStyle))
        }
      } else {
        dirDrawer.previewUrl = await Promise.resolve(renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY, dirDrawer.dirStyle))
      }
      lastErr = null
      break  // 成功，退出重试循环
    } catch (e) {
      lastErr = e
      if (attempt < MAX_RETRY) {
        message.warning(`第 ${attempt} 次请求失败，正在自动重试...`)
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }
  if (lastErr) {
    message.error((lastErr.message || '生成失败') + `，已重试 ${MAX_RETRY} 次`)
  }
  dirDrawer.loading = false
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
      await applyPdfSensitiveMosaic(pdfCanvas, page, viewport)
      dirDrawer.pdfPageDataUrl = pdfCanvas.toDataURL('image/png')
      dirDrawer.pdfPreviewUrl = dirDrawer.pdfPageDataUrl
      dirDrawer.pdfFsid = culturePdf.fs_id
      dirDrawer.previewUrl = await buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity, getActiveBgImageUrl(), dirDrawer.titleY, dirDrawer.pdfSingleStyle)
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
    const result = renderCompositeImage(dirDrawer.files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, getActiveBgImageUrl(), dirDrawer.titleY, dirDrawer.dirStyle)
    if (result instanceof Promise) {
      dirDrawer.previewUrl = await result
    } else {
      dirDrawer.previewUrl = result
    }
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
      : dirDrawer.type === 'interview' ? '面试题目录'
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

// ─── 敏感词自动识别打马赛克 ───────────────────────────────
// 敏感词列表（前端硬编码，按需维护）
const SENSITIVE_WORD_LIST = [
  '习近平', '毛泽东', '邓小平', '江泽民', '胡锦涛', '李克强',
  '赵乐际', '王沪宁', '丁薛祥', '李希',
  '中国共产党', '中共中央', '党中央', '中央', '共产党', '政治局', '政治局常委', '总书记',
  '中央委员会', '中央纪委', '中央组织部', '中央宣传部', '中央统战部', '中央政法委',
  '国家主席', '国家副主席', '中央军委', '人民解放军', '解放军', '武警部队',
  '国务院', '全国人大', '全国政协', '人大常委会', '人民代表大会', '代表大会', '人民代表',
  '最高人民法院', '最高人民检察院', '人民法院', '人民检察院', '公安部', '国防部', '外交部',
  '党委', '党组', '纪委', '监委', '省委', '市委', '县委', '区委', '政府工作报告',
  '中华人民共和国', '共和国', '中国', '中华民族', '中华', '政府', '党', '宪法',
  '社会主义', '共产主义', '马克思主义', '毛泽东思想', '中国特色社会主义',
  '全会', '二十大', '三中', '三中全会', '两会', '党代会', '国家', '法律', '法规', '政治',
  '战争', '反法西斯', '解放', '民主', '三权', '三权分立', '分权', '强国',
  '美国', '俄罗斯', '俄国', '日本', '英国', '法国', '德国', '韩国', '朝鲜', '印度',
  '加拿大', '澳大利亚', '乌克兰', '以色列', '巴勒斯坦', '伊朗', '台湾', '香港', '澳门',
  '国民党', '民进党', '民主党', '共和党', '工党', '保守党', '政党', '在野党', '执政党',
  '党员', '党建', '时事政资', '时事政治', '时政',
]
const autoMosaicEnabled = ref(true)  // 生图时自动遮盖敏感词开关

// 返回 text 中所有敏感词的合并字符区间 [{start, end}]
function _findSensitiveRanges(text) {
  const ranges = []
  for (const w of SENSITIVE_WORD_LIST) {
    let i = 0
    while (true) {
      const p = text.indexOf(w, i)
      if (p < 0) break
      ranges.push({ start: p, end: p + w.length })
      i = p + 1
    }
  }
  ranges.sort((a, b) => a.start - b.start)
  const merged = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }
  return merged
}

// 在 canvas ctx 上对 text 行内的敏感子串打马赛克
// textX: fillText 的 x (align='left'); textBaselineY: fillText 的 y (baseline='alphabetic')
// fontSize: 字号（与当前 ctx.font 的 px 值一致）; blockSize: 马赛克块（与坐标系同单位）
// 返回命中区间数
function _mosaicSensitiveInText(ctx, text, textX, textBaselineY, fontSize, blockSize = 10) {
  if (!autoMosaicEnabled.value) return 0
  const ranges = _findSensitiveRanges(text)
  if (!ranges.length) return 0

  const savedFill     = ctx.fillStyle
  const savedAlign    = ctx.textAlign
  const savedBaseline = ctx.textBaseline
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'alphabetic'

  const CW = ctx.canvas.width, CH = ctx.canvas.height
  for (const { start, end } of ranges) {
    const prefixW = ctx.measureText(text.slice(0, start)).width
    const matchW  = ctx.measureText(text.slice(start, end)).width
    const rx = Math.floor(textX + prefixW) - 2
    const ry = Math.floor(textBaselineY - fontSize * 1.05) - 2
    const rw = Math.ceil(matchW) + 4
    const rh = Math.ceil(fontSize * 1.35) + 4
    const x0 = Math.max(0, rx),    y0 = Math.max(0, ry)
    const x1 = Math.min(CW, rx + rw), y1 = Math.min(CH, ry + rh)
    for (let by = y0; by < y1; by += blockSize) {
      for (let bx = x0; bx < x1; bx += blockSize) {
        const bw = Math.min(blockSize, x1 - bx)
        const bh = Math.min(blockSize, y1 - by)
        if (bw <= 0 || bh <= 0) continue
        const px = ctx.getImageData(
          Math.min(bx + (bw >> 1), CW - 1),
          Math.min(by + (bh >> 1), CH - 1),
          1, 1
        ).data
        ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
        ctx.fillRect(bx, by, bw, bh)
      }
    }
  }

  ctx.fillStyle    = savedFill
  ctx.textAlign    = savedAlign
  ctx.textBaseline = savedBaseline
  return ranges.length
}

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

// PDF 页面敏感词自动打马赛克
// 在 page.render() 完成后、toDataURL() 之前调用
// 利用 page.getTextContent() 获取文字位置，精准遮盖敏感词
async function applyPdfSensitiveMosaic(pdfCanvas, page, viewport) {
  if (!autoMosaicEnabled.value) return 0
  let textContent
  try { textContent = await page.getTextContent() } catch { return 0 }
  const ctx = pdfCanvas.getContext('2d')
  const CW = pdfCanvas.width, CH = pdfCanvas.height
  const BLOCK = 20
  const [va, vb, vc, vd, ve, vf] = viewport.transform
  const pdfPt = (x, y) => [va * x + vc * y + ve, vb * x + vd * y + vf]

  // 转换所有文字项到 canvas 坐标
  const items = textContent.items.filter(it => it.str).map(it => {
    const [cx, cy] = pdfPt(it.transform[4], it.transform[5])
    const fontSizePdf = Math.sqrt(it.transform[0] ** 2 + it.transform[1] ** 2)
    return { str: it.str, cx, cy, widthPx: (it.width || 0) * Math.abs(va), fontSizePx: fontSizePdf * Math.abs(va) }
  })

  // 按基线 y 分行（±8px 容差），解决逐字符拆分 PDF 跨 item 无法检测的问题
  // 容差从 3→8：部分 PDF 同一视觉行各字符 baseCy 可偏差 4~6px，过小会拆断整词
  const lines = []
  for (const item of items) {
    let line = lines.find(l => Math.abs(l.baseCy - item.cy) <= 8)
    if (!line) {
      line = { baseCy: item.cy, cySum: item.cy, cyCount: 1, items: [] }
      lines.push(line)
    } else {
      // 动态维护均值基线，避免首个 item 偏低/偏高时后续匹配失败
      line.cySum += item.cy; line.cyCount++
      line.baseCy = line.cySum / line.cyCount
    }
    line.items.push(item)
  }

  let hitCount = 0
  for (const line of lines) {
    line.items.sort((a, b) => a.cx - b.cx)
    // 逐字符展开 x 区间
    const chars = []
    for (const item of line.items) {
      const n = item.str.length || 1
      for (let k = 0; k < item.str.length; k++) {
        chars.push({ ch: item.str[k], x0: item.cx + k / n * item.widthPx, x1: item.cx + (k + 1) / n * item.widthPx, fontSizePx: item.fontSizePx })
      }
    }
    const lineText = chars.map(c => c.ch).join('')
    const ranges = _findSensitiveRanges(lineText)
    for (const { start, end } of ranges) {
      if (end > chars.length) continue
      const rx  = Math.floor(chars[start].x0) - 3
      const rx1 = Math.ceil(chars[end - 1].x1) + 3
      const fh  = chars[start].fontSizePx
      const ry  = Math.floor(line.baseCy - fh * 1.05) - 3
      const rh  = Math.ceil(fh * 1.4) + 6
      const x0 = Math.max(0, rx),  y0 = Math.max(0, ry)
      const x1 = Math.min(CW, rx1), y1 = Math.min(CH, ry + rh)
      for (let by = y0; by < y1; by += BLOCK) {
        for (let bx = x0; bx < x1; bx += BLOCK) {
          const bw = Math.min(BLOCK, x1 - bx), bh = Math.min(BLOCK, y1 - by)
          if (bw <= 0 || bh <= 0) continue
          const px = ctx.getImageData(Math.min(bx + (bw >> 1), CW - 1), Math.min(by + (bh >> 1), CH - 1), 1, 1).data
          ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
          ctx.fillRect(bx, by, bw, bh)
        }
      }
      hitCount++
    }
  }
  return hitCount
}

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
    await applyPdfSensitiveMosaic(canvas, page, viewport)
    dirDrawer.pdfPreviewUrl = canvas.toDataURL('image/png')
    // history / custom 类型：同步更新合成图
    if (dirDrawer.type === 'history' || dirDrawer.type === 'custom') {
      dirDrawer.pdfPageDataUrl = dirDrawer.pdfPreviewUrl
      dirDrawer.previewUrl = await buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity, getActiveBgImageUrl(), dirDrawer.titleY, dirDrawer.pdfSingleStyle)
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

// ─── PDF 文件列表点击分支 ─────────────────────────────────
function onPdfFileClick(f) {
  if (dirDrawer.pdfGridMode) {
    openPdfGridDrawer(f)
  } else {
    renderPdfFirstPage(f)
  }
}

// ─── PDF 4页拼图预览 ──────────────────────────────────────

async function openPdfGridDrawer(file) {
  pdfGridDrawer.file = file
  pdfGridDrawer.gridUrl = ''
  pdfGridDrawer.displayUrl = ''
  pdfGridDrawer.pageDataUrls = []
  pdfGridDrawer.customItems = []
  pdfGridImageCache.clear()
  pdfGridDrawer.selectedItemIndex = 0
  pdfGridDrawer.draggingType = ''
  pdfGridDrawer.titleText = dirDrawer.title  // 继承外层标题文案
  pdfGridDrawer.titleX = 50
  pdfGridDrawer.visible = true
  pdfGridDrawer.loading = true
  try {
    pdfGridDrawer.gridUrl = await renderPdfGridImage(file)
    await refreshGridComposite()  // 叠加标题生成预览
  } catch (e) {
    message.error('PDF拼图生成失败：' + (e.message || '未知错误'))
  } finally {
    pdfGridDrawer.loading = false
    if (pdfGridDrawer.editMode === 'custom') {
      await nextTick()
      await renderCustomPdfGridComposite()
    }
  }
}

/** 重新合成带标题覆层的预览图（gridUrl + blur(仅底图) + title → displayUrl） */
async function refreshGridComposite() {
  if (!pdfGridDrawer.gridUrl) return
  if (pdfGridDrawer.editMode === 'custom') {
    await renderCustomPdfGridComposite()
    return
  }
  const hasBlur  = pdfGridDrawer.blurAmount > 0
  const hasTitle = pdfGridDrawer.titleEnabled && pdfGridDrawer.titleText.trim()

  // 无需合成：直接用底图
  if (!hasBlur && !hasTitle) {
    pdfGridDrawer.displayUrl = pdfGridDrawer.gridUrl
    return
  }

  const img = await loadImage(pdfGridDrawer.gridUrl)
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')

  // ① 绘制 PDF 拼图底图（只对底图应用模糊）
  if (hasBlur) {
    ctx.filter = `blur(${pdfGridDrawer.blurAmount}px)`
  }
  ctx.drawImage(img, 0, 0)
  ctx.filter = 'none'   // 重置，避免影响后续绘制

  // ② 叠加标题（清晰，不受模糊影响）
  if (hasTitle) {
    _drawTitleOnCanvas(ctx, c.width, c.height, pdfGridDrawer.titleText, pdfGridDrawer.titleStyle, pdfGridDrawer.titleY, pdfGridDrawer.titleSize, pdfGridDrawer.titleX)
  }

  pdfGridDrawer.displayUrl = c.toDataURL('image/png')
}

let _gridTitleTimer = null
function debouncedRefreshGridComposite() {
  clearTimeout(_gridTitleTimer)
  _gridTitleTimer = setTimeout(refreshGridComposite, 240)
}

/** 边框颜色改变：需重新合成底图（borderColor 烧在 buildPdfGridComposite 里）*/
let _gridBorderTimer = null
async function onGridBorderColorChange() {
  clearTimeout(_gridBorderTimer)
  _gridBorderTimer = setTimeout(async () => {
    if (pdfGridDrawer.editMode === 'custom') {
      await renderCustomPdfGridComposite()
      return
    }
    await rebuildPdfGridBase('边框重绘失败')
  }, 300)
}

async function onPdfGridTemplateChange() {
  if (pdfGridDrawer.gridTemplate === 'stackedFocus') {
    pdfGridDrawer.titleEnabled = true
    pdfGridDrawer.titleStyle = 'solidRed'
    pdfGridDrawer.titleY = 8
    pdfGridDrawer.titleSize = 76
  }
  await rebuildPdfGridBase('模版重绘失败')
}

async function rebuildPdfGridBase(errorPrefix = '拼图重绘失败') {
  if (!pdfGridDrawer.file) return
  pdfGridDrawer.loading = true
  try {
    pdfGridDrawer.gridUrl = await renderPdfGridImage(pdfGridDrawer.file)
    await refreshGridComposite()
  } catch (e) {
    message.error(`${errorPrefix}：` + (e.message || '未知'))
  } finally {
    pdfGridDrawer.loading = false
    if (pdfGridDrawer.editMode === 'custom') {
      await nextTick()
      await renderCustomPdfGridComposite()
    }
  }
}

async function onPdfGridEditModeChange() {
  if (pdfGridDrawer.editMode === 'custom' && !pdfGridDrawer.customItems.length) {
    await initCustomPdfGridLayout()
  }
  await nextTick()
  await refreshGridComposite()
}

async function initCustomPdfGridLayout() {
  const urls = pdfGridDrawer.pageDataUrls.length ? pdfGridDrawer.pageDataUrls : []
  if (!urls.length) return
  const CANVAS_W = 1242
  const CANVAS_H = 1656
  const slots = [
    { x: 92, y: 170, w: 500, h: 610 },
    { x: 650, y: 250, w: 500, h: 610 },
    { x: 92, y: 870, w: 500, h: 610 },
    { x: 650, y: 950, w: 500, h: 610 },
  ]
  const items = []
  for (let i = 0; i < urls.length; i++) {
    const img = await loadPdfGridPageImage(urls[i])
    const slot = slots[i] || slots[slots.length - 1]
    const scale = Math.min(slot.w / img.width, slot.h / img.height)
    const w = img.width * scale
    const h = img.height * scale
    items.push({
      src: urls[i],
      x: Math.max(0, Math.min(CANVAS_W - w, slot.x + (slot.w - w) / 2)),
      y: Math.max(0, Math.min(CANVAS_H - h, slot.y + (slot.h - h) / 2)),
      w,
      h,
      baseW: w,
      baseH: h,
    })
  }
  pdfGridDrawer.customItems = items
  pdfGridDrawer.selectedItemIndex = items.length ? 0 : -1
}

async function loadPdfGridPageImage(src) {
  if (!pdfGridImageCache.has(src)) {
    pdfGridImageCache.set(src, loadImage(src))
  }
  return pdfGridImageCache.get(src)
}

async function resetCustomPdfGridLayout() {
  await initCustomPdfGridLayout()
  await renderCustomPdfGridComposite()
}

function getPdfGridCanvasPoint(event) {
  const canvas = pdfGridCanvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  }
}

function getPdfGridTitleBounds(ctx, w, h) {
  const text = String(pdfGridDrawer.titleText || '').trim()
  if (!pdfGridDrawer.titleEnabled || !text) return null
  const fontSize = pdfGridDrawer.titleSize
  const cx = w * (pdfGridDrawer.titleX / 100)
  const cy = h * (pdfGridDrawer.titleY / 100)
  ctx.save()
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`
  const tw = ctx.measureText(text).width
  ctx.restore()
  const padX = fontSize * 0.9
  const padY = fontSize * 0.7
  return {
    left: cx - tw / 2 - padX,
    right: cx + tw / 2 + padX,
    top: cy - fontSize / 2 - padY,
    bottom: cy + fontSize / 2 + padY,
  }
}

function hitTestCustomPdfGrid(point) {
  if (!point) return { type: '', index: -1 }
  const canvas = pdfGridCanvasRef.value
  const ctx = canvas?.getContext('2d')
  const titleBounds = ctx ? getPdfGridTitleBounds(ctx, canvas.width, canvas.height) : null
  if (titleBounds && point.x >= titleBounds.left && point.x <= titleBounds.right && point.y >= titleBounds.top && point.y <= titleBounds.bottom) {
    return { type: 'title', index: -1 }
  }
  for (let i = pdfGridDrawer.customItems.length - 1; i >= 0; i--) {
    const item = pdfGridDrawer.customItems[i]
    if (point.x >= item.x && point.x <= item.x + item.w && point.y >= item.y && point.y <= item.y + item.h) {
      return { type: 'item', index: i }
    }
  }
  return { type: '', index: -1 }
}

async function renderCustomPdfGridComposite() {
  if (!pdfGridDrawer.customItems.length) await initCustomPdfGridLayout()
  const canvas = pdfGridCanvasRef.value || document.createElement('canvas')
  const CANVAS_W = 1242
  const CANVAS_H = 1656
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f7f8fb'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.strokeStyle = pdfGridDrawer.gridBorderColor
  ctx.lineWidth = 14
  ctx.strokeRect(7, 7, CANVAS_W - 14, CANVAS_H - 14)

  if (pdfGridDrawer.blurAmount > 0) ctx.filter = `blur(${pdfGridDrawer.blurAmount}px)`
  for (let i = 0; i < pdfGridDrawer.customItems.length; i++) {
    const item = pdfGridDrawer.customItems[i]
    const img = await loadPdfGridPageImage(item.src)
    ctx.save()
    ctx.shadowColor = 'rgba(15,23,42,0.24)'
    ctx.shadowBlur = 22
    ctx.shadowOffsetY = 10
    ctx.fillStyle = '#fff'
    ctx.fillRect(item.x - 8, item.y - 8, item.w + 16, item.h + 16)
    ctx.drawImage(img, item.x, item.y, item.w, item.h)
    ctx.restore()
    if (i === pdfGridDrawer.selectedItemIndex) {
      ctx.save()
      ctx.filter = 'none'
      ctx.strokeStyle = '#1677ff'
      ctx.lineWidth = 5
      ctx.setLineDash([16, 10])
      ctx.strokeRect(item.x - 12, item.y - 12, item.w + 24, item.h + 24)
      ctx.restore()
    }
  }
  ctx.filter = 'none'
  if (pdfGridDrawer.titleEnabled && pdfGridDrawer.titleText.trim()) {
    _drawTitleOnCanvas(ctx, CANVAS_W, CANVAS_H, pdfGridDrawer.titleText, pdfGridDrawer.titleStyle, pdfGridDrawer.titleY, pdfGridDrawer.titleSize, pdfGridDrawer.titleX)
  }
  pdfGridDrawer.displayUrl = canvas.toDataURL('image/png')
}

async function onCustomPdfGridMouseDown(event) {
  if (pdfGridDrawer.editMode !== 'custom') return
  const point = getPdfGridCanvasPoint(event)
  const hit = hitTestCustomPdfGrid(point)
  if (!hit.type) return
  event.preventDefault()
  pdfGridDrawer.draggingType = hit.type
  if (hit.type === 'item') {
    const item = pdfGridDrawer.customItems[hit.index]
    pdfGridDrawer.selectedItemIndex = hit.index
    pdfGridDrawer.dragOffsetX = point.x - item.x
    pdfGridDrawer.dragOffsetY = point.y - item.y
  } else {
    pdfGridDrawer.dragOffsetX = point.x - 1242 * (pdfGridDrawer.titleX / 100)
    pdfGridDrawer.dragOffsetY = point.y - 1656 * (pdfGridDrawer.titleY / 100)
  }
  await renderCustomPdfGridComposite()
}

async function onCustomPdfGridMouseMove(event) {
  if (pdfGridDrawer.editMode !== 'custom' || !pdfGridDrawer.draggingType) return
  const point = getPdfGridCanvasPoint(event)
  if (!point) return
  event.preventDefault()
  if (pdfGridDrawer.draggingType === 'item') {
    const item = pdfGridDrawer.customItems[pdfGridDrawer.selectedItemIndex]
    if (!item) return
    item.x = Math.max(-item.w * 0.8, Math.min(1242 - item.w * 0.2, point.x - pdfGridDrawer.dragOffsetX))
    item.y = Math.max(-item.h * 0.8, Math.min(1656 - item.h * 0.2, point.y - pdfGridDrawer.dragOffsetY))
  } else if (pdfGridDrawer.draggingType === 'title') {
    pdfGridDrawer.titleX = Math.max(0, Math.min(100, ((point.x - pdfGridDrawer.dragOffsetX) / 1242) * 100))
    pdfGridDrawer.titleY = Math.max(0, Math.min(100, ((point.y - pdfGridDrawer.dragOffsetY) / 1656) * 100))
  }
  await renderCustomPdfGridComposite()
}

function onCustomPdfGridMouseUp() {
  pdfGridDrawer.draggingType = ''
}

async function scaleCustomPdfGridItem(index, scale, anchor = null) {
  const item = pdfGridDrawer.customItems[index]
  if (!item) return
  const nextScale = Math.max(0.35, Math.min(2.4, Number(scale) || 1))
  const oldW = item.w
  const oldH = item.h
  const nextW = item.baseW * nextScale
  const nextH = item.baseH * nextScale
  const ax = anchor?.x ?? (item.x + oldW / 2)
  const ay = anchor?.y ?? (item.y + oldH / 2)
  const relX = (ax - item.x) / oldW
  const relY = (ay - item.y) / oldH
  item.w = nextW
  item.h = nextH
  item.x = ax - nextW * relX
  item.y = ay - nextH * relY
  await renderCustomPdfGridComposite()
}

async function onCustomPdfGridWheel(event) {
  if (pdfGridDrawer.editMode !== 'custom') return
  const point = getPdfGridCanvasPoint(event)
  const hit = hitTestCustomPdfGrid(point)
  const index = hit.type === 'item' ? hit.index : pdfGridDrawer.selectedItemIndex
  if (index < 0) return
  pdfGridDrawer.selectedItemIndex = index
  const direction = event.deltaY > 0 ? -1 : 1
  await scaleCustomPdfGridItem(index, selectedPdfGridItemScale.value + direction * 0.06, point)
}

async function onSelectedPdfGridScaleInput(event) {
  if (pdfGridDrawer.selectedItemIndex < 0) return
  await scaleCustomPdfGridItem(pdfGridDrawer.selectedItemIndex, Number(event.target.value))
}

async function moveCustomPdfGridLayer(action) {
  const index = pdfGridDrawer.selectedItemIndex
  const items = pdfGridDrawer.customItems
  if (index < 0 || index >= items.length) return

  const [item] = items.splice(index, 1)
  let nextIndex = index
  if (action === 'top') nextIndex = items.length
  else if (action === 'bottom') nextIndex = 0
  else if (action === 'up') nextIndex = Math.min(items.length, index + 1)
  else if (action === 'down') nextIndex = Math.max(0, index - 1)

  items.splice(nextIndex, 0, item)
  pdfGridDrawer.selectedItemIndex = nextIndex
  await renderCustomPdfGridComposite()
}

/**
 * 在 canvas 上绘制标题覆层
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w  canvas 宽（px）
 * @param {number} h  canvas 高（px）
 * @param {string} text 标题文案
 * @param {string} style  样式预设 key
 * @param {number} yPct  垂直位置百分比（0~100）
 * @param {number} xPct  水平位置百分比（0~100）
 */
function _drawTitleOnCanvas(ctx, w, h, text, style, yPct = 50, fontSize = 82, xPct = 50) {
  const cx = w * (xPct / 100)
  const cy = h * (yPct / 100)

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`

  const tw = ctx.measureText(text).width

  if (style === 'shadow') {
    // 白色大字 + 多层深色阴影（适合深色/渐变背景）
    ctx.shadowColor = 'rgba(0,0,0,0.88)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 5
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, cx, cy)
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 2
    ctx.fillText(text, cx, cy)

  } else if (style === 'pill') {
    // 深色半透明胶囊 + 白字
    const padX = fontSize * 0.65
    const padY = fontSize * 0.42
    const bw = tw + padX * 2
    const bh = fontSize + padY * 2
    ctx.fillStyle = 'rgba(20,20,20,0.62)'
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, cx, cy)

  } else if (style === 'stroke') {
    // 白字 + 黑色粗描边
    ctx.lineWidth = Math.max(4, fontSize * 0.09)
    ctx.strokeStyle = 'rgba(0,0,0,0.90)'
    ctx.lineJoin = 'round'
    ctx.strokeText(text, cx, cy)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, cx, cy)

  } else if (style === 'gradient') {
    // 小红书品牌色斜向渐变（红→橙→黄）
    const grad = ctx.createLinearGradient(cx - tw / 2, cy - fontSize / 2, cx + tw / 2, cy + fontSize / 2)
    grad.addColorStop(0,   '#FF2D55')
    grad.addColorStop(0.5, '#FF6B35')
    grad.addColorStop(1,   '#FFC300')
    ctx.shadowColor = 'rgba(255,60,0,0.42)'
    ctx.shadowBlur = 20
    ctx.fillStyle = grad
    ctx.fillText(text, cx, cy)

  } else if (style === 'card') {
    // 白底圆角卡片 + 顶部彩条 + 红色边框
    const padX = fontSize * 1.0
    const padY = fontSize * 0.6
    const bw = Math.max(tw + padX * 2, w * 0.38)
    const bh = fontSize + padY * 2
    const r = 20
    const accentH = Math.round(fontSize * 0.28)
    ctx.shadowColor = 'rgba(0,0,0,0.22)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 12
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, r)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.fillStyle = '#FF2D55'
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, accentH, [r, r, 0, 0])
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = '#FF2D55'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2 + 2, cy - bh / 2 + 2, bw - 4, bh - 4, r - 2)
    ctx.stroke()
    ctx.fillStyle = '#1a1a1a'
    ctx.fillText(text, cx, cy + fontSize * 0.13)

  } else if (style === 'solidRed') {
    // 🔴 纯色实底胶囊 + 白字（白底PDF上最显眼）
    const padX = fontSize * 0.72
    const padY = fontSize * 0.44
    const bw = tw + padX * 2
    const bh = fontSize + padY * 2
    // 底色阴影
    ctx.shadowColor = 'rgba(255,45,85,0.45)'
    ctx.shadowBlur = 22
    ctx.shadowOffsetY = 8
    ctx.fillStyle = '#FF2D55'
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, cx, cy)

  } else if (style === 'gradBg') {
    // 🌅 渐变色实底（橙→粉）胶囊 + 白字 + 装饰亮边
    const padX = fontSize * 0.72
    const padY = fontSize * 0.44
    const bw = tw + padX * 2
    const bh = fontSize + padY * 2
    const bgGrad = ctx.createLinearGradient(cx - bw / 2, cy, cx + bw / 2, cy)
    bgGrad.addColorStop(0, '#FF6B35')
    bgGrad.addColorStop(1, '#FF2D82')
    ctx.shadowColor = 'rgba(255,80,50,0.4)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
    ctx.fillStyle = bgGrad
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    // 顶部亮线（高光感）
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2 + 6, cy - bh / 2 + 4, bw - 12, bh / 2 - 4, [bh / 2, bh / 2, 0, 0])
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, cx, cy)

  } else if (style === 'stamp') {
    // 🔖 印章风格：双矩形边框 + 鲜红文字（无背景，不遮挡PDF）
    const padX = fontSize * 0.55
    const padY = fontSize * 0.38
    const bw = tw + padX * 2
    const bh = fontSize + padY * 2
    const r = 10
    // 外框
    ctx.strokeStyle = '#E8001A'
    ctx.lineWidth = Math.max(5, fontSize * 0.07)
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, r)
    ctx.stroke()
    // 内框（内缩）
    const inset = ctx.lineWidth + 4
    ctx.lineWidth = Math.max(2, fontSize * 0.03)
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2 + inset, cy - bh / 2 + inset, bw - inset * 2, bh - inset * 2, Math.max(2, r - 4))
    ctx.stroke()
    // 文字
    ctx.fillStyle = '#E8001A'
    ctx.fillText(text, cx, cy)

  } else if (style === 'neon') {
    // 💫 霓虹发光：青色→紫色渐变 + 多层外发光
    const neonGrad = ctx.createLinearGradient(cx - tw / 2, cy, cx + tw / 2, cy)
    neonGrad.addColorStop(0,   '#00F5FF')
    neonGrad.addColorStop(0.5, '#BF5FFF')
    neonGrad.addColorStop(1,   '#FF2D82')
    // 大光晕（最外层）
    ctx.shadowColor = 'rgba(0,220,255,0.7)'
    ctx.shadowBlur = 40
    ctx.fillStyle = neonGrad
    ctx.fillText(text, cx, cy)
    // 中层光晕
    ctx.shadowColor = 'rgba(180,80,255,0.8)'
    ctx.shadowBlur = 20
    ctx.fillText(text, cx, cy)
    // 内核高亮
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 8
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, cx, cy)
  }

  ctx.restore()
}

/** 加载 PDF 前 4 页，每页渲染为 dataURL，再合成 2×2 拼图 */
async function renderPdfGridImage(file) {
  const lib = await ensurePdfjs()
  const pdf = await lib.getDocument({
    url: `/api/baidu/proxy-pdf?path=${encodeURIComponent(file.path)}`,
    httpHeaders: { Authorization: `Bearer ${getToken()}` },
  }).promise

  const totalPages = Math.min(pdf.numPages, 4)
  const pageDataUrls = []
  for (let p = 1; p <= totalPages; p++) {
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 2 })
    const c = document.createElement('canvas')
    c.width = viewport.width
    c.height = viewport.height
    await page.render({ canvasContext: c.getContext('2d'), viewport }).promise
    // 每页渲染后同步打码敏感词（与单页模式保持一致）
    await applyPdfSensitiveMosaic(c, page, viewport)
    pageDataUrls.push(c.toDataURL('image/png'))
  }

  pdfGridDrawer.pageDataUrls = pageDataUrls
  if (pdfGridDrawer.editMode === 'custom') {
    pdfGridDrawer.customItems = []
    await initCustomPdfGridLayout()
  }
  return buildPdfGridComposite(pageDataUrls, pdfGridDrawer.gridBorderColor, pdfGridDrawer.gridTemplate)
}

/** 把最多 4 页 PDF 的 dataURL 拼成 1242×1656 的小红书笔记图 */
async function buildPdfGridComposite(dataUrls, borderColor = '#FF2D55', template = 'classic') {
  const CANVAS_W = 1242
  const CANVAS_H = 1656
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  const imgs = []
  for (const url of dataUrls.slice(0, 4)) imgs.push(url ? await loadImage(url) : null)

  const drawBg = (fill = '#f2f2f2', lineWidth = 10) => {
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    if (lineWidth > 0) {
      ctx.strokeStyle = borderColor
      ctx.lineWidth = lineWidth
      ctx.strokeRect(lineWidth / 2, lineWidth / 2, CANVAS_W - lineWidth, CANVAS_H - lineWidth)
    }
  }

  const drawGrid = (color, alpha = 0.2, size = 52) => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    for (let x = 0; x < CANVAS_W; x += size) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke()
    }
    for (let y = 0; y < CANVAS_H; y += size) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke()
    }
    ctx.restore()
  }

  const drawPage = (img, rect, opts = {}) => {
    const { x, y, w, h, r = 20, rotate = 0, shadow = true, fit = 'contain', bg = '#fff', opacity = 1 } = rect
    const cx = x + w / 2
    const cy = y + h / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotate * Math.PI / 180)
    ctx.globalAlpha = opacity
    if (shadow) {
      ctx.shadowColor = opts.shadowColor || 'rgba(0,0,0,0.22)'
      ctx.shadowBlur = opts.shadowBlur ?? 10
      ctx.shadowOffsetY = opts.shadowOffsetY ?? 5
    }
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, r)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, r)
    ctx.clip()
    ctx.fillStyle = bg
    ctx.fillRect(-w / 2, -h / 2, w, h)
    if (img) {
      const scale = fit === 'cover' ? Math.max(w / img.width, h / img.height) : Math.min(w / img.width, h / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    } else {
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(-w / 2, -h / 2, w, h)
      ctx.fillStyle = '#9ca3af'
      ctx.font = 'bold 36px "PingFang SC", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('暂无页面', 0, 0)
    }
    ctx.restore()
  }

  const drawDashedFocus = (x, y, w, h, color = '#1e80ff') => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.setLineDash([14, 10])
    ctx.strokeRect(x - 8, y - 8, w + 16, h + 16)
    ctx.restore()
  }

  const drawRibbon = (text, x, y, fill, color = '#fff') => {
    ctx.save()
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.roundRect(x, y, 330, 54, 27)
    ctx.fill()
    ctx.fillStyle = color
    ctx.font = 'bold 28px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + 165, y + 27)
    ctx.restore()
  }

  const drawFourGrid = (cells, opts = {}) => {
    cells.forEach((rect, i) => drawPage(imgs[i], { r: opts.r ?? 16, ...rect }, opts))
  }

  const drawHeader = (text, x, y, color = '#111827', size = 40) => {
    ctx.save()
    ctx.fillStyle = color
    ctx.font = `bold ${size}px "PingFang SC", sans-serif`
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  const active = PDF_GRID_TEMPLATES.some(t => t.value === template) ? template : 'classic'

  if (active === 'classic') {
    drawBg('#f2f2f2', 10)
    const pad = 32, gap = 20
    const w = Math.floor((CANVAS_W - pad * 2 - gap) / 2)
    const h = Math.floor((CANVAS_H - pad * 2 - gap) / 2)
    const cells = [
      { x: pad, y: pad, w, h },
      { x: pad + w + gap, y: pad, w, h },
      { x: pad, y: pad + h + gap, w, h },
      { x: pad + w + gap, y: pad + h + gap, w, h },
    ]
    cells.forEach((rect, i) => drawPage(imgs[i], { ...rect, r: 20 }, { shadowBlur: 8 }))
  } else if (active === 'desk') {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
    grad.addColorStop(0, '#f7efe2'); grad.addColorStop(1, '#e8f4ec')
    drawBg(grad, 0)
    ctx.fillStyle = 'rgba(194,117,64,0.16)'
    ctx.save(); ctx.translate(-120, CANVAS_H - 260); ctx.rotate(-0.14); ctx.fillRect(0, 0, 760, 230); ctx.restore()
    drawPage(imgs[0], { x: 92, y: 120, w: 520, h: 650, r: 18, rotate: -3 })
    drawPage(imgs[1], { x: 620, y: 160, w: 500, h: 620, r: 18, rotate: 2.5 })
    drawPage(imgs[2], { x: 120, y: 815, w: 500, h: 620, r: 18, rotate: 2 })
    drawPage(imgs[3], { x: 640, y: 790, w: 500, h: 650, r: 18, rotate: -2.5 })
    drawRibbon('真题先刷，少走弯路', 78, 1460, 'rgba(255,244,196,0.92)', '#814c1d')
  } else if (active === 'folder') {
    drawBg('#f1c46b', 0)
    ctx.fillStyle = '#ffe0a3'
    ctx.beginPath(); ctx.roundRect(88, 58, 410, 92, [20, 20, 0, 0]); ctx.fill()
    ctx.fillStyle = '#fff2cf'
    ctx.beginPath(); ctx.roundRect(56, 126, CANVAS_W - 112, CANVAS_H - 176, 30); ctx.fill()
    ctx.fillStyle = '#7a4306'
    ctx.font = 'bold 42px "PingFang SC", sans-serif'
    ctx.fillText('真题资料已整理', 102, 112)
    const cells = [
      { x: 98, y: 200, w: 490, h: 570 },
      { x: 654, y: 200, w: 490, h: 570 },
      { x: 98, y: 848, w: 490, h: 570 },
      { x: 654, y: 848, w: 490, h: 570 },
    ]
    cells.forEach((rect, i) => drawPage(imgs[i], { ...rect, r: 16 }, { shadowBlur: 7 }))
  } else if (active === 'phone') {
    drawBg('#101827', 0)
    ctx.fillStyle = '#f8fafc'
    ctx.beginPath(); ctx.roundRect(162, 62, 918, 1532, 70); ctx.fill()
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 18
    ctx.beginPath(); ctx.roundRect(162, 62, 918, 1532, 70); ctx.stroke()
    ctx.fillStyle = '#111827'
    ctx.beginPath(); ctx.roundRect(484, 92, 274, 26, 13); ctx.fill()
    ctx.font = 'bold 36px "PingFang SC", sans-serif'
    ctx.fillText('回忆版真题预览', 248, 182)
    const cells = [
      { x: 238, y: 260, w: 352, h: 470 },
      { x: 652, y: 260, w: 352, h: 470 },
      { x: 238, y: 806, w: 352, h: 470 },
      { x: 652, y: 806, w: 352, h: 470 },
    ]
    cells.forEach((rect, i) => drawPage(imgs[i], { ...rect, r: 14 }, { shadowBlur: 6 }))
  } else if (active === 'mask') {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
    grad.addColorStop(0, '#ecfeff'); grad.addColorStop(1, '#fff1f2')
    drawBg(grad, 0)
    const pad = 58, gap = 26
    const w = Math.floor((CANVAS_W - pad * 2 - gap) / 2)
    const h = Math.floor((CANVAS_H - pad * 2 - gap) / 2)
    ;[
      { x: pad, y: pad, w, h },
      { x: pad + w + gap, y: pad, w, h },
      { x: pad, y: pad + h + gap, w, h },
      { x: pad + w + gap, y: pad + h + gap, w, h },
    ].forEach((rect, i) => drawPage(imgs[i], { ...rect, r: 20 }, { shadowBlur: 10 }))
    ctx.fillStyle = 'rgba(17,24,39,0.16)'
    ctx.fillRect(0, CANVAS_H * 0.43, CANVAS_W, 210)
  } else if (active === 'waterfall') {
    drawBg('#f8fbff', 0)
    drawGrid('#93c5fd', 0.18, 48)
    ctx.fillStyle = '#1d4ed8'
    ctx.font = 'bold 44px "PingFang SC", sans-serif'
    ctx.fillText('先看题型，再定复习重点', 80, 120)
    drawPage(imgs[0], { x: 86, y: 190, w: 500, h: 430, r: 18 })
    drawPage(imgs[1], { x: 654, y: 360, w: 500, h: 430, r: 18 })
    drawPage(imgs[2], { x: 86, y: 810, w: 500, h: 430, r: 18 })
    drawPage(imgs[3], { x: 654, y: 1010, w: 500, h: 430, r: 18 })
  } else if (active === 'stamp') {
    drawBg('#fff8f1', 14)
    ctx.strokeStyle = '#d92727'; ctx.lineWidth = 6
    ctx.strokeRect(42, 42, CANVAS_W - 84, CANVAS_H - 84)
    const cells = [
      { x: 88, y: 132, w: 500, h: 620 },
      { x: 654, y: 132, w: 500, h: 620 },
      { x: 88, y: 884, w: 500, h: 620 },
      { x: 654, y: 884, w: 500, h: 620 },
    ]
    cells.forEach((rect, i) => drawPage(imgs[i], { ...rect, r: 14 }, { shadowBlur: 8 }))
    ctx.save()
    ctx.translate(958, 810); ctx.rotate(-0.22)
    ctx.strokeStyle = '#d92727'; ctx.lineWidth = 8
    ctx.beginPath(); ctx.arc(0, 0, 128, 0, Math.PI * 2); ctx.stroke()
    ctx.font = 'bold 44px "PingFang SC", sans-serif'
    ctx.fillStyle = '#d92727'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('回忆版', 0, -24)
    ctx.fillText('真题', 0, 34)
    ctx.restore()
  } else if (active === 'checklist') {
    drawBg('#eaf4ff', 0)
    drawPage(imgs[0], { x: 70, y: 130, w: 430, h: 560, r: 18, rotate: -1.5 })
    drawPage(imgs[1], { x: 70, y: 860, w: 430, h: 560, r: 18, rotate: 1.2 })
    drawPage(imgs[2], { x: 690, y: 140, w: 450, h: 560, r: 18, rotate: 1.5 })
    drawPage(imgs[3], { x: 690, y: 862, w: 450, h: 560, r: 18, rotate: -1.2 })
    ctx.fillStyle = 'rgba(255,255,255,0.86)'
    ctx.beginPath(); ctx.roundRect(520, 392, 210, 450, 26); ctx.fill()
    ;['题型清晰', '公基高频', '企业文化要看', '写作提前准备'].forEach((t, i) => {
      const y = 452 + i * 82
      ctx.fillStyle = borderColor
      ctx.beginPath(); ctx.arc(558, y, 13, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(551, y); ctx.lineTo(557, y + 7); ctx.lineTo(568, y - 7); ctx.stroke()
      ctx.fillStyle = '#102033'
      ctx.font = 'bold 26px "PingFang SC", sans-serif'
      ctx.fillText(t, 584, y + 9)
    })
  } else if (active === 'blueprint') {
    drawBg('#123b66', 0)
    drawGrid('#ffffff', 0.12, 42)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(56, 56, CANVAS_W - 112, CANVAS_H - 112)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 42px "PingFang SC", sans-serif'
    ctx.fillText('真题结构分析板', 86, 132)
    const cells = [
      { x: 86, y: 205, w: 500, h: 570 },
      { x: 656, y: 205, w: 500, h: 570 },
      { x: 86, y: 850, w: 500, h: 570 },
      { x: 656, y: 850, w: 500, h: 570 },
    ]
    cells.forEach((rect, i) => drawPage(imgs[i], { ...rect, r: 10 }, { shadowColor: 'rgba(0,0,0,0.3)', shadowBlur: 6 }))
  } else if (active === 'album') {
    drawBg('#111827', 0)
    ctx.fillStyle = '#f9fafb'
    ctx.beginPath(); ctx.roundRect(58, 70, CANVAS_W - 116, CANVAS_H - 140, 34); ctx.fill()
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 38px "PingFang SC", sans-serif'
    ctx.fillText('PDF 4页试卷预览', 96, 145)
    const cells = [
      { x: 96, y: 218, w: 500, h: 560 },
      { x: 646, y: 218, w: 500, h: 560 },
      { x: 96, y: 848, w: 500, h: 560 },
      { x: 646, y: 848, w: 500, h: 560 },
    ]
    cells.forEach((rect, i) => {
      ctx.fillStyle = '#111827'
      ctx.fillRect(rect.x - 18, rect.y - 18, rect.w + 36, rect.h + 36)
      drawPage(imgs[i], { ...rect, r: 6 }, { shadowBlur: 0 })
      ctx.fillStyle = '#f9fafb'
      for (let y = rect.y - 6; y < rect.y + rect.h; y += 60) {
        ctx.fillRect(rect.x - 13, y, 8, 24)
        ctx.fillRect(rect.x + rect.w + 5, y, 8, 24)
      }
    })
  } else if (active === 'indexTabs') {
    drawBg('#f8fafc', 0)
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(56, 72, CANVAS_W - 112, CANVAS_H - 144, 30); ctx.fill()
    ;['#bfdbfe', '#fde68a', '#fecaca', '#bbf7d0'].forEach((c, i) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(92 + i * 155, 76, 130, 70, [16, 16, 0, 0]); ctx.fill()
    })
    drawHeader('真题索引册', 112, 136, '#1d4ed8')
    drawFourGrid([
      { x: 96, y: 210, w: 486, h: 560 },
      { x: 660, y: 210, w: 486, h: 560 },
      { x: 96, y: 860, w: 486, h: 560 },
      { x: 660, y: 860, w: 486, h: 560 },
    ])
  } else if (active === 'newspaper') {
    drawBg('#f4efe6', 0)
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(62, 62, CANVAS_W - 124, CANVAS_H - 124)
    ctx.strokeStyle = '#d6cbb8'; ctx.lineWidth = 3; ctx.strokeRect(78, 78, CANVAS_W - 156, CANVAS_H - 156)
    drawHeader('笔试真题专栏', 112, 145, '#1f2937', 46)
    drawFourGrid([
      { x: 100, y: 225, w: 480, h: 530, r: 4 },
      { x: 660, y: 225, w: 480, h: 530, r: 4 },
      { x: 100, y: 865, w: 480, h: 530, r: 4 },
      { x: 660, y: 865, w: 480, h: 530, r: 4 },
    ], { shadow: false, r: 4 })
  } else if (active === 'spiral') {
    drawBg('#fffdf5', 0)
    ctx.strokeStyle = 'rgba(100,116,139,0.65)'; ctx.lineWidth = 3
    for (let y = 38; y < CANVAS_H; y += 58) {
      ctx.beginPath(); ctx.arc(78, y, 16, 0, Math.PI * 2); ctx.stroke()
    }
    drawFourGrid([
      { x: 160, y: 120, w: 430, h: 590, rotate: -1.5 },
      { x: 676, y: 160, w: 430, h: 590, rotate: 1.5 },
      { x: 160, y: 890, w: 430, h: 590, rotate: 1.2 },
      { x: 676, y: 850, w: 430, h: 590, rotate: -1.2 },
    ])
    drawRibbon('考前翻一遍', 438, 780, '#fde68a', '#713f12')
  } else if (active === 'chalkboard') {
    drawBg('#12372f', 0)
    ctx.strokeStyle = 'rgba(255,255,255,0.46)'; ctx.lineWidth = 6
    ctx.strokeRect(58, 58, CANVAS_W - 116, CANVAS_H - 116)
    drawHeader('真题讲透，答题不慌', 98, 148, '#fef3c7', 44)
    drawFourGrid([
      { x: 98, y: 250, w: 480, h: 530, rotate: -2 },
      { x: 662, y: 250, w: 480, h: 530, rotate: 2 },
      { x: 98, y: 880, w: 480, h: 530, rotate: 2 },
      { x: 662, y: 880, w: 480, h: 530, rotate: -2 },
    ], { shadowColor: 'rgba(0,0,0,0.34)' })
  } else if (active === 'binder') {
    drawBg('#dbeafe', 0)
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.roundRect(86, 86, CANVAS_W - 172, CANVAS_H - 172, 32); ctx.fill()
    drawHeader('资料夹预览', 154, 165, '#1e3a8a', 42)
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 8
    ;[520, 720, 920].forEach(y => { ctx.beginPath(); ctx.arc(CANVAS_W / 2, y, 26, 0, Math.PI * 2); ctx.stroke() })
    drawFourGrid([
      { x: 156, y: 235, w: 420, h: 510 },
      { x: 668, y: 235, w: 420, h: 510 },
      { x: 156, y: 880, w: 420, h: 510 },
      { x: 668, y: 880, w: 420, h: 510 },
    ])
  } else if (active === 'polaroid') {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
    grad.addColorStop(0, '#ffe4e6'); grad.addColorStop(1, '#e0f2fe')
    drawBg(grad, 0)
    const cells = [
      { x: 125, y: 185, w: 440, h: 520, rotate: -5 },
      { x: 700, y: 210, w: 440, h: 520, rotate: 4 },
      { x: 135, y: 900, w: 440, h: 520, rotate: 3 },
      { x: 680, y: 910, w: 440, h: 520, rotate: -4 },
    ]
    cells.forEach((r, i) => {
      ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(r.rotate * Math.PI / 180)
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(15,23,42,.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8
      ctx.fillRect(-r.w / 2 - 26, -r.h / 2 - 26, r.w + 52, r.h + 92); ctx.restore()
      drawPage(imgs[i], { ...r, r: 4 }, { shadowBlur: 0 })
    })
    drawRibbon('真题预览', 430, 780, '#ffffff', '#be123c')
  } else if (active === 'blueCard') {
    drawBg('#e0f2fe', 0)
    drawHeader('题型结构一眼看', 86, 142, '#075985', 46)
    drawFourGrid([
      { x: 90, y: 230, w: 486, h: 510 },
      { x: 666, y: 230, w: 486, h: 510 },
      { x: 90, y: 885, w: 486, h: 510 },
      { x: 666, y: 885, w: 486, h: 510 },
    ], { shadowColor: 'rgba(14,116,144,.2)' })
  } else if (active === 'sideNote') {
    drawBg('#fff7ed', 0)
    drawPage(imgs[0], { x: 78, y: 120, w: 500, h: 640 })
    drawPage(imgs[1], { x: 78, y: 895, w: 500, h: 640 })
    drawPage(imgs[2], { x: 704, y: 210, w: 450, h: 500 })
    drawPage(imgs[3], { x: 704, y: 940, w: 450, h: 500 })
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(690, 735, 466, 165, 18); ctx.fill()
    ctx.fillStyle = '#fb923c'; ctx.fillRect(690, 735, 8, 165)
    ctx.fillStyle = '#7c2d12'; ctx.font = 'bold 34px "PingFang SC", sans-serif'
    ;['先看题型', '再刷真题', '最后复盘错题'].forEach((t, i) => ctx.fillText(t, 728, 790 + i * 42))
  } else if (active === 'diagonal') {
    drawBg('#f8fafc', 0)
    ctx.save(); ctx.translate(-180, 610); ctx.rotate(-0.17); ctx.fillStyle = '#ef4444'; ctx.fillRect(0, 0, 1600, 220); ctx.restore()
    drawFourGrid([
      { x: 90, y: 130, w: 470, h: 560, rotate: -2 },
      { x: 680, y: 130, w: 470, h: 560, rotate: 2 },
      { x: 90, y: 940, w: 470, h: 560, rotate: 2 },
      { x: 680, y: 940, w: 470, h: 560, rotate: -2 },
    ])
    ctx.save(); ctx.translate(460, 755); ctx.rotate(-0.17); drawHeader('刷透真题', 0, 0, '#fff', 72); ctx.restore()
  } else if (active === 'pinboard') {
    drawBg('#fefce8', 0)
    ;[
      [90, 82, '#f43f5e'], [1090, 82, '#22c55e'], [90, 1480, '#3b82f6'], [1090, 1480, '#f59e0b'],
    ].forEach(([x, y, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.fill() })
    drawFourGrid([
      { x: 96, y: 165, w: 486, h: 565, rotate: -1 },
      { x: 660, y: 165, w: 486, h: 565, rotate: 1 },
      { x: 96, y: 885, w: 486, h: 565, rotate: 1 },
      { x: 660, y: 885, w: 486, h: 565, rotate: -1 },
    ])
    drawRibbon('回忆版真题', 456, 770, '#111827', '#fff')
  } else if (active === 'darkReport') {
    drawBg('#0f172a', 0)
    drawHeader('真题复盘报告', 96, 140, '#f8fafc', 44)
    ctx.fillStyle = '#67e8f9'; ctx.font = 'bold 24px ui-monospace, monospace'; ctx.fillText('PDF / 4 PAGES', 920, 138)
    drawFourGrid([
      { x: 96, y: 235, w: 486, h: 520 },
      { x: 660, y: 235, w: 486, h: 520 },
      { x: 96, y: 875, w: 486, h: 520 },
      { x: 660, y: 875, w: 486, h: 520 },
    ], { shadowColor: 'rgba(0,0,0,0.45)' })
  } else if (active === 'cornerStamp') {
    drawBg('#ffffff', 12)
    drawFourGrid([
      { x: 96, y: 205, w: 486, h: 540 },
      { x: 660, y: 205, w: 486, h: 540 },
      { x: 96, y: 875, w: 486, h: 540 },
      { x: 660, y: 875, w: 486, h: 540 },
    ])
    ctx.save(); ctx.translate(1010, 170); ctx.rotate(0.2)
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 115, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#dc2626'; ctx.font = 'bold 42px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('资料', 0, -24); ctx.fillText('已整理', 0, 34); ctx.restore()
  } else if (active === 'tornPaper') {
    drawBg('#e7e5e4', 0)
    ctx.fillStyle = '#fffaf0'
    ctx.beginPath()
    ctx.moveTo(82, 110); ctx.lineTo(210, 82); ctx.lineTo(350, 108); ctx.lineTo(520, 82); ctx.lineTo(690, 112); ctx.lineTo(840, 86); ctx.lineTo(1010, 108); ctx.lineTo(1160, 86); ctx.lineTo(1134, 1530); ctx.lineTo(980, 1504); ctx.lineTo(800, 1530); ctx.lineTo(640, 1500); ctx.lineTo(470, 1528); ctx.lineTo(300, 1500); ctx.lineTo(120, 1530); ctx.closePath(); ctx.fill()
    drawHeader('考前资料包', 170, 165, '#78350f', 42)
    drawFourGrid([
      { x: 130, y: 235, w: 460, h: 540, rotate: -2 },
      { x: 650, y: 235, w: 460, h: 540, rotate: 2 },
      { x: 130, y: 865, w: 460, h: 540, rotate: 2 },
      { x: 650, y: 865, w: 460, h: 540, rotate: -2 },
    ])
  } else if (active === 'softGradient') {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
    grad.addColorStop(0, '#fef3c7'); grad.addColorStop(0.55, '#dbeafe'); grad.addColorStop(1, '#fce7f3')
    drawBg(grad, 0)
    drawFourGrid([
      { x: 96, y: 270, w: 486, h: 500 },
      { x: 660, y: 170, w: 486, h: 500 },
      { x: 96, y: 885, w: 486, h: 500 },
      { x: 660, y: 995, w: 486, h: 500 },
    ])
    drawRibbon('题型先过一遍', 430, 790, '#ffffff', '#1d4ed8')
  } else if (active === 'stackedFocus') {
    drawBg('#f4f5f8', 0)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.roundRect(82, 34, CANVAS_W - 164, CANVAS_H - 78, 18)
    ctx.stroke()

    drawPage(imgs[3] || imgs[2] || imgs[1] || imgs[0], { x: 148, y: 242, w: 640, h: 990, r: 4, rotate: -0.8 }, { shadowColor: 'rgba(15,23,42,0.18)', shadowBlur: 18, shadowOffsetY: 9 })
    drawPage(imgs[2] || imgs[1] || imgs[0], { x: 255, y: 342, w: 640, h: 990, r: 4, rotate: 0.4 }, { shadowColor: 'rgba(15,23,42,0.18)', shadowBlur: 18, shadowOffsetY: 9 })
    drawPage(imgs[1] || imgs[0], { x: 360, y: 470, w: 640, h: 990, r: 4, rotate: -0.2 }, { shadowColor: 'rgba(15,23,42,0.18)', shadowBlur: 18, shadowOffsetY: 9 })
    const front = { x: 460, y: 600, w: 670, h: 940, r: 2 }
    drawPage(imgs[0], front, { shadowColor: 'rgba(15,23,42,0.22)', shadowBlur: 20, shadowOffsetY: 10 })
    drawDashedFocus(front.x, front.y, front.w, front.h)
  } else if (active === 'minimalLine') {
    drawBg('#ffffff', 0)
    ctx.fillStyle = '#111827'; ctx.fillRect(74, 0, 24, CANVAS_H)
    drawHeader('PDF 真题预览', 150, 145, '#111827', 44)
    drawFourGrid([
      { x: 150, y: 215, w: 450, h: 540, r: 2 },
      { x: 680, y: 215, w: 450, h: 540, r: 2 },
      { x: 150, y: 875, w: 450, h: 540, r: 2 },
      { x: 680, y: 875, w: 450, h: 540, r: 2 },
    ], { shadow: false, r: 2 })
  }

  return canvas.toDataURL('image/png')
}

/** 下载 PDF 4页拼图（模糊已烧进 displayUrl，直接导出） */
async function downloadPdfGrid() {
  const src = pdfGridDrawer.displayUrl || pdfGridDrawer.gridUrl
  if (!src) return
  const name = pdfGridDrawer.file?.name?.replace(/\.pdf$/i, '') || 'pdf_grid'
  const a = document.createElement('a')
  a.href = src
  a.download = `${name}_4页拼图.png`
  a.click()
}

// --- 打包下载全部目录图 ---
const batchDownloading = ref(false)
const batchProgress = reactive({ done: 0, total: 0 })

let jsZipLib = null
async function ensureJSZip() {
  if (jsZipLib) return jsZipLib
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  jsZipLib = window.JSZip
  return jsZipLib
}

/**
 * 带重试的 getBaiduFiles（最多 MAX_RETRY 次）
 */
async function getBaiduFilesWithRetry(path, MAX_RETRY = 5) {
  let lastErr = null
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      return await getBaiduFiles(path)
    } catch (e) {
      lastErr = e
      if (attempt < MAX_RETRY) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }
  throw lastErr
}

/**
 * 生成某个目录的目录图（dataURL），失败抛出异常
 * type: 'exam' | 'history' | 'mock' | 'custom'
 */
async function buildDirImageForBatch(path, type, title) {
  const res = await getBaiduFilesWithRetry(path)
  const files = filterDirFilesByType(res.files, type)
  if (!files.length) throw new Error('目录为空')
  files.sort((a, b) => b.isdir - a.isdir)

  if (type === 'history' || type === 'mock') {
    const keyword = type === 'mock' ? '2026' : '2025'
    const targetPdf = files.find(f => f.isdir === 0 && f.name.includes(keyword))
    if (targetPdf) {
      try {
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
        const pdfDataUrl = pdfCanvas.toDataURL('image/png')
        return await buildHistoryComposite(pdfDataUrl, files, '#F9863B', title, pickRandomBgColor(), 0.35)
      } catch (_) {
        // PDF 合成失败时降级为纯目录图
      }
    }
    return renderCompositeImage(files, title, '#F9863B', pickRandomBgColor(), 0.35)
  }

  if (type === 'custom') {
    const pdfFiles = files.filter(f => f.isdir === 0 && /\.pdf$/i.test(f.name))
    if (pdfFiles.length) {
      try {
        const pdfFile = pdfFiles[Math.floor(Math.random() * pdfFiles.length)]
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
        const pdfDataUrl = pdfCanvas.toDataURL('image/png')
        return await buildHistoryComposite(pdfDataUrl, files, '#F9863B', title, pickRandomBgColor(), 0.35)
      } catch (_) {
        // PDF 合成失败时降级为纯目录图
      }
    }
    return renderCompositeImage(files, title, '#F9863B', pickRandomBgColor(), 0.35)
  }

  // exam 类型：纯目录图
  return renderCompositeImage(files, title, '#F9863B', pickRandomBgColor(), 0.35)
}

async function batchDownloadAllDirImages() {
  if (batchDownloading.value) return

  // 收集需要下载的目录任务
  const tasks = []
  if (data.value.baidu_path_exam) {
    tasks.push({ path: data.value.baidu_path_exam, type: 'exam', label: '笔试资料目录', title: '笔试资料完整目录' })
  }
  if (data.value.baidu_path_exam) {
    // 企业文化：复用 exam 路径，需要找「企业文化」PDF
    tasks.push({ path: data.value.baidu_path_exam, type: 'culture', label: '企业文化目录', title: '企业近况及文化' })
  }
  if (data.value.baidu_path_history) {
    tasks.push({ path: data.value.baidu_path_history, type: 'history', label: '真题目录', title: pickRandomHistoryTitle() })
  }
  if (data.value.baidu_path_mock) {
    tasks.push({ path: data.value.baidu_path_mock, type: 'mock', label: '模拟题目录', title: pickRandomMockTitle() })
  }
  if (data.value.baidu_path_interview) {
    tasks.push({ path: data.value.baidu_path_interview, type: 'interview', label: '面试题目录', title: '面试题完整目录' })
  }
  if (data.value.baidu_custom_dirs?.length) {
    data.value.baidu_custom_dirs.forEach((item, idx) => {
      tasks.push({ path: item.path, type: 'custom', label: item.name || `自定义${idx + 1}`, title: item.name || '自定义' })
    })
  }

  if (!tasks.length) {
    message.warning('暂无可下载的目录')
    return
  }

  batchDownloading.value = true
  batchProgress.done = 0
  batchProgress.total = tasks.length

  let JSZip
  try {
    JSZip = await ensureJSZip()
  } catch (e) {
    message.error('JSZip 加载失败，请检查网络')
    batchDownloading.value = false
    return
  }

  const zip = new JSZip()
  const company = data.value.company_name || 'product'
  const errors = []

  for (const task of tasks) {
    try {
      let dataUrl

      if (task.type === 'culture') {
        // 企业文化：在 exam 路径下找「企业文化」PDF
        const res = await getBaiduFilesWithRetry(task.path)
        const files = res.files || []
        files.sort((a, b) => b.isdir - a.isdir)
        const culturePdf = files.find(f => f.isdir === 0 && f.name.includes('企业文化'))
        if (!culturePdf) {
          errors.push(`${task.label}：未找到"企业文化"PDF文件`)
          batchProgress.done++
          continue
        }
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
          const pdfDataUrl = pdfCanvas.toDataURL('image/png')
          dataUrl = await buildHistoryComposite(pdfDataUrl, files, '#F9863B', task.title, pickRandomBgColor(), 0.35)
        } catch (e) {
          errors.push(`${task.label}：${e.message || '生成失败'}`)
          batchProgress.done++
          continue
        }
      } else {
        dataUrl = await buildDirImageForBatch(task.path, task.type, task.title)
      }

      // dataURL → base64 → 加入 zip（dataURL 为 PNG）
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
      zip.file(`${company}-${task.label}.png`, base64, { base64: true })
    } catch (e) {
      errors.push(`${task.label}：${e.message || '生成失败'}`)
    }
    batchProgress.done++
  }

  if (errors.length === tasks.length) {
    message.error('所有目录图生成失败：' + errors.join('；'))
    batchDownloading.value = false
    return
  }

  try {
    const blob = await zip.generateAsync({ type: 'blob' })
    triggerBlobDownload(blob, `${company}-百度网盘目录图.zip`)
    if (errors.length) {
      message.warning(`已打包 ${tasks.length - errors.length} 张，${errors.length} 张失败：${errors.join('；')}`)
    } else {
      message.success(`已成功打包 ${tasks.length} 张目录图`)
    }
  } catch (e) {
    message.error('ZIP 生成失败：' + (e.message || '未知错误'))
  } finally {
    batchDownloading.value = false
  }
}

// --- 自定义目录：打开并随机预览一个 PDF ---
async function openCustomDir(item, idx) {
  if (!item.path) {
    message.warning('该条目未配置路径')
    return
  }
  customLoading.value = idx
  const MAX_RETRY = 5
  let lastErr = null
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await getBaiduFiles(item.path)
      const files = res.files || []
      // 筛选 PDF 文件（isdir===0 且文件名以 .pdf 结尾，不区分大小写）
      const pdfFiles = files.filter(f => f.isdir === 0 && /\.pdf$/i.test(f.name))
      if (!pdfFiles.length) {
        message.warning('该目录下暂无 PDF 文件')
        customLoading.value = -1
        return
      }

      // 随机选一个 PDF
      const pdfFile = pdfFiles[Math.floor(Math.random() * pdfFiles.length)]

      // 目录文件列表（文件夹在前）
      const sortedFiles = [...files].sort((a, b) => b.isdir - a.isdir)

      // 初始化抽屉状态（首次进入时打开抽屉）
      if (attempt === 1) {
        const bgImg = getActiveBgImageUrl()
        dirDrawer.type = 'custom'
        dirDrawer.customIndex = idx
        dirDrawer.dirMode = 'dir'
        dirDrawer.title = item.name || '自定义'
        dirDrawer.dirStyle = 'classic'
        dirDrawer.pdfSingleStyle = 'classic'
        dirDrawer.borderColor = '#F9863B'
        dirDrawer.bgOpacity = 0.35
        dirDrawer.dirOnly = false
        dirDrawer.previewUrl = ''
        dirDrawer.pdfPageDataUrl = ''
        dirDrawer.pdfPreviewUrl = ''
        dirDrawer.pdfFsid = null
        dirDrawer.pdfFileName = ''
        dirDrawer.loading = true
        dirDrawer.visible = true
      }
      dirDrawer.files = sortedFiles

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
        dirDrawer.bgColor, dirDrawer.bgOpacity,
        getActiveBgImageUrl(), dirDrawer.titleY,
        dirDrawer.pdfSingleStyle
      )
      lastErr = null
      break  // 成功，退出重试循环
    } catch (e) {
      lastErr = e
      if (attempt < MAX_RETRY) {
        message.warning(`第 ${attempt} 次请求失败，正在自动重试...`)
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }
  if (lastErr) {
    message.error((lastErr.message || '打开失败') + `，已重试 ${MAX_RETRY} 次`)
    dirDrawer.visible = false
  }
  dirDrawer.loading = false
  customLoading.value = -1
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

.cover-prompt-picker {
  margin-bottom: 14px;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.cover-prompt-picker__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cover-prompt-picker__label {
  color: #555;
  font-size: 13px;
  font-weight: 500;
}

.cover-prompt-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  max-height: 420px;
  margin-top: 12px;
  overflow-y: auto;
}

.cover-prompt-option {
  position: relative;
  min-width: 0;
  padding: 8px;
  color: inherit;
  text-align: left;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.cover-prompt-option:hover,
.cover-prompt-option--active {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12);
}

.cover-prompt-option__image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 150px;
  margin-bottom: 8px;
  overflow: hidden;
  color: #aaa;
  font-size: 12px;
  background: #f5f5f5;
  border-radius: 4px;
}

.cover-prompt-option__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-prompt-option__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.cover-prompt-option__meta strong,
.cover-prompt-option__meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cover-prompt-option__meta strong {
  padding-right: 20px;
  color: #222;
  font-size: 13px;
}

.cover-prompt-option__meta span {
  color: #999;
  font-size: 12px;
}

.cover-prompt-option__check {
  position: absolute;
  right: 10px;
  bottom: 28px;
  color: #1677ff;
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

.batch-card-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.batch-card-result__image {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 280px;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

.card-template-picker__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: #555;
  font-size: 13px;
}

.card-template-picker__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  max-height: 620px;
  overflow-y: auto;
}

.card-template-picker__item {
  position: relative;
  min-width: 0;
  padding: 8px;
  color: #333;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  cursor: pointer;
}

.card-template-picker__item:hover,
.card-template-picker__item--active {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12);
}

.card-template-picker__item img {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 4px;
}

.card-template-picker__item span {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  font-size: 13px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-template-picker__item > .anticon {
  position: absolute;
  top: 14px;
  right: 14px;
  padding: 4px;
  color: #fff;
  background: #1677ff;
  border-radius: 50%;
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

.community-loading {
  min-height: 240px;
}

.community-result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
}

.community-result-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.community-result-item :deep(.ant-image img) {
  width: 180px;
  height: 240px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #eee;
}

.community-template-label {
  color: #666;
  font-size: 12px;
  white-space: nowrap;
}

.community-render-host {
  position: fixed;
  left: -99999px;
  top: 0;
  width: 1080px;
  height: 1440px;
  overflow: hidden;
  pointer-events: none;
}

.community-poster {
  --cw-primary: #cf0a32;
  --cw-primary-dark: #b6072a;
  --cw-secondary: #286ec8;
  --cw-danger: #d33a32;
  --cw-footer-bg: #fff3df;
  --cw-footer-text: #b14b08;
  --cw-footer-line: #eba92e;
  --cw-black: #111;
  position: relative;
  width: 1080px;
  height: 1440px;
  overflow: hidden;
  background: #fff;
  color: #262a31;
  font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
  font-weight: 800;
  letter-spacing: 0;
}

.community-poster.cw-theme-blue {
  --cw-primary: #1556a8;
  --cw-primary-dark: #0d3f82;
  --cw-secondary: #d96b1f;
  --cw-danger: #c93737;
  --cw-footer-bg: #eaf3ff;
  --cw-footer-text: #0d4b92;
  --cw-footer-line: #f0a23a;
  --cw-black: #10233f;
}

.community-poster.cw-theme-green {
  --cw-primary: #1f7a4d;
  --cw-primary-dark: #155f3a;
  --cw-secondary: #b76b10;
  --cw-danger: #c33d32;
  --cw-footer-bg: #eef8ed;
  --cw-footer-text: #17623a;
  --cw-footer-line: #d8a12f;
  --cw-black: #132c23;
}

.community-poster.cw-theme-purple {
  --cw-primary: #6b3fa0;
  --cw-primary-dark: #512b7e;
  --cw-secondary: #1e73be;
  --cw-danger: #c63b5d;
  --cw-footer-bg: #f4edff;
  --cw-footer-text: #5b2d86;
  --cw-footer-line: #c49a3c;
  --cw-black: #251d31;
}

.community-poster.cw-theme-orange {
  --cw-primary: #d75a1d;
  --cw-primary-dark: #a94112;
  --cw-secondary: #1672b8;
  --cw-danger: #bc2f2f;
  --cw-footer-bg: #fff1e6;
  --cw-footer-text: #b44a16;
  --cw-footer-line: #e0aa24;
  --cw-black: #2d2118;
}

.community-poster.cw-theme-teal {
  --cw-primary: #087b83;
  --cw-primary-dark: #06626a;
  --cw-secondary: #b06a20;
  --cw-danger: #c84343;
  --cw-footer-bg: #e8f8f7;
  --cw-footer-text: #05656b;
  --cw-footer-line: #d9a63f;
  --cw-black: #102a2e;
}

.community-poster.cw-theme-brown {
  --cw-primary: #7a5235;
  --cw-primary-dark: #5d3d28;
  --cw-secondary: #1f6fb2;
  --cw-danger: #b83b34;
  --cw-footer-bg: #f7efe5;
  --cw-footer-text: #6b4329;
  --cw-footer-line: #c8964a;
  --cw-black: #2a211a;
}

.community-poster.cw-theme-rose {
  --cw-primary: #c0265b;
  --cw-primary-dark: #951b45;
  --cw-secondary: #176eb3;
  --cw-danger: #d14a32;
  --cw-footer-bg: #fff0f4;
  --cw-footer-text: #a41d4a;
  --cw-footer-line: #e3a338;
  --cw-black: #2e1822;
}

.cw-header {
  height: 316px;
  padding: 36px 64px 0;
  background: var(--cw-primary);
  color: #fff;
}

.cw-page-detail .cw-header {
  height: 262px;
}

.cw-kicker {
  font-size: 28px;
  line-height: 1.2;
  font-weight: 900;
}

.cw-title {
  margin-top: 16px;
  font-size: 52px;
  line-height: 1.12;
  font-weight: 900;
  white-space: nowrap;
}

.cw-page-detail .cw-title {
  margin-top: 18px;
  font-size: 56px;
}

.cw-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 62px;
  margin-top: 12px;
  padding: 0 28px;
  border: 3px solid #fff;
  font-size: 30px;
  line-height: 1;
  font-weight: 900;
}

.cw-subrow {
  position: absolute;
  left: 64px;
  right: 64px;
  top: 238px;
  height: 58px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, .45);
  font-size: 26px;
  font-weight: 900;
}

.cw-page-detail .cw-subrow {
  top: 182px;
}

.cw-subrow strong {
  font-size: 36px;
  letter-spacing: 4px;
}

.cw-body {
  position: absolute;
  left: 64px;
  right: 64px;
  top: 360px;
  bottom: 92px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.cw-page-detail .cw-body {
  top: 300px;
  justify-content: flex-start;
}

.cw-body-overview {
  top: 360px;
  justify-content: flex-start;
}

.cw-blackbar {
  height: 66px;
  padding: 0 30px;
  display: flex;
  align-items: center;
  background: var(--cw-black);
  border-radius: 14px;
  color: #fff;
  font-size: 28px;
  font-weight: 900;
}

.cw-blackbar b {
  color: #f5b53f;
  margin: 0 6px;
}

.cw-section-title {
  margin-top: 20px;
  padding-left: 24px;
  border-left: 9px solid var(--cw-primary);
  color: var(--cw-primary);
  font-size: 32px;
  line-height: 1.25;
  font-weight: 900;
}

.cw-overview-grid {
  display: grid;
  grid-template-columns: 210px 1fr;
  gap: 28px;
  margin-top: 14px;
}

.cw-module-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cw-module-pill,
.cw-row-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 66px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--cw-primary);
  color: #fff;
  text-align: center;
  font-size: 28px;
  line-height: 1.16;
  font-weight: 900;
}

.cw-module-points {
  padding-top: 6px;
}

.cw-row {
  display: grid;
  grid-template-columns: 232px 1fr;
  gap: 30px;
  align-items: center;
  min-height: 162px;
  border-bottom: 2px dashed #e5e9ef;
}

.cw-page-detail .cw-row {
  min-height: 148px;
}

.cw-row:last-child {
  border-bottom: none;
}

.cw-row-label {
  min-height: 80px;
  font-size: 28px;
}

.cw-row-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cw-dot-line {
  position: relative;
  padding-left: 28px;
  font-size: 26px;
  line-height: 1.32;
  color: #2a2e34;
  font-weight: 900;
}

.cw-dot-line::before {
  content: "";
  position: absolute;
  left: 0;
  top: .56em;
  width: 8px;
  height: 8px;
  background: var(--cw-primary);
}

.cw-blue {
  color: var(--cw-secondary);
}

.cw-red {
  color: var(--cw-danger);
}

.cw-page-detail.cw-template-compact .cw-body {
  top: 286px;
}

.cw-page-detail.cw-template-compact .cw-row {
  grid-template-columns: 210px 1fr;
  gap: 22px;
  min-height: 132px;
}

.cw-page-detail.cw-template-compact .cw-row-label {
  min-height: 66px;
  font-size: 26px;
}

.cw-page-detail.cw-template-compact .cw-row-content {
  gap: 8px;
}

.cw-page-detail.cw-template-compact .cw-dot-line {
  font-size: 24px;
  line-height: 1.24;
}

.cw-page-detail.cw-template-card .cw-body {
  top: 292px;
  gap: 16px;
}

.cw-page-detail.cw-template-card .cw-row {
  min-height: 126px;
  padding: 14px 18px;
  border: 2px solid #edf0f4;
  border-bottom: 2px solid #edf0f4;
  border-radius: 16px;
  background: #fbfcff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, .04);
}

.cw-page-detail.cw-template-card .cw-row-label {
  min-height: 66px;
  border-radius: 14px;
  font-size: 26px;
}

.cw-page-detail.cw-template-card .cw-row-content {
  gap: 9px;
}

.cw-page-detail.cw-template-card .cw-dot-line {
  font-size: 24px;
  line-height: 1.24;
}

.cw-page-detail.cw-template-table .cw-body {
  top: 290px;
  border-top: 4px solid var(--cw-primary);
  border-bottom: 4px solid var(--cw-primary);
}

.cw-page-detail.cw-template-table .cw-row {
  grid-template-columns: 252px 1fr;
  gap: 24px;
  min-height: 138px;
  border-bottom: 2px solid #e5e9ef;
}

.cw-page-detail.cw-template-table .cw-row-label {
  min-height: 88px;
  justify-content: flex-start;
  padding-left: 22px;
  border-radius: 0;
  border-left: 10px solid var(--cw-primary);
  background: transparent;
  color: var(--cw-primary);
  font-size: 27px;
}

.cw-page-detail.cw-template-table .cw-row-content {
  gap: 10px;
}

.cw-page-detail.cw-template-table .cw-dot-line {
  font-size: 25px;
  line-height: 1.26;
}

.cw-page-detail.cw-template-outline .cw-body {
  top: 292px;
}

.cw-page-detail.cw-template-outline .cw-row {
  grid-template-columns: 238px 1fr;
  gap: 28px;
  min-height: 140px;
  border-bottom: 1px dashed #d8dee8;
}

.cw-page-detail.cw-template-outline .cw-row-label {
  min-height: 76px;
  border: 3px solid var(--cw-primary);
  background: #fff;
  color: var(--cw-primary);
  font-size: 27px;
}

.cw-page-detail.cw-template-outline .cw-row-content {
  gap: 10px;
}

.cw-page-detail.cw-template-outline .cw-dot-line {
  font-size: 25px;
  line-height: 1.27;
}

.cw-page-detail.cw-template-outline .cw-dot-line::before {
  border-radius: 50%;
}

.cw-timeline {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 18px 84px 0;
}

.cw-timeline::before {
  content: "";
  position: absolute;
  left: 26px;
  right: 26px;
  top: 13px;
  height: 4px;
  background: var(--cw-primary);
}

.cw-time-point {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.cw-time-point span {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--cw-primary);
}

.cw-time-point strong {
  margin-top: 22px;
  color: var(--cw-primary);
  font-size: 30px;
  line-height: 1;
}

.cw-time-point em {
  margin-top: 8px;
  color: #555;
  font-size: 20px;
  line-height: 1.34;
  font-style: normal;
  white-space: pre-line;
}

.cw-key-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.cw-key-list > div {
  font-size: 24px;
  line-height: 1.34;
}

.cw-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  border-top: 4px solid var(--cw-footer-line);
  background: var(--cw-footer-bg);
  color: var(--cw-footer-text);
  font-size: 26px;
  font-weight: 900;
}

.cw-footer em {
  font-style: normal;
}

.community-mind-poster {
  --cmm-navy: #123f5c;
  --cmm-green: #108460;
  --cmm-red: #d9372d;
  --cmm-gold: #f0a628;
  --cmm-text: #565b60;
  position: relative;
  width: 1080px;
  height: 1440px;
  overflow: hidden;
  background: #fff;
  color: #123f5c;
  font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
  font-weight: 900;
  letter-spacing: 0;
}

.community-mind-poster.cmm-theme-emerald {
  --cmm-navy: #0f4b4f;
  --cmm-green: #0f8a68;
  --cmm-red: #c94b36;
  --cmm-gold: #e4a527;
}

.community-mind-poster.cmm-theme-indigo {
  --cmm-navy: #243f75;
  --cmm-green: #16806d;
  --cmm-red: #d23a55;
  --cmm-gold: #e2a12d;
}

.community-mind-poster.cmm-theme-brown {
  --cmm-navy: #59432e;
  --cmm-green: #2f7a55;
  --cmm-red: #c64132;
  --cmm-gold: #d89a2d;
}

.community-mind-poster.cmm-theme-ocean {
  --cmm-navy: #0d4969;
  --cmm-green: #0f7f91;
  --cmm-red: #d45536;
  --cmm-gold: #e7a62d;
  --cmm-text: #53606a;
}

.community-mind-poster.cmm-theme-cyan {
  --cmm-navy: #10586a;
  --cmm-green: #109a8f;
  --cmm-red: #cf3d4f;
  --cmm-gold: #dba72a;
  --cmm-text: #526466;
}

.community-mind-poster.cmm-theme-wine {
  --cmm-navy: #5a263a;
  --cmm-green: #2f8a61;
  --cmm-red: #b92d4f;
  --cmm-gold: #d7a133;
  --cmm-text: #5f5459;
}

.community-mind-poster.cmm-theme-violet {
  --cmm-navy: #45346f;
  --cmm-green: #2f8374;
  --cmm-red: #c43f6f;
  --cmm-gold: #d8a63c;
  --cmm-text: #585567;
}

.community-mind-poster.cmm-theme-olive {
  --cmm-navy: #4e5b2b;
  --cmm-green: #6f7f2a;
  --cmm-red: #c95a2c;
  --cmm-gold: #d69a28;
  --cmm-text: #5f6153;
}

.community-mind-poster.cmm-theme-graphite {
  --cmm-navy: #2f3f4a;
  --cmm-green: #4f7d72;
  --cmm-red: #c7473f;
  --cmm-gold: #d3a23a;
  --cmm-text: #555f64;
}

.community-mind-poster.cmm-theme-coral {
  --cmm-navy: #5c3b34;
  --cmm-green: #23876f;
  --cmm-red: #e05a45;
  --cmm-gold: #df9e2c;
  --cmm-text: #625954;
}

.community-mind-poster.cmm-theme-pine {
  --cmm-navy: #1d4a3b;
  --cmm-green: #17715a;
  --cmm-red: #bd3b2f;
  --cmm-gold: #d6a33a;
  --cmm-text: #52605b;
}

.cmm-header {
  height: 245px;
  padding: 34px 60px 0;
  background: var(--cmm-navy);
  color: #fff;
}

.cmm-kicker {
  font-size: 25px;
  line-height: 1.2;
}

.cmm-title {
  margin-top: 18px;
  font-size: 54px;
  line-height: 1.08;
  white-space: nowrap;
}

.cmm-line {
  height: 1px;
  margin-top: 22px;
  background: rgba(255, 255, 255, .45);
}

.cmm-subrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  font-size: 27px;
}

.cmm-subrow strong {
  font-size: 34px;
  letter-spacing: 4px;
}

.cmm-body {
  position: absolute;
  left: 60px;
  right: 60px;
  top: 245px;
  bottom: 90px;
}

.cmm-body-overview,
.cmm-body-branch {
  overflow: hidden;
}

.cmm-overview-lines,
.cmm-branch-lines {
  position: absolute;
  left: 0;
  top: 0;
  width: 960px;
  height: 890px;
  overflow: visible;
  pointer-events: none;
  color: var(--cmm-green);
}

.cmm-overview-lines {
  top: 0;
  height: 620px;
}

.cmm-overview-lines path,
.cmm-branch-lines path {
  fill: none;
  stroke: var(--cmm-green);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cmm-branch-lines .cmm-line-red {
  stroke: var(--cmm-red);
}

.cmm-root-node,
.cmm-center-node,
.cmm-node-title {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  text-align: center;
  box-shadow: 0 2px 0 rgba(0, 0, 0, .02);
}

.cmm-root-node {
  position: absolute;
  left: 356px;
  top: 36px;
  width: 240px;
  height: 68px;
  border-radius: 14px;
  background: var(--cmm-navy);
  font-size: 28px;
  line-height: 1.08;
}

.cmm-center-node {
  position: absolute;
  left: 370px;
  top: 362px;
  width: 220px;
  height: 92px;
  flex-direction: column;
  border-radius: 16px;
  background: var(--cmm-navy);
}

.cmm-center-node strong {
  font-size: 31px;
  line-height: 1.1;
}

.cmm-center-node span {
  margin-top: 12px;
  padding: 7px 18px;
  border-radius: 999px;
  background: var(--cmm-red);
  font-size: 25px;
  line-height: 1;
}

.cmm-node {
  position: absolute;
  width: 306px;
}

.cmm-overview-node {
  width: 292px;
}

.cmm-branch-node {
  width: 300px;
}

.cmm-node-title {
  min-height: 58px;
  padding: 0 16px;
  border-radius: 12px;
  background: var(--cmm-green);
  font-size: 25px;
  line-height: 1.12;
}

.cmm-node-blue .cmm-node-title,
.cmm-node-blue {
  --cmm-node-bg: var(--cmm-navy);
}

.cmm-node-blue .cmm-node-title {
  background: var(--cmm-navy);
}

.cmm-node-red .cmm-node-title {
  background: var(--cmm-red);
}

.cmm-node-green .cmm-node-title {
  background: var(--cmm-green);
}

.cmm-node-text,
.cmm-node-lines {
  margin-top: 14px;
  color: var(--cmm-text);
  font-size: 20px;
  line-height: 1.46;
  text-align: center;
}

.cmm-node-lines {
  text-align: left;
}

.cmm-node-lines div {
  margin-bottom: 4px;
}

.cmm-overview-summary {
  position: absolute;
  left: 0;
  right: 0;
  top: 620px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--cmm-navy);
}

.cmm-overview-summary strong {
  font-size: 29px;
}

.cmm-overview-summary span {
  color: #80858a;
  font-size: 22px;
}

.cmm-phase-row {
  position: absolute;
  left: 0;
  right: 0;
  top: 735px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}

.cmm-phase-card {
  height: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 3px solid var(--cmm-green);
  border-radius: 12px;
  background: rgba(16, 132, 96, .1);
  color: var(--cmm-green);
}

.cmm-phase-card strong {
  font-size: 23px;
}

.cmm-phase-card span {
  color: #666;
  font-size: 18px;
}

.cmm-tag-row {
  position: absolute;
  left: 36px;
  right: 36px;
  top: 910px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px 16px;
}

.cmm-tag-row span {
  min-height: 44px;
  padding: 8px 20px;
  border-radius: 999px;
  background: rgba(16, 132, 96, .12);
  color: var(--cmm-green);
  font-size: 22px;
  line-height: 1.2;
}

.cmm-tip {
  position: absolute;
  right: 42px;
  bottom: 54px;
  width: 326px;
  min-height: 130px;
  padding: 20px 24px;
  border: 3px solid var(--cmm-gold);
  border-radius: 14px;
  background: #fff8e8;
  color: #a8520a;
  text-align: center;
}

.cmm-tip-red {
  border-color: var(--cmm-red);
  background: #fff0ee;
  color: #a7211c;
}

.cmm-tip strong {
  display: block;
  margin-bottom: 12px;
  font-size: 26px;
}

.cmm-tip span {
  display: block;
  margin-top: 8px;
  font-size: 20px;
  line-height: 1.28;
}

.cmm-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  border-top: 4px solid var(--cmm-gold);
  background: #fff3df;
  color: #b14b08;
  font-size: 26px;
}

.cmm-footer em {
  font-style: normal;
}
</style>
