import type { EmitFn, FileData, NodeContext } from '@/lib/types'

export async function handleInput(
  _nodeId: string,
  _config: unknown,
  context: NodeContext,
  _emit: EmitFn,
): Promise<NodeContext> {
  const textInput = context.input  ?? ''
  const fileData  = context.fileData as FileData | undefined

  if (!fileData) {
    return {
      ...context,
      output:   textInput,
      messages: [{ role: 'user', content: textInput }],
    }
  }

  const isImage = fileData.mimeType.startsWith('image/')
  const isText  = fileData.mimeType.startsWith('text/') ||
                  fileData.mimeType === 'application/json' ||
                  fileData.mimeType === 'application/yaml'

  // ── Image → multimodal message ──────────────────────────────────────────────
  if (isImage) {
    const imageBytes = Buffer.from(fileData.data, 'base64')
    return {
      ...context,
      output:   textInput || fileData.name,
      messages: [{
        role: 'user',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [
          { type: 'image' as const, image: imageBytes, mimeType: fileData.mimeType as any },
          ...(textInput ? [{ type: 'text' as const, text: textInput }] : []),
        ] as any,
      }],
    }
  }

  // ── Text / JSON → decode and embed as text ──────────────────────────────────
  if (isText) {
    const decoded = Buffer.from(fileData.data, 'base64').toString('utf-8')
    const content = textInput
      ? `File: ${fileData.name}\n\n${decoded}\n\nUser instruction: ${textInput}`
      : `File: ${fileData.name}\n\n${decoded}`
    return {
      ...context,
      output:   content,
      messages: [{ role: 'user', content }],
    }
  }

  // ── Other binary files → pass metadata + optional instruction ───────────────
  const sizeLabel = fileData.size < 1024
    ? `${fileData.size}B`
    : `${Math.round(fileData.size / 1024)}KB`
  const content = textInput
    ? `File: ${fileData.name} (${fileData.mimeType}, ${sizeLabel})\n\n${textInput}`
    : `File: ${fileData.name} (${fileData.mimeType}, ${sizeLabel})`
  return {
    ...context,
    output:   content,
    messages: [{ role: 'user', content }],
  }
}
