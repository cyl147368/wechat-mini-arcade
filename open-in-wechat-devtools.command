#!/bin/zsh
set -u

TOOLS_CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
SCRIPT_DIR="${0:A:h}"
RELEASE_DIR="${SCRIPT_DIR:h}/wechat-mini-arcade-release"

echo "WeChat Mini Arcade"
echo "Project: ${RELEASE_DIR}"
echo

if [[ ! -x "${TOOLS_CLI}" ]]; then
  echo "Cannot find WeChat DevTools CLI:"
  echo "${TOOLS_CLI}"
  echo
  echo "Install WeChat DevTools or adjust TOOLS_CLI in this script."
  read -k 1 "reply?Press any key to close..."
  echo
  exit 1
fi

if [[ ! -f "${RELEASE_DIR}/game.js" || ! -f "${RELEASE_DIR}/game.json" || ! -f "${RELEASE_DIR}/project.config.json" ]]; then
  echo "Release project is missing or incomplete."
  echo "Building the minimal WeChat Mini Game release package..."
  echo
  if ! command -v node >/dev/null 2>&1; then
    echo "Cannot find Node.js, so the release package cannot be rebuilt."
    echo "Install Node.js or open an existing release folder manually:"
    echo "${RELEASE_DIR}"
    read -k 1 "reply?Press any key to close..."
    echo
    exit 1
  fi
  if ! (cd "${SCRIPT_DIR}" && node scripts/build-release.js); then
    echo
    echo "Release build failed."
    read -k 1 "reply?Press any key to close..."
    echo
    exit 1
  fi
  if [[ ! -f "${RELEASE_DIR}/game.js" || ! -f "${RELEASE_DIR}/game.json" || ! -f "${RELEASE_DIR}/project.config.json" ]]; then
    echo
    echo "Release project is still incomplete after build:"
    echo "${RELEASE_DIR}"
    read -k 1 "reply?Press any key to close..."
    echo
    exit 1
  fi
fi

echo "Opening WeChat DevTools..."
echo "If DevTools asks to enable the service port, choose y."
echo

"${TOOLS_CLI}" open --project "${RELEASE_DIR}" --port 9420 --lang zh
STATUS=$?

echo
if [[ ${STATUS} -eq 0 ]]; then
  echo "Done. The project should now be open in WeChat DevTools."
else
  echo "WeChat DevTools returned exit code ${STATUS}."
  echo "Check DevTools security settings and enable the service port if needed."
fi

read -k 1 "reply?Press any key to close..."
echo
exit ${STATUS}
