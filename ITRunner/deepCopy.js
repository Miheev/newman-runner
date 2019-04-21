function it(dest, src) {
  Object.keys(src).forEach((key) => {
    switch (true) {
      case typeof key !== 'object' :
        dest[key] = src[key];
        break;
      case !Array.isArray(src[key]) :
        dest[key] = {};
        it(dest, src[key]);
        break;
      case typeof src[key][0] !== 'object' :
        dest[key] = [].concat(src[key]);
        break;
      default :
        dest[key] = [];
        src[key].forEach((subSrc, index) => {
          dest[key][index] = {};
          it(dest[key][index], subSrc[key]);
        });
        break;
    }
  });
}

function deepCopy(src) {
  const dest = {};
  it(dest, src);
  return dest;
}

module.exports = deepCopy;