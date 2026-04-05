import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const showPinyin = ref(
    JSON.parse(localStorage.getItem('showPinyin') ?? 'true')
  )

  function togglePinyin() {
    showPinyin.value = !showPinyin.value
    localStorage.setItem('showPinyin', JSON.stringify(showPinyin.value))
  }

  return { showPinyin, togglePinyin }
})
