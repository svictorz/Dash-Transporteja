import type { SupabaseClient } from '@supabase/supabase-js'

type StorageBucket = ReturnType<SupabaseClient['storage']['from']>

export type FreightDocument = {
  path: string
  url: string
  name: string
  kind: 'image' | 'pdf'
}

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024
const SAFE_IMAGE_DIMENSION = 4000
const IMAGE_COMPRESSION_QUALITY = 0.9
const COMPRESSIBLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function getFreightDocumentKind(name: string): FreightDocument['kind'] {
  return name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
}

function validateFiles(files: readonly File[]): void {
  if (files.some((file) => file.type !== 'application/pdf' && !file.type.startsWith('image/'))) {
    throw new Error('Envie apenas imagens (JPG, PNG, WEBP) ou PDF.')
  }
  if (files.some((file) => file.type === 'application/pdf' && file.size > MAX_PDF_SIZE_BYTES)) {
    throw new Error('Cada PDF pode ter no máximo 20 MB.')
  }
}

async function prepareImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_IMAGE_TYPES.includes(file.type)) return file

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const image: HTMLImageElement = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = dataUrl
  })
  const ratio = Math.min(1, SAFE_IMAGE_DIMENSION / Math.max(image.width, image.height))
  const targetWidth = Math.round(image.width * ratio)
  const targetHeight = Math.round(image.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) return file
  context.drawImage(image, 0, 0, targetWidth, targetHeight)
  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', IMAGE_COMPRESSION_QUALITY)
  })
  if (!blob) return file
  const compressed = new File([blob], file.name.replace(/\.(png|webp|heic|heif)$/i, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
  return compressed.size < file.size ? compressed : file
}

function documentFromPath(bucket: StorageBucket, path: string): FreightDocument {
  const name = path.split('/').pop() ?? path
  return {
    path,
    url: bucket.getPublicUrl(path).data.publicUrl,
    name,
    kind: getFreightDocumentKind(name),
  }
}

export function createFreightDocumentService(bucket: StorageBucket) {
  return {
    async list(routeId: string): Promise<FreightDocument[]> {
      const folder = `documents/${routeId}`
      const result: FreightDocument[] = []
      let offset = 0
      while (true) {
        const { data, error } = await bucket.list(folder, {
          limit: 100,
          offset,
          sortBy: { column: 'created_at', order: 'asc' },
        })
        if (error) throw error
        for (const entry of data ?? []) {
          if (entry.name?.startsWith('freteDocs-')) {
            result.push(documentFromPath(bucket, `${folder}/${entry.name}`))
          }
        }
        if (!data || data.length < 100) return result
        offset += data.length
      }
    },

    async upload(routeId: string, files: readonly File[], onUploaded: (document: FreightDocument) => void): Promise<void> {
      validateFiles(files)
      for (const original of files) {
        const file = original.type === 'application/pdf' ? original : await prepareImage(original)
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `documents/${routeId}/freteDocs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
        const { data, error } = await bucket.upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })
        if (error) throw error
        if (!data) throw new Error('O Storage não retornou o arquivo enviado.')
        onUploaded(documentFromPath(bucket, data.path))
      }
    },

    async remove(routeId: string, path: string): Promise<void> {
      if (!path.startsWith(`documents/${routeId}/freteDocs-`)) {
        throw new Error('Arquivo não pertence a este frete.')
      }
      const { error } = await bucket.remove([path])
      if (error) throw error
    },
  }
}
