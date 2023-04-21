# rapid-dicom-viewer

@ischemaview/rapid-dicom-viewer built and bundled into static assets

> NOTE: The current `platform/viewer` project cannot be built without linking other libraries from this [repo](https://github.com/ischemaview/RapidExtensionsAndModes). Review the README.md of that repo for details.  Due to this current process, the RMA integration relies on the developers of the `rapid-dicom-viewer` to build locally and provide the bundled static assets. See [Publishing Latest Dicom Viewer for RMA Integration](#publishing_latest_dicom_viewer_for_rma_integration)

## Build
### Prerequisite
yarn install run on ````root```` project or ````platform/viewer````
> NOTE: yarn@^1.18.0 required with workspaces-experimental=true. required.  See [README of ohif-monorepo](https://github.com/ischemaview/rapid-dicom-viewer#to-develop)
### Build
````bash
# From within the platform/viewer-static directory
yarn build

OR

npm run build
````

## Publish
````bash
# From within the platform/viewer-static directory
npm publish

OR

yarn publish
````
> NOTE: Nexus repository authentication required

## Installation
````
npm install @ischemaview/rapid-dicom-viewer
````

### Copy via postinstall script (optional)
````bash
snippet of consuming projects package.json:

{
  ...
  "scripts": {
    "postinstall": "./node_modules/@ischemaview/rapid-dicom-viewer/scripts/copy-folder-recursive-cli ./node_modules/@ischemaview/rapid-dicom-viewer/dist <destination_directory_path>"
  },
  ....
}

# Where <destination_directory_path> is the desired location for static assets
````


## <a name="publishing_latest_dicom_viewer_for_rma_integration">Publishing Latest Dicom Viewer for RMA Integration
</a>

### Publish Latest Dicom Viewer Package
1. Download, save, and extract dicom viewer static assets provided from `rapid-dicom-viewer` development team to a location on your computer.

2. Delete the previous static assets located relative to the root of this repo here: `platform/viewer-static/dist`
````bash
(bash, zsh, unix)
rm -rf platform/viewer-static/dist

OR

(Windows / Cross Platform - Node.js >= 16)
npx rimraf platform/viewer-static/dist
````
3. Copy the static assets saved in step #1 above to the same location `platform/viewer-static/dist`

````bash
(bash, zsh, unix)
cp -R <directory_path_to_static_assets> platform/viewer-static/dist

(Windows / Cross Platform - Node.js >= 16)
# relative to repo root directory
platform/viewer-static/scripts/copy-folder-recursive-cli <directory_path_to_static_assets> platform/viewer-static/dist
````

4. Commit changes to Source Control (`git`)
- Manually force add dist folder files to staged.  This is because `dist` is an ignored directory per the standard `.gitignore` file.
````bash
git add -f platform/viewer-static/dist/*
git commit -m "added latest static assets"
git push origin --set-upstream <upstream_branch_name>
````

5. Bump version, tag, and commit/push
````bash
# relative to repo root directory
cd platform/viewer-static
npm version <major|minor|patch|prerelease> --workspaces false
git commit -m "viewer-static@<version>"
git tag viewer-static@<version>
git push
git push origin viewer-static@<version>
````

6. Publish `@ischemaview/rapid-dicom-viewer` to Nexus repository
````bash
npm publish

OR

yarn publish
````


### RMA Integration
1. Pull down latest tag / prerelease / epic branch of the `@ischemaview/rapid-mobile-app` that supports the dicom viewer.  At the time of writing this `rapid-mobile-app@v3.10.0-15` is the last known tag to support dicom viewer. New prerelease and epic branches will be cut in the future to continue on with dicom viewer integration work beyond RMA v3.10.0.

````bash
git checkout tags/v3.10.0-15 -b feature/RDV-XXX_update_dicom_viewer
````

2. Update `@ischemaview/rapid-dicom-viewer` via npm
````bash
npm install --save --save-exact [--force] @ischemaview/rapid-dicom-viewer@<version>
````

3. Run RMA on web, iOS, and android and verify dicom viewer is able to load data and launch

4. Commit the `rapid-dicom-viewer` update change to source control

5. Create Pull Request (PR) for `rapid-dicom-viewer` update change to the appropriate epic / prerelease branch. Once approved and merged move onto step #6.

6. Create a tag branch from the latest epic / prerelease branch.
e.g. `tag/vX.Y.Z-P`

7. Perform a version bump with auto tagging.  This should bump all the versions for all `/projects/**/package[-lock].json` files as well as the root `package[-lock].json` files. It will also create the corresonding git tag `vX.Y.Z-P` and commit it to your local branch.
````bash
npm version X.Y.Z-P
````

8. Push the tag branch and tag to the remote repo and create a PR for the tag change. Ensure the PR gets approved and merged.
````bash
git push --set-upstream origin tag/vX.Y.Z-P
# push the tag
git push origin vX.Y.Z-P
````

9. Deploy the version by executing the appropriate `<Environment> >> frontend_deploy_all` for the desired environment.
