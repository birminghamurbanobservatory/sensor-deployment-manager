import {ObservationApp} from '../observation/observation-app.class';
import {ContextApp} from './context-app.class';
import {cloneDeep, isMatch} from 'lodash';
import * as check from 'check-types';


export function giveObsContext(observation: ObservationApp, context: ContextApp): ObservationApp {

  const merged = cloneDeep(observation);

  const easyMergeKeys = ['inDeployments', 'hostedByPath'];
  const complexMergeKeys = ['observedProperty', 'hasFeatureOfInterest', 'usedProcedures'];

  easyMergeKeys.forEach((key) => {
    if (check.not.assigned(observation[key]) && check.assigned(context[key])) {
      merged[key] = context[key];
    }
  });

  // Step 1. Apply any defaults for properties that don't also have 'when' defaults
  complexMergeKeys.forEach((key) => {

    // Only add these defaults if the given property isn't already set.
    if (check.not.assigned(observation[key])) {

      const defaultsForThisKey = context.defaults.filter((def) => {
        return check.assigned(def[key]);
      });

      const whenDefaultsForThisKey = defaultsForThisKey.filter((def) => {
        return check.assigned(def.when);
      });

      if (whenDefaultsForThisKey.length === 0) {
        defaultsForThisKey.forEach((def) => {
          merged[key] = def[key];
        });
      }

    }

  });

  // Step 2. Now apply any defaults with a matching 'when' clause 
  complexMergeKeys.forEach((key) => {

    // Only add these defaults if the given property isn't already set.
    if (check.not.assigned(observation[key])) {

      const whenDefaultsForThisKey = context.defaults.filter((def) => {
        return check.assigned(def[key]) && check.assigned(def.when);
      });

      whenDefaultsForThisKey.forEach((def) => {
        if (isMatch(merged, def.when)) {
          merged[key] = def[key];
        }
      });

    }

  });  

  // Step 3. Now if the whens didn't find anything they could apply, then we can apply the non-when defaults if available.
  complexMergeKeys.forEach((key) => {

    // Only add these defaults if the given property isn't already set.
    if (check.not.assigned(merged[key])) {

      const defaultsWithoutWhenForThisKey = context.defaults.filter((def) => {
        return check.assigned(def[key]) && check.not.assigned(def.when);
      });

      defaultsWithoutWhenForThisKey.forEach((def) => {
        merged[key] = def[key];
      });

    }

  });


  // TODO: should I be concatinating the userProcedures array?

  return merged;

}