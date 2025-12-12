
function getRandomCode4Num() {
  const num = [Math.floor(Math.random()*10), Math.floor(Math.random()*10), Math.floor(Math.random()*10), Math.floor(Math.random()*10)];
  return num[0]*1000 + num[1]*100 + num[2]*10 + num[3] ;
}

export function getRandomCode(nbcar) {
    // TODO
    return getRandomCode4Num();

}