import type { Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext, LoaderStats } from 'hls.js'
import { offlineKey, readFile } from './storage'

/** This loader never falls back to the network, even for missing segments. */
export class OfflineLoader implements Loader<LoaderContext> {
  context: LoaderContext | null = null
  stats: LoaderStats = {
    aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 }, parsing: { start: 0, end: 0 }, buffering: { start: 0, first: 0, end: 0 },
  }
  abort() { this.stats.aborted = true }
  destroy() { this.abort() }
  load(context: LoaderContext, _config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
    this.context = context
    this.stats.loading.start = performance.now()
    void this.read(context).then((data) => {
      if (this.stats.aborted) return
      this.stats.loading.first = this.stats.loading.end = performance.now()
      this.stats.loaded = this.stats.total = typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data.byteLength
      callbacks.onProgress?.(this.stats, context, data, null)
      callbacks.onSuccess({ url: context.url, data, code: 200 }, this.stats, context, null)
    }).catch(() => {
      if (!this.stats.aborted) callbacks.onError({ code: 404, text: 'Saved video data is missing. Delete this download and download it again.' }, context, null, this.stats)
    })
  }
  private async read(context: LoaderContext) {
    let blob = await readFile(offlineKey(context.url))
    if (!blob) throw new Error('Missing download')
    // hls.js uses rangeEnd=0 to mean the full resource, not an empty range.
    if (context.rangeEnd) blob = blob.slice(context.rangeStart ?? 0, context.rangeEnd)
    return context.responseType === 'arraybuffer' ? blob.arrayBuffer() : blob.text()
  }
}
