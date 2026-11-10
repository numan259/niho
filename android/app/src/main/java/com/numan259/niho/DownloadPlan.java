package com.numan259.niho;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.util.*;
import java.util.regex.*;

/** Resolves a finite HLS rendition and rewrites every reference to local storage. */
final class DownloadPlan {
    private final DownloadHttp http;
    private final String id, audio, subtitles;
    private final LinkedHashMap<String, String> assets = new LinkedHashMap<>();
    private final JSONObject playlists = new JSONObject();
    private final Set<String> visiting = new HashSet<>();
    private final JSONObject info = new JSONObject();
    private int sequence;
    DownloadPlan(DownloadHttp http, String id, String audio, String subtitles) {
        this.http = http; this.id = id; this.audio = audio; this.subtitles = subtitles;
    }
    JSONObject build(String url) throws Exception {
        playlist(url, "master.m3u8", 0);
        if (assets.isEmpty()) throw new IOException("The video has no downloadable segments.");
        JSONArray resources = new JSONArray();
        for (Map.Entry<String, String> entry : assets.entrySet()) resources.put(new JSONObject().put("url", entry.getKey()).put("file", entry.getValue()));
        return new JSONObject().put("assets", resources).put("playlists", playlists).put("info", info);
    }
    private String local(String file) { return "https://offline.niho.invalid/" + id + "/" + file; }
    private String asset(String url) {
        if (!assets.containsKey(url)) assets.put(url, "asset-" + assets.size());
        return local(assets.get(url));
    }
    private String playlist(String address, String file, int depth) throws Exception {
        http.check();
        if (depth > 4 || !visiting.add(address)) throw new IOException("Invalid video playlist structure.");
        String[] fetched = http.playlist(address);
        String text = select(fetched[0], depth == 0), base = fetched[1];
        boolean master = text.contains("#EXT-X-STREAM-INF:");
        if (!master) {
            if (!text.contains("#EXT-X-ENDLIST")) throw new IOException("This video is still being prepared or is live. Try again later.");
            if (Pattern.compile("#EXT-X-(DEFINE|PART:|PRELOAD-HINT|RENDITION-REPORT|GAP)").matcher(text).find()) throw new IOException("This stream format does not support downloads yet.");
        }
        StringBuilder result = new StringBuilder();
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.trim();
            if (line.isEmpty()) continue;
            if (line.startsWith("#EXT-X-KEY:")) {
                Map<String, String> attrs = attributes(line);
                if (!"NONE".equals(attrs.get("METHOD")) && (!"AES-128".equals(attrs.get("METHOD")) || !"identity".equals(attrs.getOrDefault("KEYFORMAT", "identity")))) throw new IOException("This protected video cannot be downloaded.");
            }
            if (!line.startsWith("#")) {
                String url = DownloadHttp.resolve(base, line);
                line = master ? playlist(url, "playlist-" + sequence++ + ".m3u8", depth + 1) : asset(url);
            } else if (line.contains("URI=\"")) {
                String uri = attributes(line).get("URI");
                if (uri == null) throw new IOException("Unsupported playlist resource.");
                String url = DownloadHttp.resolve(base, uri);
                String replacement = line.startsWith("#EXT-X-MEDIA:") ? playlist(url, "playlist-" + sequence++ + ".m3u8", depth + 1) : asset(url);
                line = line.replaceFirst("URI=\"[^\"]*\"", Matcher.quoteReplacement("URI=\"" + replacement + "\""));
            }
            result.append(line).append('\n');
        }
        playlists.put(file, result.toString()); visiting.remove(address);
        return local(file);
    }
    static Map<String, String> attributes(String line) {
        Map<String, String> attrs = new HashMap<>();
        Matcher matcher = Pattern.compile("([A-Z0-9-]+)=(\"[^\"]*\"|[^,]*)").matcher(line.substring(line.indexOf(':') + 1));
        while (matcher.find()) attrs.put(matcher.group(1), matcher.group(2).replaceAll("^\"|\"$", ""));
        return attrs;
    }
    static String language(String value) {
        String code = value.toLowerCase(Locale.ROOT).split("[-_]")[0];
        switch (code) { case "eng": return "en"; case "tur": return "tr"; case "spa": return "es"; case "fra": case "fre": return "fr"; case "deu": case "ger": return "de"; default: return code; }
    }
    private boolean matches(String lang, String preference) { return lang != null && !preference.isEmpty() && !preference.equals("off") && language(lang).equals(language(preference)); }
    private String select(String text, boolean root) throws Exception {
        List<String> lines = new ArrayList<>();
        for (String line : text.trim().split("\\r?\\n")) lines.add(line.trim());
        if (lines.isEmpty() || !lines.get(0).equals("#EXTM3U")) throw new IOException("The server did not return a video playlist.");
        if (Pattern.compile("#EXT-X-(SESSION-KEY|DEFINE|CONTENT-STEERING)").matcher(text).find()) throw new IOException("This stream format does not support downloads yet.");
        List<Integer> variants = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) if (lines.get(i).startsWith("#EXT-X-STREAM-INF:")) variants.add(i);
        if (variants.isEmpty()) {
            if (root) info.put("quality", "Original").put("audio", "Included audio").put("subtitles", "Embedded only");
            return text;
        }
        variants.sort(Comparator.comparingInt((Integer i) -> height(lines.get(i))).thenComparingLong(i -> bandwidth(lines.get(i))));
        int selected = variants.get(0);
        for (int i : variants) if (height(lines.get(i)) <= 720) selected = i;
        if (selected + 1 >= lines.size() || lines.get(selected + 1).startsWith("#")) throw new IOException("Incomplete video playlist.");
        Map<String, String> variant = attributes(lines.get(selected));
        String chosenAudio = null, defaultAudio = null, firstAudio = null, chosenSubs = null;
        List<String> captions = new ArrayList<>();
        for (String line : lines) {
            if (!line.startsWith("#EXT-X-MEDIA:")) continue;
            Map<String, String> a = attributes(line);
            if ("AUDIO".equals(a.get("TYPE")) && Objects.equals(a.get("GROUP-ID"), variant.get("AUDIO"))) {
                if (firstAudio == null) firstAudio = line;
                if ("YES".equals(a.get("DEFAULT"))) defaultAudio = line;
                if (chosenAudio == null && matches(a.get("LANGUAGE"), audio)) chosenAudio = line;
            }
            if ("SUBTITLES".equals(a.get("TYPE")) && Objects.equals(a.get("GROUP-ID"), variant.get("SUBTITLES")) && chosenSubs == null && matches(a.get("LANGUAGE"), subtitles)) chosenSubs = line;
            if ("CLOSED-CAPTIONS".equals(a.get("TYPE")) && Objects.equals(a.get("GROUP-ID"), variant.get("CLOSED-CAPTIONS"))) captions.add(line);
        }
        if (chosenAudio == null) chosenAudio = defaultAudio != null ? defaultAudio : firstAudio;
        StringBuilder result = new StringBuilder("#EXTM3U\n#EXT-X-VERSION:7\n");
        if (chosenAudio != null) result.append(chosenAudio).append('\n');
        if (chosenSubs != null) result.append(chosenSubs).append('\n');
        for (String caption : captions) result.append(caption).append('\n');
        String line = lines.get(selected);
        if (chosenSubs == null) line = line.replaceAll(",SUBTITLES=\"[^\"]*\"", "");
        result.append(line).append('\n').append(lines.get(selected + 1)).append('\n');
        if (root) info.put("quality", height(line) > 0 ? height(line) + "p" : "Original")
            .put("audio", chosenAudio == null ? "Included audio" : attributes(chosenAudio).get("NAME"))
            .put("subtitles", chosenSubs == null ? "Embedded only" : attributes(chosenSubs).get("NAME"));
        return result.toString();
    }
    private static int height(String line) { try { return Integer.parseInt(attributes(line).getOrDefault("RESOLUTION", "0x0").split("x")[1]); } catch (RuntimeException e) { return 0; } }
    private static long bandwidth(String line) { try { return Long.parseLong(attributes(line).getOrDefault("BANDWIDTH", "0")); } catch (RuntimeException e) { return 0; } }
}
