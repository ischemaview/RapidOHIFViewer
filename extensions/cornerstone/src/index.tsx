import React from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  Enums as cs3DEnums,
  imageLoadPoolManager,
  imageRetrievalPoolManager,
} from '@cornerstonejs/core';
import { Enums as cs3DToolsEnums } from '@cornerstonejs/tools';
import { Types } from '@ohif/core';

import init from './init';
import getCommandsModule from './commandsModule';
import getHangingProtocolModule from './getHangingProtocolModule';
import ToolGroupService from './services/ToolGroupService';
import SyncGroupService from './services/SyncGroupService';
import SegmentationService from './services/SegmentationService';
import CornerstoneCacheService from './services/CornerstoneCacheService';

import { toolNames } from './initCornerstoneTools';
import {
  getEnabledElement,
  setEnabledElement,
  reset as enabledElementReset,
} from './state';
import CornerstoneViewportService from './services/ViewportService/CornerstoneViewportService';

import dicomLoaderService from './utils/dicomLoaderService';
import { registerColormap } from './utils/colormap/transferFunctionHelpers';

import { id } from './id';
import * as csWADOImageLoader from './initWADOImageLoader.js';
import { measurementMappingUtils } from './utils/measurementServiceMappings';
import { PublicViewportOptions } from './services/ViewportService/Viewport';

const Component = React.lazy(() => {
  return import(
    /* webpackPrefetch: true */ './Viewport/OHIFCornerstoneViewport'
  );
});

const OHIFCornerstoneViewport = React.forwardRef((props, ref) => {
  return (
    <React.Suspense fallback={
      <div className="pointer-events-none bg-black opacity-50 absolute h-full w-full top-0 left-0">
        <div className="flex flex-col transparent items-center justify-center w-full h-full">
          <div className="loading">
            <div className="infinite-loading-bar bg-primary-light"></div>
          </div>
          <div className="loading-messagetext">
            <div className="caption-1-white">Loading Images</div>
          </div>
        </div>
      </div>
    }>
      <Component ref={ref} {...props} />
    </React.Suspense>
  );
});
OHIFCornerstoneViewport.displayName = 'OHIFCornerstoneViewport';

/**
 *
 */
const cornerstoneExtension: Types.Extensions.Extension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,

  onModeExit: (): void => {
    // Empty out the image load and retrieval pools to prevent memory leaks
    // on the mode exits
    Object.values(cs3DEnums.RequestType).forEach(type => {
      imageLoadPoolManager.clearRequestStack(type);
      imageRetrievalPoolManager.clearRequestStack(type);
    });

    csWADOImageLoader.destroy();
    enabledElementReset();
  },

  /**
   * Register the Cornerstone 3D services and set them up for use.
   *
   * @param configuration.csToolsConfig - Passed directly to `initCornerstoneTools`
   */
  preRegistration: function (
    props: Types.Extensions.ExtensionParams
  ): Promise<void> {
    const { servicesManager } = props;
    // Todo: we should be consistent with how services get registered. Use REGISTRATION static method for all
    servicesManager.registerService(
      CornerstoneViewportService(servicesManager)
    );
    servicesManager.registerService(
      ToolGroupService.REGISTRATION(servicesManager)
    );
    servicesManager.registerService(SyncGroupService(servicesManager));
    servicesManager.registerService(SegmentationService(servicesManager));
    servicesManager.registerService(
      CornerstoneCacheService.REGISTRATION(servicesManager)
    );

    return init.call(this, props);
  },

  getHangingProtocolModule,
  getViewportModule({ servicesManager, commandsManager }) {
    const ExtendedOHIFCornerstoneViewport = React.forwardRef((props, ref) => {
      // const onNewImageHandler = jumpData => {
      //   commandsManager.runCommand('jumpToImage', jumpData);
      // };
      const { toolbarService } = (servicesManager as ServicesManager).services;

      return (
        <OHIFCornerstoneViewport
          ref={ref}
          {...props}
          ToolbarService={toolbarService}
          servicesManager={servicesManager}
          commandsManager={commandsManager}
        />
      );
    });

    return [
      {
        name: 'cornerstone',
        component: ExtendedOHIFCornerstoneViewport,
      },
    ];
  },
  getCommandsModule,
  getUtilityModule({ servicesManager }) {
    return [
      {
        name: 'common',
        exports: {
          getCornerstoneLibraries: () => {
            return { cornerstone, cornerstoneTools };
          },
          getEnabledElement,
          setEnabledElement,
          dicomLoaderService,
          registerColormap,
        },
      },
      {
        name: 'core',
        exports: {
          Enums: cs3DEnums,
        },
      },
      {
        name: 'tools',
        exports: {
          toolNames,
          Enums: cs3DToolsEnums,
        },
      },
    ];
  },
};

export type { PublicViewportOptions };
export { measurementMappingUtils };
export default cornerstoneExtension;
