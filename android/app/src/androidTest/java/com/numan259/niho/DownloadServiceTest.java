package com.numan259.niho;

import static org.junit.Assert.*;
import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@RunWith(AndroidJUnit4.class)
public class DownloadServiceTest {
    @Test public void downloadsQueueWithActivityBackgroundedAndScreenOff() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String first = "instrumented-queue-first", second = "instrumented-queue-second";
        ExecutorService serverThreads = Executors.newCachedThreadPool();
        ServerSocket server = new ServerSocket(0);
        AtomicInteger active = new AtomicInteger(), peak = new AtomicInteger();
        serverThreads.execute(() -> {
            while (!server.isClosed()) try {
                Socket socket = server.accept();
                serverThreads.execute(() -> {
                    try (socket) {
                        BufferedReader request = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                        String path = request.readLine().split(" ")[1];
                        String header; while ((header = request.readLine()) != null && !header.isEmpty()) { }
                        byte[] data;
                        boolean segment = !path.endsWith(".m3u8");
                        if (segment) {
                            peak.accumulateAndGet(active.incrementAndGet(), Math::max);
                            Thread.sleep(1500);
                            data = new byte[] { 1, 2, 3, 4 };
                        } else if (path.endsWith("master.m3u8")) data = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100000,RESOLUTION=640x360\nvideo.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=1920x1080\nlarge.m3u8\n".getBytes(StandardCharsets.UTF_8);
                        else data = "#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\na.ts\n#EXTINF:2,\nb.ts\n#EXTINF:2,\nc.ts\n#EXTINF:2,\nd.ts\n#EXT-X-ENDLIST\n".getBytes(StandardCharsets.UTF_8);
                        OutputStream output = socket.getOutputStream();
                        output.write(("HTTP/1.1 200 OK\r\nContent-Length: " + data.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                        output.write(data); output.flush();
                        if (segment) active.decrementAndGet();
                    } catch (Exception ignored) { }
                });
            } catch (IOException ignored) { }
        });
        try {
            DownloadStore.remove(context, first); DownloadStore.remove(context, second);
            String url = "http://127.0.0.1:" + server.getLocalPort() + "/master.m3u8";
            DownloadStore.save(context, job(first, url, 1)); DownloadStore.save(context, job(second, url, 2));
            context.startActivity(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            Thread.sleep(1500);
            ContextCompat.startForegroundService(context, new Intent(context, DownloadService.class));
            waitFor(context, first, "downloading");
            InstrumentationRegistry.getInstrumentation().getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME);
            InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent 223").close();
            waitFor(context, second, "ready");
            assertEquals("ready", DownloadStore.get(context, first).getJSONObject("item").getString("status"));
            assertEquals("360p", DownloadStore.get(context, second).getJSONObject("item").getString("quality"));
            assertTrue("Segments should transfer concurrently", peak.get() >= 2);
            assertTrue("Concurrency should be bounded", peak.get() <= 3);
            assertTrue(DownloadStore.file(context, second + "/master.m3u8").isFile());
            assertEquals(4, DownloadStore.file(context, second + "/asset-0").length());
            DownloadStore.remove(context, first);
            assertFalse(DownloadStore.file(context, first + "/asset-0").exists());
        } finally {
            InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent 224").close();
            context.stopService(new Intent(context, DownloadService.class));
            server.close(); serverThreads.shutdownNow();
            DownloadStore.remove(context, first); DownloadStore.remove(context, second);
        }
    }
    private JSONObject job(String id, String url, int order) throws Exception {
        JSONObject item = new JSONObject().put("id", id).put("profileId", "test").put("backend", "native").put("status", "queued")
            .put("queuedAt", order).put("createdAt", order).put("bytes", 0).put("completed", 0).put("total", 0)
            .put("title", new JSONObject().put("id", 1).put("key", "movie/1").put("mediaType", "movie").put("name", "Download test"));
        return new JSONObject().put("item", item).put("url", url).put("audio", "en").put("subtitles", "off");
    }
    private void waitFor(Context context, String id, String status) throws Exception {
        long deadline = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < deadline) {
            JSONObject item = DownloadStore.get(context, id).getJSONObject("item");
            if (status.equals(item.optString("status"))) return;
            assertNotEquals(item.optString("error"), "error", item.optString("status"));
            Thread.sleep(100);
        }
        fail("Timed out waiting for " + id + " to become " + status);
    }
}
