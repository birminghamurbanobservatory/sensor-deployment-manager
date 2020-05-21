export interface FeatureOfInterestClient {
  id?: string;
  label?: string;
  comment?: string;
  listed?: boolean;
  inCommonVocab?: boolean;
  createdBy?: string;
  belongsToDeployment?: string;
  location?: FeatureOfInterestLocation;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface FeatureOfInterestLocation {
  id?: string;
  geometry?: Geometry;
  centroid?: Geometry;
  height?: number;
  validAt?: Date;
}


interface Geometry {
 type: string;
 coordinates: any[];
}
