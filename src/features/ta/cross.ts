// val1, val2 is array data, demonstrating an indicator line
// this function verifies if val1 crossover val2
export const crossover = (val1: string | any[], val2: string | any[]) => {
  return (
    val1[val1.length - 2] < val2[val2.length - 2] &&
    val1[val1.length - 1] >= val2[val2.length - 1]
  );
};

// val1, val2 is array data, demonstrating an indicator line
// this function verifies if val1 crossunnder val2

export const crossunder = (val1: string | any[], val2: string | any[]) => {
  return (
    val1[val1.length - 2] > val2[val2.length - 2] &&
    val1[val1.length - 1] <= val2[val2.length - 1]
  );
};

module.exports = {
  crossover: crossover,
  crossunder: crossunder,
};
