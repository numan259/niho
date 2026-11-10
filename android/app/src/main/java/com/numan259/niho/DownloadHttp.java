package com.numan259.niho;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

final class DownloadHttp {
    final AtomicBoolean cancelled = new AtomicBoolean();
    private final Set<HttpURLConnection> connections = ConcurrentHashMap.newKeySet();
    void cancel() { cancelled.set(true); for (HttpURLConnection connection : connections) connection.disconnect(); }
    void check() throws IOException { if (cancelled.get() || Thread.currentThread().isInterrupted()) throw new IOException("Download cancelled."); }
    static String resolve(String base, String uri) throws IOException {
        URL url = new URL(new URL(base), uri);
        if (!(url.getProtocol().equals("http") || url.getProtocol().equals("https")) || uri.contains("{$")) throw new IOException("Unsupported download resource.");
        return url.toString();
    }
    private HttpURLConnection open(String address) throws IOException {
        String current = resolve(address, address);
        for (int redirects = 0; redirects < 8; redirects++) {
            check();
            HttpURLConnection connection = (HttpURLConnection) new URL(current).openConnection();
            connection.setConnectTimeout(20000); connection.setReadTimeout(30000); connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "Niho/1.0");
            connections.add(connection);
            try {
                int code = connection.getResponseCode();
                if (code >= 300 && code < 400 && connection.getHeaderField("Location") != null) {
                    current = resolve(current, connection.getHeaderField("Location"));
                    connections.remove(connection); connection.disconnect(); continue;
                }
                if (code != 200) throw new IOException("Video server returned " + code + ". Try again later.");
                return connection;
            } catch (IOException error) { connections.remove(connection); connection.disconnect(); throw error; }
        }
        throw new IOException("Too many stream redirects.");
    }
    String[] playlist(String url) throws IOException {
        IOException failure = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            check(); HttpURLConnection connection = null;
            try {
                connection = open(url);
                ByteArrayOutputStream data = new ByteArrayOutputStream();
                copy(connection, data, 4 * 1024 * 1024);
                return new String[] { data.toString(StandardCharsets.UTF_8.name()), connection.getURL().toString() };
            } catch (IOException error) { failure = error; }
            finally { if (connection != null) { connections.remove(connection); connection.disconnect(); } }
        }
        throw failure;
    }
    void download(String url, File target) throws IOException {
        if (target.isFile() && target.length() > 0) return; // Completed segments survive service/process restarts.
        if (!target.getParentFile().isDirectory() && !target.getParentFile().mkdirs()) throw new IOException("Not enough storage for download.");
        File partial = new File(target.getPath() + ".part");
        IOException failure = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            check(); HttpURLConnection connection = null;
            try {
                connection = open(url);
                try (FileOutputStream output = new FileOutputStream(partial)) { copy(connection, output, 128L * 1024 * 1024); output.getFD().sync(); }
                check();
                if (!partial.renameTo(target)) throw new IOException("Could not save downloaded segment.");
                return;
            } catch (IOException error) { failure = error; partial.delete(); }
            finally { if (connection != null) { connections.remove(connection); connection.disconnect(); } }
        }
        throw failure;
    }
    private void copy(HttpURLConnection connection, OutputStream output, long limit) throws IOException {
        long expected = connection.getContentLengthLong();
        if (expected > limit) throw new IOException("A video resource is too large to download.");
        long total = 0;
        try (InputStream input = connection.getInputStream()) {
            byte[] buffer = new byte[64 * 1024]; int read;
            while ((read = input.read(buffer)) != -1) {
                check(); total += read;
                if (total > limit) throw new IOException("A video resource is too large to download.");
                output.write(buffer, 0, read);
            }
        }
        if (total == 0 || (expected >= 0 && total != expected)) throw new IOException("The server sent an incomplete file.");
    }
}
