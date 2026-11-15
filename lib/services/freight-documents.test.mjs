import test from 'node:test'
import assert from 'node:assert/strict'
import { createFreightDocumentService, getFreightDocumentKind } from './freight-documents.ts'

test('lists old freteDocs objects and retains original public URLs', async () => {
  const listed = []
  const bucket = {
    async list(folder, options) {
      listed.push({ folder, options })
      return { data: [{ name: 'freteDocs-old.pdf' }, { name: 'other.jpg' }], error: null }
    },
    getPublicUrl(path) { return { data: { publicUrl: `https://supa.example/${path}` } } },
  }
  const docs = await createFreightDocumentService(bucket).list('route-1')
  assert.deepEqual(docs, [{ path: 'documents/route-1/freteDocs-old.pdf', url: 'https://supa.example/documents/route-1/freteDocs-old.pdf', name: 'freteDocs-old.pdf', kind: 'pdf' }])
  assert.equal(listed[0].folder, 'documents/route-1')
  assert.equal(getFreightDocumentKind('photo.JPG'), 'image')
})

test('keeps successful uploads visible when a later file fails', async () => {
  let calls = 0
  const bucket = {
    async upload(path) {
      calls += 1
      return calls === 1 ? { data: { path }, error: null } : { data: null, error: new Error('Upload failed') }
    },
    getPublicUrl(path) { return { data: { publicUrl: `https://supa.example/${path}` } } },
  }
  const visible = []
  const files = [new File(['one'], 'one.pdf', { type: 'application/pdf' }), new File(['two'], 'two.pdf', { type: 'application/pdf' })]
  await assert.rejects(createFreightDocumentService(bucket).upload('route-1', files, doc => visible.push(doc)), /Upload failed/)
  assert.equal(visible.length, 1)
  assert.match(visible[0].path, /^documents\/route-1\/freteDocs-.*-one\.pdf$/)
})

test('rejects oversized PDFs before writing and blocks removal outside route', async () => {
  let writes = 0
  const bucket = { async upload() { writes += 1 }, async remove() { writes += 1 } }
  const service = createFreightDocumentService(bucket)
  const largePdf = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' })
  await assert.rejects(service.upload('route-1', [largePdf], () => {}), /20 MB/)
  await assert.rejects(service.remove('route-1', 'documents/route-2/freteDocs-old.pdf'), /frete/)
  assert.equal(writes, 0)
})
