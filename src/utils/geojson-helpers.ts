import centerOfMass from '@turf/center-of-mass';
import * as check from 'check-types';



export function calculateCentroidFromGeometry(geometry: {type: string; coordinates: any[]}): {type: string; coordinates: any[]} {
  const feature = {
    type: 'Feature',
    geometry
  };
  // Although @turf also has "center" and "centroid" functions, I found the "centerOfMass" function worked best. For example if your Feature was the USA the centerOfMass wouldn't put the pin in the middle of the pacific unlike the others that would be swayed by Hawaii. 
  const centroid = centerOfMass(feature);
  // Note: it will ignore any Z coordinates 
  return centroid.geometry;
}






export function centroidToGeometry(centroid: {lat: number; lng: number; height?: number}): {type: string; coordinates: any[]} {

  const geometry = {
    type: 'Point',
    coordinates: [centroid.lng, centroid.lat]
  };

  if (check.assigned(centroid.height)) {
    geometry.coordinates.push(centroid.height);
  }

  return geometry;

}