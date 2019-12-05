import {Observation} from './observation.class';
import {ToAdd} from './context-app.class';
import {cloneDeep, isMatch} from 'lodash';
import * as check from 'check-types';


export function giveObsContext(observation: Observation, toAdd: ToAdd): Observation {

  const merged = cloneDeep(observation);

  const easyMergeKeys = ['inDeployments', 'hostedByPath'];
  const complexMergeKeys = ['observedProperty', 'hasFeatureOfInterest', 'usedProcedures'];

  easyMergeKeys.forEach((key) => {
    if (check.not.assigned(observation[key]) && check.assigned(toAdd[key])) {
      merged[key] = toAdd[key];
    }
  });

  // 1. If there's only a value for this toAdd property (i.e. no ifs) then apply these first.
  complexMergeKeys.forEach((key) => {
    // Only add these properties if they're not already set.
    if (check.not.assigned(observation[key]) && check.assigned(toAdd[key]) && check.assigned(toAdd[key].value)) {
      merged[key] = toAdd[key].value;
    }
  });

  // 2. Now apply some IFs
  complexMergeKeys.forEach((key) => {
    // Only add these properties if they're not already set.
    if (check.not.assigned(observation[key]) && check.assigned(toAdd[key]) && check.nonEmptyArray(toAdd[key].ifs)) {
      toAdd[key].ifs.forEach((ifObj) => {
        if (isMatch(merged, ifObj.if)) {
          merged[key] = ifObj.value;
        }
      });
      // Do the properties in the if object match what's already been set in 'merged'.
    }
  });  

  // 3. Now if the IFs didn't find anything they could apply, then we can apply the value if there is one.
  complexMergeKeys.forEach((key) => {
    if (check.not.assigned(merged[key]) && check.assigned(toAdd[key]) && check.assigned(toAdd[key].value)) {
      merged[key] = toAdd[key].value;
    }
  });


  // TODO: should I be concatinating the userProcedures array?

  return merged;

}