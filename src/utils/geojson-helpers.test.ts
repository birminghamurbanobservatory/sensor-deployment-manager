import {calculateGeometryCentroid, centroidToGeometry} from './geojson-helpers';


describe('Testing of calculateGeometryCentroid function', () => {

  test('Find correct centroid of Point geometry', () => {
    const geometry = {
      type: 'Point',
      coordinates: [-1.9, 52.5]
    };
    const expected = {
      lat: 52.5,
      lng: -1.9
    };
    const centroid = calculateGeometryCentroid(geometry);
    expect(centroid).toEqual(expected);
  });

  test('Find correct centroid of Point geometry with height', () => {
    const geometry = {
      type: 'Point',
      coordinates: [-1.9, 52.5, 100]
    };
    const expected = {
      lat: 52.5,
      lng: -1.9,
      height: 100
    };
    const centroid = calculateGeometryCentroid(geometry);
    expect(centroid).toEqual(expected);
  });

  test('Find correct centroid of a polygon geometry', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[10, 10], [10, 20], [20, 20], [20, 10], [10, 10]]]
    };
    const expected = {
      lat: 15,
      lng: 15,
    };
    const centroid = calculateGeometryCentroid(geometry);
    expect(centroid).toEqual(expected);
  });

});




describe('Testing centroidToGeometry function', () => {

  test('Converts a centroid (with height) as expected', () => {
    
    const centroid = {lat: 52.5, lng: -1.9, height: 2};
    const expected = {
      type: 'Point',
      coordinates: [-1.9, 52.5, 2]
    };
    const geometry = centroidToGeometry(centroid);
    expect(geometry).toEqual(expected);

  });


  test('Converts a centroid (without height) as expected', () => {
    
    const centroid = {lat: 52.5, lng: -1.9};
    const expected = {
      type: 'Point',
      coordinates: [-1.9, 52.5]
    };
    const geometry = centroidToGeometry(centroid);
    expect(geometry).toEqual(expected);

  });

});