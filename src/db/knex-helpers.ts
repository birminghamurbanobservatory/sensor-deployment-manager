// e.g. the following array
// ['2T9-PYvw9L', '3vH8_oCIh0', '7F4jVZX1HF']
// is converted to the following string
// ('2T9-PYvw9L'), ('3vH8_oCIh0'), ('7F4jVZX1HF')
export function convertToValuesString(arr: string[]): string {

  if (arr.length === 0) throw new Error('arr cannot be empty when converting to a values string');

  const outputStr = `('${arr.join(`'), ('`)}')`;

  return outputStr;


}