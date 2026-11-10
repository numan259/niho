import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Download } from './storage'

export const nativeDownloads = Capacitor.getPlatform() === 'android'
export const NativeDownloads = registerPlugin<{
  list(): Promise<{ items: Download[] }>
  enqueue(options: { item: Download; url: string; audio: string; subtitles: string }): Promise<void>
  cancel(options: { id: string }): Promise<void>
  remove(options: { id: string }): Promise<void>
  file(options: { key: string }): Promise<{ uri: string }>
  resume(): Promise<void>
  permissions(): Promise<{ notifications: boolean }>
  batterySettings(): Promise<void>
}>('NihoDownloads')

export async function readNativeFile(key: string) {
  const { uri } = await NativeDownloads.file({ key })
  const response = await fetch(Capacitor.convertFileSrc(uri))
  if (!response.ok) throw new Error('Saved video data is missing.')
  return response.blob()
}
