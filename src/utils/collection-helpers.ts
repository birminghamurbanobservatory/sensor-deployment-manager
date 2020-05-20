import * as check from 'check-types';
import {concat, uniq} from 'lodash';


export function retrieveAllPropertyIdsFromCollection(collection: any[], key: string): string[] {

  const ids = collection.reduce((idsSoFar, item): string[] => {
    let updatedIdsSoFar = idsSoFar;
    if (check.assigned(item[key])) {
      updatedIdsSoFar = concat(idsSoFar, item[key]);
    }
    return updatedIdsSoFar;
  }, []);

  const uniqueIds: any = uniq(ids);

  return uniqueIds;

}
