import { pinyin } from 'pinyin-pro'

const chineseCharRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/

export function usePinyin() {
  function addPinyin(text: string): { char: string; pinyin: string }[] {
    if (!text) return []

    const pinyinArray = pinyin(text, { type: 'array', toneType: 'symbol' })
    const result: { char: string; pinyin: string }[] = []

    let pinyinIdx = 0
    for (const char of text) {
      if (chineseCharRegex.test(char)) {
        result.push({ char, pinyin: pinyinArray[pinyinIdx] ?? '' })
      } else {
        result.push({ char, pinyin: '' })
      }
      pinyinIdx++
    }

    return result
  }

  return { addPinyin }
}
