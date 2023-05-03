import * as cornerstone from '@cornerstonejs/core';
import { volumeLoader } from '@cornerstonejs/core';
import { cornerstoneStreamingImageVolumeLoader } from '@cornerstonejs/streaming-image-volume-loader';
import cornerstoneWADOImageLoader, {
  webWorkerManager,
} from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import { errorHandler } from '@ohif/core';

const { registerVolumeLoader } = volumeLoader;

let initialized = false;

function initWebWorkers(appConfig) {
  const config = {
    maxWebWorkers: Math.min(
      Math.max(navigator.hardwareConcurrency - 1, 1),
      appConfig.maxNumberOfWebWorkers
    ),
    startWebWorkersOnDemand: true,
    taskConfiguration: {
      decodeTask: {
        initializeCodecsOnStartup: false,
        usePDFJS: false,
        strict: false,
      },
    },
  };

  if (!initialized) {
    cornerstoneWADOImageLoader.webWorkerManager.initialize(config);
    initialized = true;
  }
}

export default function initWADOImageLoader(
  userAuthenticationService,
  appConfig
) {
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

  registerVolumeLoader(
    'cornerstoneStreamingImageVolume',
    cornerstoneStreamingImageVolumeLoader
  );

  cornerstoneWADOImageLoader.configure({
    decodeConfig: {
      // !! IMPORTANT !!
      // We should set this flag to false, since, by default cornerstone-wado-image-loader
      // will convert everything to integers (to be able to work with cornerstone-2d).
      // Until the default is set to true (which is the case for cornerstone3D),
      // we should set this flag to false.
      convertFloatPixelDataToInt: false,
      use16BitDataType: Boolean(appConfig.use16BitDataType),
    },
    beforeSend: function(xhr) {
      const headers = userAuthenticationService.getAuthorizationHeader();

      // Request:
      // JPEG-LS Lossless (1.2.840.10008.1.2.4.80) if available, otherwise accept
      // whatever transfer-syntax the origin server provides.
      // For now we use image/jls and image/x-jls because some servers still use the old type
      // http://dicom.nema.org/medical/dicom/current/output/html/part18.html
      const xhrRequestHeaders = {
        Accept: appConfig.omitQuotationForMultipartRequest
          ? 'multipart/related; type=application/octet-stream'
          : 'multipart/related; type="application/octet-stream"',
        // 'multipart/related; type="image/x-jls", multipart/related; type="image/jls"; transfer-syntax="1.2.840.10008.1.2.4.80", multipart/related; type="image/x-jls", multipart/related; type="application/octet-stream"; transfer-syntax=*',
      };

      if (headers && headers.Authorization) {
        xhrRequestHeaders.Authorization = headers.Authorization;
      }

      return xhrRequestHeaders;
    },
    errorInterceptor: error => {
      errorHandler.getHTTPErrorHandler(error);
    },
    withCredentials: true,
    cache: {
      getScope: function(url) {
        /**
         * getScope takes in a url and returns a string representing a cache
         * scope. For instance, dicom series uid is a scope. This allows the
         * cacheAPI to remove related dicoms with one command.
         */
        const isDicomWeb = url.split('series/');

        if (isDicomWeb.length === 1) {
          return 'default-cornerstone-WADO-cache';
        }
        const scope = `${isDicomWeb[0]}series/${isDicomWeb[1].split('/')[0]}`;

        return scope;
      },
      writeCacheProxy: function(xhr) {
        // open cache based on url scoping this allows efficient cache deletion
        // using: window.caches.delete(scope);
        if (!window.caches) {
          return;
        }

        const scope = this.getScope(xhr.responseURL);
        const cacheLogic = (cache, scope, xhr) => {
          const getXHRJSONHeaders = xhr => {
            // Mock headers of response object
            const headers = xhr.getAllResponseHeaders().split('\r\n');

            headers.pop(); // remove empty ""

            return headers.reduce((prev, h) => {
              const [key, value] = h.split(':');

              prev[key] = value.trim();

              return prev;
            }, {});
          };

          const res = new Response(xhr.response, {
            headers: getXHRJSONHeaders(xhr),
          });

          const req = new Request(xhr.responseURL, {
            headers: {
              'dicom-last-put-date': new Date().toUTCString(),
              'dicom-last-viewed-date': new Date().toUTCString(),
              'dicom-content-length':
                xhr.response instanceof ArrayBuffer
                  ? `${xhr.response.byteLength}`
                  : 'undefined',
            },
          });
          const triggerQuotaError = () => {
            const error = new DOMError('QuotaExceededError');

            cornerstone.triggerEvent(
              cornerstone.events,
              'CORNERSTONE_CACHE_QUOTA_EXCEEDED_ERROR',
              {
                error,
                xhr,
                scope,
                cache,
                retry: () => cacheLogic(cache, scope, xhr),
              }
            );

            return error;
          };

          return cache.put(req, res).catch(error => {
            if (error.name === 'QuotaExceededError') {
              triggerQuotaError();
            } else {
              console.error(error);
            }
          });
        };

        window.caches.open(scope).then(cache => {
          cacheLogic(cache, scope, xhr);
        });
      },
      readCacheProxy: async function(xhr, url, resolve) {
        // open cache based on url scoping this allows efficient cache deletion
        // using: window.caches.delete(scope);
        const scope = this.getScope(url);

        if (!window.caches) {
          return false;
        }

        try {
          const cache = await window.caches.open(scope);
          const res = await cache.match(url, {
            ignoreVary: true,
            ignoreMethod: true,
            ignoreSearch: true,
          });

          if (!res) {
            return false;
          }

          const resClone = res.clone();

          xhr.getResponseHeader = name => res.headers.get(name);
          const arrayBuffer = res.arrayBuffer();
          const contentLength = arrayBuffer.byteLength;

          resolve(arrayBuffer);

          const req = new Request(url, {
            headers: {
              'dicom-last-put-date': new Date().toUTCString(),
              'dicom-last-viewed-date': new Date().toUTCString(),
              'dicom-content-length': `${contentLength}`,
            },
          });

          cache.put(req, resClone);

          return true;
        } catch (e) {
          console.error(e);

          return false;
        }
      },
    },
  });

  initWebWorkers(appConfig);
}

export function destroy() {
  // Note: we don't want to call .terminate on the webWorkerManager since
  // that resets the config
  const webWorkers = webWorkerManager.webWorkers;
  for (let i = 0; i < webWorkers.length; i++) {
    webWorkers[i].worker.terminate();
  }
  webWorkers.length = 0;
}
