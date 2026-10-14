#!/usr/bin/env bash
# Публикация сборки игры в ветку gh-pages (для GitHub Pages).
# Использование:  tools/publish-pages.sh <git-url-репозитория> [ветка=gh-pages]
# Запускается из GitHub Actions (.github/workflows/berserk-pages.yml) и вручную: npm run deploy:pages -- <url>
set -euo pipefail

REMOTE="${1:?укажите URL репозитория, например https://github.com/<user>/<repo>.git}"
BRANCH="${2:-gh-pages}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$HERE"
npm run build
test -f dist/index.html && test -f dist/sw.js

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll"                      # Pages не должен обрабатывать файлы через Jekyll

cd "$TMP"
git init -q
git checkout -q -b "$BRANCH"
git config user.name  "${GIT_AUTHOR_NAME:-berserk-publisher}"
git config user.email "${GIT_AUTHOR_EMAIL:-berserk-publisher@users.noreply.github.com}"
git add -A
git commit -q -m "Берсерк: публикация сборки ${GITHUB_SHA:-$(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo local)}"
git push -q --force "$REMOTE" "$BRANCH"
echo "Готово: ветка $BRANCH обновлена."
