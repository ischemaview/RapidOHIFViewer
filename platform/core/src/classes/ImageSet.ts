import guid from '../utils/guid.js';
import { Vector3 } from 'cornerstone-math';
import metadataProvider from './MetadataProvider.js';

const OBJECT = 'object';

/**
 * This class defines an ImageSet object which will be used across the viewer. This object represents
 * a list of images that are associated by any arbitrary criteria being thus content agnostic. Besides the
 * main attributes (images and uid) it allows additional attributes to be appended to it (currently
 * indiscriminately, but this should be changed).
 */
class ImageSet {
  private rawImages;

  constructor(images) {
    if (Array.isArray(images) !== true) {
      throw new Error('ImageSet expects an array of images');
    }

    // @property "rawImages"
    Object.defineProperty(this, 'rawImages', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: images,
    });

    // @property "uid"
    Object.defineProperty(this, 'uid', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: guid(), // Unique ID of the instance
    });
  }

  get images(): any {
    /**
     * Extensions can create arbitrary imagesMapper functions to filter/map
     * these metadata. For example to only return the first 300 slices
     * of a large volume, the below can be run in a command.
     *
     * const ds = services.DisplaySetService.getDisplaySetByUID(displaySetUID)
     * ds.sortByImagePositionPatient()
     * ds.setAttribute('imagesMapper', (ds)=> ds.slice(0, 300))
     * displaySetService.setDisplaySetMetadataInvalidated(displaySetUID)
     */
    const imagesMapper = this.getAttribute('imagesMapper');
    if (
      !this.getAttribute('isMultiFrame') &&
      imagesMapper &&
      imagesMapper instanceof Function
    ) {
      return imagesMapper(this.rawImages);
    }
    return this.rawImages;
  }

  getUID() {
    return this.uid;
  }

  setAttribute(attribute, value) {
    this[attribute] = value;
  }

  getAttribute(attribute) {
    return this[attribute];
  }

  setAttributes(attributes) {
    if (typeof attributes === OBJECT && attributes !== null) {
      const imageSet = this,
        hasOwn = Object.prototype.hasOwnProperty;
      for (const attribute in attributes) {
        if (hasOwn.call(attributes, attribute)) {
          imageSet[attribute] = attributes[attribute];
        }
      }
    }
  }

  getNumImages = () => this.rawImages.length;

  getImage(index) {
    return this.rawImages[index];
  }

  sortBy(sortingCallback) {
    return this.rawImages.sort(sortingCallback);
  }

  sortByImagePositionPatient() {
    const images = this.rawImages;
    const instance0 = metadataProvider.getInstance(images[0].imageId);
    const referenceImagePositionPatient = instance0.ImagePositionPatient;
    const ImageOrientationPatient = instance0.ImageOrientationPatient;
    const refIppVec = new Vector3(
      referenceImagePositionPatient[0],
      referenceImagePositionPatient[1],
      referenceImagePositionPatient[2]
    );
    const scanAxisNormal = new Vector3(
      ImageOrientationPatient[0],
      ImageOrientationPatient[1],
      ImageOrientationPatient[2]
    ).cross(
      new Vector3(
        ImageOrientationPatient[3],
        ImageOrientationPatient[4],
        ImageOrientationPatient[5]
      )
    );
    const distanceImagePairs = images.map(function(image) {
      const instance = metadataProvider.getInstance(image.imageId);
      const eachInstanceImageOrientationPatient =
        instance.ImageOrientationPatient;
      const ippVec = new Vector3(eachInstanceImageOrientationPatient);
      const positionVector = refIppVec.clone().sub(ippVec);
      const distance = positionVector.dot(scanAxisNormal);
      return {
        distance,
        image,
      };
    });
    distanceImagePairs.sort(function(a, b) {
      return b.distance - a.distance;
    });
    const sortedImages = distanceImagePairs.map(a => a.image);
    images.sort(function(a, b) {
      return sortedImages.indexOf(a) - sortedImages.indexOf(b);
    });
  }
}

export default ImageSet;
