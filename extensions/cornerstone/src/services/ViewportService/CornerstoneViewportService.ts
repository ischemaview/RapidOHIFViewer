import { PubSubService } from '@ohif/core';
import {
  RenderingEngine,
  StackViewport,
  Types,
  getRenderingEngine,
  utilities as csUtils,
  VolumeViewport,
  VolumeViewport3D,
  cache,
  utilities,
  CONSTANTS,
} from '@cornerstonejs/core';

import { utilities as csToolsUtils } from '@cornerstonejs/tools';
import { IViewportService } from './IViewportService';
import { RENDERING_ENGINE_ID } from './constants';
import ViewportInfo, {
  ViewportOptions,
  DisplaySetOptions,
  PublicViewportOptions,
} from './Viewport';
import {
  StackViewportData,
  VolumeViewportData,
} from '../../types/CornerstoneCacheService';
import { Presentation, Presentations } from '../../types/Presentation';
import {
  setColormap,
  setLowerUpperColorTransferFunction,
} from '../../utils/colormap/transferFunctionHelpers';

import JumpPresets from '../../utils/JumpPresets';

const EVENTS = {
  VIEWPORT_DATA_CHANGED:
    'event::cornerstoneViewportService:viewportDataChanged',
  VIEWPORT_STACK_SET: 'event::cornerstone::viewportservice:viewportstackset',
  VIEWPORT_VOLUME_SET: 'event::cornerstone::viewportservice:viewportvolumeset',
};

const MINIMUM_SLAB_THICKNESS = 5e-2;
/**
 * Handles cornerstone viewport logic including enabling, disabling, and
 * updating the viewport.
 */
class CornerstoneViewportService
  extends PubSubService
  implements IViewportService
{
  renderingEngine: Types.IRenderingEngine | null;
  viewportsInfo: Map<number, ViewportInfo> = new Map();
  viewportsById: Map<string, ViewportInfo> = new Map();
  viewportGridResizeObserver: ResizeObserver | null;
  viewportsDisplaySets: Map<string, string[]> = new Map();
  
  // Some configs
  enableResizeDetector: true;
  resizeRefreshRateMs: 200;
  resizeRefreshMode: 'debounce';
  servicesManager = null;

  constructor(servicesManager) {
    super(EVENTS);
    this.renderingEngine = null;
    this.viewportGridResizeObserver = null;
    this.servicesManager = servicesManager;
  }

  /**
   * Adds the HTML element to the viewportService
   * @param {*} viewportIndex
   * @param {*} elementRef
   */
  public enableViewport(
    viewportIndex: number,
    viewportOptions: PublicViewportOptions,
    elementRef: HTMLDivElement
  ) {
    // Use the provided viewportId
    // Not providing a viewportId is frowned upon because it does weird things
    // on moving them around, but it does mostly work.
    if (!viewportOptions.viewportId) {
      console.warn('Should provide viewport id externally', viewportOptions);
      viewportOptions.viewportId =
        this.getViewportId(viewportIndex) || `viewport-${viewportIndex}`;
    }
    const { viewportId } = viewportOptions;
    const viewportInfo = new ViewportInfo(viewportIndex, viewportId);
    if (!viewportInfo.viewportId) {
      throw new Error('Should have viewport ID afterwards');
    }

    viewportInfo.setElement(elementRef);
    this.viewportsInfo.set(viewportIndex, viewportInfo);
    this.viewportsById.set(viewportId, viewportInfo);
  }

  public getViewportIds(): string[] {
    const viewportIds = [];

    this.viewportsInfo.forEach(viewportInfo => {
      viewportIds.push(viewportInfo.getViewportId());
    });

    return viewportIds;
  }

  public getViewportId(viewportIndex: number): string {
    return this.viewportsInfo[viewportIndex]?.viewportId;
  }

  /**
   * It retrieves the renderingEngine if it does exist, or creates one otherwise
   * @returns {RenderingEngine} rendering engine
   */
  public getRenderingEngine() {
    // get renderingEngine from cache if it exists
    const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);

    if (renderingEngine) {
      this.renderingEngine = renderingEngine;
      return this.renderingEngine;
    }

    if (!renderingEngine || renderingEngine.hasBeenDestroyed) {
      this.renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
    }

    return this.renderingEngine;
  }

  /**
   * It triggers the resize on the rendering engine.
   */
  public resize() {
    const immediate = true;
    const keepCamera = true;

    this.renderingEngine.resize(immediate, keepCamera);
    this.renderingEngine.render();
  }

  /**
   * Removes the viewport from cornerstone, and destroys the rendering engine
   */
  public destroy() {
    this._removeResizeObserver();
    this.viewportGridResizeObserver = null;
    try {
      this.renderingEngine?.destroy?.();
    } catch (e) {
      console.warn('Rendering engine not destroyed', e);
    }
    this.viewportsDisplaySets.clear();
    this.renderingEngine = null;
    cache.purgeCache();
  }

  /**
   * Disables the viewport inside the renderingEngine, if no viewport is left
   * it destroys the renderingEngine.
   * @param viewportIndex
   */
  public disableElement(viewportIndex: number) {
    const viewportInfo = this.viewportsInfo.get(viewportIndex);
    if (!viewportInfo) {
      return;
    }

    const viewportId = viewportInfo.getViewportId();

    this.renderingEngine && this.renderingEngine.disableElement(viewportId);

    this.viewportsInfo.get(viewportIndex).destroy();
    this.viewportsInfo.delete(viewportIndex);
    this.viewportsById.delete(viewportId);
  }

  public setPresentations(viewport, presentations?: Presentations): void {
    const properties = presentations?.lutPresentation?.properties;
    if (properties) viewport.setProperties(properties);
    const camera = presentations?.positionPresentation?.camera;
    if (camera) viewport.setCamera(camera);

    const slabThickness = presentations?.positionPresentation?.slabThickness;
    if(slabThickness) {
      if (slabThickness <= MINIMUM_SLAB_THICKNESS) {
        viewport.setBlendMode(0); //, actorUIDs, immediate);
        viewport.setSlabThickness(MINIMUM_SLAB_THICKNESS); //, actorUIDs);
      } else {
        viewport.setBlendMode(1); //, actorUIDs, immediate);
        viewport.setSlabThickness(slabThickness); //, actorUIDs);
      }
    }
  }

  public getPresentation(viewportIndex: number): Presentation {
    const viewportInfo = this.viewportsInfo.get(viewportIndex);
    if (!viewportInfo) return;
    const { viewportType, presentationIds } = viewportInfo.getViewportOptions();

    const csViewport = this.getCornerstoneViewportByIndex(viewportIndex);
    if (!csViewport) return;

    const properties = csViewport.getProperties();
    if (properties.isComputedVOI) {
      delete properties.voiRange;
      delete properties.VOILUTFunction;
    }
    const initialImageIndex = csViewport.getCurrentImageIdIndex();
    const camera = csViewport.getCamera();

    const presentation:Presentation = {
      presentationIds,
      viewportType:
        !viewportType || viewportType === 'stack' ? 'stack' : 'volume',
      properties,
      initialImageIndex,
      camera,
    };

    if (viewportType === 'orthographic') {
      presentation.slabThickness = csViewport.getSlabThickness()
        ? csViewport.getSlabThickness()
        : MINIMUM_SLAB_THICKNESS;
    }

    return presentation;
  }

  /**
   * Uses the renderingEngine to enable the element for the given viewport index
   * and sets the displaySet data to the viewport
   * @param {*} viewportIndex
   * @param {*} displaySet
   * @param {*} dataSource
   * @returns
   */
  public setViewportData(
    viewportIndex: number,
    viewportData: StackViewportData | VolumeViewportData,
    publicViewportOptions: PublicViewportOptions,
    publicDisplaySetOptions: DisplaySetOptions[],
    presentations?: Presentations
  ): Promise<void> {
    const renderingEngine = this.getRenderingEngine();
    const viewportId =
      publicViewportOptions.viewportId || this.getViewportId(viewportIndex);
    if (!viewportId) {
      throw new Error('Must define viewportId externally');
    }

    const viewportInfo = this.viewportsById.get(viewportId);

    if (!viewportInfo) {
      throw new Error('Viewport info not defined');
    }

    // If the viewport has moved index, then record the new index
    if (viewportInfo.viewportIndex !== viewportIndex) {
      this.viewportsInfo.delete(viewportInfo.viewportIndex);
      this.viewportsInfo.set(viewportIndex, viewportInfo);
      viewportInfo.viewportIndex = viewportIndex;
    }

    viewportInfo.setRenderingEngineId(renderingEngine.id);

    const { viewportOptions, displaySetOptions } =
      this._getViewportAndDisplaySetOptions(
        publicViewportOptions,
        publicDisplaySetOptions,
        viewportInfo
      );

    viewportInfo.setViewportOptions(viewportOptions);
    viewportInfo.setDisplaySetOptions(displaySetOptions);
    viewportInfo.setViewportData(viewportData);

    this._broadcastEvent(this.EVENTS.VIEWPORT_DATA_CHANGED, {
      viewportData,
      viewportIndex,
      viewportId,
    });

    const element = viewportInfo.getElement();
    const type = viewportInfo.getViewportType();
    const background = viewportInfo.getBackground();
    const orientation = viewportInfo.getOrientation();
    const displayArea = viewportInfo.getDisplayArea();

    const viewportInput: Types.PublicViewportInput = {
      viewportId,
      element,
      type,
      defaultOptions: {
        background,
        orientation,
        displayArea,
      },
    };

    // Todo: this is not optimal at all, we are re-enabling the already enabled
    // element which is not what we want. But enabledElement as part of the
    // renderingEngine is designed to be used like this. This will trigger
    // ENABLED_ELEMENT again and again, which will run onEnableElement callbacks
    renderingEngine.enableElement(viewportInput);

    const viewport = renderingEngine.getViewport(viewportId);
    return this._setDisplaySets(
      viewport,
      viewportData,
      viewportInfo,
      presentations
    );
  }

  public getCornerstoneViewport(
    viewportId: string
  ): Types.IStackViewport | Types.IVolumeViewport | null {
    const viewportInfo = this.getViewportInfo(viewportId);

    if (
      !viewportInfo ||
      !this.renderingEngine ||
      this.renderingEngine.hasBeenDestroyed
    ) {
      return null;
    }

    const viewport = this.renderingEngine.getViewport(viewportId);

    return viewport;
  }

  public getCornerstoneViewportByIndex(
    viewportIndex: number
  ): Types.IStackViewport | Types.IVolumeViewport | null {
    const viewportInfo = this.getViewportInfoByIndex(viewportIndex);

    if (
      !viewportInfo ||
      !this.renderingEngine ||
      this.renderingEngine.hasBeenDestroyed
    ) {
      return null;
    }

    const viewport = this.renderingEngine.getViewport(
      viewportInfo.getViewportId()
    );

    return viewport;
  }

  /**
   * Returns the viewportIndex for the provided viewportId
   * @param {string} viewportId - the viewportId
   * @returns {number} - the viewportIndex
   */
  public getViewportInfoByIndex(viewportIndex: number): ViewportInfo {
    return this.viewportsInfo.get(viewportIndex);
  }

  public getViewportInfo(viewportId: string): ViewportInfo {
    // @ts-ignore
    for (const [index, viewport] of this.viewportsInfo.entries()) {
      if (viewport.getViewportId() === viewportId) {
        return viewport;
      }
    }
    return null;
  }

  _setStackViewport(
    viewport: Types.IStackViewport,
    viewportData: StackViewportData,
    viewportInfo: ViewportInfo,
    presentations: Presentations
  ): Promise<void> {
    const displaySetOptions = viewportInfo.getDisplaySetOptions();

    const { imageIds, initialImageIndex, displaySetInstanceUID } =
      viewportData.data;

    this.viewportsDisplaySets.set(viewport.id, [displaySetInstanceUID]);

    let initialImageIndexToUse =
      presentations?.positionPresentation?.initialImageIndex ??
      initialImageIndex;

    if (
      initialImageIndexToUse === undefined ||
      initialImageIndexToUse === null
    ) {
      initialImageIndexToUse =
        this._getInitialImageIndexForStackViewport(viewportInfo, imageIds) || 0;
    }

    const properties = { ...presentations.lutPresentation?.properties };
    if (!presentations.lutPresentation?.properties) {
      const { voi, voiInverted } = displaySetOptions[0];
      if (voi && (voi.windowWidth || voi.windowCenter)) {
        const { lower, upper } = csUtils.windowLevel.toLowHighRange(
          voi.windowWidth,
          voi.windowCenter
        );
        properties.voiRange = { lower, upper };
      }

      if (voiInverted !== undefined) {
        properties.invert = voiInverted;
      }
    }

    // There is a bug in CS3D that the setStack does not
    // navigate to the desired image.
    return viewport.setStack(imageIds, 0).then(() => {
      // The scroll, however, works fine in CS3D
      viewport.scroll(initialImageIndexToUse);
      viewport.setProperties(properties);
      const camera = presentations.positionPresentation?.camera;
      if (camera) viewport.setCamera(camera);
      this._broadcastEvent(EVENTS.VIEWPORT_STACK_SET, {
        viewport,
        imageIds,
        initialImageIndexToUse,
      });
    });
  }

  private _getInitialImageIndexForStackViewport(
    viewportInfo: ViewportInfo,
    imageIds?: string[]
  ): number {
    const initialImageOptions = viewportInfo.getInitialImageOptions();

    if (!initialImageOptions) {
      return;
    }

    const { index, preset } = initialImageOptions;
    return this._getInitialImageIndex(imageIds.length, index, preset);
  }

  _getInitialImageIndex(
    numberOfSlices: number,
    imageIndex?: number,
    preset?: JumpPresets
  ): number {
    const lastSliceIndex = numberOfSlices - 1;

    if (imageIndex !== undefined) {
      return csToolsUtils.clip(imageIndex, 0, lastSliceIndex);
    }

    if (preset === JumpPresets.First) {
      return 0;
    }

    if (preset === JumpPresets.Last) {
      return lastSliceIndex;
    }

    if (preset === JumpPresets.Middle) {
      // Note: this is a simple but yet very important formula.
      // since viewport reset works with the middle slice
      // if the below formula is not correct, on a viewport reset
      // it will jump to a different slice than the middle one which
      // was the initial slice, and we have some tools such as Crosshairs
      // which rely on a relative camera modifications and those will break.
      return lastSliceIndex % 2 === 0
        ? lastSliceIndex / 2
        : (lastSliceIndex + 1) / 2;
    }

    return 0;
  }

  async _setVolumeViewport(
    viewport: Types.IVolumeViewport,
    viewportData: VolumeViewportData,
    viewportInfo: ViewportInfo,
    presentations: Presentations
  ): Promise<void> {
    // TODO: We need to overhaul the way data sources work so requests can be made
    // async. I think we should follow the image loader pattern which is async and
    // has a cache behind it.
    // The problem is that to set this volume, we need the metadata, but the request is
    // already in-flight, and the promise is not cached, so we have no way to wait for
    // it and know when it has fully arrived.
    // loadStudyMetadata(StudyInstanceUID) => Promise([instances for study])
    // loadSeriesMetadata(StudyInstanceUID, SeriesInstanceUID) => Promise([instances for series])
    // If you call loadStudyMetadata and it's not in the DicomMetadataStore cache, it should fire
    // a request through the data source?
    // (This call may or may not create sub-requests for series metadata)
    const volumeInputArray = [];
    const displaySetOptionsArray = viewportInfo.getDisplaySetOptions();
    const { hangingProtocolService } = this.servicesManager.services;

    const volumeToLoad = [];
    const displaySetInstanceUIDs = [];

    for (const [index, data] of viewportData.data.entries()) {
      const { volume, imageIds, displaySetInstanceUID } = data;

      displaySetInstanceUIDs.push(displaySetInstanceUID);

      if (!volume) {
        console.log('Volume display set not found');
        continue;
      }

      volumeToLoad.push(volume);

      const displaySetOptions = displaySetOptionsArray[index];
      const { volumeId } = volume;

      const voiCallbacks = this._getVOICallbacks(volumeId, displaySetOptions);

      const callback = ({ volumeActor }) => {
        voiCallbacks.forEach(callback => callback(volumeActor));
      };

      volumeInputArray.push({
        imageIds,
        volumeId,
        callback,
        blendMode: displaySetOptions.blendMode,
        slabThickness: this._getSlabThickness(displaySetOptions, volumeId),
      });
    }

    this.viewportsDisplaySets.set(viewport.id, displaySetInstanceUIDs);

    if (
      hangingProtocolService.hasCustomImageLoadStrategy() &&
      !hangingProtocolService.customImageLoadPerformed
    ) {
      // delegate the volume loading to the hanging protocol service if it has a custom image load strategy
      return hangingProtocolService.runImageLoadStrategy({
        viewportId: viewport.id,
        volumeInputArray,
      });
    }

    if (!hangingProtocolService.hasCustomImageLoadStrategy()) {
      volumeToLoad.forEach(volume => {
        if (!volume.loadStatus.loaded && !volume.loadStatus.loading) {
          volume.load();
        }
      });
    }

    // This returns the async continuation only
    return this.setVolumesForViewport(
      viewport,
      volumeInputArray,
      presentations
    );
  }

  public async setVolumesForViewport(
    viewport,
    volumeInputArray,
    presentations
  ): Promise<void> {
    const { displaySetService, segmentationService, toolGroupService } =
      this.servicesManager.services;

    await viewport.setVolumes(volumeInputArray);
    this.setPresentations(viewport, presentations);

    // load any secondary displaySets
    const displaySetInstanceUIDs = this.viewportsDisplaySets.get(viewport.id);

    const segDisplaySet = displaySetInstanceUIDs
      .map(displaySetService.getDisplaySetByUID)
      .find(displaySet => displaySet && displaySet.Modality === 'SEG');

    if (segDisplaySet) {
      const { referencedVolumeId } = segDisplaySet;
      const referencedVolume = cache.getVolume(referencedVolumeId);
      const segmentationId = segDisplaySet.displaySetInstanceUID;

      const toolGroup = toolGroupService.getToolGroupForViewport(viewport.id);

      if (referencedVolume) {
        segmentationService.addSegmentationRepresentationToToolGroup(
          toolGroup.id,
          segmentationId
        );
      }
    } else {
      const toolGroup = toolGroupService.getToolGroupForViewport(viewport.id);
      const toolGroupSegmentationRepresentations =
        segmentationService.getSegmentationRepresentationsForToolGroup(
          toolGroup.id
        ) || [];

      // csToolsUtils.segmentation.triggerSegmentationRender(toolGroup.id);
      // If the displaySet is not a SEG displaySet we assume it is a primary displaySet
      // and we can look into hydrated segmentations to check if any of them are
      // associated with the primary displaySet
      // get segmentations only returns the hydrated segmentations
      const segmentations = segmentationService.getSegmentations();

      for (const segmentation of segmentations) {
        // if there is already a segmentation representation for this segmentation
        // for this toolGroup, don't bother at all
        if (
          toolGroupSegmentationRepresentations.find(
            representation => representation.segmentationId === segmentation.id
          )
        ) {
          continue;
        }

        // otherwise, check if the hydrated segmentations are in the same FOR
        // as the primary displaySet, if so add the representation (since it was not there)
        const { id: segDisplaySetInstanceUID } = segmentation;

        const segFrameOfReferenceUID = this._getFrameOfReferenceUID(
          segDisplaySetInstanceUID
        );

        let shouldDisplaySeg = false;

        for (const displaySetInstanceUID of displaySetInstanceUIDs) {
          const primaryFrameOfReferenceUID = this._getFrameOfReferenceUID(
            displaySetInstanceUID
          );

          if (segFrameOfReferenceUID === primaryFrameOfReferenceUID) {
            shouldDisplaySeg = true;
            break;
          }
        }

        if (shouldDisplaySeg) {
          const toolGroup = toolGroupService.getToolGroupForViewport(
            viewport.id
          );

          segmentationService.addSegmentationRepresentationToToolGroup(
            toolGroup.id,
            segmentation.id
          );
        }
      }
    }

    const viewportInfo = this.getViewportInfo(viewport.id);

    const toolGroup = toolGroupService.getToolGroupForViewport(viewport.id);
    csToolsUtils.segmentation.triggerSegmentationRender(toolGroup.id);

    const initialImageOptions = viewportInfo.getInitialImageOptions();

    if (
      initialImageOptions &&
      (initialImageOptions.preset !== undefined ||
        initialImageOptions.index !== undefined)
    ) {
      const { index, preset } = initialImageOptions;

      const { numberOfSlices } =
        csUtils.getImageSliceDataForVolumeViewport(viewport);

      const imageIndex = this._getInitialImageIndex(
        numberOfSlices,
        index,
        preset
      );

      csToolsUtils.jumpToSlice(viewport.element, {
        imageIndex,
      });
    }

    viewport.render();

    this._broadcastEvent(EVENTS.VIEWPORT_VOLUME_SET, {
      viewport,
      volumeInputArray,
    });
  }

  // Todo: keepCamera is an interim solution until we have a better solution for
  // keeping the camera position when the viewport data is changed
  public updateViewport(
    viewportIndex: number,
    viewportData,
    keepCamera = false
  ): Promise<void> {
    const viewportInfo = this.getViewportInfoByIndex(viewportIndex);

    const viewportId = viewportInfo.getViewportId();
    const viewport = this.getCornerstoneViewport(viewportId);
    const viewportCamera = viewport.getCamera();

    if (viewport instanceof VolumeViewport) {
      return this._setVolumeViewport(viewport, viewportData, viewportInfo).then(
        () => {
          if (keepCamera) {
            viewport.setCamera(viewportCamera);
            viewport.render();
          }

          this._broadcastEvent(this.EVENTS.VIEWPORT_DATA_CHANGED, {
                  viewportData,
                  viewportIndex,
                  viewportId,
                });
        }
      );
    }

    if (viewport instanceof StackViewport) {
      return this._setStackViewport(viewport, viewportData, viewportInfo);
    }
  }

  _getVOICallbacks(volumeId, displaySetOptions) {
    const {
      voi,
      voiInverted: inverted,
      colormap,
      presetName,
    } = displaySetOptions;

    const voiCallbackArray = [];

    // If colormap is set, use it to set the color transfer function
    if (colormap) {
      voiCallbackArray.push(volumeActor => setColormap(volumeActor, colormap));
    }

    if (voi instanceof Object && voi.windowWidth && voi.windowCenter) {
      const { windowWidth, windowCenter } = voi;
      const { lower, upper } = csUtils.windowLevel.toLowHighRange(
        windowWidth,
        windowCenter
      );
      voiCallbackArray.push(volumeActor =>
        setLowerUpperColorTransferFunction({
          volumeActor,
          lower,
          upper,
          inverted,
        })
      );
    }

    if (presetName) {
      voiCallbackArray.push(volumeActor => {
        utilities.applyPreset(
          volumeActor,
          CONSTANTS.VIEWPORT_PRESETS.find(preset => {
            return preset.name === presetName;
          })
        );
      });
    }
    return voiCallbackArray;
  }

  _setDisplaySets(
    viewport: StackViewport | VolumeViewport,
    viewportData: StackViewportData | VolumeViewportData,
    viewportInfo: ViewportInfo,
    presentations: Presentations = {}
  ): Promise<void> {
    if (viewport instanceof StackViewport) {
      return this._setStackViewport(
        viewport,
        viewportData as StackViewportData,
        viewportInfo,
        presentations
      );
    } else if (
      viewport instanceof VolumeViewport ||
      viewport instanceof VolumeViewport3D
    ) {
      return this._setVolumeViewport(
        viewport,
        viewportData as VolumeViewportData,
        viewportInfo,
        presentations
      );
    } else {
      throw new Error('Unknown viewport type');
    }
  }

  /**
   * Removes the resize observer from the viewport element
   */
  _removeResizeObserver() {
    if (this.viewportGridResizeObserver) {
      this.viewportGridResizeObserver.disconnect();
    }
  }

  _getSlabThickness(displaySetOptions, volumeId) {
    const { blendMode } = displaySetOptions;
    if (
      blendMode === undefined ||
      displaySetOptions.slabThickness === undefined
    ) {
      return;
    }

    // if there is a slabThickness set as a number then use it
    if (typeof displaySetOptions.slabThickness === 'number') {
      return displaySetOptions.slabThickness;
    }

    if (displaySetOptions.slabThickness.toLowerCase() === 'fullvolume') {
      // calculate the slab thickness based on the volume dimensions
      const imageVolume = cache.getVolume(volumeId);

      const { dimensions } = imageVolume;
      const slabThickness = Math.sqrt(
        dimensions[0] * dimensions[0] +
          dimensions[1] * dimensions[1] +
          dimensions[2] * dimensions[2]
      );

      return slabThickness;
    }
  }

  _getViewportAndDisplaySetOptions(
    publicViewportOptions: PublicViewportOptions,
    publicDisplaySetOptions: DisplaySetOptions[],
    viewportInfo: ViewportInfo
  ): {
    viewportOptions: ViewportOptions;
    displaySetOptions: DisplaySetOptions[];
  } {
    const viewportIndex = viewportInfo.getViewportIndex();

    // Creating a temporary viewportInfo to handle defaults
    const newViewportInfo = new ViewportInfo(
      viewportIndex,
      viewportInfo.getViewportId()
    );

    // To handle setting the default values if missing for the viewportOptions and
    // displaySetOptions
    newViewportInfo.setPublicViewportOptions(publicViewportOptions);
    newViewportInfo.setPublicDisplaySetOptions(publicDisplaySetOptions);

    const newViewportOptions = newViewportInfo.getViewportOptions();
    const newDisplaySetOptions = newViewportInfo.getDisplaySetOptions();

    return {
      viewportOptions: newViewportOptions,
      displaySetOptions: newDisplaySetOptions,
    };
  }

  _getFrameOfReferenceUID(displaySetInstanceUID) {
    const { displaySetService } = this.servicesManager.services;
    const displaySet = displaySetService.getDisplaySetByUID(
      displaySetInstanceUID
    );

    if (!displaySet) {
      return;
    }

    if (displaySet.frameOfReferenceUID) {
      return displaySet.frameOfReferenceUID;
    }

    if (displaySet.Modality === 'SEG') {
      const { instance } = displaySet;
      return instance.FrameOfReferenceUID;
    }

    const { images } = displaySet;
    if (images && images.length) {
      return images[0].FrameOfReferenceUID;
    }
  }
}

export default function CornerstoneViewportServiceRegistration(serviceManager) {
  return {
    name: 'cornerstoneViewportService',
    altName: 'CornerstoneViewportService',
    create: ({ configuration = {} }) => {
      return new CornerstoneViewportService(serviceManager);
    },
  };
}

export { CornerstoneViewportService, CornerstoneViewportServiceRegistration };
