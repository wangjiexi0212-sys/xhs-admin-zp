<template>
  <a-layout class="basic-layout">
    <a-layout-sider v-model:collapsed="collapsed" collapsible :trigger="null" breakpoint="lg" class="basic-sider"
      :width="220" :collapsed-width="80">
      <div class="logo">
        <span v-if="!collapsed">XHS Admin</span>
        <span v-else>X</span>
      </div>
      <a-menu theme="dark" mode="inline" :selected-keys="selectedKeys" :open-keys="openKeys" @click="onMenuClick"
        @openChange="onOpenChange">
        <a-menu-item key="/">
          <template #icon>
            <HomeOutlined />
          </template>
          <span>首页</span>
        </a-menu-item>
        <a-sub-menu key="product">
          <template #icon>
            <ShoppingOutlined />
          </template>
          <template #title>商品管理</template>
          <a-menu-item key="/product/list">商品列表</a-menu-item>
          <a-menu-item key="/product/category">商品类型</a-menu-item>
        </a-sub-menu>
        <a-sub-menu key="user">
          <template #icon>
            <TeamOutlined />
          </template>
          <template #title>用户管理</template>
          <a-menu-item key="/user/list">用户列表</a-menu-item>
          <a-menu-item key="/user/role">角色列表</a-menu-item>
        </a-sub-menu>
        <a-sub-menu key="note">
          <template #icon>
            <FileImageOutlined />
          </template>
          <template #title>笔记配置</template>
          <a-menu-item key="/note/images">图片管理</a-menu-item>
          <a-menu-item key="/note/title-formula">标题公式</a-menu-item>
          <a-menu-item key="/note/content-template">内容模版</a-menu-item>
          <a-menu-item key="/note/prompt">提示词管理</a-menu-item>
          <a-menu-item key="/note/card-prompt">卡片提示词</a-menu-item>
          <a-menu-item key="/note/card-generator">卡片生成</a-menu-item>
          <a-menu-item key="/note/exam-template">试题模版</a-menu-item>
        </a-sub-menu>
        <a-sub-menu key="system">
          <template #icon>
            <SettingOutlined />
          </template>
          <template #title>系统设置</template>
          <a-menu-item key="/system/llm">LLM</a-menu-item>
          <a-menu-item key="/system/ai-image">AI绘图</a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>

    <a-layout class="basic-main" :style="{
      marginLeft: collapsed ? '80px' : '220px',
      width: collapsed ? 'calc(100% - 80px)' : 'calc(100% - 220px)',
      transition: 'margin-left 0.2s, width 0.2s',
    }">
      <a-layout-header class="basic-header">
        <div class="header-left">
          <component :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined" class="trigger"
            @click="collapsed = !collapsed" />
        </div>
        <div class="header-right">
          <a-dropdown placement="bottomRight">
            <div class="user-info">
              <a-avatar class="user-avatar">{{ avatarText }}</a-avatar>
              <span class="user-name">{{ displayName }}</span>
            </div>
            <template #overlay>
              <a-menu @click="onUserMenuClick">
                <a-menu-item key="logout">
                  <LogoutOutlined />
                  <span>退出登录</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <a-layout-content class="basic-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import {
  HomeOutlined,
  ShoppingOutlined,
  TeamOutlined,
  FileImageOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useLlmStore } from '@/stores/llm'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const collapsed = ref(false)
const selectedKeys = computed(() => [route.path])

const subMenuKeys = ['product', 'user', 'note', 'system']
const openKeys = ref(getDefaultOpenKeys())

function getDefaultOpenKeys() {
  if (route.path.startsWith('/product')) return ['product']
  if (route.path.startsWith('/user')) return ['user']
  if (route.path.startsWith('/note')) return ['note']
  if (route.path.startsWith('/system')) return ['system']
  return []
}

watch(() => route.path, (path) => {
  if (collapsed.value) return
  if (path.startsWith('/product') && !openKeys.value.includes('product')) {
    openKeys.value = ['product']
  } else if (path.startsWith('/user') && !openKeys.value.includes('user')) {
    openKeys.value = ['user']
  } else if (path.startsWith('/note') && !openKeys.value.includes('note')) {
    openKeys.value = ['note']
  } else if (path.startsWith('/system') && !openKeys.value.includes('system')) {
    openKeys.value = ['system']
  }
})

function onOpenChange(keys) {
  const latest = keys.find(k => !openKeys.value.includes(k))
  openKeys.value = latest ? [latest] : []
}

const displayName = computed(() => auth.user?.nickname || auth.user?.username || '未登录')
const avatarText = computed(() => {
  const name = auth.user?.nickname || auth.user?.username || ''
  return name ? name.charAt(0).toUpperCase() : '?'
})

function onMenuClick({ key }) {
  if (key !== route.path) router.push(key)
}

function onUserMenuClick({ key }) {
  if (key === 'logout') {
    auth.logout()
    router.replace('/login')
  }
}

const llm = useLlmStore()

onMounted(() => {
  llm.load()
  if (!llm.hasActive) {
    Modal.warning({
      title: '提示',
      content: '请设置模型信息',
      okText: '去设置',
      onOk: () => router.push('/system/llm'),
    })
  }
})
</script>

<style scoped>
.basic-layout {
  min-height: 100vh;
  overflow: hidden;
  width: 100vw;
}

.basic-sider {
  position: fixed !important;
  top: 0;
  left: 0;
  bottom: 0;
  height: 100vh;
  z-index: 10;
  overflow: auto;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}

.basic-header {
  position: sticky;
  top: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);
}

.header-left .trigger {
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
}

.header-left .trigger:hover {
  color: #1677ff;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  cursor: pointer;
  border-radius: 4px;
}

.user-info:hover {
  background: rgba(0, 0, 0, 0.04);
}

.user-avatar {
  background: #1677ff;
  color: #fff;
}

.user-name {
  font-size: 14px;
  color: #1f2937;
}

.basic-content {
  margin: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  max-height: calc(100vh - 56px - 32px);
  min-width: 0;
  overflow: scroll;
}
</style>
