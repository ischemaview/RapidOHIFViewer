# Publish script to be run on existing branch
# Usage: ./publish <relative_path_to_dist>

if [ -z "$1" ]
  then
    echo "Path to dist not supplied"
    exit 1
fi
TARGET_ROOT=./platform/viewer-static
TARGET_PATH=${TARGET_ROOT}/dist
rm -rf ${TARGET_PATH}
cp -R $1 ${TARGET_PATH}
git add -f ${TARGET_PATH}
git commit -m "latest static assets"
cd ${TARGET_ROOT}
VERSION=$(npm version patch --workspaces=false)
git add .
TAG="viewer-static@$(cut -c 2-99 <<< ${VERSION})"
git commit -m "${TAG}"
git tag ${TAG}
git push
git push origin ${TAG}
npm publish
cd ../..
