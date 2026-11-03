# UM demo video assets

Add browser-compatible H.264 MP4 recordings here:

- `original.mp4`: original demo footage
- `ai.mp4`: AI-annotated demo footage

Then set `umDemo.videos.original` to `/um/original.mp4` and
`umDemo.videos.ai` to `/um/ai.mp4` in `src/lib/um-demo.ts`.

Until configured, the player shows a video-not-added message. UM never falls
back to MBS footage, connects to a backend, or generates inference events.
Commit the video assets and configuration and redeploy the frontend.
