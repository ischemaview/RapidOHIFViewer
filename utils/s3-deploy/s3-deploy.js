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
import commandLineUsage from 'command-line-usage';

const COMMAND_LINE_ARG_OPTIONS = [
  { name: 'help', type: Boolean, alias: 'h', description: 'Display this usage guide'},
  { name: 'region', alias: 'r', type: String, description: '{bold {italic REQUIRED:}} AWS region profile to use defined in ini credentials' },
  { name: 'bucket', alias: 'b', type: String, description: '{bold {italic REQUIRED:}} S3 bucket name' },
  {
    name: 'paths',
    type: String,
    multiple: true,
    defaultOption: true,
    description: '{bold {italic REQUIRED}} Path to zip file and an {italic OPTIONAL} extract to path',
    typeLabel: '<zip_file_path> [extract_to_path]'
  },
  {
    name: 'subfolder',
    type: String,
    alias: 's',
    defaultValue: 'rapid-dicom-viewer',
    description: 'S3 bucket subfolder path without leading or trailing slashes.\n{italic Default: rapid-dicom-viewer}'
  },
  { name: 'nodelete', type: Boolean, alias: 'n', description: 'Do not delete existing files in the S3 subfolder' },
  { name: 'verbose', type: Boolean, alias: 'v', description: 'Verbose console logging'},
  { name: 'quiet', type: Boolean, alias: 'q', description: 'Minimal console logging'},
  { name: 'keep', type: Boolean, alias: 'k', description: 'Keep extracted files instead of automatically deleting'}
];

const USAGE_CONFIG = [
  {
    header: '{underline rapid-dicom-viewer S3 Deploy Script}',
    content: 'A nodejs utility script to streamline cloud hosted rapid-dicom-viewer deployments to an S3 environment'
  },
  {
    header: '{underline Usage}',
    content: `  node s3-deploy.js <zip_file_path> [extract_to_path] \n    --region <aws_region_profile> --bucket <bucket_name> [OPTIONS]`,
    raw: true
  },
  {
    header: '{underline Options}',
    optionList: COMMAND_LINE_ARG_OPTIONS
  }
];

const USAGE = commandLineUsage(USAGE_CONFIG);

// Bit flags for log level processing
const LogLevel = {
  None: 0x0,
  QuietBypass: 0x1,
  Normal: 0x2,
  Verbose: 0x4,
  Error: 0x8
};

const OPTIONS = commandLineArgs(COMMAND_LINE_ARG_OPTIONS);

const VERBOSE = OPTIONS.verbose;
const QUIET = OPTIONS.quiet;

const LOG_LEVEL = VERBOSE ?
  LogLevel.QuietBypass | LogLevel.Normal | LogLevel.Verbose | LogLevel.Error :
  QUIET ?
    LogLevel.QuietBypass | LogLevel.Error :
    LogLevel.QuietBypass | LogLevel.Normal | LogLevel.Error;

const REGEX_LEADING_TRAILING_SEP = new RegExp(`(^${path.sep})|(${path.sep}$)`, 'g');
const REGION_PROFILE = OPTIONS.region ?? 'isv-sandpit3';
const BUCKET_NAME = OPTIONS.bucket;
const S3_DIRECTORY = OPTIONS.subfolder?.replace(REGEX_LEADING_TRAILING_SEP, '');
const ZIP_FILE_PATH = OPTIONS.paths?.[0];
const EXTRACT_DIRECTORY = OPTIONS.paths?.[1] ?? path.dirname(ZIP_FILE_PATH ?? '.');
const DELETE_PREVIOUS = !OPTIONS.nodelete;
const KEEP_EXTRACTED = OPTIONS.keep;


if (OPTIONS.help || !REGION_PROFILE || !BUCKET_NAME || !ZIP_FILE_PATH) {
  log(USAGE, LogLevel.QuietBypass);
  process.exit(0);
}

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

const client = new S3Client({
  credentials: fromIni({ profile: REGION_PROFILE })
});

async function unzipFile(sourcePath, destinationPath) {
  return await decompress(sourcePath, destinationPath);
}

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

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } = await client.send(command);
      results = results.concat(Contents);
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
    }

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
  const files = await unzipFile(ZIP_FILE_PATH, EXTRACT_DIRECTORY);
  const {sep} = path;
  const pathPrefixRegex = new RegExp(`^(package${sep})?dist${sep}`);
  for (let file of files) {

    if (file.type === 'directory' ||
        Object.keys(EXCLUDE_PATH_FLAGS).some(path => file.path.match(path))) {
      log(`***Excluding file/dir entry: ${file.path}`, LogLevel.Verbose);
      continue;
    }

    const extractedFilePath = path.join(EXTRACT_DIRECTORY, file.path);



    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: path.join(S3_DIRECTORY, file.path.replace(pathPrefixRegex, '')),
        ContentType: getContentType(file.path),
        Body: await fsPromise.readFile(extractedFilePath),
        CacheControl: file.path.endsWith('index.html') ? 'no-cache' : undefined
      });

      log(`Uploading file: ${command.input.Key} - start`, LogLevel.Verbose);
      await client.send(command);
      log(`Uploading file: ${command.input.Key} - complete`, LogLevel.Verbose);
    } catch (e){
      log(`Error encountered attempting to upload: ${command.input.Key}`, LogLevel.Error, e);
    }
  }

  if (!KEEP_EXTRACTED) {
    try {
      const deletePath = path.join(EXTRACT_DIRECTORY, files[0].path);
      log(`Deleting extracted files: ${deletePath} - start`, LogLevel.Verbose);
      await fsPromise.rm(deletePath, { recursive: true });
      log(`Deleting extracted files: ${deletePath} - complete`, LogLevel.Verbose);
    } catch (e) {
      log(`Error encountered while deleting extracted files: ${deletePath} - start`, LogLevel.Error, e);
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

(async function main() {
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
