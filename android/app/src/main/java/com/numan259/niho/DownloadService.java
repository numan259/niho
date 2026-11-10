package com.numan259.niho;

import android.app.*;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.*;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class DownloadService extends Service {
    private static final String CHANNEL = "niho-downloads";
    private static final int NOTIFICATION = 4101;
    private static volatile DownloadService instance;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService queue = Executors.newSingleThreadExecutor();
    private volatile DownloadHttp currentHttp;
    private volatile String activeId;
    private volatile boolean stopping, timedOut, userCancelled, queueBlocked;
    private boolean running;
    private int lastStartId;
    private long lastNotification;
    private PowerManager.WakeLock wakeLock;

    static boolean cancelActive(String id) {
        DownloadService service = instance;
        if (service == null || !id.equals(service.activeId)) return false;
        service.userCancelled = true;
        if (service.currentHttp != null) service.currentHttp.cancel();
        return true;
    }
    static boolean isActive(String id) { DownloadService service = instance; return service != null && id.equals(service.activeId); }
    @Override public void onCreate() {
        super.onCreate(); instance = this;
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL, "Video downloads", NotificationManager.IMPORTANCE_LOW));
        try { DownloadStore.recover(this); } catch (Exception ignored) { }
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        lastStartId = startId;
        queueBlocked = false;
        if (intent != null && "cancel".equals(intent.getAction()) && activeId != null) cancelActive(activeId);
        Notification notification = notification("Niho downloads", "Preparing your queue…", 0, 0);
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(NOTIFICATION, notification);
        } catch (RuntimeException unavailable) { stopSelf(); return START_NOT_STICKY; }
        if (wakeLock == null) {
            wakeLock = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Niho:downloads");
            wakeLock.acquire(6L * 60 * 60 * 1000);
        }
        if (!running) launch();
        return START_STICKY;
    }
    private void launch() {
        running = true;
        queue.execute(() -> {
            try {
                while (!stopping && !timedOut) {
                    JSONObject job = DownloadStore.next(this);
                    if (job == null) break;
                    runDownload(job);
                }
            } catch (Exception ignored) { queueBlocked = true; /* Avoid a retry loop when the queue index cannot be saved. */ }
            finally {
                main.post(() -> {
                    running = false;
                    if (stopping) return;
                    try { if (!timedOut && !queueBlocked && DownloadStore.next(this) != null) { launch(); return; } } catch (Exception ignored) { }
                    stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(lastStartId);
                });
            }
        });
    }
    private void runDownload(JSONObject job) throws Exception {
        JSONObject item = job.getJSONObject("item");
        String id = item.getString("id");
        DownloadHttp http = new DownloadHttp();
        synchronized (DownloadStore.class) {
            JSONObject latest = DownloadStore.get(this, id);
            if (latest == null || !"queued".equals(latest.getJSONObject("item").optString("status"))) return;
            activeId = id; userCancelled = false; currentHttp = http;
            item.put("status", "downloading").remove("error");
            DownloadStore.save(this, job);
        }
        publish(item, true);
        ExecutorService workers = Executors.newFixedThreadPool(3);
        try {
            File planFile = DownloadStore.file(this, id + "/plan.json");
            JSONObject plan;
            if (planFile.isFile()) plan = new JSONObject(new String(new android.util.AtomicFile(planFile).readFully(), StandardCharsets.UTF_8));
            else {
                plan = new DownloadPlan(http, id, job.optString("audio", "en"), job.optString("subtitles", "off")).build(job.getString("url"));
                writeFile(planFile, plan.toString());
            }
            JSONObject info = plan.getJSONObject("info");
            for (Iterator<String> keys = info.keys(); keys.hasNext();) { String key = keys.next(); item.put(key, info.get(key)); }
            JSONArray assets = plan.getJSONArray("assets");
            item.put("total", assets.length()).put("completed", 0).put("bytes", 0);
            DownloadStore.save(this, job);
            AtomicInteger cursor = new AtomicInteger();
            AtomicReference<Exception> failed = new AtomicReference<>();
            List<Future<?>> futures = new ArrayList<>();
            for (int worker = 0; worker < Math.min(3, assets.length()); worker++) futures.add(workers.submit(() -> {
                try {
                    int index;
                    while (!stopping && !timedOut && !userCancelled && failed.get() == null && (index = cursor.getAndIncrement()) < assets.length()) {
                        JSONObject resource = assets.getJSONObject(index);
                        File target = DownloadStore.file(this, id + "/" + resource.getString("file"));
                        http.download(resource.getString("url"), target);
                        synchronized (item) {
                            item.put("bytes", item.optLong("bytes") + target.length()).put("completed", item.optInt("completed") + 1);
                            DownloadStore.save(this, job); publish(item, false);
                        }
                    }
                } catch (Exception error) { failed.compareAndSet(null, error); http.cancel(); }
            }));
            for (Future<?> future : futures) future.get();
            if (failed.get() != null) throw failed.get();
            http.check();
            if (stopping || timedOut || userCancelled) throw new IOException("Download interrupted.");
            JSONObject playlists = plan.getJSONObject("playlists");
            for (Iterator<String> keys = playlists.keys(); keys.hasNext();) {
                String file = keys.next(); File target = DownloadStore.file(this, id + "/" + file);
                writeFile(target, playlists.getString(file)); item.put("bytes", item.optLong("bytes") + target.length());
            }
            synchronized (DownloadStore.class) {
                http.check();
                if (userCancelled || stopping || timedOut) throw new IOException("Download interrupted.");
                item.put("status", "ready"); DownloadStore.save(this, job);
            }
        } catch (Exception error) {
            http.cancel();
            workers.shutdown();
            // All writes must stop before cancelling/deleting an incomplete download.
            while (!workers.awaitTermination(1, TimeUnit.SECONDS)) { }
            if (stopping || timedOut) {
                item.put("status", "queued").put("error", "Android paused background downloads. Open Niho to continue.");
            } else {
                DownloadStore.clearFiles(this, id);
                item.put("status", "error").put("bytes", 0).put("completed", 0)
                    .put("error", userCancelled ? "Download cancelled. Tap Retry to add it again." : error.getMessage() == null ? "Download failed. Check your connection and retry." : error.getMessage());
            }
            DownloadStore.save(this, job);
        } finally { workers.shutdown(); currentHttp = null; activeId = null; }
    }
    private static void writeFile(File target, String value) throws IOException {
        if (!target.getParentFile().isDirectory() && !target.getParentFile().mkdirs()) throw new IOException("Not enough download storage.");
        android.util.AtomicFile atomic = new android.util.AtomicFile(target);
        FileOutputStream output = null;
        try { output = atomic.startWrite(); output.write(value.getBytes(StandardCharsets.UTF_8)); atomic.finishWrite(output); }
        catch (IOException error) { if (output != null) atomic.failWrite(output); throw error; }
    }
    private void publish(JSONObject item, boolean force) {
        long now = SystemClock.elapsedRealtime();
        if (!force && now - lastNotification < 1000) return;
        lastNotification = now;
        String title = item.optJSONObject("title").optString("name", "Niho download");
        String label = item.has("episode") ? "S" + item.optInt("season") + ":E" + item.optInt("episode") + " · " : "";
        int count = item.optInt("completed"), total = item.optInt("total");
        label += total > 0 ? (count * 100 / total) + "% · " + count + " / " + total + " files" : "Preparing video…";
        getSystemService(NotificationManager.class).notify(NOTIFICATION, notification(title, label, count, total));
    }
    private Notification notification(String title, String text, int completed, int total) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent cancel = PendingIntent.getService(this, 1, new Intent(this, DownloadService.class).setAction("cancel"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title).setContentText(text).setContentIntent(open).setOnlyAlertOnce(true).setOngoing(true)
            .setProgress(total, completed, total == 0).addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancel current", cancel).build();
    }
    @Override public void onTimeout(int startId, int fgsType) {
        timedOut = true;
        if (currentHttp != null) currentHttp.cancel();
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    @Override public void onDestroy() {
        stopping = true;
        if (currentHttp != null) currentHttp.cancel();
        queue.shutdown();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (instance == this) instance = null;
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
