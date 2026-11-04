// Builds the debug APK with the Gradle wrapper on any OS
// (Windows needs .\gradlew.bat, macOS/Linux ./gradlew).
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const androidDir = join(import.meta.dirname, '..', 'android')
const windows = process.platform === 'win32'
const gradlew = windows ? '.\\gradlew.bat' : './gradlew'

const result = spawnSync(gradlew, ['assembleDebug'], { cwd: androidDir, stdio: 'inherit', shell: windows })
if (result.status === 0) {
  console.log(`\nAPK: ${join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')}`)
}
process.exit(result.status ?? 1)
