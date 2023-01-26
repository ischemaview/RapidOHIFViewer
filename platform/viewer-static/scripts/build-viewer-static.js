const { spawn } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

function onExit(childProcess){
  return new Promise((resolve, reject) => {
    childProcess.once('exit', (code, signal) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error('Exit with error code: '+code));
      }
    });
    childProcess.once('error', (err) => {
      reject(err);
    });
  });
}

function copyFolderSync(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
      if (fs.lstatSync(path.join(from, element)).isFile()) {
          fs.copyFileSync(path.join(from, element), path.join(to, element));
      } else {
          copyFolderSync(path.join(from, element), path.join(to, element));
      }
  });
}

function getUpdatedPackageJson(packageJson, packageScope, packageVersion) {
  const packageJsonClone = JSON.parse(JSON.stringify(packageJson));
  const packageNameTransformed = packageJsonClone.name.replace(/^@/, '').replace(/\//g,'-');
  // packageJsonClone.name = `${packageScope}/${packageNameTransformed}`;
  packageJsonClone.version += '-' + packageVersion;
  packageJsonClone.main = 'dist/umd/index.js';
  packageJsonClone.module = 'dist/esm/index.js';
  packageJsonClone.publishConfig = {
    "registry": "https://nexus.infrastructure.rapid-sys.com/repository/npm-internal"
  };

  return packageJsonClone;
}

(async () => {
  const dirPathViewer = path.join('..', 'viewer');
  const dirPathViewerStatic = path.join('.');
  const build = spawn('yarn', ['build:static'], {
    cwd: dirPathViewer,
    stdio: [process.stdin, process.stdout, process.stderr]
  });

  await onExit(build);

  console.log('copying dist folder');
  copyFolderSync(
    path.join(dirPathViewer, 'dist'),
    path.join(dirPathViewerStatic, 'dist'));

  console.log('copying LICENSE');
  await fsPromises.copyFile(
    path.join(dirPathViewer, './LICENSE'),
    path.join(dirPathViewerStatic, 'LICENSE'));
})();
