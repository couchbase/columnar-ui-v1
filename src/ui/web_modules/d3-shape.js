var t=Math.PI,i=2*t,n=i-1e-6;function e(){this._x0=this._y0=this._x1=this._y1=null,this._=""}function s(){return new e}function h(t){return function(){return t}}e.prototype=s.prototype={constructor:e,moveTo:function(t,i){this._+="M"+(this._x0=this._x1=+t)+","+(this._y0=this._y1=+i)},closePath:function(){null!==this._x1&&(this._x1=this._x0,this._y1=this._y0,this._+="Z")},lineTo:function(t,i){this._+="L"+(this._x1=+t)+","+(this._y1=+i)},quadraticCurveTo:function(t,i,n,e){this._+="Q"+ +t+","+ +i+","+(this._x1=+n)+","+(this._y1=+e)},bezierCurveTo:function(t,i,n,e,s,h){this._+="C"+ +t+","+ +i+","+ +n+","+ +e+","+(this._x1=+s)+","+(this._y1=+h)},arcTo:function(i,n,e,s,h){i=+i,n=+n,e=+e,s=+s,h=+h;var o=this._x1,_=this._y1,r=e-i,a=s-n,c=o-i,u=_-n,l=c*c+u*u;if(h<0)throw new Error("negative radius: "+h);if(null===this._x1)this._+="M"+(this._x1=i)+","+(this._y1=n);else if(l>1e-6)if(Math.abs(u*r-a*c)>1e-6&&h){var f=e-o,x=s-_,y=r*r+a*a,p=f*f+x*x,v=Math.sqrt(y),d=Math.sqrt(l),T=h*Math.tan((t-Math.acos((y+l-p)/(2*v*d)))/2),g=T/d,b=T/v;Math.abs(g-1)>1e-6&&(this._+="L"+(i+g*c)+","+(n+g*u)),this._+="A"+h+","+h+",0,0,"+ +(u*f>c*x)+","+(this._x1=i+b*r)+","+(this._y1=n+b*a)}else this._+="L"+(this._x1=i)+","+(this._y1=n);else;},arc:function(e,s,h,o,_,r){e=+e,s=+s,r=!!r;var a=(h=+h)*Math.cos(o),c=h*Math.sin(o),u=e+a,l=s+c,f=1^r,x=r?o-_:_-o;if(h<0)throw new Error("negative radius: "+h);null===this._x1?this._+="M"+u+","+l:(Math.abs(this._x1-u)>1e-6||Math.abs(this._y1-l)>1e-6)&&(this._+="L"+u+","+l),h&&(x<0&&(x=x%i+i),x>n?this._+="A"+h+","+h+",0,1,"+f+","+(e-a)+","+(s-c)+"A"+h+","+h+",0,1,"+f+","+(this._x1=u)+","+(this._y1=l):x>1e-6&&(this._+="A"+h+","+h+",0,"+ +(x>=t)+","+f+","+(this._x1=e+h*Math.cos(_))+","+(this._y1=s+h*Math.sin(_))))},rect:function(t,i,n,e){this._+="M"+(this._x0=this._x1=+t)+","+(this._y0=this._y1=+i)+"h"+ +n+"v"+ +e+"h"+-n+"Z"},toString:function(){return this._}};var o=Math.abs,_=Math.atan2,r=Math.cos,a=Math.max,c=Math.min,u=Math.sin,l=Math.sqrt,f=Math.PI,x=f/2,y=2*f;function p(t){return t>1?0:t<-1?f:Math.acos(t)}function v(t){return t>=1?x:t<=-1?-x:Math.asin(t)}function d(t){return t.innerRadius}function T(t){return t.outerRadius}function g(t){return t.startAngle}function b(t){return t.endAngle}function w(t){return t&&t.padAngle}function M(t,i,n,e,s,h,o,_){var r=n-t,a=e-i,c=o-s,u=_-h,l=u*r-c*a;if(!(l*l<1e-12))return[t+(l=(c*(i-h)-u*(t-s))/l)*r,i+l*a]}function m(t,i,n,e,s,h,o){var _=t-n,r=i-e,c=(o?h:-h)/l(_*_+r*r),u=c*r,f=-c*_,x=t+u,y=i+f,p=n+u,v=e+f,d=(x+p)/2,T=(y+v)/2,g=p-x,b=v-y,w=g*g+b*b,M=s-h,m=x*v-p*y,k=(b<0?-1:1)*l(a(0,M*M*w-m*m)),N=(m*b-g*k)/w,S=(-m*g-b*k)/w,E=(m*b+g*k)/w,A=(-m*g+b*k)/w,P=N-d,C=S-T,q=E-d,O=A-T;return P*P+C*C>q*q+O*O&&(N=E,S=A),{cx:N,cy:S,x01:-u,y01:-f,x11:N*(s/M-1),y11:S*(s/M-1)}}function k(){var t=d,i=T,n=h(0),e=null,a=g,k=b,N=w,S=null;function E(){var h,d,T=+t.apply(this,arguments),g=+i.apply(this,arguments),b=a.apply(this,arguments)-x,w=k.apply(this,arguments)-x,E=o(w-b),A=w>b;if(S||(S=h=s()),g<T&&(d=g,g=T,T=d),g>1e-12)if(E>y-1e-12)S.moveTo(g*r(b),g*u(b)),S.arc(0,0,g,b,w,!A),T>1e-12&&(S.moveTo(T*r(w),T*u(w)),S.arc(0,0,T,w,b,A));else{var P,C,q=b,O=w,R=b,z=w,X=E,Y=E,L=N.apply(this,arguments)/2,B=L>1e-12&&(e?+e.apply(this,arguments):l(T*T+g*g)),I=c(o(g-T)/2,+n.apply(this,arguments)),D=I,W=I;if(B>1e-12){var Z=v(B/T*u(L)),j=v(B/g*u(L));(X-=2*Z)>1e-12?(R+=Z*=A?1:-1,z-=Z):(X=0,R=z=(b+w)/2),(Y-=2*j)>1e-12?(q+=j*=A?1:-1,O-=j):(Y=0,q=O=(b+w)/2)}var Q=g*r(q),V=g*u(q),F=T*r(z),G=T*u(z);if(I>1e-12){var H,J=g*r(O),K=g*u(O),U=T*r(R),$=T*u(R);if(E<f&&(H=M(Q,V,U,$,J,K,F,G))){var tt=Q-H[0],it=V-H[1],nt=J-H[0],et=K-H[1],st=1/u(p((tt*nt+it*et)/(l(tt*tt+it*it)*l(nt*nt+et*et)))/2),ht=l(H[0]*H[0]+H[1]*H[1]);D=c(I,(T-ht)/(st-1)),W=c(I,(g-ht)/(st+1))}}Y>1e-12?W>1e-12?(P=m(U,$,Q,V,g,W,A),C=m(J,K,F,G,g,W,A),S.moveTo(P.cx+P.x01,P.cy+P.y01),W<I?S.arc(P.cx,P.cy,W,_(P.y01,P.x01),_(C.y01,C.x01),!A):(S.arc(P.cx,P.cy,W,_(P.y01,P.x01),_(P.y11,P.x11),!A),S.arc(0,0,g,_(P.cy+P.y11,P.cx+P.x11),_(C.cy+C.y11,C.cx+C.x11),!A),S.arc(C.cx,C.cy,W,_(C.y11,C.x11),_(C.y01,C.x01),!A))):(S.moveTo(Q,V),S.arc(0,0,g,q,O,!A)):S.moveTo(Q,V),T>1e-12&&X>1e-12?D>1e-12?(P=m(F,G,J,K,T,-D,A),C=m(Q,V,U,$,T,-D,A),S.lineTo(P.cx+P.x01,P.cy+P.y01),D<I?S.arc(P.cx,P.cy,D,_(P.y01,P.x01),_(C.y01,C.x01),!A):(S.arc(P.cx,P.cy,D,_(P.y01,P.x01),_(P.y11,P.x11),!A),S.arc(0,0,T,_(P.cy+P.y11,P.cx+P.x11),_(C.cy+C.y11,C.cx+C.x11),A),S.arc(C.cx,C.cy,D,_(C.y11,C.x11),_(C.y01,C.x01),!A))):S.arc(0,0,T,z,R,A):S.lineTo(F,G)}else S.moveTo(0,0);if(S.closePath(),h)return S=null,h+""||null}return E.centroid=function(){var n=(+t.apply(this,arguments)+ +i.apply(this,arguments))/2,e=(+a.apply(this,arguments)+ +k.apply(this,arguments))/2-f/2;return[r(e)*n,u(e)*n]},E.innerRadius=function(i){return arguments.length?(t="function"==typeof i?i:h(+i),E):t},E.outerRadius=function(t){return arguments.length?(i="function"==typeof t?t:h(+t),E):i},E.cornerRadius=function(t){return arguments.length?(n="function"==typeof t?t:h(+t),E):n},E.padRadius=function(t){return arguments.length?(e=null==t?null:"function"==typeof t?t:h(+t),E):e},E.startAngle=function(t){return arguments.length?(a="function"==typeof t?t:h(+t),E):a},E.endAngle=function(t){return arguments.length?(k="function"==typeof t?t:h(+t),E):k},E.padAngle=function(t){return arguments.length?(N="function"==typeof t?t:h(+t),E):N},E.context=function(t){return arguments.length?(S=null==t?null:t,E):S},E}function N(t){this._context=t}function S(t){return new N(t)}function E(t){return t[0]}function A(t){return t[1]}function P(){var t=E,i=A,n=h(!0),e=null,o=S,_=null;function r(h){var r,a,c,u=h.length,l=!1;for(null==e&&(_=o(c=s())),r=0;r<=u;++r)!(r<u&&n(a=h[r],r,h))===l&&((l=!l)?_.lineStart():_.lineEnd()),l&&_.point(+t(a,r,h),+i(a,r,h));if(c)return _=null,c+""||null}return r.x=function(i){return arguments.length?(t="function"==typeof i?i:h(+i),r):t},r.y=function(t){return arguments.length?(i="function"==typeof t?t:h(+t),r):i},r.defined=function(t){return arguments.length?(n="function"==typeof t?t:h(!!t),r):n},r.curve=function(t){return arguments.length?(o=t,null!=e&&(_=o(e)),r):o},r.context=function(t){return arguments.length?(null==t?e=_=null:_=o(e=t),r):e},r}function C(){var t=E,i=null,n=h(0),e=A,o=h(!0),_=null,r=S,a=null;function c(h){var c,u,l,f,x,y=h.length,p=!1,v=new Array(y),d=new Array(y);for(null==_&&(a=r(x=s())),c=0;c<=y;++c){if(!(c<y&&o(f=h[c],c,h))===p)if(p=!p)u=c,a.areaStart(),a.lineStart();else{for(a.lineEnd(),a.lineStart(),l=c-1;l>=u;--l)a.point(v[l],d[l]);a.lineEnd(),a.areaEnd()}p&&(v[c]=+t(f,c,h),d[c]=+n(f,c,h),a.point(i?+i(f,c,h):v[c],e?+e(f,c,h):d[c]))}if(x)return a=null,x+""||null}function u(){return P().defined(o).curve(r).context(_)}return c.x=function(n){return arguments.length?(t="function"==typeof n?n:h(+n),i=null,c):t},c.x0=function(i){return arguments.length?(t="function"==typeof i?i:h(+i),c):t},c.x1=function(t){return arguments.length?(i=null==t?null:"function"==typeof t?t:h(+t),c):i},c.y=function(t){return arguments.length?(n="function"==typeof t?t:h(+t),e=null,c):n},c.y0=function(t){return arguments.length?(n="function"==typeof t?t:h(+t),c):n},c.y1=function(t){return arguments.length?(e=null==t?null:"function"==typeof t?t:h(+t),c):e},c.lineX0=c.lineY0=function(){return u().x(t).y(n)},c.lineY1=function(){return u().x(t).y(e)},c.lineX1=function(){return u().x(i).y(n)},c.defined=function(t){return arguments.length?(o="function"==typeof t?t:h(!!t),c):o},c.curve=function(t){return arguments.length?(r=t,null!=_&&(a=r(_)),c):r},c.context=function(t){return arguments.length?(null==t?_=a=null:a=r(_=t),c):_},c}function q(t,i){return i<t?-1:i>t?1:i>=t?0:NaN}function O(t){return t}function R(){var t=O,i=q,n=null,e=h(0),s=h(y),o=h(0);function _(h){var _,r,a,c,u,l=h.length,f=0,x=new Array(l),p=new Array(l),v=+e.apply(this,arguments),d=Math.min(y,Math.max(-y,s.apply(this,arguments)-v)),T=Math.min(Math.abs(d)/l,o.apply(this,arguments)),g=T*(d<0?-1:1);for(_=0;_<l;++_)(u=p[x[_]=_]=+t(h[_],_,h))>0&&(f+=u);for(null!=i?x.sort((function(t,n){return i(p[t],p[n])})):null!=n&&x.sort((function(t,i){return n(h[t],h[i])})),_=0,a=f?(d-l*g)/f:0;_<l;++_,v=c)r=x[_],c=v+((u=p[r])>0?u*a:0)+g,p[r]={data:h[r],index:_,value:u,startAngle:v,endAngle:c,padAngle:T};return p}return _.value=function(i){return arguments.length?(t="function"==typeof i?i:h(+i),_):t},_.sortValues=function(t){return arguments.length?(i=t,n=null,_):i},_.sort=function(t){return arguments.length?(n=t,i=null,_):n},_.startAngle=function(t){return arguments.length?(e="function"==typeof t?t:h(+t),_):e},_.endAngle=function(t){return arguments.length?(s="function"==typeof t?t:h(+t),_):s},_.padAngle=function(t){return arguments.length?(o="function"==typeof t?t:h(+t),_):o},_}N.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._point=0},lineEnd:function(){(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,i){switch(t=+t,i=+i,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,i):this._context.moveTo(t,i);break;case 1:this._point=2;default:this._context.lineTo(t,i)}}};var z=Y(S);function X(t){this._curve=t}function Y(t){function i(i){return new X(t(i))}return i._curve=t,i}function L(t){var i=t.curve;return t.angle=t.x,delete t.x,t.radius=t.y,delete t.y,t.curve=function(t){return arguments.length?i(Y(t)):i()._curve},t}function B(){return L(P().curve(z))}function I(){var t=C().curve(z),i=t.curve,n=t.lineX0,e=t.lineX1,s=t.lineY0,h=t.lineY1;return t.angle=t.x,delete t.x,t.startAngle=t.x0,delete t.x0,t.endAngle=t.x1,delete t.x1,t.radius=t.y,delete t.y,t.innerRadius=t.y0,delete t.y0,t.outerRadius=t.y1,delete t.y1,t.lineStartAngle=function(){return L(n())},delete t.lineX0,t.lineEndAngle=function(){return L(e())},delete t.lineX1,t.lineInnerRadius=function(){return L(s())},delete t.lineY0,t.lineOuterRadius=function(){return L(h())},delete t.lineY1,t.curve=function(t){return arguments.length?i(Y(t)):i()._curve},t}function D(t,i){return[(i=+i)*Math.cos(t-=Math.PI/2),i*Math.sin(t)]}X.prototype={areaStart:function(){this._curve.areaStart()},areaEnd:function(){this._curve.areaEnd()},lineStart:function(){this._curve.lineStart()},lineEnd:function(){this._curve.lineEnd()},point:function(t,i){this._curve.point(i*Math.sin(t),i*-Math.cos(t))}};var W=Array.prototype.slice;function Z(t){return t.source}function j(t){return t.target}function Q(t){var i=Z,n=j,e=E,o=A,_=null;function r(){var h,r=W.call(arguments),a=i.apply(this,r),c=n.apply(this,r);if(_||(_=h=s()),t(_,+e.apply(this,(r[0]=a,r)),+o.apply(this,r),+e.apply(this,(r[0]=c,r)),+o.apply(this,r)),h)return _=null,h+""||null}return r.source=function(t){return arguments.length?(i=t,r):i},r.target=function(t){return arguments.length?(n=t,r):n},r.x=function(t){return arguments.length?(e="function"==typeof t?t:h(+t),r):e},r.y=function(t){return arguments.length?(o="function"==typeof t?t:h(+t),r):o},r.context=function(t){return arguments.length?(_=null==t?null:t,r):_},r}function V(t,i,n,e,s){t.moveTo(i,n),t.bezierCurveTo(i=(i+e)/2,n,i,s,e,s)}function F(t,i,n,e,s){t.moveTo(i,n),t.bezierCurveTo(i,n=(n+s)/2,e,n,e,s)}function G(t,i,n,e,s){var h=D(i,n),o=D(i,n=(n+s)/2),_=D(e,n),r=D(e,s);t.moveTo(h[0],h[1]),t.bezierCurveTo(o[0],o[1],_[0],_[1],r[0],r[1])}function H(){return Q(V)}function J(){return Q(F)}function K(){var t=Q(G);return t.angle=t.x,delete t.x,t.radius=t.y,delete t.y,t}var U={draw:function(t,i){var n=Math.sqrt(i/f);t.moveTo(n,0),t.arc(0,0,n,0,y)}},$={draw:function(t,i){var n=Math.sqrt(i/5)/2;t.moveTo(-3*n,-n),t.lineTo(-n,-n),t.lineTo(-n,-3*n),t.lineTo(n,-3*n),t.lineTo(n,-n),t.lineTo(3*n,-n),t.lineTo(3*n,n),t.lineTo(n,n),t.lineTo(n,3*n),t.lineTo(-n,3*n),t.lineTo(-n,n),t.lineTo(-3*n,n),t.closePath()}},tt=Math.sqrt(1/3),it=2*tt,nt={draw:function(t,i){var n=Math.sqrt(i/it),e=n*tt;t.moveTo(0,-n),t.lineTo(e,0),t.lineTo(0,n),t.lineTo(-e,0),t.closePath()}},et=Math.sin(f/10)/Math.sin(7*f/10),st=Math.sin(y/10)*et,ht=-Math.cos(y/10)*et,ot={draw:function(t,i){var n=Math.sqrt(.8908130915292852*i),e=st*n,s=ht*n;t.moveTo(0,-n),t.lineTo(e,s);for(var h=1;h<5;++h){var o=y*h/5,_=Math.cos(o),r=Math.sin(o);t.lineTo(r*n,-_*n),t.lineTo(_*e-r*s,r*e+_*s)}t.closePath()}},_t={draw:function(t,i){var n=Math.sqrt(i),e=-n/2;t.rect(e,e,n,n)}},rt=Math.sqrt(3),at={draw:function(t,i){var n=-Math.sqrt(i/(3*rt));t.moveTo(0,2*n),t.lineTo(-rt*n,-n),t.lineTo(rt*n,-n),t.closePath()}},ct=-.5,ut=Math.sqrt(3)/2,lt=1/Math.sqrt(12),ft=3*(lt/2+1),xt={draw:function(t,i){var n=Math.sqrt(i/ft),e=n/2,s=n*lt,h=e,o=n*lt+n,_=-h,r=o;t.moveTo(e,s),t.lineTo(h,o),t.lineTo(_,r),t.lineTo(ct*e-ut*s,ut*e+ct*s),t.lineTo(ct*h-ut*o,ut*h+ct*o),t.lineTo(ct*_-ut*r,ut*_+ct*r),t.lineTo(ct*e+ut*s,ct*s-ut*e),t.lineTo(ct*h+ut*o,ct*o-ut*h),t.lineTo(ct*_+ut*r,ct*r-ut*_),t.closePath()}},yt=[U,$,nt,_t,ot,at,xt];function pt(){var t=h(U),i=h(64),n=null;function e(){var e;if(n||(n=e=s()),t.apply(this,arguments).draw(n,+i.apply(this,arguments)),e)return n=null,e+""||null}return e.type=function(i){return arguments.length?(t="function"==typeof i?i:h(i),e):t},e.size=function(t){return arguments.length?(i="function"==typeof t?t:h(+t),e):i},e.context=function(t){return arguments.length?(n=null==t?null:t,e):n},e}function vt(){}function dt(t,i,n){t._context.bezierCurveTo((2*t._x0+t._x1)/3,(2*t._y0+t._y1)/3,(t._x0+2*t._x1)/3,(t._y0+2*t._y1)/3,(t._x0+4*t._x1+i)/6,(t._y0+4*t._y1+n)/6)}function Tt(t){this._context=t}function gt(t){return new Tt(t)}function bt(t){this._context=t}function wt(t){return new bt(t)}function Mt(t){this._context=t}function mt(t){return new Mt(t)}function kt(t,i){this._basis=new Tt(t),this._beta=i}Tt.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=NaN,this._point=0},lineEnd:function(){switch(this._point){case 3:dt(this,this._x1,this._y1);case 2:this._context.lineTo(this._x1,this._y1)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,i){switch(t=+t,i=+i,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,i):this._context.moveTo(t,i);break;case 1:this._point=2;break;case 2:this._point=3,this._context.lineTo((5*this._x0+this._x1)/6,(5*this._y0+this._y1)/6);default:dt(this,t,i)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=i}},bt.prototype={areaStart:vt,areaEnd:vt,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._y0=this._y1=this._y2=this._y3=this._y4=NaN,this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x2,this._y2),this._context.closePath();break;case 2:this._context.moveTo((this._x2+2*this._x3)/3,(this._y2+2*this._y3)/3),this._context.lineTo((this._x3+2*this._x2)/3,(this._y3+2*this._y2)/3),this._context.closePath();break;case 3:this.point(this._x2,this._y2),this.point(this._x3,this._y3),this.point(this._x4,this._y4)}},point:function(t,i){switch(t=+t,i=+i,this._point){case 0:this._point=1,this._x2=t,this._y2=i;break;case 1:this._point=2,this._x3=t,this._y3=i;break;case 2:this._point=3,this._x4=t,this._y4=i,this._context.moveTo((this._x0+4*this._x1+t)/6,(this._y0+4*this._y1+i)/6);break;default:dt(this,t,i)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=i}},Mt.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=NaN,this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,i){switch(t=+t,i=+i,this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3;var n=(this._x0+4*this._x1+t)/6,e=(this._y0+4*this._y1+i)/6;this._line?this._context.lineTo(n,e):this._context.moveTo(n,e);break;case 3:this._point=4;default:dt(this,t,i)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=i}},kt.prototype={lineStart:function(){this._x=[],this._y=[],this._basis.lineStart()},lineEnd:function(){var t=this._x,i=this._y,n=t.length-1;if(n>0)for(var e,s=t[0],h=i[0],o=t[n]-s,_=i[n]-h,r=-1;++r<=n;)e=r/n,this._basis.point(this._beta*t[r]+(1-this._beta)*(s+e*o),this._beta*i[r]+(1-this._beta)*(h+e*_));this._x=this._y=null,this._basis.lineEnd()},point:function(t,i){this._x.push(+t),this._y.push(+i)}};var Nt=function t(i){function n(t){return 1===i?new Tt(t):new kt(t,i)}return n.beta=function(i){return t(+i)},n}(.85);function St(t,i,n){t._context.bezierCurveTo(t._x1+t._k*(t._x2-t._x0),t._y1+t._k*(t._y2-t._y0),t._x2+t._k*(t._x1-i),t._y2+t._k*(t._y1-n),t._x2,t._y2)}function Et(t,i){this._context=t,this._k=(1-i)/6}Et.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x2,this._y2);break;case 3:St(this,this._x1,this._y1)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,i){switch(t=+t,i=+i,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,i):this._context.moveTo(t,i);break;case 1:this._point=2,this._x1=t,this._y1=i;break;case 2:this._point=3;default:St(this,t,i)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=i}};var At=function t(i){function n(t){return new Et(t,i)}return n.tension=function(i){return t(+i)},n}(0);function Pt(t,i){this._context=t,this._k=(1-i)/6}Pt.prototype={areaStart:vt,areaEnd:vt,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._x5=this._y0=this._y1=this._y2=this._y3=this._y4=this._y5=NaN,this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x3,this._y3),this._context.closePath();break;case 2:this._context.lineTo(this._x3,this._y3),this._context.closePath();break;case 3:this.point(this._x3,this._y3),this.point(this._x4,this._y4),this.point(this._x5,this._y5)}},point:function(t,i){switch(t=+t,i=+i,this._point){case 0:this._point=1,this._x3=t,this._y3=i;break;case 1:this._point=2,this._context.moveTo(this._x4=t,this._y4=i);break;case 2:this._point=3,this._x5=t,this._y5=i;break;default:St(this,t,i)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=i}};var Ct=function t(i){function n(t){return new Pt(t,i)}return n.tension=function(i){return t(+i)},n}(0);function qt(t,i){this._context=t,this._k=(1-i)/6}qt.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,i){switch(t=+t,i=+i,this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3,this._line?this._context.lineTo(this._x2,this._y2):this._context.moveTo(this._x2,this._y2);break;case 3:this._point=4;default:St(this,t,i)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=i}};var Ot=function t(i){function n(t){return new qt(t,i)}return n.tension=function(i){return t(+i)},n}(0);function Rt(t,i,n){var e=t._x1,s=t._y1,h=t._x2,o=t._y2;if(t._l01_a>1e-12){var _=2*t._l01_2a+3*t._l01_a*t._l12_a+t._l12_2a,r=3*t._l01_a*(t._l01_a+t._l12_a);e=(e*_-t._x0*t._l12_2a+t._x2*t._l01_2a)/r,s=(s*_-t._y0*t._l12_2a+t._y2*t._l01_2a)/r}if(t._l23_a>1e-12){var a=2*t._l23_2a+3*t._l23_a*t._l12_a+t._l12_2a,c=3*t._l23_a*(t._l23_a+t._l12_a);h=(h*a+t._x1*t._l23_2a-i*t._l12_2a)/c,o=(o*a+t._y1*t._l23_2a-n*t._l12_2a)/c}t._context.bezierCurveTo(e,s,h,o,t._x2,t._y2)}function zt(t,i){this._context=t,this._alpha=i}zt.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x2,this._y2);break;case 3:this.point(this._x2,this._y2)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,i){if(t=+t,i=+i,this._point){var n=this._x2-t,e=this._y2-i;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(n*n+e*e,this._alpha))}switch(this._point){case 0:this._point=1,this._line?this._context.lineTo(t,i):this._context.moveTo(t,i);break;case 1:this._point=2;break;case 2:this._point=3;default:Rt(this,t,i)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=i}};var Xt=function t(i){function n(t){return i?new zt(t,i):new Et(t,0)}return n.alpha=function(i){return t(+i)},n}(.5);function Yt(t,i){this._context=t,this._alpha=i}Yt.prototype={areaStart:vt,areaEnd:vt,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._x5=this._y0=this._y1=this._y2=this._y3=this._y4=this._y5=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x3,this._y3),this._context.closePath();break;case 2:this._context.lineTo(this._x3,this._y3),this._context.closePath();break;case 3:this.point(this._x3,this._y3),this.point(this._x4,this._y4),this.point(this._x5,this._y5)}},point:function(t,i){if(t=+t,i=+i,this._point){var n=this._x2-t,e=this._y2-i;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(n*n+e*e,this._alpha))}switch(this._point){case 0:this._point=1,this._x3=t,this._y3=i;break;case 1:this._point=2,this._context.moveTo(this._x4=t,this._y4=i);break;case 2:this._point=3,this._x5=t,this._y5=i;break;default:Rt(this,t,i)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=i}};var Lt=function t(i){function n(t){return i?new Yt(t,i):new Pt(t,0)}return n.alpha=function(i){return t(+i)},n}(.5);function Bt(t,i){this._context=t,this._alpha=i}Bt.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,i){if(t=+t,i=+i,this._point){var n=this._x2-t,e=this._y2-i;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(n*n+e*e,this._alpha))}switch(this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3,this._line?this._context.lineTo(this._x2,this._y2):this._context.moveTo(this._x2,this._y2);break;case 3:this._point=4;default:Rt(this,t,i)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=i}};var It=function t(i){function n(t){return i?new Bt(t,i):new qt(t,0)}return n.alpha=function(i){return t(+i)},n}(.5);function Dt(t){this._context=t}function Wt(t){return new Dt(t)}function Zt(t){return t<0?-1:1}function jt(t,i,n){var e=t._x1-t._x0,s=i-t._x1,h=(t._y1-t._y0)/(e||s<0&&-0),o=(n-t._y1)/(s||e<0&&-0),_=(h*s+o*e)/(e+s);return(Zt(h)+Zt(o))*Math.min(Math.abs(h),Math.abs(o),.5*Math.abs(_))||0}function Qt(t,i){var n=t._x1-t._x0;return n?(3*(t._y1-t._y0)/n-i)/2:i}function Vt(t,i,n){var e=t._x0,s=t._y0,h=t._x1,o=t._y1,_=(h-e)/3;t._context.bezierCurveTo(e+_,s+_*i,h-_,o-_*n,h,o)}function Ft(t){this._context=t}function Gt(t){this._context=new Ht(t)}function Ht(t){this._context=t}function Jt(t){return new Ft(t)}function Kt(t){return new Gt(t)}function Ut(t){this._context=t}function $t(t){var i,n,e=t.length-1,s=new Array(e),h=new Array(e),o=new Array(e);for(s[0]=0,h[0]=2,o[0]=t[0]+2*t[1],i=1;i<e-1;++i)s[i]=1,h[i]=4,o[i]=4*t[i]+2*t[i+1];for(s[e-1]=2,h[e-1]=7,o[e-1]=8*t[e-1]+t[e],i=1;i<e;++i)n=s[i]/h[i-1],h[i]-=n,o[i]-=n*o[i-1];for(s[e-1]=o[e-1]/h[e-1],i=e-2;i>=0;--i)s[i]=(o[i]-s[i+1])/h[i];for(h[e-1]=(t[e]+s[e-1])/2,i=0;i<e-1;++i)h[i]=2*t[i+1]-s[i+1];return[s,h]}function ti(t){return new Ut(t)}function ii(t,i){this._context=t,this._t=i}function ni(t){return new ii(t,.5)}function ei(t){return new ii(t,0)}function si(t){return new ii(t,1)}function hi(t,i){if((s=t.length)>1)for(var n,e,s,h=1,o=t[i[0]],_=o.length;h<s;++h)for(e=o,o=t[i[h]],n=0;n<_;++n)o[n][1]+=o[n][0]=isNaN(e[n][1])?e[n][0]:e[n][1]}function oi(t){for(var i=t.length,n=new Array(i);--i>=0;)n[i]=i;return n}function _i(t,i){return t[i]}function ri(){var t=h([]),i=oi,n=hi,e=_i;function s(s){var h,o,_=t.apply(this,arguments),r=s.length,a=_.length,c=new Array(a);for(h=0;h<a;++h){for(var u,l=_[h],f=c[h]=new Array(r),x=0;x<r;++x)f[x]=u=[0,+e(s[x],l,x,s)],u.data=s[x];f.key=l}for(h=0,o=i(c);h<a;++h)c[o[h]].index=h;return n(c,o),c}return s.keys=function(i){return arguments.length?(t="function"==typeof i?i:h(W.call(i)),s):t},s.value=function(t){return arguments.length?(e="function"==typeof t?t:h(+t),s):e},s.order=function(t){return arguments.length?(i=null==t?oi:"function"==typeof t?t:h(W.call(t)),s):i},s.offset=function(t){return arguments.length?(n=null==t?hi:t,s):n},s}function ai(t,i){if((e=t.length)>0){for(var n,e,s,h=0,o=t[0].length;h<o;++h){for(s=n=0;n<e;++n)s+=t[n][h][1]||0;if(s)for(n=0;n<e;++n)t[n][h][1]/=s}hi(t,i)}}function ci(t,i){if((_=t.length)>0)for(var n,e,s,h,o,_,r=0,a=t[i[0]].length;r<a;++r)for(h=o=0,n=0;n<_;++n)(s=(e=t[i[n]][r])[1]-e[0])>0?(e[0]=h,e[1]=h+=s):s<0?(e[1]=o,e[0]=o+=s):(e[0]=0,e[1]=s)}function ui(t,i){if((n=t.length)>0){for(var n,e=0,s=t[i[0]],h=s.length;e<h;++e){for(var o=0,_=0;o<n;++o)_+=t[o][e][1]||0;s[e][1]+=s[e][0]=-_/2}hi(t,i)}}function li(t,i){if((s=t.length)>0&&(e=(n=t[i[0]]).length)>0){for(var n,e,s,h=0,o=1;o<e;++o){for(var _=0,r=0,a=0;_<s;++_){for(var c=t[i[_]],u=c[o][1]||0,l=(u-(c[o-1][1]||0))/2,f=0;f<_;++f){var x=t[i[f]];l+=(x[o][1]||0)-(x[o-1][1]||0)}r+=u,a+=l*u}n[o-1][1]+=n[o-1][0]=h,r&&(h-=a/r)}n[o-1][1]+=n[o-1][0]=h,hi(t,i)}}function fi(t){var i=t.map(xi);return oi(t).sort((function(t,n){return i[t]-i[n]}))}function xi(t){for(var i,n=-1,e=0,s=t.length,h=-1/0;++n<s;)(i=+t[n][1])>h&&(h=i,e=n);return e}function yi(t){var i=t.map(pi);return oi(t).sort((function(t,n){return i[t]-i[n]}))}function pi(t){for(var i,n=0,e=-1,s=t.length;++e<s;)(i=+t[e][1])&&(n+=i);return n}function vi(t){return yi(t).reverse()}function di(t){var i,n,e=t.length,s=t.map(pi),h=fi(t),o=0,_=0,r=[],a=[];for(i=0;i<e;++i)n=h[i],o<_?(o+=s[n],r.push(n)):(_+=s[n],a.push(n));return a.reverse().concat(r)}function Ti(t){return oi(t).reverse()}Dt.prototype={areaStart:vt,areaEnd:vt,lineStart:function(){this._point=0},lineEnd:function(){this._point&&this._context.closePath()},point:function(t,i){t=+t,i=+i,this._point?this._context.lineTo(t,i):(this._point=1,this._context.moveTo(t,i))}},Ft.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=this._t0=NaN,this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x1,this._y1);break;case 3:Vt(this,this._t0,Qt(this,this._t0))}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,i){var n=NaN;if(i=+i,(t=+t)!==this._x1||i!==this._y1){switch(this._point){case 0:this._point=1,this._line?this._context.lineTo(t,i):this._context.moveTo(t,i);break;case 1:this._point=2;break;case 2:this._point=3,Vt(this,Qt(this,n=jt(this,t,i)),n);break;default:Vt(this,this._t0,n=jt(this,t,i))}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=i,this._t0=n}}},(Gt.prototype=Object.create(Ft.prototype)).point=function(t,i){Ft.prototype.point.call(this,i,t)},Ht.prototype={moveTo:function(t,i){this._context.moveTo(i,t)},closePath:function(){this._context.closePath()},lineTo:function(t,i){this._context.lineTo(i,t)},bezierCurveTo:function(t,i,n,e,s,h){this._context.bezierCurveTo(i,t,e,n,h,s)}},Ut.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x=[],this._y=[]},lineEnd:function(){var t=this._x,i=this._y,n=t.length;if(n)if(this._line?this._context.lineTo(t[0],i[0]):this._context.moveTo(t[0],i[0]),2===n)this._context.lineTo(t[1],i[1]);else for(var e=$t(t),s=$t(i),h=0,o=1;o<n;++h,++o)this._context.bezierCurveTo(e[0][h],s[0][h],e[1][h],s[1][h],t[o],i[o]);(this._line||0!==this._line&&1===n)&&this._context.closePath(),this._line=1-this._line,this._x=this._y=null},point:function(t,i){this._x.push(+t),this._y.push(+i)}},ii.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x=this._y=NaN,this._point=0},lineEnd:function(){0<this._t&&this._t<1&&2===this._point&&this._context.lineTo(this._x,this._y),(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line>=0&&(this._t=1-this._t,this._line=1-this._line)},point:function(t,i){switch(t=+t,i=+i,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,i):this._context.moveTo(t,i);break;case 1:this._point=2;default:if(this._t<=0)this._context.lineTo(this._x,i),this._context.lineTo(t,i);else{var n=this._x*(1-this._t)+t*this._t;this._context.lineTo(n,this._y),this._context.lineTo(n,i)}}this._x=t,this._y=i}};export{k as arc,C as area,I as areaRadial,gt as curveBasis,wt as curveBasisClosed,mt as curveBasisOpen,Nt as curveBundle,At as curveCardinal,Ct as curveCardinalClosed,Ot as curveCardinalOpen,Xt as curveCatmullRom,Lt as curveCatmullRomClosed,It as curveCatmullRomOpen,S as curveLinear,Wt as curveLinearClosed,Jt as curveMonotoneX,Kt as curveMonotoneY,ti as curveNatural,ni as curveStep,si as curveStepAfter,ei as curveStepBefore,P as line,B as lineRadial,H as linkHorizontal,K as linkRadial,J as linkVertical,R as pie,D as pointRadial,I as radialArea,B as radialLine,ri as stack,ci as stackOffsetDiverging,ai as stackOffsetExpand,hi as stackOffsetNone,ui as stackOffsetSilhouette,li as stackOffsetWiggle,fi as stackOrderAppearance,yi as stackOrderAscending,vi as stackOrderDescending,di as stackOrderInsideOut,oi as stackOrderNone,Ti as stackOrderReverse,pt as symbol,U as symbolCircle,$ as symbolCross,nt as symbolDiamond,_t as symbolSquare,ot as symbolStar,at as symbolTriangle,xt as symbolWye,yt as symbols};
//# sourceMappingURL=d3-shape.js.map
