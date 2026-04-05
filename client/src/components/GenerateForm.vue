<script setup lang="ts">
import { ref } from 'vue'
import type { Difficulty } from '../types'

defineProps<{ loading: boolean }>()
const emit = defineEmits<{ generate: [difficulty: Difficulty] }>()

const difficulty = ref<Difficulty>('medium')

const options: { value: Difficulty; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Short texts, 1–2 new words' },
  { value: 'medium', label: 'Medium', description: 'Moderate length, 3–5 new words' },
  { value: 'hard', label: 'Hard', description: 'Longer texts, 5–8 new words' },
]

function handleSubmit() {
  emit('generate', difficulty.value)
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-5">
    <div>
      <span class="block text-sm font-medium text-gray-700 mb-2">Difficulty</span>
      <div class="flex gap-3">
        <label
          v-for="opt in options"
          :key="opt.value"
          class="flex-1 cursor-pointer"
        >
          <input
            type="radio"
            :value="opt.value"
            v-model="difficulty"
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
