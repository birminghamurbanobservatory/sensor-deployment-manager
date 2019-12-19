import {LocationApp} from './location-app.class';

export class PlatformLocationClient {
  public id?: string; // i.e. of the location, not the platform location
  public date?: string | object;
  type: string;
  coordinates: any;
}