export interface SensorConfigClient {
  hasPriority?: boolean;
  observedProperty?: string;
  unit?: string;
  hasFeatureOfInterest?: string;
  disciplines?: string[];
  usedProcedures?: string[];
}