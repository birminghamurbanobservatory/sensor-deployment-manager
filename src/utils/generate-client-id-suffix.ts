
export function generateClientIdSuffix(): string {

  const numberChoices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const letterChoices = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'k', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

  return `${selectRandomItem(letterChoices)}${selectRandomItem(numberChoices)}${selectRandomItem(letterChoices)}`;

}


function selectRandomItem(arr): any {
  return arr[Math.floor(Math.random() * arr.length)];
}
