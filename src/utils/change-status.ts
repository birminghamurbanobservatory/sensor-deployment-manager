import * as check from 'check-types';


interface ChangeStatus {
  wasSet?: boolean;
  settingNow?: boolean;
  unsettingNow?: boolean;
  willBeSet?: boolean;
  isChanging?: boolean;
  valueWillBe?: any;
}


export function calculateChangeStatus(property: string, oldObj: any, updates: any): ChangeStatus {

  const status: ChangeStatus = {};

  status.wasSet = check.assigned(oldObj[property]);
  status.settingNow = check.assigned(updates[property]);
  status.unsettingNow = check.null(updates[property]);
  status.willBeSet = status.settingNow || (status.wasSet && !status.unsettingNow);
  status.isChanging = (status.settingNow || status.unsettingNow) && (oldObj[property] !== updates[property]) && !(check.not.assigned(oldObj[property]) && status.unsettingNow);

  if (status.willBeSet) {
    status.valueWillBe = updates[property] || oldObj[property];
  }

  return status;

}