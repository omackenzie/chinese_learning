import type { Difficulty } from '../types'

function parseSSEData(data: string): string | never {
  try {
    const parsed = JSON.parse(data)
    if (parsed.error) {
      throw new Error(parsed.error)
    }
    if (parsed.content !== undefined) {
      return parsed.content
    }
    return ''
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Not JSON — return raw text as fallback
      return data
    }
    throw e
  }
}

async function* readSSEStream(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') return

        const content = parseSSEData(data)
        if (content) yield content
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6)
      if (data !== '[DONE]') {
        const content = parseSSEData(data)
        if (content) yield content
      }
    }
  } finally {
    reader.releaseLock()
  }
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return body.error || `Request failed: ${response.status} ${response.statusText}`
  } catch {
    return `Request failed: ${response.status} ${response.statusText}`
  }
}

export async function* generateParagraph(
  params: { difficulty: Difficulty; knownHskLevel: number }
): AsyncGenerator<string> {
  let response: Response
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch {
    throw new Error('Could not connect to the server. Is the backend running?')
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }

  yield* readSSEStream(response)
}

export async function* getTranslation(chinese: string): AsyncGenerator<string> {
  let response: Response
  try {
    response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chinese }),
    })
  } catch {
    throw new Error('Could not connect to the server. Is the backend running?')
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }

  yield* readSSEStream(response)
}
