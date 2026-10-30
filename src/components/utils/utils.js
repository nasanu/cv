export function deBounce(func, timeFrame) {
  let lastTime = 0;
  return function () {
    const now = new Date();
    if (now - lastTime >= timeFrame) {
      func();
      lastTime = now;
    }
  };
}

export function showCode(code) {
  return JSON.stringify(code).replaceAll("\\", "").slice(1, -1);
}
