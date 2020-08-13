import {CollectionOptions} from '../common/collection-options.interface';

export interface GetDeploymentsOptions extends CollectionOptions {
  mineOnly?: boolean;
}