import * as check from 'check-types';

export function whereToMongoFind(where: any): any {

  if (check.not.object(where)) {
    throw new Error('where argument must be an object');
  }

  const find: any = {};

  const mappings = {
    exists: '$exists',
    in: '$in',
    gte: '$gte',
    gt: '$gt',
    lte: '$lte',
    lt: '$lt',
    begins: '$regex',
    includes: '' // this one's a bit of a special case
  };

  Object.keys(where).forEach((propKey) => {

    if (propKey === 'search') {
      // search is a special case because it's not the name of resource field (unlike resultTime, description, etc), instead it applies to multiple fields, i.e. those defined in the index in the relevant .model.ts file.
      find.$text = {$search: where[propKey]}; // docs: https://docs.mongodb.com/manual/text-search/
    } else if (check.object(where[propKey])) {

      const propObj = where[propKey];
      Object.keys(propObj).forEach((opKey) => {

        if (check.assigned(mappings[opKey])) {
          const findKey = mappings[opKey];
          if (check.not.assigned(find[propKey])) {
            find[propKey] = {};
          } 
          if (opKey === 'begins') {
            find[propKey][findKey] = `^${propObj[opKey]}`;
          } else if (opKey === 'includes') {
            find[propKey] = propObj[opKey];
          } else {
            find[propKey][findKey] = propObj[opKey];
          }
        } else {
          throw new Error(`Unknown key for where object called: '${opKey}'`);
        }

      });

    } else {
      find[propKey] = where[propKey];
    }

  });

  // Account for _id
  if (find.id) {
    find._id = find.id;
    delete find.id;
  }  

  return find;

}