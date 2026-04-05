<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { usePinyin } from '../composables/usePinyin'

const props = defineProps<{
  text: string
  newWords: { simplified: string; pinyin: string; english: string }[]
  loading: boolean
}>()

const settings = useSettingsStore()
const { addPinyin } = usePinyin()

const activeTooltip = ref<number | null>(null)

const newWordChars = computed(() => {
  const chars = new Set<string>()
  for (const w of props.newWords) {
    for (const ch of w.simplified) {
      chars.add(ch)
    }
  }
  return chars
})

const newWordMap = computed(() => {
  const map = new Map<string, { pinyin: string; english: string }>()
  for (const w of props.newWords) {
    for (const ch of w.simplified) {
      if (!map.has(ch)) {
        map.set(ch, { pinyin: w.pinyin, english: w.english })
      }
    }
    map.set(w.simplified, { pinyin: w.pinyin, english: w.english })
  }
  return map
})

const annotatedChars = computed(() => addPinyin(props.text))

function isNewWordChar(char: string): boolean {
  return newWordChars.value.has(char)
}

function getWordInfo(char: string) {
  return newWordMap.value.get(char)
}

function toggleTooltip(index: number) {
  activeTooltip.value = activeTooltip.value === index ? null : index
}
</script>

<template>
  <div class="relative">
    <!-- Placeholder -->
    <div
      v-if="!text && !loading"
      class="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center"
    >
      <p class="text-gray-400 text-lg">Generated paragraph will appear here</p>
      <p class="text-gray-300 text-sm mt-1">Configure options and click Generate</p>
    </div>

    <!-- Thinking state — waiting for first token -->
    <div
      v-else-if="loading && !text"
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div class="flex items-center gap-2 text-gray-400 text-sm mb-4">
        <svg class="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-red-600 font-medium">Generating</span>
        <span class="flex gap-0.5">
          <span class="animate-bounce [animation-delay:0ms] inline-block w-1 h-1 rounded-full bg-red-400" />
          <span class="animate-bounce [animation-delay:150ms] inline-block w-1 h-1 rounded-full bg-red-400" />
          <span class="animate-bounce [animation-delay:300ms] inline-block w-1 h-1 rounded-full bg-red-400" />
        </span>
      </div>
      <div class="space-y-3">
        <div class="h-7 rounded-md bg-gray-100 animate-pulse w-full" />
        <div class="h-7 rounded-md bg-gray-100 animate-pulse w-5/6" />
        <div class="h-7 rounded-md bg-gray-100 animate-pulse w-4/6" />
      </div>
    </div>

    <!-- Content -->
    <div
      v-else
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div class="text-2xl leading-relaxed tracking-wide" lang="zh-CN">
        <span
          v-for="(item, idx) in annotatedChars"
          :key="idx"
          class="relative inline-block"
          :class="{ 'cursor-pointer': isNewWordChar(item.char) }"
          @click="isNewWordChar(item.char) && toggleTooltip(idx)"
        >
          <ruby v-if="item.pinyin && settings.showPinyin">
            <span
              :class="[
                isNewWordChar(item.char)
                  ? 'text-red-700 underline decoration-red-300 decoration-2 underline-offset-4 hover:bg-red-50 rounded'
                  : ''
              ]"
            >{{ item.char }}</span>
            <rp>(</rp>
            <rt class="text-xs text-gray-500 font-normal">{{ item.pinyin }}</rt>
            <rp>)</rp>
          </ruby>
          <span
            v-else
            :class="[
              isNewWordChar(item.char)
                ? 'text-red-700 underline decoration-red-300 decoration-2 underline-offset-4 hover:bg-red-50 rounded'
                : ''
            ]"
          >{{ item.char }}</span>

          <!-- Tooltip -->
          <Transition name="fade">
            <div
              v-if="activeTooltip === idx && isNewWordChar(item.char)"
              class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg"
            >
              <div class="font-medium">{{ getWordInfo(item.char)?.pinyin }}</div>
              <div class="text-gray-300">{{ getWordInfo(item.char)?.english }}</div>
              <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </Transition>
        </span>

        <!-- Blinking cursor while loading -->
        <span v-if="loading" class="inline-block w-0.5 h-7 bg-red-700 animate-pulse ml-0.5 align-middle" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
