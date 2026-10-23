# Ahmed production safety

- The production project is `/home/pmsa/apps/ahmed`; API is `ahmed-api`, Expo app is `ahmed-mobile`, and Expo uses port 8082.
- Production previously contained newer, uncommitted developments than GitHub. A full reset on 2026-10-23 replaced them. They were recovered from the verified 2026-10-22 source snapshot and committed to this repository. Never assume GitHub is newer than the production worktree.
- Do not run `git reset --hard`, `git checkout .`, `git restore .`, `git clean`, or a deployment script that replaces the production worktree. Inspect production source changes and preserve them first. Use guarded, explicit file updates and retain private recovery copies outside the public directory.
- Automatic deployment triggers in `deploy.yml` and `ahmed-expo-hot-deploy.yml` are paused after the incident. Do not re-enable them until the full-worktree resets have been removed and deployed source has been compared with the repository. The old restart/deploy scripts still contain resets and must not be executed unchanged.
- Save recovered and newly edited source to GitHub before publishing. Verify the actual production source and existing work, including untracked application modules, rather than checking only a clean local clone.
- UI source recovery must preserve the current database, receipts, investments, and funding dates. Never restore an older database to recover a screen.
- The verified October 22 UI includes compact opportunity cards, red overdue backgrounds, active/partial/overdue filtering, opportunity sorting, funding date inside the details editor, receipt save feedback, investor selection, and allocation protection. Preserve these behaviors.
- Build and publish only from the verified complete source. Keep public web artifacts readable, verify the served bundle, and confirm the iOS and Android production update. Do not generate an APK unless requested.
