package com.numan259.niho;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;
import java.io.File;

@CapacitorPlugin(name = "NihoDownloads", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class NihoDownloadsPlugin extends Plugin {
    @PluginMethod public void list(PluginCall call) {
        try { call.resolve(new JSObject().put("items", DownloadStore.items(getContext()))); }
        catch (Exception error) { call.reject("Could not read downloads.", error); }
    }
    @PluginMethod public void enqueue(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") == PermissionState.PROMPT) requestPermissionForAlias("notifications", call, "downloadPermission");
        else enqueueGranted(call);
    }
    @PermissionCallback private void downloadPermission(PluginCall call) { enqueueGranted(call); }
    private void enqueueGranted(PluginCall call) {
        try {
            JSONObject item = call.getObject("item");
            if (item == null) throw new Exception("Missing download.");
            String id = item.getString("id");
            DownloadStore.file(getContext(), id + "/master.m3u8"); // Validate before any write.
            String url = DownloadHttp.resolve(call.getString("url"), call.getString("url"));
            JSONObject existing = DownloadStore.get(getContext(), id);
            if (existing != null && !"error".equals(existing.getJSONObject("item").optString("status"))) { call.resolve(); return; }
            if (DownloadService.isActive(id)) { call.reject("This download is still stopping. Please try again shortly."); return; }
            DownloadStore.clearFiles(getContext(), id);
            item.put("backend", "native").put("status", "queued").put("queuedAt", System.currentTimeMillis()).remove("error");
            JSONObject job = new JSONObject().put("item", item).put("url", url).put("audio", call.getString("audio", "en")).put("subtitles", call.getString("subtitles", "off"));
            DownloadStore.save(getContext(), job);
            start(); call.resolve();
        } catch (Exception error) { call.reject("Could not queue download: " + error.getMessage(), error); }
    }
    private void start() { ContextCompat.startForegroundService(getContext(), new Intent(getContext(), DownloadService.class)); }
    @PluginMethod public void resume(PluginCall call) {
        try {
            // No permission dialogs at launch. Restart persisted queued/in-flight work.
            if (DownloadStore.next(getContext()) != null) start();
            else {
                org.json.JSONArray items = DownloadStore.items(getContext());
                for (int i = 0; i < items.length(); i++) if ("downloading".equals(items.getJSONObject(i).optString("status"))) { start(); break; }
            }
            call.resolve();
        } catch (Exception error) { call.reject("Open Niho to resume background downloads.", error); }
    }
    @PluginMethod public void cancel(PluginCall call) {
        try {
            String id = call.getString("id");
            synchronized (DownloadStore.class) { if (!DownloadService.cancelActive(id)) {
                JSONObject job = DownloadStore.get(getContext(), id);
                if (job != null && "queued".equals(job.getJSONObject("item").optString("status"))) {
                    job.getJSONObject("item").put("status", "error").put("error", "Download cancelled. Tap Retry to add it again.");
                    DownloadStore.clearFiles(getContext(), id); DownloadStore.save(getContext(), job);
                }
            } }
            call.resolve();
        } catch (Exception error) { call.reject("Could not cancel download.", error); }
    }
    @PluginMethod public void remove(PluginCall call) {
        try {
            String id = call.getString("id");
            synchronized (DownloadStore.class) {
                if (DownloadService.isActive(id)) { call.reject("Cancel the active download before deleting it."); return; }
                DownloadStore.remove(getContext(), id);
            }
            call.resolve();
        } catch (Exception error) { call.reject("Could not remove download.", error); }
    }
    @PluginMethod public void file(PluginCall call) {
        try {
            File file = DownloadStore.file(getContext(), call.getString("key", ""));
            if (!file.isFile()) throw new Exception("Missing saved file.");
            call.resolve(new JSObject().put("uri", android.net.Uri.fromFile(file).toString()));
        } catch (Exception error) { call.reject("Saved video data is missing.", error); }
    }
    @PluginMethod public void permissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) requestPermissionForAlias("notifications", call, "permissionsResult");
        else permissionsResult(call);
    }
    @PermissionCallback private void permissionsResult(PluginCall call) { call.resolve(new JSObject().put("notifications", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED)); }
    @PluginMethod public void batterySettings(PluginCall call) {
        try { getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); call.resolve(); }
        catch (Exception error) { call.reject("Could not open battery settings.", error); }
    }
}
