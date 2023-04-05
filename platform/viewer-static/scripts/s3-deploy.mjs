import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';
import {
  fromIni
} from '@aws-sdk/credential-providers';
import decompress from 'decompress';
import path from 'path';
import * as fsPromise from 'fs/promises';
import commandLineArgs from 'command-line-args';

const COMMAND_LINE_ARG_OPTIONS = [
  { name: 'region', alias: 'r', type: String },
  { name: 'bucket', alias: 'b', type: String }
  { name: 'paths', type: String, multiple: true, defaultOption: true },
  { name: 'delete', type: String, alias: 'd', defaultValue: 'true' },
  { name: 'verbose', type: Boolean, alias: 'v'},
  { name: 'quiet', type: Boolean, alias: 'q'}
];

const LogLevel = {
  None: 0x0,
  QuietBypass: 0x1,
  Normal: 0x2,
  Verbose: 0x4,
  Error: 0x8
};

const OPTIONS = commandLineArgs(COMMAND_LINE_ARG_OPTIONS);

const REGION_PROFILE = OPTIONS.region ?? 'isv-sandpit3';

const client = new S3Client({
  credentials: fromIni({ profile: REGION_PROFILE })
});

async function unzipFile(sourcePath, destinationPath) {
  return await decompress(sourcePath, destinationPath);
}

const BUCKET_NAME = OPTIONS.bucket ?? 'rapid-webapp-sandpit3';
const S3_DIRECTORY = 'rapid-dicom-viewer';
const ZIP_FILE_PATH = OPTIONS.paths[0];
const DELETE_PREVIOUS = OPTIONS.delete === 'true';
const VERBOSE = OPTIONS.verbose;
const QUIET = OPTIONS.quiet;

const LOG_LEVEL = VERBOSE ?
  LogLevel.QuietBypass | LogLevel.Normal | LogLevel.Verbose | LogLevel.Error :
  QUIET ?
    LogLevel.QuietBypass | LogLevel.Error :
    LogLevel.Normal | LogLevel.Error;

const EXCLUDE_PATH_FLAGS = {
  '__MACOSX': true,
  '.DS_Store': true
};

const CONTENT_TYPE_BY_EXT = {
  'css': 'text/css',
  'html': 'text/html',
  'ico': 'x-icon',
  'jpg': 'image/jpx',
  'js': 'application/javascript',
  'json': 'application/json',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'txt': 'text/plain',
  'wasm': 'application/wasm',
  'xml': 'application/xml'
};

function getContentType(filePath) {
  const extension = path.extname(filePath).replace('.', '').toLowerCase();

  let contentType = CONTENT_TYPE_BY_EXT[extension];

  return contentType;
}

async function getBucketObjects(bucketName, prefix) {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    // The default and maximum number of keys returned is 1000. This limits it to
    // one for demonstration purposes.
    MaxKeys: 100,
    Prefix: prefix
  });

  let results = [];

  try {
    let isTruncated = true;
    let contents = "";

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } = await client.send(command);
      const contentsList = Contents.map((c) => ` • ${c.Key}`).join("\n");
      contents += contentsList + "\n";
      results = results.concat(Contents);
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
    }
    //console.log(contents);

  } catch (err) {
    log('Error encountered listing bucket objects', LogLevel.Error, err);
  }

  return results;
}

async function deletePrevious() {
  const bucketObjects = await getBucketObjects(BUCKET_NAME, S3_DIRECTORY);
  const s3DirectoryWithSlash = `${S3_DIRECTORY}/`;
  const deleteCommand = new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: bucketObjects
        .filter(bo => bo.Key !== s3DirectoryWithSlash)
        .map(bo => ({ Key: bo.Key }))
    }
  });

  if (!deleteCommand.input.Delete.Objects.length) {
    log('No objects found to delete', LogLevel.Verbose);
    return;
  }
  const result = await client.send(deleteCommand);
}

async function deployZip() {
  const extractDirectory = path.dirname(ZIP_FILE_PATH);
  const files = await unzipFile(ZIP_FILE_PATH, extractDirectory);

  for (let file of files) {
    // console.log(`${file.type}: ${file.path}`)

    if (file.type === 'directory' ||
        Object.keys(EXCLUDE_PATH_FLAGS).some(path => file.path.match(path))) {
      log(`***Excluding file: ${file.path}`, LogLevel.Verbose);
      continue;
    }
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: path.join(S3_DIRECTORY, file.path.replace('dist/', '')),
      ContentType: getContentType(file.path),
      Body: await fsPromise.readFile(path.join(extractDirectory, file.path)),
      CacheControl: file.path.endsWith('index.html') ? 'no-cache' : undefined
      //Body: path.join(extractDirectory, file.path)
    });

    try {
      log(`Uploading file: ${command.input.Key} - start`, LogLevel.Verbose);
      const result = await client.send(command);
      log(`Uploading file: ${command.input.Key} - complete`, LogLevel.Verbose);
    } catch (e){
      log(`Error encoutered attempting to upload: ${command.input.Key}`, LogLevel.Error, e);
    }

  }
}

function log(message, level, data) {
  const computedLevel = level & LOG_LEVEL;
  if (computedLevel === level) {
    if (level === LogLevel.Error) {
      data ? console.error(message, data) : console.error(message);
    } else {
      data ? console.log(message, data) : console.log(message);
    }
  }
}

(async () => {

  if (DELETE_PREVIOUS) {
    try {
      log('Deleting previous deployment - start', LogLevel.Normal);
      await deletePrevious();
      log('Deleting previous deployment - complete', LogLevel.Normal);
    } catch (e) {
      log('Error occurred attempting to delete previous deployment', LogLevel.Error, e);
    }
  }

  log(`Deploying zip file: ${ZIP_FILE_PATH} - start`, LogLevel.Normal);
  await deployZip();
  log(`Deploying zip file: ${ZIP_FILE_PATH} - complete`, LogLevel.Normal);
})();
