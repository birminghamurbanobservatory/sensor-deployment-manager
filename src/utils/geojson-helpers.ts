import centerOfMass from '@turf/center-of-mass';
import * as check from 'check-types';

export function calculateGeometryCentroid(geometry: {type: string; coordinates: any[]}): {lat: number; lng: number; height?: number} {
  const feature = {
    type: 'Feature',
    geometry
  };
  // Although @turf also has "center" and "centroid" functions, I found the "centerOfMass" function worked best. For example if your Feature was the USA the centerOfMass wouldn't put the pin in the middle of the pacific unlike the others that would be swayed by Hawaii. 
  const centre = centerOfMass(feature);
  const centroid: any = {
    lat: centre.geometry.coordinates[1],
    lng: centre.geometry.coordinates[0],
  };
  // Annoyingly none of these @turf functions take into account the height coordinate, and only every return x and y coordinates, so we'll need to do this manually.
  if (geometry.type === 'Point' && check.number(geometry.coordinates[2])) {
    centroid.height = geometry.coordinates[2];
  }
  // TODO: Add support for finding the centroid height for non-Point geometry's, e.g. Polygons.
  return centroid;
}