import { createRouter, createWebHistory } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: BasicLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue'),
        },
        {
          path: 'product/list',
          name: 'product-list',
          component: () => import('../views/product/List.vue'),
        },
        {
          path: 'product/create',
          name: 'product-create',
          component: () => import('../views/product/Edit.vue'),
        },
        {
          path: 'product/edit/:id',
          name: 'product-edit',
          component: () => import('../views/product/Edit.vue'),
        },
        {
          path: 'product/detail/:id',
          name: 'product-detail',
          component: () => import('../views/product/Detail.vue'),
        },
        {
          path: 'product/category',
          name: 'product-category',
          component: () => import('../views/product/Category.vue'),
        },
        {
          path: 'user/list',
          name: 'user-list',
          component: () => import('../views/user/List.vue'),
        },
        {
          path: 'user/role',
          name: 'user-role',
          component: () => import('../views/user/Role.vue'),
        },
        {
          path: 'note/images',
          name: 'note-images',
          component: () => import('../views/note/Images.vue'),
        },
        {
          path: 'note/title-formula',
          name: 'note-title-formula',
          component: () => import('../views/note/TitleFormula.vue'),
        },
        {
          path: 'note/title-formula/detail/:id',
          name: 'note-title-formula-detail',
          component: () => import('../views/note/TitleFormulaDetail.vue'),
        },
        {
          path: 'note/content-template',
          name: 'note-content-template',
          component: () => import('../views/note/ContentTemplate.vue'),
        },
        {
          path: 'note/prompt',
          name: 'note-prompt',
          component: () => import('../views/note/Prompt.vue'),
        },
        {
          path: 'note/card-generator',
          name: 'note-card-generator',
          component: () => import('../views/note/CardGenerator.vue'),
        },
        {
          path: 'note/card-prompt',
          name: 'note-card-prompt',
          component: () => import('../views/note/CardPrompt.vue'),
        },
        {
          path: 'note/exam-template',
          name: 'note-exam-template',
          component: () => import('../views/note/ExamTemplate.vue'),
        },
        {
          path: 'system/llm',
          name: 'system-llm',
          component: () => import('../views/system/Llm.vue'),
        },
        {
          path: 'system/llm/create',
          name: 'system-llm-create',
          component: () => import('../views/system/LlmEdit.vue'),
        },
        {
          path: 'system/llm/edit/:id',
          name: 'system-llm-edit',
          component: () => import('../views/system/LlmEdit.vue'),
        },
        {
          path: 'system/ai-image',
          name: 'system-ai-image',
          component: () => import('../views/system/AiImage.vue'),
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login/Index.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth) {
    if (!auth.isLogin) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
    if (!auth.user) {
      try { await auth.loadMe() } catch { return { path: '/login' } }
    }
  }
  if (to.path === '/login' && auth.isLogin) return { path: '/' }
})

export default router
