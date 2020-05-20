import {retrieveAllPropertyIdsFromCollection} from './collection-helpers';


describe('Testing retrieveAllPropertyIdsFromCollection', () => {

  test('Can handle a collection object property that is a string', () => {

    const collection = [
      {deployment: 'id-1'},
      {deployment: 'id-2'},
      {deployment: 'id-3'},
    ];

    const key = 'deployment';

    const expected = ['id-1', 'id-2', 'id-3'];

    const ids = retrieveAllPropertyIdsFromCollection(collection, key);
    expect(ids).toEqual(expected);

  });


  test('Can handle a collection object property that is an array', () => {

    const collection = [
      {deployments: ['id-1']},
      {deployments: ['id-2']},
      {deployments: ['id-3']},
    ];

    const key = 'deployments';

    const expected = ['id-1', 'id-2', 'id-3'];

    const ids = retrieveAllPropertyIdsFromCollection(collection, key);
    expect(ids).toEqual(expected);

  });


  test('Can handle duplicate ids in arrays', () => {

    const collection = [
      {deployments: ['id-1']},
      {deployments: ['id-1', 'id-2']},
      {deployments: ['id-3']},
    ];

    const key = 'deployments';

    const expected = ['id-1', 'id-2', 'id-3'];

    const ids = retrieveAllPropertyIdsFromCollection(collection, key);
    expect(ids).toEqual(expected);

  });



});