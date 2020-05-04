import {ObservationApp} from '../observation/observation-app.class';
import {ContextApp} from './context-app.class';
import {cloneDeep, isMatch} from 'lodash';
import * as check from 'check-types';


export function giveObsContext(observation: ObservationApp, context: ContextApp): ObservationApp {

  const merged = cloneDeep(observation);

  const easyMergeKeys = ['hasDeployment', 'hostedByPath'];
  easyMergeKeys.forEach((key) => {
    if (check.not.assigned(observation[key]) && check.assigned(context[key])) {
      merged[key] = context[key];
    }
  });

  const observedPropertyInObservation = observation.observedProperty;

  let configToMerge;

  if (context.config.length > 0) {

    if (observedPropertyInObservation) {

      const matchingConfig = context.config.find((config) => {
        return config.observedProperty === observedPropertyInObservation;
      });

      if (matchingConfig) {
        configToMerge = matchingConfig;
      } 
      // Crucially if the observation does have an observedProperty set, but there is no matching config, we DON'T want to apply the default config here, as you risk adding completely the wrong units, procedures, etc.... 

    } else {

      // Get the config with priority instead
      const priorityConfig = context.config.find((config) => {
        return config.hasPriority;
      });
      configToMerge = priorityConfig;

    }

  }

  if (configToMerge) {

    const complexMergeKeys = ['observedProperty', 'hasFeatureOfInterest', 'usedProcedures', 'disciplines'];

    complexMergeKeys.forEach((key) => {
      // Add the config property if it hasn't already been set in the observation.
      if (configToMerge[key] && !observation[key]) {
        merged[key] = configToMerge[key];
      }
    });

    // Need to handle properties that go in hasResult differently
    const hasResultMergeKeys = ['unit'];

    hasResultMergeKeys.forEach((key) => {
      // Add the config property if it hasn't already been set in the observation.
      if (configToMerge[key] && !observation.hasResult[key]) {
        merged.hasResult[key] = configToMerge[key];
      }
    });

  }

  return merged;

}