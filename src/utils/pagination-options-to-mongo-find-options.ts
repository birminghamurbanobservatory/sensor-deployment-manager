import {PaginationOptions} from '../components/common/pagination-options.interface';
import * as check from 'check-types';

export function paginationOptionsToMongoFindOptions(paginationOptions: PaginationOptions): any {

  const sortObj = {};
  const sortOrderNumeric = paginationOptions.sortOrder === 'desc' ? -1 : 1;
  const sortKey = (!paginationOptions.sortBy || paginationOptions.sortBy === 'id') ? '_id' : paginationOptions.sortBy;
  sortObj[sortKey] = sortOrderNumeric;

  const findOptions: any = {
    sort: sortObj,
    skip: check.assigned(paginationOptions.offset) ? paginationOptions.offset : 0
  };

  const limitAssigned = check.assigned(paginationOptions.limit);
  if (limitAssigned) {
    findOptions.limit = paginationOptions.limit;
  }

  return findOptions;

}