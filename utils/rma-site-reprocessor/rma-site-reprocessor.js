import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { fromIni, fromSSO } from '@aws-sdk/credential-providers';
import decompress from 'decompress';
import path from 'path';
import * as fsPromise from 'fs/promises';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';

const COMMAND_LINE_ARG_OPTIONS = [
  {
    name: 'help',
    type: Boolean,
    alias: 'h',
    description: 'Display this usage guide',
  },
  {
    name: 'region',
    alias: 'r',
    type: String,
    description:
      '{bold {italic REQUIRED:}} AWS region profile to use defined in ini credentials',
  },
  {
    name: 'bucket',
    alias: 'b',
    type: String,
    description: '{bold {italic REQUIRED:}} S3 bucket name',
  },
  {
    name: 'copy',
    alias: 'c',
    type: Boolean,
    description: 'Copy mode, source to destination',
  },
  {
    name: 'dest_region',
    alias: 'd',
    type: String,
    description: 'Destination S3 bucket name for copy mode',
  },
  {
    name: 'dest_bucket',
    alias: 'e',
    type: String,
    description: 'Destination S3 bucket name for copy mode',
  },
  {
    name: 'sites',
    type: String,
    multiple: true,
    defaultOption: true,
    description:
      '{bold {italic REQUIRED:}} case-sensitive relative path from bucket root of the site/module to iterate and re-deploy.' +
      '\n\nUsing the --sites parameter flag is optional, as these are captured by default.\n',
    typeLabel: 'site_module_path_1 ... site_module_path_N',
  },
  {
    name: 'verbose',
    type: Boolean,
    alias: 'v',
    description: 'Verbose console logging',
  },
  {
    name: 'quiet',
    type: Boolean,
    alias: 'q',
    description: 'Minimal console logging',
  },
  {
    name: 'listonly',
    type: Boolean,
    alias: 'l',
    description: 'Only list patients for a given site/module',
  },
  {
    name: 'triggerfile',
    type: String,
    alias: 't',
    description:
      'The name of the file to re-save to trigger processing.\nDefault is outputjson.json',
    defaultValue: 'outputjson.json',
  },
  {
    name: 'platform',
    type: String,
    alias: 'p',
    description: 'Update the platform version to this value',
  },
  {
    name: 'use_dest_site',
    type: Boolean,
    alias: 'u',
    description:
      'Replace system/site in path references including inside destination json files',
  },
  {
    name: 'use_dest_system',
    type: Boolean,
    alias: 'y',
    description: 'Expect and replace only system in path references',
  },
  {
    name: 'server_uuid',
    type: String,
    alias: 's',
    description: 'Server uuid to use when converting to destination site',
  },
  {
    name: 'patientId',
    type: String,
    alias: 'x',
    description: 'Replace patient RapidId',
  },
  {
    name: 'overwrite',
    type: Boolean,
    alias: 'o',
    description: 'Overwrite existing files in destination bucket',
  },
  {
    name: 'singlefile',
    type: Boolean,
    alias: 'f',
    description: 'Single file copy only',
  },
  {
    name: 'iniauth',
    type: Boolean,
    alias: 'i',
    description: 'Use ini credentials for authentication instead of SSO',
  },
];

const USAGE_CONFIG = [
  {
    header: '{underline RMA site reprocessor}',
    content:
      'A nodejs utility script to trigger reprocessing for patient data via re-saving outputjson.json for a specified site module',
  },
  {
    header: '{underline Usage}',
    content:
      `  node rma-site-reprocessor.js <site_module_path_1> ... [site_module_path_N]\n    --region <aws_region_profile> --bucket <bucket_name> [OPTIONS]\n` +
      `\n node rma-site-reprocessor.js --copy <src_s3_path_1> <dest_s3_path_2>\n    --region <src aws_region_profile> --bucket <src bucket_name>` +
      `\n    --dest_region <dest_aws_region_profile> --dest_bucket <dest_bucket_name>`,
    raw: true,
  },
  {
    header: '{underline Options}',
    optionList: COMMAND_LINE_ARG_OPTIONS,
  },
];

const USAGE = commandLineUsage(USAGE_CONFIG);

// Bit flags for log level processing
const LogLevel = {
  None: 0x0,
  QuietBypass: 0x1,
  Normal: 0x2,
  Verbose: 0x4,
  Error: 0x8,
};

const OPTIONS = commandLineArgs(COMMAND_LINE_ARG_OPTIONS);

const VERBOSE = OPTIONS.verbose;
const QUIET = OPTIONS.quiet;

const LOG_LEVEL = VERBOSE
  ? LogLevel.QuietBypass | LogLevel.Normal | LogLevel.Verbose | LogLevel.Error
  : QUIET
  ? LogLevel.QuietBypass | LogLevel.Error
  : LogLevel.QuietBypass | LogLevel.Normal | LogLevel.Error;

const S3_PATH_SEPARATOR = '/';
const REGEX_LEADING_TRAILING_SEP = new RegExp(
  `(^${S3_PATH_SEPARATOR})|(${S3_PATH_SEPARATOR}$)`,
  'g'
);
const REGION_PROFILE = OPTIONS.region ?? 'sandpit3';
const BUCKET_NAME = OPTIONS.bucket ?? 'ischemaview-sandpit3-us-west-2';
const SITES = OPTIONS.sites ?? [];
const LIST_ONLY = OPTIONS.listonly;
const TRIGGER_FILE =
  !LIST_ONLY && OPTIONS.triggerfile ? OPTIONS.triggerfile : 'outputjson.json';
const PLATFORM_UPDATE_VERSION = OPTIONS.platform;
const COPY_MODE = OPTIONS.copy;
const DEST_REGION_PROFILE = OPTIONS.dest_region ?? REGION_PROFILE;
const DEST_BUCKET_NAME = OPTIONS.dest_bucket ?? BUCKET_NAME;
const USE_DEST_SITE = OPTIONS.use_dest_site ?? false;
const USE_DEST_SYSTEM = OPTIONS.use_dest_system ?? false;
const SERVER_UUID = OPTIONS.server_uuid;
const RAPIDID = OPTIONS.patientId;
const OVERWRITE = OPTIONS.overwrite ?? false;
const SINGLEFILE = OPTIONS.singlefile ?? false;
const INIAUTH = OPTIONS.iniauth ?? false;
if (OPTIONS.help || !REGION_PROFILE || !BUCKET_NAME || !SITES.length) {
  log(USAGE, LogLevel.QuietBypass);
  process.exit(0);
}

const client = new S3Client({
  credentials: INIAUTH
    ? fromIni({ profile: REGION_PROFILE })
    : fromSSO({
        profile: REGION_PROFILE,
      }),
});

const clientDestination = new S3Client({
  credentials: INIAUTH
    ? fromIni({ profile: DEST_REGION_PROFILE })
    : fromSSO({
        profile: DEST_REGION_PROFILE,
      }),
});

async function getBucketObjects(bucketName, prefix, clientInner) {
  clientInner = clientInner ?? client;
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    // The default and maximum number of keys returned is 1000. This limits it to
    // one for demonstration purposes.
    MaxKeys: 100,
    Prefix: prefix,
  });

  let results = [];

  try {
    let isTruncated = true;

    while (isTruncated) {
      const {
        Contents,
        IsTruncated,
        NextContinuationToken,
      } = await clientInner.send(command);
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
  let siteModulePathIndex = -1;
  for (let siteModulePath of SITES) {
    siteModulePathIndex++;
    const siteModulePathNormalized =
      siteModulePath.replace(REGEX_LEADING_TRAILING_SEP, '') +
      (siteModulePath.endsWith('.json') || SINGLEFILE ? '' : S3_PATH_SEPARATOR);
    if (COPY_MODE) {
      if (siteModulePathIndex > 0) {
        log('copy operation - complete', LogLevel.Normal);
        return;
      } else {
        log(
          `copy operation ${SITES[0]} => ${SITES[1]} - start`,
          LogLevel.Normal
        );
      }
    } else {
      log(
        `retrieving patients for site module ${siteModulePathNormalized} - start`,
        LogLevel.Normal
      );
    }

    let bObjects;
    try {
      bObjects = await getBucketObjects(
        BUCKET_NAME,
        path.join('', siteModulePathNormalized)
      );
    } catch (error) {
      log('Error getting bucket objects', LogLevel.Error, error);
    }

    const totalObjects = bObjects.length;
    let currentObjectIndex = 0;

    if (bObjects.length === 1 && bObjects[0] === undefined) {
      log(
        `No objects found for path ${siteModulePathNormalized}`,
        LogLevel.Normal
      );
      continue;
    }

    let destinationPathBase = '';
    if (USE_DEST_SITE || USE_DEST_SYSTEM) {
      const srcPathParts = siteModulePathNormalized.split('/');
      const srcSystemSite = `${srcPathParts[0]}${
        USE_DEST_SYSTEM ? '' : '/' + srcPathParts[1]
      }`;
      const destPathParts = SITES[1].split('/');
      const destSystemSite = `${destPathParts[0]}${
        USE_DEST_SYSTEM ? '' : '/' + destPathParts[1]
      }`;
      const regEx = new RegExp('^' + srcSystemSite + '\\b', 'g');
      const keyWithoutSystemSite = siteModulePathNormalized.replace(regEx, '');
      destinationPathBase = `${destSystemSite}${keyWithoutSystemSite}`.replace(
        REGEX_LEADING_TRAILING_SEP,
        ''
      );
    }
    let destinationObjects;
    if (COPY_MODE) {
      try {
        destinationObjects = await getBucketObjects(
          DEST_BUCKET_NAME,
          destinationPathBase,
          clientDestination
        );
      } catch (error) {
        log('Error getting bucket objects', LogLevel.Error, error);
      }
    }

    if (SINGLEFILE) {
      const filePathNormalized = siteModulePath.replace(
        REGEX_LEADING_TRAILING_SEP,
        ''
      );
      bObjects = bObjects.filter(b => b.Key === filePathNormalized);
      if (!bObjects.length) {
        log(
          `No matching file found for path ${filePathNormalized}`,
          LogLevel.Error
        );
        return;
      }
    }

    for (let bObject of bObjects) {
      currentObjectIndex++;
      if (COPY_MODE || bObject.Key.endsWith(TRIGGER_FILE)) {
        const chunks = [];

        let response_getObject;
        let destinationPath = bObject.Key;
        if (!OVERWRITE && COPY_MODE) {
          if (USE_DEST_SITE || USE_DEST_SYSTEM) {
            const srcPathParts = bObject.Key.split('/');
            const srcSystemSite = `${srcPathParts[0]}${
              USE_DEST_SYSTEM ? '' : '/' + srcPathParts[1]
            }`;
            const destPathParts = SITES[1].split('/');
            const destSystemSite = `${destPathParts[0]}${
              USE_DEST_SYSTEM ? '' : '/' + destPathParts[1]
            }`;

            const regEx = new RegExp('^' + srcSystemSite + '\\b', 'g');

            const keyWithoutSystemSite = destinationPath.replace(regEx, '');
            destinationPath = `${destSystemSite}${keyWithoutSystemSite}`;
          }

          if (destinationObjects.some(o => o?.Key === destinationPath)) {
            log(
              `File already exists in destination bucket: ${destinationPath}`,
              LogLevel.Normal
            );
            continue;
          }
        }
        try {
          log(`Downloading file: ${bObject.Key} - start`, LogLevel.Verbose);
          const getObjectCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: bObject.Key,
          });
          response_getObject = await client.send(getObjectCommand);
          for await (let chunk of response_getObject.Body) {
            chunks.push(chunk);
          }
          log(`Downloading file: ${bObject.Key} - complete`, LogLevel.Verbose);
          if (LIST_ONLY) {
            const buffer = Buffer.concat(chunks);
            const jsonData = buffer.toString('utf-8');
            const outputObj = JSON.parse(jsonData);
            log(
              `{` +
                `\n  "Patient": "${outputObj.Patient.PatientName ||
                  outputObj.Patient.PatientAge +
                    ',' +
                    outputObj.Patient.PatientSex}",` +
                `\n  "ID": "${outputObj.Patient.PatientID}",` +
                `\n  "TaskID": "${outputObj.JobManagerTaskID}",` +
                `\n  "StudyUID": "${outputObj.StudyInstanceUID}",` +
                `\n  "SeriesUID": "${outputObj.SeriesInstanceUID}"` +
                `\n},`,
              LogLevel.Normal
            );
            continue;
          }
        } catch (e) {
          log(`ERROR Downloading file: ${bObject.Key}`, LogLevel.Error, e);
        }

        let finalBuffer = new Buffer.concat(chunks);

        if (COPY_MODE) {
          log(
            `Copying ${currentObjectIndex}/${totalObjects}`,
            LogLevel.Verbose
          );
          if (USE_DEST_SITE || USE_DEST_SYSTEM) {
            const srcPathParts = bObject.Key.split('/');

            const isRootLevelFile = srcPathParts.length === 5;
            const filename = srcPathParts.at(-1);
            const isJsonFile = filename.endsWith('.json');

            if (isRootLevelFile && isJsonFile) {
              const buffer = Buffer.concat(chunks);
              const jsonData = buffer.toString('utf-8');
              const regex_bucket = new RegExp(BUCKET_NAME, 'g');
              const regex_system = new RegExp(`\\b${srcPathParts[0]}\\b`, 'g');
              const regex_site = new RegExp(`\\b${srcPathParts[1]}\\b`, 'g');
              const destPathParts = destinationPath.split('/');
              let finalJsonData = jsonData
                .replace(regex_bucket, DEST_BUCKET_NAME)
                .replace(regex_system, destPathParts[0])
                .replace(regex_site, destPathParts[1]);

              if (
                (SERVER_UUID || RAPIDID) &&
                (filename === 'outputjson.json' ||
                  filename === 'output.json' ||
                  filename === 'site_params.json')
              ) {
                const jObject = JSON.parse(finalJsonData);
                if (SERVER_UUID) {
                  if (filename === 'site_params.json') {
                    jObject.ServerId = SERVER_UUID;
                  } else if (filename === 'output.json') {
                    jObject.DeviceSerialNumber = SERVER_UUID;
                  } else if (filename === 'outputjson.json') {
                    jObject.ServerId = SERVER_UUID;
                  }
                }
                if (RAPIDID) {
                  if (filename === 'site_params.json') {
                    jObject.RAPIDId = RAPIDID;
                  } else if (filename === 'outputjson.json') {
                    jObject.Patient.RAPIDId = RAPIDID;
                  }
                }
                finalJsonData = JSON.stringify(jObject);
              }
              finalBuffer = Buffer.from(finalJsonData, 'utf-8');
            }
          } else {
            destinationPath = `${SITES[1]}/${destinationPath}`;
          }
        }

        if (TRIGGER_FILE === 'outputjson.json' && PLATFORM_UPDATE_VERSION) {
          log(
            `Updating platform version to ${PLATFORM_UPDATE_VERSION} - start`,
            LogLevel.Verbose
          );
          const buffer = finalBuffer;
          const jsonData = buffer.toString('utf-8');
          const outputObj = JSON.parse(jsonData);
          log(
            `Updating platform version to ${PLATFORM_UPDATE_VERSION} - current RapidVersion ${outputObj.Version.RapidVersion}`,
            LogLevel.Verbose
          );
          outputObj.Version.RapidVersion = outputObj.Version.RapidVersion.split(
            ' '
          )
            .slice(0, 1)
            .concat(OPTIONS.platform)
            .join(' ');

          finalBuffer = Buffer.from(JSON.stringify(outputObj, 'utf-8'));
          log(
            `Updating platform version to ${PLATFORM_UPDATE_VERSION} - complete`,
            LogLevel.Verbose
          );
        }

        try {
          log(
            `Uploading file: ${DEST_BUCKET_NAME}/${destinationPath} - start`,
            LogLevel.Verbose
          );
          const putObjectCommand = new PutObjectCommand({
            Bucket: DEST_BUCKET_NAME,
            Key: destinationPath,
            CacheControl: response_getObject.CacheControl,
            ContentDisposition: response_getObject.ContentDisposition,
            ContentEncoding: response_getObject.ContentEncoding,
            ContentLanguage: response_getObject.ContentLanguage,
            ContentType: response_getObject.ContentType,
            Body: finalBuffer,
          });

          const putResult = await clientDestination.send(putObjectCommand);
          log(
            `Uploading file: ${DEST_BUCKET_NAME}/${destinationPath} - complete`,
            LogLevel.Verbose
          );
        } catch (e) {
          log(
            `ERRORß Uploading file: ${destinationPath} - ${e.toString()}`,
            LogLevel.Error
          );
        }
      }
    }
    if (!COPY_MODE) {
      log(
        `retrieving patients for site module ${siteModulePathNormalized} - complete`,
        LogLevel.Normal
      );
    }
  }
})();
