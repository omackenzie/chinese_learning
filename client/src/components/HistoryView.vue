<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGenerationHistoryStore } from '../stores/generationHistory'
import { useVocabularyStore } from '../stores/vocabulary'

import type { PracticeHistoryEntry } from '../types'

const router = useRouter()
const historyStore = useGenerationHistoryStore()
const vocabularyStore = useVocabularyStore()

const entries = computed(() => historyStore.entries)

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function latestAttempt(entry: PracticeHistoryEntry) {
  return entry.translationAttempts[0] ?? null
}

function openForPractice(entryId: string) {
  router.push({ name: 'practice', query: { history: entryId } })
}

function isRetained(entry: PracticeHistoryEntry, simplified: string) {
  return entry.retainedWords.includes(simplified)
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6">
    <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">History</h2>
          <p class="text-sm text-gray-500 mt-1">
            {{ entries.length }} saved passage<span v-if="entries.length !== 1">s</span>,
            {{ historyStore.totalAttempts }} translation attempt<span v-if="historyStore.totalAttempts !== 1">s</span>
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="!entries.length"
      class="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center"
    >
      <p class="text-lg font-medium text-gray-600">No saved practice yet</p>
      <p class="text-sm text-gray-400 mt-2">Generate a passage and it will appear here for review.</p>
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="entry in entries"
        :key="entry.id"
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <span>{{ formatDate(entry.createdAt) }}</span>
              <span class="rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                {{ entry.config.paragraphLength }}
              </span>
              <span class="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                {{ entry.config.studyMode }}
              </span>
            </div>
            <p class="text-xl leading-relaxed text-gray-900" lang="zh-CN">{{ entry.chinese }}</p>
          </div>

          <div class="flex gap-2 shrink-0">
            <button
              @click="openForPractice(entry.id)"
              class="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800"
            >
              Practice Again
            </button>
            <button
              @click="historyStore.deleteEntry(entry.id)"
              class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Delete
            </button>
          </div>
        </div>

        <div v-if="entry.newWords.length" class="mt-5 border-t border-gray-100 pt-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">New words</h3>
          <div class="grid gap-3 md:grid-cols-2">
            <div
              v-for="word in entry.newWords"
              :key="word.simplified"
              class="rounded-lg border border-gray-200 px-4 py-3"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-3">
                    <span class="text-lg font-semibold text-gray-900">{{ word.simplified }}</span>
                    <span class="text-sm text-red-700">{{ word.pinyin }}</span>
                  </div>
                  <p class="text-sm text-gray-500 mt-1">{{ word.english }}</p>
                </div>
                <button
                  @click="historyStore.toggleRetainedWord(entry.id, word.simplified)"
                  class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                  :class="isRetained(entry, word.simplified)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'"
                >
                  {{ isRetained(entry, word.simplified) ? 'Retained' : 'Mark retained' }}
                </button>
              </div>
              <p
                v-if="vocabularyStore.isSimplifiedLearned(word.simplified)"
                class="text-xs font-medium text-green-600 mt-2"
              >
                Already marked learned in your vocabulary list
              </p>
            </div>
          </div>
        </div>

        <div class="mt-5 border-t border-gray-100 pt-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Translation review</h3>
          <div v-if="latestAttempt(entry)" class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Latest attempt</p>
              <p class="text-xs text-gray-400 mt-1">{{ formatDate(latestAttempt(entry)!.createdAt) }}</p>
              <p class="text-sm text-gray-800 leading-relaxed mt-3">{{ latestAttempt(entry)!.userTranslation }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Latest feedback</p>
              <p class="text-sm text-gray-800 mt-3">
                {{ latestAttempt(entry)!.feedback?.summary ?? 'Reference translation saved without extra feedback.' }}
              </p>
              <ul
                v-if="latestAttempt(entry)!.feedback?.improvements?.length"
                class="mt-3 space-y-1 text-sm text-gray-600 list-disc list-inside"
              >
                <li
                  v-for="item in latestAttempt(entry)!.feedback!.improvements.slice(0, 2)"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500">
            No translation attempts saved yet. Use “Practice Again” to revisit this passage.
          </p>
        </div>
      </article>
    </div>
  </div>
</template>
