# UM demo video assets

Browser-compatible H.264 MP4 recordings are stored here:

- `original.mp4`: original demo footage
- `ai.mp4`: AI-annotated demo footage

`umDemo.videos.original` uses `/um/original.mp4` and
`umDemo.videos.ai` uses `/um/ai.mp4` in `src/lib/um-demo.ts`.

The recordings use H.264/yuv420p with faststart for browser playback. UM never falls
back to MBS footage. Its live inference data uses the isolated UM API documented
in `docs/um-inference-integration.md`.
Commit the video assets and configuration and redeploy the frontend.
