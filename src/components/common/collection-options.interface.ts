import {PaginationOptions} from './pagination-options.interface';

export interface CollectionOptions extends PaginationOptions {
  includeDeleted?: boolean;
}