/**
 * One-time script to fill missing pinyin and English in the HSK word list.
 * Uses pinyin-pro for pinyin and cc-cedict (CEDICT) for English definitions.
 * Run with: node scripts/fill-hsk-data.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { pinyin as getPinyin } from 'pinyin-pro'
import cedict from 'cc-cedict'

// Manual translations for compound phrases not in CEDICT
const MANUAL = {
  '车上': 'on the vehicle; on the bus/train/car',
  '不太': 'not very; not quite',
  '不一会儿': 'in a little while; before long',
  '见过': 'to have seen; to have met',
  '送到': 'to deliver to; to send to',
  '这时候': 'at this moment; at this time',
  '放到': 'to put into; to place in',
  '能不能': 'can or cannot; is it possible to',
  '眼里': 'in one\'s eyes; in the eyes of',
  '有劲儿': 'energetic; vigorous; strong',
  '城里': 'in the city; in town',
  '很难说': 'hard to say; difficult to tell',
  '一番': 'a round of; some; a bout of',
  '指着': 'pointing at; indicating',
  '不利于': 'unfavorable for; detrimental to',
  '不肯': 'unwilling to; refuse to',
  '不难': 'not difficult; not hard',
  '不如说': 'better to say; rather say',
  '不予': 'to not; to refuse to; to withhold',
  '趁着': 'while; taking advantage of',
  '定为': 'to define as; to classify as',
  '飞往': 'to fly to; bound for',
  '公益性': 'public welfare; non-profit; charitable',
  '怀着': 'holding; carrying; with (a feeling)',
  '难以想象': 'hard to imagine; unimaginable',
  '说起来': 'speaking of; when it comes to',
  '着眼于': 'to focus on; with a view to',
}

const HSK_FILE = new URL('../client/src/data/hsk.ts', import.meta.url).pathname

const content = readFileSync(HSK_FILE, 'utf8')

const jsonStart = content.indexOf('[{')
const header = content.slice(0, jsonStart)

const jsonEnd = content.lastIndexOf('}]') + 2
const footer = content.slice(jsonEnd)
const words = JSON.parse(content.slice(jsonStart, jsonEnd))

let filledPinyin = 0
let filledEnglish = 0
let stillMissingEnglish = 0

for (const word of words) {
  if (!word.pinyin) {
    word.pinyin = getPinyin(word.simplified, { toneType: 'symbol', separator: ' ', type: 'string' })
    filledPinyin++
  }

  if (!word.english) {
    const results = cedict.getBySimplified(word.simplified, null, { asObject: false })
    if (results && results.length > 0) {
      word.english = results[0].english.join('; ')
      filledEnglish++
    } else if (MANUAL[word.simplified]) {
      word.english = MANUAL[word.simplified]
      filledEnglish++
    } else {
      stillMissingEnglish++
    }
  }
}

const newContent = header + JSON.stringify(words) + footer
writeFileSync(HSK_FILE, newContent)

console.log(`Done!`)
console.log(`  Filled pinyin:   ${filledPinyin}`)
console.log(`  Filled English:  ${filledEnglish}`)
console.log(`  Still missing:   ${stillMissingEnglish} English entries (no match found)`)
console.log(`  Total words:     ${words.length}`)
