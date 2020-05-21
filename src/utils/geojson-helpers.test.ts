import {calculateCentroidFromGeometry, centroidToGeometry} from './geojson-helpers';


describe('Testing of calculateCentroidFromGeometry function', () => {


  test('Find correct centroid of Point geometry', () => {
    const geometry = {
      type: 'Point',
      coordinates: [-1.9, 52.5]
    };
    const expected = {
      type: 'Point',
      coordinates: [-1.9, 52.5]
    };
    const centroid = calculateCentroidFromGeometry(geometry);
    expect(centroid).toEqual(expected);
  });


  test('Find correct centroid of a linestring geometry', () => {
    const geometry = {
      type: 'LineString',
      coordinates: [[10, 10], [20, 20], [30, 30]]
    };
    const expected = {
      type: 'Point',
      coordinates: [20, 20]
    };
    const centroid = calculateCentroidFromGeometry(geometry);
    expect(centroid).toEqual(expected);
  });


  test('Find correct centroid of a polygon geometry', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]]
    };
    const expected = {
      type: 'Point',
      coordinates: [15, 15]
    };
    const centroid = calculateCentroidFromGeometry(geometry);
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