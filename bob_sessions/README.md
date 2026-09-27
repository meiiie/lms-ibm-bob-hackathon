# IBM Bob task evidence

This directory belongs at the root of the repository submitted to the IBM Bob
2.0 Hackathon. It records evidence from the Neko Core team; the team name does
not identify a software dependency of this LMS.

Status checked **27 September 2026, Vietnam (UTC+7)** against current tracked files:

- `meiiie_dark-offline-sidebar-01_summary.png` now shows the expanded Bob task
  summary: task `b3f61aaa13f3e3d94298655249da2d8c`, **38.66 Bobcoins**, 9/9 tasks.
  The team replaced the earlier 28.50 checkpoint under the same filename.
- `toshiro_task01_en-vi_language_switch_summary.png.png` shows task
  `6e1c4fab0fd885ba517f99a2dfe89646`, **39.98 Bobcoins**, 10/10 tasks and quota
  exceeded. The manifest points to this actual filename; capture time does not
  independently establish completion time.
- `faiz_devops_docker_review.png` shows a browser/File Explorer missing-file
  error, not Bob's expanded task summary. Its author still needs to supply the
  correct image and task details. Do not infer Bob consumption from text in a
  different assistant's browser page.
- A team-published history export is tracked as
  `bob-task-b3f61aaa13f3e3d94298655249da2d8c-2026-09-26.md`. The separately
  recovered `*.local.md` remains ignored. Transcripts supplement screenshots.

The current images are preserved byte-for-byte. Final team/task coverage still
requires the participants' confirmation. Codex continuation, deployment and
verification are not additional Bob usage and must not be added to these totals.

## Capture each relevant task

Every participant must capture all relevant Bob IDE task session summaries:

1. In Bob IDE, open **Tasks**.
2. Select the task for the correct workspace; use **All** if needed.
3. Click the task header to open its session consumption summary.
4. Capture a readable screenshot of the actual summary; PNG is preferred.
5. Save it directly in this directory and add one row to `manifest.csv`.

Suggested filename pattern: `<member-handle>_<task-id>_<short-purpose>_summary.png`.
This is a naming example, not an existing screenshot.

## Manifest conventions

- `member_handle`: participant handle, not a personal email address.
- `task_id`: the real Bob task identifier or a consistently recorded local label.
- `task_description`: the actual work performed in that task.
- `completed_at_vietnam`: actual completion time in ISO 8601 with `+07:00`.
  Leave blank when completion is unverified; put checkpoint capture times in notes.
  Vietnam uses UTC+7. Do not replace timestamps with the time of file upload.
- `summary_png`: filename relative to this directory; the file must exist.
- `history_markdown_optional`: optional reviewed history export, if available.
- `bobcoins_used_if_shown`: record only a value visible in the actual summary;
  otherwise leave it blank.
- `related_commit`: the real commit hash, when available; otherwise leave blank.
- `notes`: context needed to understand the evidence or its limitations.

Do not invent screenshots, usage numbers, task IDs, timestamps, or commit links.
Do not attribute Codex research, license changes, or this scaffold to Bob.
Exclude credentials and private/customer data from captures and exports. Optional
history exports supplement the required screenshots; they do not replace them.

Before submission, check every participant and relevant task, verify every listed
image exists and is readable, and commit the evidence to the public submission
repository. Only add screenshots captured from the actual Bob sessions.

[Official event guide](https://lablab-ibm-bob-2-hackathon-guide.s3.us.cloud-object-storage.appdomain.cloud/index.html#upload-bob-task-session-summary)

[Pre-existing material and preparation](../docs/PREEXISTING.md)
