# Publish script to be run on existing branch
# Usage: ./publish <relative_path_to_dist>

if [ -z "$1" ]
  then
    echo "Path to dist not supplied"
    exit 1
fi
VERSION_PARAMS="${2:-patch}"
TARGET_ROOT=./platform/viewer-static
TARGET_PATH=${TARGET_ROOT}/dist
rm -rf ${TARGET_PATH}
cp -R $1 ${TARGET_PATH}
git add -f ${TARGET_PATH}
git commit -m "latest static assets"
cd ${TARGET_ROOT}
SCRIPT="npm version  $VERSION_PARAMS --workspaces=false"
echo $SCRIPT
VERSION=$($SCRIPT)
git add .
TAG="viewer-static@$(cut -c 2-99 <<< ${VERSION})"
git commit -m "${TAG}"
git tag ${TAG}
git push
git push origin ${TAG}
npm publish
cd ../..
