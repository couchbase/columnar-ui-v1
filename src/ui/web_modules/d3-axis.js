var t=Array.prototype.slice;function n(t){return t}function r(t){return"translate("+(t+.5)+",0)"}function e(t){return"translate(0,"+(t+.5)+")"}function i(t){return function(n){return+t(n)}}function a(t){var n=Math.max(0,t.bandwidth()-1)/2;return t.round()&&(n=Math.round(n)),function(r){return+t(r)+n}}function u(){return!this.__axis}function o(o,c){var l=[],s=null,f=null,d=6,m=6,h=3,p=1===o||4===o?-1:1,g=4===o||2===o?"x":"y",k=1===o||3===o?r:e;function x(t){var r=null==s?c.ticks?c.ticks.apply(c,l):c.domain():s,e=null==f?c.tickFormat?c.tickFormat.apply(c,l):n:f,x=Math.max(d,0)+h,y=c.range(),M=+y[0]+.5,v=+y[y.length-1]+.5,_=(c.bandwidth?a:i)(c.copy()),A=t.selection?t.selection():t,F=A.selectAll(".domain").data([null]),V=A.selectAll(".tick").data(r,c).order(),z=V.exit(),H=V.enter().append("g").attr("class","tick"),b=V.select("line"),C=V.select("text");F=F.merge(F.enter().insert("path",".tick").attr("class","domain").attr("stroke","currentColor")),V=V.merge(H),b=b.merge(H.append("line").attr("stroke","currentColor").attr(g+"2",p*d)),C=C.merge(H.append("text").attr("fill","currentColor").attr(g,p*x).attr("dy",1===o?"0em":3===o?"0.71em":"0.32em")),t!==A&&(F=F.transition(t),V=V.transition(t),b=b.transition(t),C=C.transition(t),z=z.transition(t).attr("opacity",1e-6).attr("transform",(function(t){return isFinite(t=_(t))?k(t):this.getAttribute("transform")})),H.attr("opacity",1e-6).attr("transform",(function(t){var n=this.parentNode.__axis;return k(n&&isFinite(n=n(t))?n:_(t))}))),z.remove(),F.attr("d",4===o||2==o?m?"M"+p*m+","+M+"H0.5V"+v+"H"+p*m:"M0.5,"+M+"V"+v:m?"M"+M+","+p*m+"V0.5H"+v+"V"+p*m:"M"+M+",0.5H"+v),V.attr("opacity",1).attr("transform",(function(t){return k(_(t))})),b.attr(g+"2",p*d),C.attr(g,p*x).text(e),A.filter(u).attr("fill","none").attr("font-size",10).attr("font-family","sans-serif").attr("text-anchor",2===o?"start":4===o?"end":"middle"),A.each((function(){this.__axis=_}))}return x.scale=function(t){return arguments.length?(c=t,x):c},x.ticks=function(){return l=t.call(arguments),x},x.tickArguments=function(n){return arguments.length?(l=null==n?[]:t.call(n),x):l.slice()},x.tickValues=function(n){return arguments.length?(s=null==n?null:t.call(n),x):s&&s.slice()},x.tickFormat=function(t){return arguments.length?(f=t,x):f},x.tickSize=function(t){return arguments.length?(d=m=+t,x):d},x.tickSizeInner=function(t){return arguments.length?(d=+t,x):d},x.tickSizeOuter=function(t){return arguments.length?(m=+t,x):m},x.tickPadding=function(t){return arguments.length?(h=+t,x):h},x}function c(t){return o(1,t)}function l(t){return o(2,t)}function s(t){return o(3,t)}function f(t){return o(4,t)}export{s as axisBottom,f as axisLeft,l as axisRight,c as axisTop};
//# sourceMappingURL=d3-axis.js.map
