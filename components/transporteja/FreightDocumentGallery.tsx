'use client'

import { FileText, Loader2, Trash2 } from 'lucide-react'
import type { FreightDocument } from '@/lib/services/freight-documents'

export default function FreightDocumentGallery({
  documents,
  canRemove,
  removingPath,
  onPreview,
  onRemove,
}: {
  documents: FreightDocument[]
  canRemove: boolean
  removingPath: string | null
  onPreview: (url: string) => void
  onRemove: (document: FreightDocument) => void
}) {
  if (documents.length === 0) return null

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {documents.map((document) => {
        const isRemoving = removingPath === document.path
        return (
          <div
            key={document.path}
            className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
          >
            {document.kind === 'pdf' ? (
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-800"
                title={document.name}
              >
                <FileText className="mb-1 h-10 w-10 text-red-600" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-red-700">PDF</span>
                <span className="mt-1 line-clamp-2 break-all text-[10px] text-gray-500">
                  {document.name.replace(/^freteDocs-\d+-[a-z0-9]+-/, '')}
                </span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onPreview(document.url)}
                className="block h-full w-full focus:outline-none focus:ring-2 focus:ring-slate-800"
                aria-label="Visualizar imagem"
              >
                <img
                  src={document.url}
                  alt="Documento do frete"
                  className="h-full w-full object-contain transition-opacity group-hover:opacity-95"
                  loading="lazy"
                />
              </button>
            )}
            {canRemove && (
              <button
                type="button"
                onClick={() => onRemove(document)}
                disabled={isRemoving}
                className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-red-600 shadow transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                title="Remover arquivo"
                aria-label="Remover arquivo"
              >
                {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
