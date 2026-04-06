<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from './stores/settings'

const settings = useSettingsStore()
const mobileMenuOpen = ref(false)
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div class="h-0.5 bg-gradient-to-r from-red-800 via-red-600 to-amber-500" />
      <div class="px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <h1 class="text-xl font-bold text-red-700 tracking-tight">中文练习</h1>
          <nav class="hidden sm:flex gap-1">
            <router-link
              to="/"
              class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-md px-3 py-1.5"
              exact-active-class="!bg-red-50 !text-red-700"
            >
              Practice
            </router-link>
            <router-link
              to="/words"
              class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-md px-3 py-1.5"
              active-class="!bg-red-50 !text-red-700"
            >
              Word List
            </router-link>
            <router-link
              to="/history"
              class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-md px-3 py-1.5"
              active-class="!bg-red-50 !text-red-700"
            >
              History
            </router-link>
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              v-model="settings.showPinyin"
              class="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span class="hidden sm:inline">Pinyin</span>
            <span class="sm:hidden">拼音</span>
          </label>
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="sm:hidden rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Toggle menu"
          >
            <svg v-if="!mobileMenuOpen" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <!-- Mobile menu -->
      <nav v-if="mobileMenuOpen" class="sm:hidden border-t border-gray-100 px-4 py-2 space-y-1 bg-white">
        <router-link
          to="/"
          @click="mobileMenuOpen = false"
          class="block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-md px-3 py-2"
          exact-active-class="!bg-red-50 !text-red-700"
        >
          Practice
        </router-link>
        <router-link
          to="/words"
          @click="mobileMenuOpen = false"
          class="block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-md px-3 py-2"
          active-class="!bg-red-50 !text-red-700"
        >
          Word List
        </router-link>
        <router-link
          to="/history"
          @click="mobileMenuOpen = false"
          class="block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-md px-3 py-2"
          active-class="!bg-red-50 !text-red-700"
        >
          History
        </router-link>
      </nav>
    </header>
    <main class="flex-1">
      <router-view />
    </main>
  </div>
</template>
