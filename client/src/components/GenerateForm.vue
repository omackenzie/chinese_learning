<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVocabularyStore } from '../stores/vocabulary'
import { HSK_LEVELS } from '../data/hsk'

import type {
  ContentStyle,
  GenerateParagraphRequest,
  ParagraphLength,
  PreferredStyle,
  StudyMode,
} from '../types'

defineProps<{ loading: boolean }>()

const emit = defineEmits<{ generate: [config: GenerateParagraphRequest] }>()

const vocab = useVocabularyStore()

const paragraphLength = ref<ParagraphLength>('medium')
const studyMode = ref<StudyMode>('balanced')
const preferredStyle = ref<PreferredStyle>('auto')
const topicHint = ref('')

const lengthOptions: {
  value: ParagraphLength
  label: string
  description: string
}[] = [
  { value: 'short', label: 'Short', description: '2-3 sentences' },
  { value: 'medium', label: 'Medium', description: '4-6 sentences' },
  { value: 'long', label: 'Long', description: '8-12 sentences' },
]

const studyModeOptions: {
  value: StudyMode
  label: string
  description: string
}[] = [
  {
    value: 'review',
    label: 'Review',
    description: 'Mostly familiar vocabulary with gentle reinforcement',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Comfortable reading plus a few targeted new words',
  },
  {
    value: 'stretch',
    label: 'Stretch',
    description: 'A more challenging passage with richer vocabulary',
  },
]

const styleOptions: {
  value: PreferredStyle
  label: string
}[] = [
  { value: 'auto', label: 'Auto-select' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'text_messages', label: 'Text messages' },
  { value: 'social_media', label: 'Social media' },
  { value: 'short_story', label: 'Short story' },
  { value: 'news_article', label: 'News article' },
  { value: 'diary_entry', label: 'Diary entry' },
  { value: 'email', label: 'Email' },
]

const targetNewWords = computed(() => {
  const targets: Record<StudyMode, Record<ParagraphLength, number>> = {
    review: { short: 1, medium: 2, long: 3 },
    balanced: { short: 2, medium: 3, long: 5 },
    stretch: { short: 3, medium: 5, long: 6 },
  }

  return targets[studyMode.value][paragraphLength.value]
})

const frontierSummary = computed(() => {
  const level = vocab.frontierLevel
  if (level === null) {
    return 'All HSK words are marked as learned, so generation will stay in full review mode.'
  }

  const levelInfo = HSK_LEVELS.find((entry) => entry.level === level)
  const learned = vocab.learnedCountByLevel[level] ?? 0
  const total = levelInfo?.wordCount ?? 0
  const remaining = Math.max(total - learned, 0)

  return `${levelInfo?.label ?? `HSK ${level}`} frontier: ${learned}/${total} learned, ${remaining} remaining`
})

const studyModeSummary = computed(() => {
  if (studyMode.value === 'review') {
    return 'Targets the current frontier level only and keeps sentence patterns familiar.'
  }

  if (studyMode.value === 'balanced') {
    return 'Prefers the current frontier level, with light spillover when it helps the passage feel natural.'
  }

  return 'Can pull from the next challenge level and aims for a more demanding read.'
})

function handleSubmit() {
  emit('generate', {
    paragraphLength: paragraphLength.value,
    studyMode: studyMode.value,
    preferredStyle: preferredStyle.value,
    topicHint: topicHint.value.trim(),
    learnerProfile: vocab.buildLearnerProfile(studyMode.value),
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <div>
      <span class="block text-sm font-medium text-gray-700 mb-2">Length</span>
      <div class="flex gap-3">
        <label
          v-for="opt in lengthOptions"
          :key="opt.value"
          class="flex-1 cursor-pointer"
        >
          <input
            v-model="paragraphLength"
            type="radio"
            :value="opt.value"
            class="sr-only peer"
          />
          <div
            class="flex flex-col items-center text-center rounded-lg border border-gray-300 py-3 px-2 transition-all peer-checked:border-red-700 peer-checked:bg-red-50 peer-checked:text-red-700 hover:border-gray-400"
          >
            <span class="text-sm font-semibold">{{ opt.label }}</span>
            <span class="text-xs text-gray-400 mt-0.5 leading-tight">{{ opt.description }}</span>
          </div>
        </label>
      </div>
    </div>

    <div>
      <span class="block text-sm font-medium text-gray-700 mb-2">Study focus</span>
      <div class="grid gap-3 sm:grid-cols-3">
        <label
          v-for="opt in studyModeOptions"
          :key="opt.value"
          class="cursor-pointer"
        >
          <input
            v-model="studyMode"
            type="radio"
            :value="opt.value"
            class="sr-only peer"
          />
          <div
            class="h-full rounded-lg border border-gray-300 px-4 py-3 transition-all peer-checked:border-red-700 peer-checked:bg-red-50 hover:border-gray-400"
          >
            <div class="text-sm font-semibold text-gray-900 peer-checked:text-red-700">
              {{ opt.label }}
            </div>
            <p class="text-xs leading-relaxed text-gray-500 mt-1">
              {{ opt.description }}
            </p>
          </div>
        </label>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block">
        <span class="block text-sm font-medium text-gray-700 mb-1.5">Preferred style</span>
        <select
          v-model="preferredStyle"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option
            v-for="opt in styleOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="block text-sm font-medium text-gray-700 mb-1.5">Topic hint</span>
        <input
          v-model="topicHint"
          type="text"
          placeholder="Optional, e.g. ordering food or moving to a new city"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </label>
    </div>

    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p class="font-semibold">Generation preview</p>
      <p class="mt-1">Up to <span class="font-semibold">{{ targetNewWords }}</span> unfamiliar word(s), tuned for {{ paragraphLength }} length.</p>
      <p class="mt-1">{{ studyModeSummary }}</p>
      <p class="mt-1 text-amber-800">{{ frontierSummary }}</p>
    </div>

    <button
      type="submit"
      :disabled="loading"
      class="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      <svg
        v-if="loading"
        class="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {{ loading ? 'Generating...' : 'Generate Paragraph' }}
    </button>
  </form>
</template>
