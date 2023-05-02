import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand
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
    name: 'sites',
    type: String,
    multiple: true,
    defaultOption: true,
    description: '{bold {italic REQUIRED:}} case-sensitive relative path from bucket root of the site/module to iterate and re-deploy.'
      + '\n\nUsing the --sites parameter flag is optional, as these are captured by default.\n',
    typeLabel: 'site_module_path_1 ... site_module_path_N'
  },
  { name: 'verbose', type: Boolean, alias: 'v', description: 'Verbose console logging'},
  { name: 'quiet', type: Boolean, alias: 'q', description: 'Minimal console logging'},
  { name: 'listonly', type: Boolean, alias: 'l', description: 'Only list patients for a given site/module'},
  {
    name: 'triggerfile',
    type: String,
    alias: 't',
    description: 'The name of the file to re-save to trigger processing.\nDefault is outputjson.json',
    defaultValue: 'outputjson.json'
  }
];

const USAGE_CONFIG = [
  {
    header: '{underline RMA site reprocessor}',
    content: 'A nodejs utility script to trigger reprocessing for patient data via re-saving outputjson.json for a specified site module'
  },
  {
    header: '{underline Usage}',
    content: `  node rma-site-reprocessor.js <site_module_path_1> ... [site_module_path_N]\n    --region <aws_region_profile> --bucket <bucket_name> [OPTIONS]`,
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

const S3_PATH_SEPARATOR = '/';
const REGEX_LEADING_TRAILING_SEP = new RegExp(`(^${S3_PATH_SEPARATOR})|(${S3_PATH_SEPARATOR}$)`, 'g');
const REGION_PROFILE = OPTIONS.region ?? 'isv-sandpit3';
const BUCKET_NAME = OPTIONS.bucket;
const SITES = OPTIONS.sites ?? [];
const LIST_ONLY = OPTIONS.listonly;
const TRIGGER_FILE =  !LIST_ONLY && OPTIONS.triggerfile ? OPTIONS.triggerfile : 'outputjson.json';

if (OPTIONS.help || !REGION_PROFILE || !BUCKET_NAME || !SITES.length) {
  log(USAGE, LogLevel.QuietBypass);
  process.exit(0);
}

const client = new S3Client({
  credentials: fromIni({ profile: REGION_PROFILE })
});

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
  for (let siteModulePath of SITES) {
    const siteModulePathNormalized = siteModulePath.replace(REGEX_LEADING_TRAILING_SEP, '') + S3_PATH_SEPARATOR;
    log(`retrieving patients for site module ${siteModulePathNormalized} - start`, LogLevel.Normal);
    const bObjects = await getBucketObjects(BUCKET_NAME, path.join('', siteModulePathNormalized));
    let pIndex = 0;
    for (let bObject of bObjects) {
      if (bObject.Key.endsWith(TRIGGER_FILE)) {
        const chunks = [];

        try {
          log(`Downloading file: ${bObject.Key} - start`, LogLevel.Verbose);
          const getObjectCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: bObject.Key
          })
          const response = await client.send(getObjectCommand);

          for await (let chunk of response.Body) {
            chunks.push(chunk);
          }

          log(`Downloading file: ${bObject.Key} - complete`, LogLevel.Verbose);

          if (LIST_ONLY) {
            const buffer = Buffer.concat(chunks);
            const jsonData = buffer.toString('utf-8');
            const outputObj = JSON.parse(jsonData);

            log(
              `{`
              + `\n  "Patient": "${outputObj.Patient.PatientName}",`
              + `\n  "ID": "${outputObj.Patient.PatientID}",`
              + `\n  "TaskID": "${outputObj.JobManagerTaskID}",`
              + `\n  "StudyUID": "${outputObj.StudyInstanceUID}",`
              + `\n  "SeriesUID": "${outputObj.SeriesInstanceUID}"`
              + `\n},`, LogLevel.Normal);
            continue;
          }

        } catch (e) {
          log(`ERROR Downloading file: ${bObject.Key}`, LogLevel.Error, e);
        }

        try {
          log(`Uploading file: ${bObject.Key} - start`, LogLevel.Verbose);
          const putObjectCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: bObject.Key,
            ContentType: bObject.ContentType,
            Body: new Buffer.concat(chunks)
          });

          const putResult = await client.send(putObjectCommand);
          log(`Uploading file: ${bObject.Key} - complete`, LogLevel.Verbose);
        } catch (e) {

        }
      }

    }
    log(`retrieving patients for site module ${siteModulePathNormalized} - complete`, LogLevel.Normal);
  }

})();
