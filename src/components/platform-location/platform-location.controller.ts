import * as platformLocationService from './platform-location.service';
import {PlatformLocationClient} from './platform-location-client';


export async function getPlatformLocations(platformId: string): Promise<PlatformLocationClient[]> {

  const locations = await platformLocationService.getPlatformLocations(platformId);

  return locations.map(platformLocationService.platformLocationAppToClient);

}