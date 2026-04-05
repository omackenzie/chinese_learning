<script setup lang="ts">
import { computed } from 'vue'
import { useVocabularyStore } from '../stores/vocabulary'
import { HSK_LEVELS, hskWordsByLevel } from '../data/hsk'

const vocab = useVocabularyStore()

const overallPercent = computed(() => {
  if (vocab.totalWordCount === 0) return 0
  return Math.round((vocab.totalLearnedCount / vocab.totalWordCount) * 100)
})

function levelPercent(level: number): number {
  const total = hskWordsByLevel[level]?.length ?? 0
  if (total === 0) return 0
  const learned = vocab.learnedCountByLevel[level] ?? 0
  return Math.round((learned / total) * 100)
}
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 p-5">
    <!-- Overall progress -->
    <div class="mb-5">
      <div class="flex items-baseline justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overall Progress</h3>
        <span class="text-sm text-gray-500">
          <span class="font-semibold text-gray-900">{{ vocab.totalLearnedCount }}</span>
          / {{ vocab.totalWordCount }} words
        </span>
      </div>
      <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full bg-red-700 rounded-full transition-all duration-500 ease-out"
          :style="{ width: overallPercent + '%' }"
        />
      </div>
      <p class="text-right text-xs text-gray-400 mt-1">{{ overallPercent }}%</p>
    </div>

    <!-- Per-level breakdown -->
    <div class="space-y-3">
      <div v-for="hsk in HSK_LEVELS" :key="hsk.level" class="group">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-gray-600">{{ hsk.label }}</span>
          <span class="text-xs text-gray-400">
            {{ vocab.learnedCountByLevel[hsk.level] ?? 0 }}/{{ hsk.wordCount }}
            <span class="ml-1 font-medium text-gray-500">{{ levelPercent(hsk.level) }}%</span>
          </span>
        </div>
        <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
            :style="{ width: levelPercent(hsk.level) + '%' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
