# Offline playback fixture

This 12-second test pattern and sine wave were generated locally with FFmpeg.
They contain no third-party movie or television content. Binary MPEG-TS segments
use `.bin` filenames on disk to avoid TypeScript tooling treating them as source;
the test server serves them with their playlist `.ts` names.

Generation command (rename segment extensions to `.bin` afterwards):

```sh
ffmpeg -f lavfi -i testsrc2=size=160x90:rate=12 -f lavfi -i sine=frequency=440:sample_rate=44100 -t 12 -c:v libx264 -preset ultrafast -crf 35 -g 24 -pix_fmt yuv420p -c:a aac -b:a 32k -hls_time 2 -hls_playlist_type vod -hls_segment_filename segment-%d.ts video.m3u8
```
