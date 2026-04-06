<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVocabularyStore } from '../stores/vocabulary'
import { useSettingsStore } from '../stores/settings'
import { hskWords, hskWordsByLevel, HSK_LEVELS } from '../data/hsk'
import StatsPanel from './StatsPanel.vue'

const vocab = useVocabularyStore()
const settings = useSettingsStore()

const WORD_LIST_EXPORT_VERSION = 1
const LEARNED_WORD_IDS_STORAGE_KEY = 'learnedWordIds'

const selectedLevel = ref(1)
const searchQuery = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const pendingImportMode = ref<'merge' | 'replace'>('merge')
const importMessage = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

const validWordIds = new Set(hskWords.map((word) => word.id))

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

function buildImportMessage(summary: {
  mode: 'merge' | 'replace'
  importedCount: number
  totalAfterImport: number
  invalidCount: number
  duplicateCount: number
}): string {
  const action = summary.mode === 'replace'
    ? `Replaced your word list with ${summary.totalAfterImport} learned word(s).`
    : `Imported ${summary.importedCount} new word(s). You now have ${summary.totalAfterImport} learned word(s).`

  const extras: string[] = []
  if (summary.invalidCount > 0) {
    extras.push(`${summary.invalidCount} invalid ID(s) skipped`)
  }
  if (summary.duplicateCount > 0) {
    extras.push(`${summary.duplicateCount} duplicate ID(s) ignored`)
  }

  return extras.length > 0
    ? `${action} ${extras.join(', ')}.`
    : action
}

function exportWordList() {
  const payload = typeof vocab.exportWordList === 'function'
    ? vocab.exportWordList()
    : {
      version: WORD_LIST_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      learnedWordIds: [...vocab.learnedWordIds],
      words: [...vocab.learnedWords]
        .slice()
        .sort((a, b) => (
          a.level - b.level
          || a.simplified.localeCompare(b.simplified, 'zh-Hans-CN')
        ))
        .map((word) => ({
          id: word.id,
          simplified: word.simplified,
          pinyin: word.pinyin,
          english: word.english,
          level: word.level,
        })),
    }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const dateStamp = payload.exportedAt.slice(0, 10)

  anchor.href = url
  anchor.download = `learned-word-list-${dateStamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)

  importMessage.value = {
    kind: 'success',
    text: `Exported ${payload.learnedWordIds.length} learned word(s).`,
  }
}

function triggerImport(mode: 'merge' | 'replace') {
  pendingImportMode.value = mode
  importMessage.value = null

  if (fileInput.value) {
    fileInput.value.value = ''
    fileInput.value.click()
  }
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const summary = typeof vocab.importWordList === 'function'
      ? vocab.importWordList(parsed, pendingImportMode.value)
      : fallbackImportWordList(parsed, pendingImportMode.value)

    importMessage.value = {
      kind: 'success',
      text: buildImportMessage(summary),
    }
  } catch (error) {
    importMessage.value = {
      kind: 'error',
      text: error instanceof Error
        ? error.message
        : 'Could not import that file.',
    }
  } finally {
    input.value = ''
  }
}

function fallbackImportWordList(
  payload: unknown,
  mode: 'merge' | 'replace',
) {
  const importedIds = parseImportedIds(payload)

  if (importedIds.length === 0) {
    throw new Error('Import file does not contain any learned word IDs.')
  }

  const validUniqueIds: string[] = []
  const seen = new Set<string>()
  let invalidCount = 0
  let duplicateCount = 0

  for (const id of importedIds) {
    if (!validWordIds.has(id)) {
      invalidCount += 1
      continue
    }

    if (seen.has(id)) {
      duplicateCount += 1
      continue
    }

    seen.add(id)
    validUniqueIds.push(id)
  }

  if (validUniqueIds.length === 0) {
    throw new Error('Import file does not contain any valid word IDs for this app.')
  }

  const next = mode === 'replace'
    ? new Set<string>()
    : new Set(vocab.learnedWordIds)

  let importedCount = 0
  for (const id of validUniqueIds) {
    if (next.has(id)) {
      duplicateCount += 1
      continue
    }

    next.add(id)
    importedCount += 1
  }

  vocab.learnedWordIds = next
  localStorage.setItem(LEARNED_WORD_IDS_STORAGE_KEY, JSON.stringify([...next]))

  return {
    mode,
    importedCount,
    totalAfterImport: next.size,
    invalidCount,
    duplicateCount,
  }
}

function parseImportedIds(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((id): id is string => typeof id === 'string')
  }

  if (!input || typeof input !== 'object') {
    throw new Error('Import file must be a JSON array or an object with learnedWordIds.')
  }

  const payload = input as { learnedWordIds?: unknown }
  if (!Array.isArray(payload.learnedWordIds)) {
    throw new Error('Import file is missing learnedWordIds.')
  }

  return payload.learnedWordIds.filter((id): id is string => typeof id === 'string')
}
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

    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Import / Export</h3>
          <p class="text-sm text-gray-500 mt-1">
            Export your learned words to a JSON file, or import a previously exported list.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            @click="exportWordList"
            class="px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Export Word List
          </button>
          <button
            @click="triggerImport('merge')"
            class="px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            Import and Merge
          </button>
          <button
            @click="triggerImport('replace')"
            class="px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            Import and Replace
          </button>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="handleImport"
      />

      <p class="text-xs text-gray-400 mt-3">
        “Import and Merge” keeps your current learned words and adds the imported ones. “Import and Replace” overwrites your current learned list.
      </p>

      <div
        v-if="importMessage"
        class="mt-3 rounded-lg px-4 py-3 text-sm"
        :class="importMessage.kind === 'success'
          ? 'border border-green-200 bg-green-50 text-green-800'
          : 'border border-red-200 bg-red-50 text-red-800'"
      >
        {{ importMessage.text }}
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
