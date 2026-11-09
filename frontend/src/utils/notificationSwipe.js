export function swipeAxis(x,y){if(Math.max(Math.abs(x),Math.abs(y))<10)return null;return Math.abs(x)>Math.abs(y)*1.4?'horizontal':'vertical';}
export function swipeAction(x,axis){return axis==='horizontal'&&Math.abs(x)>=72?(x<0?'dismiss':'read'):null;}
