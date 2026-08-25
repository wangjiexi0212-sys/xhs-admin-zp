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
        <a-button @click="openExamCard">
          <template #icon><PictureOutlined /></template>
          生图
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
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;background:#fff;padding:10px 20px;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,0.08)">
            <span style="font-size:13px;color:#555;white-space:nowrap">模糊程度：</span>
            <input
              type="range"
              v-model.number="pdfGridDrawer.blurAmount"
              min="0"
              max="20"
              step="0.5"
              style="width:160px;accent-color:#1677ff;cursor:pointer"
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
            <a-button type="primary" size="large" @click="downloadPdfGrid">
              ⬇ 下载拼图（PNG）
            </a-button>
          </div>

          <!-- ③ 预览图 -->
          <img
            :src="pdfGridDrawer.displayUrl || pdfGridDrawer.gridUrl"
            :style="{
              maxWidth: 'min(100%, 560px)',
              boxShadow: '0 6px 28px rgba(0,0,0,0.18)',
              borderRadius: '12px',
              display: 'block',
              flexShrink: 0,
              filter: pdfGridDrawer.blurAmount > 0 ? `blur(${pdfGridDrawer.blurAmount}px)` : 'none',
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
                <a-button v-if="titlePromptUsed" type="link" size="small" @click="titlePromptVisible = true">
                  提示词
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
                <a-button type="link" size="small" :loading="bodyGenerating" @click="templateModalVisible = true">
                  模版生成
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

    <!-- 生成标题 提示词 弹窗 -->
    <a-modal
      v-model:open="titlePromptVisible"
      title="生成标题 · 提示词"
      :footer="null"
      width="600px"
      destroy-on-close
    >
      <template v-if="titlePromptUsed">
        <div style="margin-bottom: 12px;">
          <div style="font-size: 12px; color: #999; margin-bottom: 4px;">System（系统提示词）</div>
          <a-textarea :value="titlePromptUsed.system" :auto-size="{ minRows: 4, maxRows: 12 }" readonly />
        </div>
        <div>
          <div style="font-size: 12px; color: #999; margin-bottom: 4px;">User（用户输入）</div>
          <a-textarea :value="titlePromptUsed.user" :auto-size="{ minRows: 3, maxRows: 10 }" readonly />
        </div>
      </template>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { LeftOutlined, EditOutlined, FileTextOutlined, DownloadOutlined, BulbOutlined, FileWordOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, FormOutlined, StopOutlined, CopyOutlined, PictureOutlined } from '@ant-design/icons-vue'
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
import { getBgImageList } from '@/api/bgImages'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

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
const titlePromptUsed = ref(null) // { system: string, user: string } | null
const titlePromptVisible = ref(false)
const templateModalVisible = ref(false)

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

const BODY_TEMPLATES = [
  {
    id: 1,
    title: '考点解析型',
    desc: '按科目拆解各科考什么',
    content: `26山东发展投资集团校招，笔试考什么？附真题
谁懂啊家人们！山东发展投资 26 校招网申都开冲了🥹 截止到 7 月 31 号！
后台被问麻了：笔试到底考啥？有没有真题能刷？
刚把往届考情扒完 + 整理好资料包，说点实打实的干货！
✅ 行测
45-55 道单选题，言语、数量、判断、资料分析四大块
难度比山东省考低，但题量很紧，非常拼做题速度
重点死磕判断推理 + 资料分析，提分巨快，别死磕数量难题浪费时间💨
✅ 公基 + 企业文化
单选多选都有，时政、山东省情、党建法律是常客
集团的愿景使命、核心业务、发展战略是必考点！
官网翻 5 分钟就能拿的送分题，千万别丢分丢得冤🙅‍♀️
✅ 材料写作
基本 1-2 道主观题，以议论文为主，偶尔考公文
主题常围绕国企担当、产业投资、双碳、山东区域经济
提前攒几套行文框架 + 专属金句，上考场直接套不慌✍️
✅ 岗位专业知识
专业岗必考，综合岗基本不考
投资、财会、人力各岗考各的，别瞎复习别的岗内容
整理了 22-25 年考生回忆版真题 + 全套备考包
行测公基高分笔记、写作范文、企业文化押题卷、省情时政汇总都有
都是往届学长学姐考完攒的一手题，题型考点完全对标，考前刷一遍直接找手感🔥
最后敲黑板：笔试大概率八月初就安排，别等网申过了再学！
早准备早上岸，冲就完事了～`,
  },
  {
    id: 2,
    title: 'N天冲刺计划型',
    desc: '分天结构化备考安排',
    content: `山东发展投资集团笔试资料，5天拿下85+
救命！山东发展投资集团笔试，5 天裸考冲 85 + 真的够了🤯
Day1-2 死磕行测 + 公基（占分大头）
行测别挨个抠知识点，直接上做题技巧 + 黄金公式，重点死磕判断推理和资料分析，提分巨快！数量挑简单题型练，难题直接蒙，性价比太低。公基直接背高频考点 + 记忆口诀，地毯式复习纯纯浪费时间🙅‍♀️
Day3 薅企业文化 + 省情时政的分
纯纯送分题！集团的定位、核心业务、发展愿景过一遍，搭配近半年山东时政速记，半天就能刷完，白捡的分千万别丢✅
Day4 写作 + 专业知识收尾
写作别背百篇范文，直接记国企写作通用框架 + 专属金句，主题往国企担当、产业投资、双碳上靠，考场直接套。专业岗刷对应题库抓核心，综合岗直接跳过省时间⏰
Day5 刷回忆真题找手感
22-25 年考生回忆卷掐时间整套做，熟悉出题套路，错题复盘一遍，比瞎刷模拟题管用 10 倍🔥
资料都整理妥了，直接拿走去冲！`,
  },
  {
    id: 3,
    title: '资料清单型',
    desc: '详细列举各类资料包内容',
    content: `放心背！26山东发展投资，笔试真题+讲义~
放心背！26 山东发展投资笔试真的不用裸考硬熬😭
历年考点重复率巨高，找对资料直接抄作业就行，别再走弯路当陪跑了🙏
✅ 集团概况 + 山东时政速记
官网核心信息都整理好了，搭配近一年山东时政高频考点，都是选择判断的常客，考前突击背完直接拿分💯
✅ 行测 + 公基全套干货
三色笔记 + 考点汇总 + 专项题库，言语、判断、公基法律经济这些重点模块都捋得明明白白，零基础也能直接上手，不用死磕大本教材📝
✅ 岗位专业知识 + 写作
财会、人力、计算机、工程这些常招岗都有对应题库；还有国企写作金句 + 精选范文，大作文直接套框架，考场提笔就写不卡壳✍️
✅ 22-25 年考生回忆真题
都是往届学长学姐考完整理的回忆版真题，带完整答案解析，刷完直接摸透出题套路，考场撞见熟题真的爽飞🚀
备考时间紧的宝子直接拿这套冲，不用自己瞎整理浪费时间！
祝大家都能稳稳上岸呀🎉`,
  },
  {
    id: 4,
    title: '复习顺序攻略型',
    desc: '步骤捋清复习优先级',
    content: `山东发展投资集团，笔试不难，背完保底86+
准备山发投笔试的小伙伴别慌！亲身经验，这套笔试没有想象中难，抓对重点短期冲刺完全来得及。
整套笔试分为几大块：集团企业文化、公基、行测、岗位专业知识，部分岗位会考写作。
⚠️重中之重：企业认知题一定要先啃！愿景、使命、企业口号、集团重组背景是高频考点，属于送分题，千万别丢。
复习顺序给大家捋好了：
1. 先刷历年考生回忆真题，摸清出题偏好；
2. 吃透山发投企业文化资料，配套题库反复练；
3. 行测抓技巧，不用盲目海量刷题；
4. 公基侧重山东时政、省情；
5. 最后针对性复习对应岗位专业内容。
不用死磕全部资料，优先攻克高频模块！短期备考抓核心考点，把基础分稳稳拿到手。
认真背完重点内容，分数很容易拉上来，预祝大家笔试顺利进面✨`,
  },
  {
    id: 5,
    title: '题库模块型',
    desc: '按模块推荐题库资料',
    content: `山东发展投资，笔试题库+答案，稳稳86+
备考山发投的宝子看过来！别盲目啃书啦😮‍💨
整理了历年考生回忆版真题，直接上手刷题摸透出题套路！
重点模块一次性备齐👇
✅历年回忆真题卷（22-25 年），吃透高频考点
✅山东时政 + 省情题库，这一块很容易拉开分🥇
✅集团企业文化专项题，送分题千万别丢！
✅行测 + 公基全套笔记、练习题，夯实基础
✅财会 / 工程 / 人力等多岗位专业题库按需挑选
真心劝大家，企业文化、山东时政优先背！
笔试客观题占比很高，刷题效率远高于死记硬背📝
整套资料搭配练习，稳住状态冲刺 86 + 完全有机会！
备考时间有限，抓核心资料高效冲刺，少走弯路！`,
  },
  {
    id: 6,
    title: '企业考点速记型',
    desc: '企业文化数据考点详解',
    content: `山东水发集团笔试，这些题最好要刷！
备考水发集团笔试别瞎刷题！🙅‍♀️ 整理了必考高频考点，吃透直接拿捏基础分值，超实用✅
🏢 企业基础考点（必背）
省属一级国企！2009年成立，2017年划归省国资委，核心口号"上善若水、发展惠民"，主打民生服务赛道🌊
💼 三大核心主业（高频单选）
牢牢记住：水利水务、现代农业、清洁能源！淘汰了环保非主业，聚焦主业是近年考察重点📌
📊 核心数据速记（易考填空/判断）
2025年总资产超1634亿，净利润大幅上涨，服务业占比最高，国企瘦身健体、提质增效是核心亮点📈
🌟 特色时政考点
山东现代水网核心建设主体，落地百亿级鲁东南水资源配置工程，海外布局东南亚，科创资质拉满💡
✍️ 刷题小贴士
笔试最爱考企业定位、主业板块、年度发展亮点、企业文化，不用死记硬背，眼熟就能得分！`,
  },
]

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
      d.company_name        ? `单位：${d.company_name}` : '',
      d.job_type_name       ? `招聘岗位类型：${d.job_type_name}` : '',
      d.recruit_count       ? `招聘人数：${d.recruit_count}` : '',
      d.written_exam_time   ? `笔试时间：${d.written_exam_time}` : '',
      d.written_exam_content ? `笔试内容：${d.written_exam_content}` : '',
      '',
      '请严格按照以下格式输出笔试备考建议，只输出纯文字，不带任何Markdown符号：',
      '',
      '笔试备考建议',
      '第1-4天夯实基础：[根据笔试内容，具体说明综合知识和专业知识各自的备考重点，结合单位行业特点]',
      '第5-6天刷题冲刺：[根据笔试时长，说明刷题节奏、查漏补缺方向、分数线目标]',
      '第7天复盘核心考点、调整状态，[补充面试准备建议]',
      '',
      '注意：',
      '1. 内容必须结合实际笔试内容（如燃气行业则聚焦燃气专业，IT行业聚焦技术知识等），不得生成与笔试无关的通用内容',
      '2. 严禁出现任何涉及政治人物、领导人姓名、中央政府政策文件名称、党政纪律等政治敏感内容',
      '3. 若笔试含"时事政治"，只写"关注近期社会热点、民生经济动态"等通用表述，不得提及具体政治人物或文件',
      '4. 输出纯文字，总字数不超过200字',
    ].filter(s => s !== null).join('\n')

    try {
      const llmRes = await chatLlm({
        provider:    active.provider,
        api_format:  active.api_format,
        api_key:     active.api_key,
        base_url:    active.base_url || '',
        model:       active.default_model,
        messages: [
          { role: 'system', content: '你是一名专业的企业招聘考试辅导老师，擅长根据笔试科目制定实用的分天备考计划。你的输出必须是纯文字，按照用户指定格式，内容具体、实用、有针对性。严禁涉及政治人物、领导人姓名、党政文件名称等政治敏感内容。' },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens:  500,
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
    prompt:                examCardState.promptText,
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

    // 2) 组装用户消息并调用 LLM
    // 前端随机选类别，避免 AI 每次走同一条路
    const CATEGORY_NAMES = [
      '碎片化轻备考',
      '考前复盘避坑',
      '高效备考拒绝盲目刷题',
      '真题深挖吃透出题逻辑',
      '专项突破稳步提分',
      '零基础懒人轻松备考',
      '考情解读抓准重点',
      '少背书刷题速过',
    ]
    const categoryIndex = Math.floor(Math.random() * CATEGORY_NAMES.length)
    const categoryName = CATEGORY_NAMES[categoryIndex]

    const userContent = [
      `单位名称：${data.value.company_name || ''}`,
      `商品类型：${data.value.job_type_name || ''}`,
      data.value.written_exam_content ? `笔试内容：${data.value.written_exam_content}` : '',
      data.value.interview_content ? `面试内容：${data.value.interview_content}` : '',
      `本次必须使用【类别${categoryIndex + 1}：${categoryName}】的风格生成标题，不得使用其他类别风格。`,
      '注意：标题字数不能超过20个字。',
    ].filter(Boolean).join('\n')

    // 记录本次使用的提示词，供查看
    titlePromptUsed.value = { system: promptItem.content, user: userContent }
    console.log('[generateTitle] messages →', JSON.stringify([
      { role: 'system', content: promptItem.content },
      { role: 'user', content: userContent },
    ], null, 2))

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
      temperature: 1.0,
    })
    console.log('[generateTitle] raw response →', JSON.stringify(res, null, 2))
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
      `笔试内容：${data.value.job_type_name || ''}`,
      `笔记标题：${generatedTitle.value || '（未生成，请围绕企业名称与笔试内容自行展开）'}`,
      '',
      '要求：只输出正文，不重复标题，不含任何引流内容（关注我、加微信、私信等），数字和表情符号的使用风格与模版保持一致。',
      '禁止使用网络口头禅或夸张感叹句，例如"谁懂啊家人们"、"后台被问麻了"、"救命"、"真的绷不住"等，语气保持实用、亲切即可。',
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

// PDF 4页拼图预览抽屉状态
const pdfGridDrawer = reactive({
  visible: false,
  file: null,          // 当前选中的 PDF 文件 { name, path, fs_id }
  loading: false,
  gridUrl: '',         // 原始合成拼图 dataURL（无标题）
  displayUrl: '',      // 标题叠加后的预览 dataURL
  blurAmount: 0,       // 模糊程度（px），0 = 不模糊
  // 标题覆层
  titleEnabled: true,  // 是否显示标题
  titleText: '',       // 标题文案（默认继承 dirDrawer.title）
  titleStyle: 'solidRed', // 文字样式预设
  titleY: 50,          // 垂直位置（百分比，0~100，50=居中）
  titleSize: 82,       // 字体大小（px，基于 1242px 画布）
  gridBorderColor: '#FF2D55', // 拼图外围边框颜色
})

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

function renderCompositeImage(files, title, borderColor, bgColor, bgOpacity, bgImageUrl = null, titleY = null) {
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
    buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY)
      .then(url => { dirDrawer.previewUrl = url })
  } else {
    const result = renderCompositeImage(dirDrawer.files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY)
    if (result instanceof Promise) {
      result.then(url => { dirDrawer.previewUrl = url })
    } else {
      dirDrawer.previewUrl = result
    }
  }
}

// 新版：整图 1242×1656，外边框，顶部标题 + PDF 铺满 + 右下角目录浮层
async function buildHistoryComposite(pdfDataUrl, files, borderColor, title, bgColor, bgOpacity, bgImageUrl = null, titleY = null) {
  const pdfImg = await loadImage(pdfDataUrl)

  const CANVAS_W = 1242
  const CANVAS_H = 1656
  const BORDER = bgImageUrl ? 0 : 12
  const TITLE_H = 120

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

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
      const files = res.files || []
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
          dirDrawer.pdfPageDataUrl = pdfCanvas.toDataURL('image/png')
          dirDrawer.previewUrl = dirDrawer.dirOnly
            ? await Promise.resolve(renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY))
            : await buildHistoryComposite(dirDrawer.pdfPageDataUrl, files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY)
        } else {
          message.warning(`未找到文件名含"${keyword}"的PDF，降级显示目录列表`)
          dirDrawer.previewUrl = await Promise.resolve(renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY))
        }
      } else {
        dirDrawer.previewUrl = await Promise.resolve(renderCompositeImage(files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, bgImg, dirDrawer.titleY))
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
      dirDrawer.pdfPageDataUrl = pdfCanvas.toDataURL('image/png')
      dirDrawer.pdfPreviewUrl = dirDrawer.pdfPageDataUrl
      dirDrawer.pdfFsid = culturePdf.fs_id
      dirDrawer.previewUrl = await buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity, getActiveBgImageUrl(), dirDrawer.titleY)
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
    const result = renderCompositeImage(dirDrawer.files, dirDrawer.title, dirDrawer.borderColor, dirDrawer.bgColor, dirDrawer.bgOpacity, getActiveBgImageUrl(), dirDrawer.titleY)
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
      dirDrawer.previewUrl = await buildHistoryComposite(dirDrawer.pdfPageDataUrl, dirDrawer.files, dirDrawer.borderColor, dirDrawer.title, dirDrawer.bgColor, dirDrawer.bgOpacity, getActiveBgImageUrl(), dirDrawer.titleY)
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
  pdfGridDrawer.titleText = dirDrawer.title  // 继承外层标题文案
  pdfGridDrawer.visible = true
  pdfGridDrawer.loading = true
  try {
    pdfGridDrawer.gridUrl = await renderPdfGridImage(file)
    await refreshGridComposite()  // 叠加标题生成预览
  } catch (e) {
    message.error('PDF拼图生成失败：' + (e.message || '未知错误'))
  } finally {
    pdfGridDrawer.loading = false
  }
}

/** 重新合成带标题覆层的预览图（gridUrl + title → displayUrl） */
async function refreshGridComposite() {
  if (!pdfGridDrawer.gridUrl) return
  if (!pdfGridDrawer.titleEnabled || !pdfGridDrawer.titleText.trim()) {
    pdfGridDrawer.displayUrl = pdfGridDrawer.gridUrl
    return
  }
  const img = await loadImage(pdfGridDrawer.gridUrl)
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  _drawTitleOnCanvas(ctx, c.width, c.height, pdfGridDrawer.titleText, pdfGridDrawer.titleStyle, pdfGridDrawer.titleY, pdfGridDrawer.titleSize)
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
    if (!pdfGridDrawer.file) return
    pdfGridDrawer.loading = true
    try {
      pdfGridDrawer.gridUrl = await renderPdfGridImage(pdfGridDrawer.file)
      await refreshGridComposite()
    } catch (e) {
      message.error('边框重绘失败：' + (e.message || '未知'))
    } finally {
      pdfGridDrawer.loading = false
    }
  }, 300)
}

/**
 * 在 canvas 上绘制标题覆层
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w  canvas 宽（px）
 * @param {number} h  canvas 高（px）
 * @param {string} text 标题文案
 * @param {string} style  样式预设 key
 * @param {number} yPct  垂直位置百分比（0~100）
 */
function _drawTitleOnCanvas(ctx, w, h, text, style, yPct = 50, fontSize = 82) {
  const cx = w / 2
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
    pageDataUrls.push(c.toDataURL('image/png'))
  }

  return buildPdfGridComposite(pageDataUrls, pdfGridDrawer.gridBorderColor)
}

/** 把最多 4 页 PDF 的 dataURL 拼成 1242×1656 的小红书笔记图 */
async function buildPdfGridComposite(dataUrls, borderColor = '#FF2D55') {
  const CANVAS_W = 1242
  const CANVAS_H = 1656
  const BORDER = 10           // 外围边框宽度（固定 10px）
  const OUTER_PAD = 32        // 外边距（含边框）
  const GAP = 20              // 两格之间的间距
  const RADIUS = 20           // 每格圆角
  const SHADOW_BLUR = 8       // 阴影模糊半径（4~8px）
  const SHADOW_COLOR = 'rgba(0,0,0,0.22)'

  const cellW = Math.floor((CANVAS_W - OUTER_PAD * 2 - GAP) / 2)
  const cellH = Math.floor((CANVAS_H - OUTER_PAD * 2 - GAP) / 2)

  // 四格坐标：左上 / 右上 / 左下 / 右下
  const cells = [
    { x: OUTER_PAD,              y: OUTER_PAD },
    { x: OUTER_PAD + cellW + GAP, y: OUTER_PAD },
    { x: OUTER_PAD,              y: OUTER_PAD + cellH + GAP },
    { x: OUTER_PAD + cellW + GAP, y: OUTER_PAD + cellH + GAP },
  ]

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  // 整体浅灰背景
  ctx.fillStyle = '#f2f2f2'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 外围边框（10px，紧贴画布四边）
  ctx.strokeStyle = borderColor
  ctx.lineWidth = BORDER
  ctx.strokeRect(BORDER / 2, BORDER / 2, CANVAS_W - BORDER, CANVAS_H - BORDER)

  for (let i = 0; i < 4; i++) {
    const { x, y } = cells[i]
    const dataUrl = dataUrls[i]

    if (!dataUrl) {
      // 不足 4 页：灰色占位格
      ctx.save()
      ctx.fillStyle = '#e0e0e0'
      ctx.beginPath()
      ctx.roundRect(x, y, cellW, cellH, RADIUS)
      ctx.fill()
      ctx.restore()
      continue
    }

    const img = await loadImage(dataUrl)  // 复用 Detail.vue 内已有的 loadImage()

    // ① 先画阴影（在 clip 外，用白底圆角矩形承载阴影）
    ctx.save()
    ctx.shadowColor = SHADOW_COLOR
    ctx.shadowBlur = SHADOW_BLUR
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(x, y, cellW, cellH, RADIUS)
    ctx.fill()
    ctx.restore()

    // ② clip 圆角后绘制 PDF 页面（contain 等比缩放居中）
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, cellW, cellH, RADIUS)
    ctx.clip()
    // 白色底（防透明 PDF）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, cellW, cellH)
    // contain 缩放
    const scale = Math.min(cellW / img.width, cellH / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const dx = x + (cellW - dw) / 2
    const dy = y + (cellH - dh) / 2
    ctx.drawImage(img, dx, dy, dw, dh)
    ctx.restore()
  }

  return canvas.toDataURL('image/png')
}

/** 下载 PDF 4页拼图（带标题、若有模糊则烧进 canvas 导出） */
async function downloadPdfGrid() {
  const src = pdfGridDrawer.displayUrl || pdfGridDrawer.gridUrl
  if (!src) return
  const name = pdfGridDrawer.file?.name?.replace(/\.pdf$/i, '') || 'pdf_grid'
  const a = document.createElement('a')

  if (pdfGridDrawer.blurAmount > 0) {
    // 将模糊效果烧入 canvas，使下载文件与预览一致
    const img = await loadImage(src)
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.filter = `blur(${pdfGridDrawer.blurAmount}px)`
    ctx.drawImage(img, 0, 0)
    a.href = c.toDataURL('image/png')
  } else {
    a.href = src
  }

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
  const files = res.files || []
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
        getActiveBgImageUrl(), dirDrawer.titleY
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
