import {buildNestedHostsArray, buildNestedPlatformsArray} from './platform.service';

describe('Testing buildNestedHostsArray function', () => {

  test('It can process a complicated set of platforms and sensors', () => {
    
    const topPlatformId = 'grand-parent-platform';

    const subPlatforms = [
      {
        id: 'parent-platform-1',
        name: 'Parent Platform 1',
        isHostedBy: 'grand-parent-platform',
        hostedByPath: ['grand-parent-platform'],
        topPlatform: 'grand-parent-platform'
      },
      {
        id: 'parent-platform-2',
        name: 'Parent Platform 2',
        isHostedBy: 'grand-parent-platform',
        hostedByPath: ['grand-parent-platform'],
        topPlatform: 'grand-parent-platform'
      },
      {
        id: 'child-platform-1',
        name: 'Child Platform 1',
        isHostedBy: 'parent-platform-2',
        hostedByPath: ['grand-parent-platform', 'parent-platform-2'],
        topPlatform: 'grand-parent-platform'
      }
    ];

    const sensors = [
      {
        id: 'sensor-1',
        isHostedBy: 'grand-parent-platform'
      },
      {
        id: 'sensor-2',
        isHostedBy: 'parent-platform-1'
      },
      {
        id: 'sensor-3',
        isHostedBy: 'parent-platform-1'
      },
      {
        id: 'sensor-4',
        isHostedBy: 'child-platform-1'
      }
    ];

    const expected = [
      {
        id: 'sensor-1',
        isHostedBy: 'grand-parent-platform',
        type: 'sensor'
      },
      {
        id: 'parent-platform-1',
        name: 'Parent Platform 1',
        isHostedBy: 'grand-parent-platform',
        hostedByPath: ['grand-parent-platform'],
        topPlatform: 'grand-parent-platform',
        type: 'platform',
        hosts: [
          {
            id: 'sensor-2',
            isHostedBy: 'parent-platform-1',
            type: 'sensor'
          },
          {
            id: 'sensor-3',
            isHostedBy: 'parent-platform-1',
            type: 'sensor'
          },
        ]
      },
      {
        id: 'parent-platform-2',
        name: 'Parent Platform 2',
        isHostedBy: 'grand-parent-platform',
        hostedByPath: ['grand-parent-platform'],
        topPlatform: 'grand-parent-platform',
        type: 'platform',
        hosts: [
          {
            id: 'child-platform-1',
            name: 'Child Platform 1',
            isHostedBy: 'parent-platform-2',
            hostedByPath: ['grand-parent-platform', 'parent-platform-2'],
            topPlatform: 'grand-parent-platform',
            type: 'platform',
            hosts: [
              {
                id: 'sensor-4',
                isHostedBy: 'child-platform-1',
                type: 'sensor'
              }
            ]
          }
        ]
      }
    ];

    const hostsArray = buildNestedHostsArray(topPlatformId, subPlatforms, sensors);

    expect(hostsArray).toEqual(expected);

  });



  test('It throws an error when a platform is present that does not belong in this ancestry', () => {

    const topPlatformId = 'grand-parent-platform';

    const subPlatforms = [
      {
        id: 'parent-platform-1',
        name: 'Parent Platform 1',
        isHostedBy: 'grand-parent-platform'
      },
      {
        id: 'parent-platform-2',
        name: 'Parent Platform 2',
        isHostedBy: 'some-other-grand-parent-platform' // <-- This is the bit that should cause the error
      }
    ];
    
    const sensors = [
      {
        id: 'sensor-1',
        isHostedBy: 'grand-parent-platform'
      }
    ];

    expect(() => {
      buildNestedHostsArray(topPlatformId, subPlatforms, sensors);
    }).toThrowError();

  });


  test('Can handle a situation when there are no sub-platforms and no sensors', () => {

    const topPlatformId = 'platform-1';
    const subPlatforms = [];
    const sensors = [];

    const expected = [];

    const hostsArray = buildNestedHostsArray(topPlatformId, subPlatforms, sensors);

    expect(hostsArray).toEqual(expected);

  });



});




describe('Testing buildNestedPlatformsArray function', () => {

  test('Can process a normal set of platforms and sensors', () => {
    
    const allPlatforms = [
      {
        id: 'grand-parent-platform',
        name: 'GrandParent Platform',
        topPlatform: 'grand-parent-platform'
      },
      {
        id: 'parent-platform-1',
        name: 'Parent Platform 1',
        isHostedBy: 'grand-parent-platform',
        hostedByPath: ['grand-parent-platform'],
        topPlatform: 'grand-parent-platform'
      },
      {
        id: 'parent-platform-2',
        name: 'Parent Platform 2',
        isHostedBy: 'grand-parent-platform',
        hostedByPath: ['grand-parent-platform'],
        topPlatform: 'grand-parent-platform'
      },
      {
        id: 'child-platform-1',
        name: 'Child Platform 1',
        isHostedBy: 'parent-platform-2',
        hostedByPath: ['grand-parent-platform', 'parent-platform-2'],
        topPlatform: 'grand-parent-platform'
      }
    ];

    const allSensors = [
      {
        id: 'sensor-1',
        isHostedBy: 'grand-parent-platform'
      },
      {
        id: 'sensor-2',
        isHostedBy: 'parent-platform-1'
      },
      {
        id: 'sensor-3',
        isHostedBy: 'parent-platform-1'
      },
      {
        id: 'sensor-4',
        isHostedBy: 'child-platform-1'
      }
    ];

    const expected = [
      {
        id: 'grand-parent-platform',
        name: 'GrandParent Platform',
        topPlatform: 'grand-parent-platform',
        hosts: [
          {
            id: 'sensor-1',
            isHostedBy: 'grand-parent-platform',
            type: 'sensor'
          },
          {
            id: 'parent-platform-1',
            name: 'Parent Platform 1',
            isHostedBy: 'grand-parent-platform',
            hostedByPath: ['grand-parent-platform'],
            topPlatform: 'grand-parent-platform',
            type: 'platform',
            hosts: [
              {
                id: 'sensor-2',
                isHostedBy: 'parent-platform-1',
                type: 'sensor'
              },
              {
                id: 'sensor-3',
                isHostedBy: 'parent-platform-1',
                type: 'sensor'
              },
            ]
          },
          {
            id: 'parent-platform-2',
            name: 'Parent Platform 2',
            isHostedBy: 'grand-parent-platform',
            hostedByPath: ['grand-parent-platform'],
            topPlatform: 'grand-parent-platform',
            type: 'platform',
            hosts: [
              {
                id: 'child-platform-1',
                name: 'Child Platform 1',
                isHostedBy: 'parent-platform-2',
                hostedByPath: ['grand-parent-platform', 'parent-platform-2'],
                topPlatform: 'grand-parent-platform',
                type: 'platform',
                hosts: [
                  {
                    id: 'sensor-4',
                    isHostedBy: 'child-platform-1',
                    type: 'sensor'
                  }
                ]
              }
            ]
          }
        ]  
      }  
    ];

    const nestedPlatformsArray = buildNestedPlatformsArray(allPlatforms, allSensors);
    expect(nestedPlatformsArray).toEqual(expected);

  });


  test('Can handle a situation when there are no sub-platforms and no sensors', () => {

    const allPlatforms = [];
    const allSensors = [];
    const expected = [];
    const nestedPlatformsArray = buildNestedPlatformsArray(allPlatforms, allSensors);
    expect(nestedPlatformsArray).toEqual(expected);

  });


});