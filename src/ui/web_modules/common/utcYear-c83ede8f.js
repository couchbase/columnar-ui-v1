var e=new Date,t=new Date;function n(r,a,u,o){function s(e){return r(e=0===arguments.length?new Date:new Date(+e)),e}return s.floor=function(e){return r(e=new Date(+e)),e},s.ceil=function(e){return r(e=new Date(e-1)),a(e,1),r(e),e},s.round=function(e){var t=s(e),n=s.ceil(e);return e-t<n-e?t:n},s.offset=function(e,t){return a(e=new Date(+e),null==t?1:Math.floor(t)),e},s.range=function(e,t,n){var u,o=[];if(e=s.ceil(e),n=null==n?1:Math.floor(n),!(e<t&&n>0))return o;do{o.push(u=new Date(+e)),a(e,n),r(e)}while(u<e&&e<t);return o},s.filter=function(e){return n((function(t){if(t>=t)for(;r(t),!e(t);)t.setTime(t-1)}),(function(t,n){if(t>=t)if(n<0)for(;++n<=0;)for(;a(t,-1),!e(t););else for(;--n>=0;)for(;a(t,1),!e(t););}))},u&&(s.count=function(n,a){return e.setTime(+n),t.setTime(+a),r(e),r(t),Math.floor(u(e,t))},s.every=function(e){return e=Math.floor(e),isFinite(e)&&e>0?e>1?s.filter(o?function(t){return o(t)%e==0}:function(t){return s.count(0,t)%e==0}):s:null}),s}var r=1e3,a=6e4,u=36e5,o=n((function(e){e.setHours(0,0,0,0)}),(function(e,t){e.setDate(e.getDate()+t)}),(function(e,t){return(t-e-6e4*(t.getTimezoneOffset()-e.getTimezoneOffset()))/864e5}),(function(e){return e.getDate()-1})),s=o.range;function f(e){return n((function(t){t.setDate(t.getDate()-(t.getDay()+7-e)%7),t.setHours(0,0,0,0)}),(function(e,t){e.setDate(e.getDate()+7*t)}),(function(e,t){return(t-e-6e4*(t.getTimezoneOffset()-e.getTimezoneOffset()))/6048e5}))}var i=f(0),l=f(1),c=f(2),g=f(3),T=f(4),D=f(5),C=f(6),U=i.range,F=l.range,Y=c.range,h=g.range,M=T.range,v=D.range,w=C.range,H=n((function(e){e.setMonth(0,1),e.setHours(0,0,0,0)}),(function(e,t){e.setFullYear(e.getFullYear()+t)}),(function(e,t){return t.getFullYear()-e.getFullYear()}),(function(e){return e.getFullYear()}));H.every=function(e){return isFinite(e=Math.floor(e))&&e>0?n((function(t){t.setFullYear(Math.floor(t.getFullYear()/e)*e),t.setMonth(0,1),t.setHours(0,0,0,0)}),(function(t,n){t.setFullYear(t.getFullYear()+n*e)})):null};var m=H.range,y=n((function(e){e.setUTCHours(0,0,0,0)}),(function(e,t){e.setUTCDate(e.getUTCDate()+t)}),(function(e,t){return(t-e)/864e5}),(function(e){return e.getUTCDate()-1})),z=y.range;function O(e){return n((function(t){t.setUTCDate(t.getUTCDate()-(t.getUTCDay()+7-e)%7),t.setUTCHours(0,0,0,0)}),(function(e,t){e.setUTCDate(e.getUTCDate()+7*t)}),(function(e,t){return(t-e)/6048e5}))}var d=O(0),p=O(1),x=O(2),b=O(3),j=O(4),k=O(5),q=O(6),A=d.range,B=p.range,E=x.range,G=b.range,I=j.range,J=k.range,K=q.range,L=n((function(e){e.setUTCMonth(0,1),e.setUTCHours(0,0,0,0)}),(function(e,t){e.setUTCFullYear(e.getUTCFullYear()+t)}),(function(e,t){return t.getUTCFullYear()-e.getUTCFullYear()}),(function(e){return e.getUTCFullYear()}));L.every=function(e){return isFinite(e=Math.floor(e))&&e>0?n((function(t){t.setUTCFullYear(Math.floor(t.getUTCFullYear()/e)*e),t.setUTCMonth(0,1),t.setUTCHours(0,0,0,0)}),(function(t,n){t.setUTCFullYear(t.getUTCFullYear()+n*e)})):null};var N=L.range;export{m as A,z as B,A as C,B as D,x as E,E as F,b as G,G as H,I,k as J,J as K,q as L,K as M,N,H as a,d as b,L as c,p as d,j as e,T as f,r as g,a as h,u as i,s as j,U as k,F as l,l as m,n,c as o,Y as p,h as q,M as r,i as s,o as t,y as u,D as v,g as w,v as x,C as y,w as z};
//# sourceMappingURL=utcYear-c83ede8f.js.map
