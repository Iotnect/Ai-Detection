# NeoVision demo replay videos

Only `neovision.iotnect.com` can replay demo footage for `MBS-KDN-C1`.
Camera outages or live playback failures activate replay; the live player keeps
retrying and returns to live footage when playback and camera status recover.

| Selected mode | File in the repository | Playback label |
| --- | --- | --- |
| Original | `public/neovision-demo-1015.mp4` | DEMO REPLAY |
| AI Detection | `public/neovision-demo-ai.mp4` | AI DEMO REPLAY |

Add the AI recording as `public/neovision-demo-ai.mp4`. Use a browser-compatible
H.264 MP4; playback is muted, automatic, looping, and has no native controls.
The bundled AI recording is H.264, 1080p, approximately 30 seconds long.
If a replay file is missing or cannot be decoded, the player displays a demo
unavailable message rather than playing original footage in AI mode.

No code change is needed when adding a video at that exact path. Commit the
video and deploy the frontend. To use a different filename, update
`demoReplaySources.ai` in `src/lib/camera-replay.ts`.

The inline player and enlarged view both use the selected mode's replay.
AI failures no longer change the selected mode to Original. MBS has no demo
fallback and displays the live player's unavailable state on failure.
Recordings do not generate inference events or update stored water-level data.
