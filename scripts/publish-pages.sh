#!/usr/bin/env bash
# Publish tested main assets through the repository's existing legacy Pages source.
# No force-push, credentials file, admin-setting changes, or history rewrite.
set -euo pipefail
: "${GITHUB_REPOSITORY:?Run this script in the repository GitHub Actions workflow.}"
: "${GITHUB_SHA:?Missing tested source commit.}"
: "${RUNNER_TEMP:?Missing Actions temporary directory.}"
: "${GH_TOKEN:?Missing workflow token.}"
settings=$(gh api "repos/$GITHUB_REPOSITORY/pages")
if [[ $(jq -r .build_type <<< "$settings") != legacy ||
      $(jq -r .source.branch <<< "$settings") != gh-pages ||
      $(jq -r .source.path <<< "$settings") != / ]]; then
  echo 'Expected the existing gh-pages root publishing source; no settings were changed.' >&2
  exit 1
fi
page_url=$(jq -r .html_url <<< "$settings")
publication="$RUNNER_TEMP/morris-publication"
git fetch --no-tags origin gh-pages
git worktree add --detach "$publication" FETCH_HEAD
trap 'git worktree remove --force "$publication" >/dev/null 2>&1 || true' EXIT
# Preserve the original documentation and every unrelated publishing-branch file.
cp _site/index.html _site/styles.css _site/.nojekyll _site/LICENSE _site/version.txt "$publication/"
mkdir -p "$publication/src"
rsync -a --delete _site/src/ "$publication/src/"
git -C "$publication" config user.name 'github-actions[bot]'
git -C "$publication" config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git -C "$publication" add -- index.html styles.css .nojekyll LICENSE version.txt src
if ! git -C "$publication" diff --cached --quiet; then
  git -C "$publication" commit -m "Publish tested main $GITHUB_SHA"
  git -C "$publication" push origin HEAD:refs/heads/gh-pages
fi
published=$(git -C "$publication" rev-parse HEAD)
# GITHUB_TOKEN pushes do not reliably trigger a legacy Pages build themselves.
gh api --method POST "repos/$GITHUB_REPOSITORY/pages/builds" >/dev/null
built=false
for attempt in {1..60}; do
  build=$(gh api "repos/$GITHUB_REPOSITORY/pages/builds/latest")
  if [[ $(jq -r .commit <<< "$build") == "$published" ]]; then
    status=$(jq -r .status <<< "$build")
    if [[ $status == built ]]; then built=true; break; fi
    if [[ $status == errored ]]; then jq .error <<< "$build" >&2; exit 1; fi
  fi
  sleep 5
done
if [[ $built != true ]]; then echo 'Pages did not finish building the published commit in time.' >&2; exit 1; fi
# Verify the live CDN serves the tested source, not an old documentation page.
for attempt in {1..18}; do
  live=$(curl -fsSL "${page_url%/}/version.txt?deploy=$GITHUB_SHA" || true)
  if [[ $live == "$GITHUB_SHA" ]]; then
    echo "Published main $GITHUB_SHA through gh-pages $published"
    echo "page_url=$page_url" >> "$GITHUB_OUTPUT"
    printf '### Live deployment\n\n%s\n\nSource: `%s` on `main`. Publishing branch: `gh-pages`.\n' "$page_url" "$GITHUB_SHA" >> "$GITHUB_STEP_SUMMARY"
    exit 0
  fi
  sleep 5
done
echo 'Build completed, but the live version could not yet be verified.' >&2
exit 1
