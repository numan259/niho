package com.numan259.niho;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Small durable queue index. Media bytes never cross the Capacitor bridge. */
final class DownloadStore {
    private static JSONArray jobs;
    static File root(Context context) throws IOException {
        File root = new File(context.getFilesDir(), "offline-downloads");
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Cannot create download storage.");
        return root;
    }
    static File file(Context context, String key) throws IOException {
        if (!key.matches("[A-Za-z0-9_%.-]+/[A-Za-z0-9_.-]+") || key.contains("..")) throw new IOException("Invalid download path.");
        File root = root(context);
        File file = new File(root, key).getCanonicalFile();
        if (!file.getPath().startsWith(root.getCanonicalPath() + File.separator)) throw new IOException("Invalid download path.");
        return file;
    }
    static synchronized JSONArray jobs(Context context) throws Exception {
        if (jobs == null) {
            AtomicFile index = new AtomicFile(new File(root(context), "index.json"));
            try { jobs = new JSONArray(new String(index.readFully(), StandardCharsets.UTF_8)); }
            catch (FileNotFoundException missing) { jobs = new JSONArray(); }
        }
        return new JSONArray(jobs.toString());
    }
    static synchronized void save(Context context, JSONObject job) throws Exception {
        JSONArray next = jobs(context);
        String id = job.getJSONObject("item").getString("id");
        boolean found = false;
        for (int i = 0; i < next.length(); i++) {
            if (next.getJSONObject(i).getJSONObject("item").getString("id").equals(id)) { next.put(i, job); found = true; break; }
        }
        if (!found) next.put(job);
        write(context, next);
    }
    static synchronized JSONObject get(Context context, String id) throws Exception {
        JSONArray all = jobs(context);
        for (int i = 0; i < all.length(); i++) {
            JSONObject job = all.getJSONObject(i);
            if (job.getJSONObject("item").getString("id").equals(id)) return job;
        }
        return null;
    }
    static synchronized JSONArray items(Context context) throws Exception {
        JSONArray result = new JSONArray(), all = jobs(context);
        for (int i = 0; i < all.length(); i++) result.put(all.getJSONObject(i).getJSONObject("item"));
        return result;
    }
    static synchronized JSONObject next(Context context) throws Exception {
        JSONObject next = null;
        JSONArray all = jobs(context);
        for (int i = 0; i < all.length(); i++) {
            JSONObject candidate = all.getJSONObject(i), item = candidate.getJSONObject("item");
            if (!"queued".equals(item.optString("status"))) continue;
            if (next == null || item.optLong("queuedAt") < next.getJSONObject("item").optLong("queuedAt")) next = candidate;
        }
        return next;
    }
    static synchronized void recover(Context context) throws Exception {
        JSONArray all = jobs(context);
        for (int i = 0; i < all.length(); i++) {
            JSONObject item = all.getJSONObject(i).getJSONObject("item");
            if ("downloading".equals(item.optString("status"))) item.put("status", "queued");
        }
        write(context, all);
    }
    static synchronized void remove(Context context, String id) throws Exception {
        clearFiles(context, id);
        JSONArray next = new JSONArray(), all = jobs(context);
        for (int i = 0; i < all.length(); i++) if (!all.getJSONObject(i).getJSONObject("item").getString("id").equals(id)) next.put(all.get(i));
        write(context, next);
    }
    static void clearFiles(Context context, String id) throws IOException {
        File directory = file(context, id + "/master.m3u8").getParentFile();
        File[] files = directory.listFiles();
        if (files != null) for (File child : files) if (!child.delete()) throw new IOException("Could not remove incomplete download.");
        if (directory.exists() && !directory.delete()) throw new IOException("Could not remove download folder.");
    }
    private static void write(Context context, JSONArray next) throws IOException {
        AtomicFile file = new AtomicFile(new File(root(context), "index.json"));
        FileOutputStream output = null;
        try {
            output = file.startWrite(); output.write(next.toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(output); jobs = next;
        } catch (IOException error) { if (output != null) file.failWrite(output); throw error; }
    }
}
