# Submission readiness audit

Recorded 26 September 2026, 08:51 Vietnam (UTC+7). **The repository has real Bob
evidence, but the submission package is not complete.** This is an artifact audit,
not a new application test run or an eligibility ruling.

### Hosted demo update — 26 September, 20:35 UTC+7

The separate [student demo](https://neko-core-lms-demo.pages.dev) is now deployed
on Cloudflare Pages, Railway trial and Neon Free. Genuine public login, course
download and server-side restrictions passed. Offline text reload/completion,
persistence across a second reload and real backend sync passed in Chrome. See
[actual acceptance evidence](DEMO-VERIFICATION.md) and
[deployment and limitations](FREE-DEMO-DEPLOYMENT.md) for actual revision/results
and the private learner handoff location. Hosting is Codex continuation work,
not additional Bob evidence. Video, slides, cover and final Bob summaries remain
outstanding; publishing the site does not submit the event form.

The owner independently merged Faiz's PR #1 at 18:58 UTC+7 as `ada302bb`.
Its one PNG is preserved by this deployment work. The earlier image-quality and
missing-manifest observations below remain observations about that same file;
a merge alone does not verify it as the required task summary.

### Later team-evidence check on 26 September

Main still contained the original `meiiie` checkpoint when rechecked for the
sidebar merge. [Faiz's separate PR #1](https://github.com/meiiie/lms-ibm-bob-hackathon/pull/1)
at `a55f49c372e7bd584fb3e2104c6d1bf1c369f673` adds only
`bob_sessions/faiz_devops_docker_review.png`, without a manifest row. The inspected
image shows a browser/File Explorer and a missing-file message rather than the
Bob task consumption summary or Docker results; it appears to be the wrong
capture. Ask its author to supply the actual summary before treating it as
evidence. This audit did not modify, comment on or merge that PR. Its changed file
does not overlap PR #3, which preserves the original `meiiie` PNG.

## Checkpoint and scope

GitHub `meiiie/lms-ibm-bob-hackathon`, branch `main`, was inspected at
`c94f9f9f75a9c4741d4d2dc3f1ed15acd4adf053` (committed 26 September at
08:19:25 UTC+7). Local HEAD matched that revision. The ongoing ChatGPT changes
and updates to PRD, WORKSTATE, PREEXISTING and the evidence README were local
changes, not part of remote main at this checkpoint. Recheck the final revision
after integration; this document does not claim later pushes are already present.

## Present and outstanding

| Item | Verified state at the checkpoint |
| --- | --- |
| Bob evidence directory | Remote main contains `bob_sessions/README.md`, `manifest.csv` and `meiiie_dark-offline-sidebar-01_summary.png`. |
| Existing screenshot | Real IDE chat/settings screenshot at 08:18 UTC+7, with 28.50 Bobcoins visible. It is an intermediate checkpoint, not the expanded task consumption-summary panel requested by the event guide. |
| Final Bob summary | Still needs an actual screenshot. The task later stopped at 08:24:34 UTC+7; recovered task metadata records 38.658728 Bobcoins. Do not alter the earlier image or relabel its 28.50 value as the final total. |
| Participant coverage | Only one task row for `meiiie` is recorded. Other participants' actual task inventories were not available, so full team coverage is unverified. |
| Recovered history | A 303-message transcript exists locally as `bob_sessions/meiiie_b3f61aaa13f3e3d94298655249da2d8c_history.local.md`. It is Git-ignored pending privacy review and is not a native Bob export or a replacement for screenshots. |
| Submission text | `submission/TEMPLATE.md` still has placeholders for title, descriptions, final revision and deliverable links. Its claim that the manifest is empty is stale. |
| Video, slides and cover | No tracked MP4 or PDF exists at this revision. No completed hackathon cover is identified; inherited application artwork is not evidence of a finalized submission cover. |
| Interactive demo | No deployment of this fork was verified. The upstream production URL in README is not a verified demo of the hackathon changes. |
| Sources and measurements | `data/SOURCES.csv` and `metrics/experiments.csv` contain headers only. `docs/DARK-QA-BASELINE.md` describes a real browser check using synthetic fixtures; it does not establish a measured productivity improvement. |
| Provenance | Remote `docs/PREEXISTING.md` records reused application/setup material, but its new-contribution section and README still contain preparation-era statements. Local corrections must reach the final submission branch. |

## Official requirements and team conventions

The [September IBM guide](https://lablab-ibm-bob-2-hackathon-guide.s3.us.cloud-object-storage.appdomain.cloud/index.html#upload-bob-task-session-summary)
requires every participant's relevant Bob task consumption-summary screenshots
in `bob_sessions/`. Open **Tasks**, select the relevant task, click its header,
and capture the actual summary; PNG is preferred. Cover all relevant workspaces.
The same guide requires a working developer-workflow improvement with Bob IDE
as a core component. It permits continuing work after Bobcoins run out; credit
subsequent Codex work accurately. Use only permitted data and assets.

The [lablab submission guidelines](https://lablab.ai/delivering-your-hackathon-solution)
list a title, short description up to 255 characters, long description of at
least 100 words, technology/category tags, PNG/JPG cover, MP4 video up to five
minutes, PDF slides, public GitHub repository and an interactive application URL.
A 16:9 cover is recommended. The page does not explicitly require a demo without
login. Its Bob-report instruction points to the event guide above.

`manifest.csv`, `data/SOURCES.csv` and `metrics/experiments.csv` are useful team
conventions, not organizer-mandated filenames. Optional reviewed transcripts
supplement the required images. Empty templates prove neither usage nor impact.

## Finish before submission

1. Capture the final expanded summary and inventory all relevant participant
   tasks. Keep the existing image as an intermediate checkpoint; record the new
   capture with its actual task, time and visible consumption.
2. Publish the verified final code and corrected documentation; record its exact
   branch/commit and distinguish Bob contributions from Codex work and reused LMS.
3. Finish the actual title/descriptions, cover, video, PDF slides and interactive
   demo. Test the links and access instructions from a clean browser session.
4. Record the sample-data sources/permissions and only measurements actually
   performed. Review public files and captures for credentials or private data.
5. Assign the submitter, complete the event form and retain its success
   confirmation. Repository files alone do not prove the form was submitted.

The team's recorded deadline is 27 September 2026, 22:00 Vietnam (UTC+7), with
an internal target of 20:00. Confirm the live countdown in the
[official event page](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon) before
submitting; this audit did not inspect the authenticated submission form.
