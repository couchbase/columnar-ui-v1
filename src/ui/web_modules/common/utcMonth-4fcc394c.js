import{n,g as t,h as e,i as u}from"./utcYear-c83ede8f.js";var o=n((function(){}),(function(n,t){n.setTime(+n+t)}),(function(n,t){return t-n}));o.every=function(t){return t=Math.floor(t),isFinite(t)&&t>0?t>1?n((function(n){n.setTime(Math.floor(n/t)*t)}),(function(n,e){n.setTime(+n+e*t)}),(function(n,e){return(e-n)/t})):o:null};var i=o.range,s=n((function(n){n.setTime(n-n.getMilliseconds())}),(function(n,e){n.setTime(+n+e*t)}),(function(n,e){return(e-n)/t}),(function(n){return n.getUTCSeconds()})),r=s.range,c=n((function(n){n.setTime(n-n.getMilliseconds()-n.getSeconds()*t)}),(function(n,t){n.setTime(+n+t*e)}),(function(n,t){return(t-n)/e}),(function(n){return n.getMinutes()})),a=c.range,f=n((function(n){n.setTime(n-n.getMilliseconds()-n.getSeconds()*t-n.getMinutes()*e)}),(function(n,t){n.setTime(+n+t*u)}),(function(n,t){return(t-n)/u}),(function(n){return n.getHours()})),g=f.range,T=n((function(n){n.setDate(1),n.setHours(0,0,0,0)}),(function(n,t){n.setMonth(n.getMonth()+t)}),(function(n,t){return t.getMonth()-n.getMonth()+12*(t.getFullYear()-n.getFullYear())}),(function(n){return n.getMonth()})),l=T.range,M=n((function(n){n.setUTCSeconds(0,0)}),(function(n,t){n.setTime(+n+t*e)}),(function(n,t){return(t-n)/e}),(function(n){return n.getUTCMinutes()})),h=M.range,m=n((function(n){n.setUTCMinutes(0,0,0)}),(function(n,t){n.setTime(+n+t*u)}),(function(n,t){return(t-n)/u}),(function(n){return n.getUTCHours()})),C=m.range,U=n((function(n){n.setUTCDate(1),n.setUTCHours(0,0,0,0)}),(function(n,t){n.setUTCMonth(n.getUTCMonth()+t)}),(function(n,t){return t.getUTCMonth()-n.getUTCMonth()+12*(t.getUTCFullYear()-n.getUTCFullYear())}),(function(n){return n.getUTCMonth()})),d=U.range;export{s as a,f as b,T as c,M as d,m as e,U as f,a as g,g as h,l as i,h as j,C as k,d as l,i as m,r as s,c as t,o as u};
//# sourceMappingURL=utcMonth-4fcc394c.js.map
