<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVocabularyStore } from '../stores/vocabulary'
import { useSettingsStore } from '../stores/settings'
import { hskWordsByLevel, HSK_LEVELS } from '../data/hsk'
import StatsPanel from './StatsPanel.vue'

const vocab = useVocabularyStore()
const settings = useSettingsStore()

const selectedLevel = ref(1)
const searchQuery = ref('')

const wordsForLevel = computed(() => hskWordsByLevel[selectedLevel.value] ?? [])

const filteredWords = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return wordsForLevel.value
  return wordsForLevel.value.filter(
    (w) =>
      w.simplified.includes(q) ||
      w.pinyin.toLowerCase().includes(q) ||
      w.english.toLowerCase().includes(q),
  )
})

const currentLevelInfo = computed(() =>
  HSK_LEVELS.find((h) => h.level === selectedLevel.value),
)

const learnedInLevel = computed(
  () => vocab.learnedCountByLevel[selectedLevel.value] ?? 0,
)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-6 sm:px-6">
    <!-- Stats panel -->
    <StatsPanel class="mb-6" />

    <!-- Level tabs -->
    <div class="mb-5">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="hsk in HSK_LEVELS"
          :key="hsk.level"
          @click="selectedLevel = hsk.level"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          :class="
            selectedLevel === hsk.level
              ? 'bg-red-700 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300 hover:text-red-700'
          "
        >
          {{ hsk.label }}
          <span
            class="ml-1.5 text-xs"
            :class="selectedLevel === hsk.level ? 'text-red-200' : 'text-gray-400'"
          >
            {{ hsk.wordCount }}
          </span>
        </button>
      </div>
    </div>

    <!-- Search + bulk actions -->
    <div class="flex flex-col sm:flex-row gap-3 mb-5">
      <div class="relative flex-1">
        <svg
          class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by character, pinyin, or English…"
          class="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-gray-400"
        />
      </div>
      <div class="flex gap-2 shrink-0">
        <button
          @click="vocab.bulkMarkLevel(selectedLevel)"
          class="px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
        >
          ✓ Mark All Learned
        </button>
        <button
          @click="vocab.bulkUnmarkLevel(selectedLevel)"
          class="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ✗ Unmark All
        </button>
      </div>
    </div>

    <!-- Level summary -->
    <p class="text-sm text-gray-500 mb-4">
      <span class="font-medium text-gray-700">{{ currentLevelInfo?.label }}</span>
      —
      <span class="font-semibold text-red-700">{{ learnedInLevel }}</span>
      / {{ currentLevelInfo?.wordCount }} learned
      <span v-if="searchQuery" class="ml-2 text-gray-400">
        ({{ filteredWords.length }} matching "{{ searchQuery }}")
      </span>
    </p>

    <!-- Word grid -->
    <div
      v-if="filteredWords.length"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
    >
      <button
        v-for="word in filteredWords"
        :key="word.id"
        @click="vocab.toggleWord(word.id)"
        class="relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-150 text-center select-none"
        :class="
          vocab.isWordLearned(word.id)
            ? 'bg-green-50 border-green-300 hover:border-green-400'
            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
        "
      >
        <!-- Learned check -->
        <span
          v-if="vocab.isWordLearned(word.id)"
          class="absolute top-2 right-2 text-green-500 text-xs"
        >
          ✓
        </span>

        <!-- Simplified character -->
        <span
          class="text-2xl font-bold leading-tight"
          :class="vocab.isWordLearned(word.id) ? 'text-green-800' : 'text-gray-800'"
        >
          {{ word.simplified }}
        </span>

        <!-- Pinyin -->
        <span
          v-if="settings.showPinyin"
          class="text-xs mt-1"
          :class="vocab.isWordLearned(word.id) ? 'text-green-600' : 'text-gray-400'"
        >
          {{ word.pinyin }}
        </span>

        <!-- English -->
        <span
          class="text-xs mt-1 line-clamp-2 leading-snug"
          :class="vocab.isWordLearned(word.id) ? 'text-green-600' : 'text-gray-500'"
        >
          {{ word.english }}
        </span>
      </button>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-16 text-gray-400">
      <p class="text-lg">No words found</p>
      <p class="text-sm mt-1">Try a different search term</p>
    </div>
  </div>
</template>
