import{b as t}from"./tslib.es6-c4a4947b.js";import{S as e,O as n}from"./mergeMap-64c6f393.js";import{o as i}from"./filter-d76a729c.js";var r,s=function(e){function n(t,n){var i=e.call(this,t,n)||this;return i.scheduler=t,i.work=n,i.pending=!1,i}return t(n,e),n.prototype.schedule=function(t,e){if(void 0===e&&(e=0),this.closed)return this;this.state=t;var n=this.id,i=this.scheduler;return null!=n&&(this.id=this.recycleAsyncId(i,n,e)),this.pending=!0,this.delay=e,this.id=this.id||this.requestAsyncId(i,this.id,e),this},n.prototype.requestAsyncId=function(t,e,n){return void 0===n&&(n=0),setInterval(t.flush.bind(t,this),n)},n.prototype.recycleAsyncId=function(t,e,n){if(void 0===n&&(n=0),null!==n&&this.delay===n&&!1===this.pending)return e;clearInterval(e)},n.prototype.execute=function(t,e){if(this.closed)return new Error("executing a cancelled action");this.pending=!1;var n=this._execute(t,e);if(n)return n;!1===this.pending&&null!=this.id&&(this.id=this.recycleAsyncId(this.scheduler,this.id,null))},n.prototype._execute=function(t,e){var n=!1,i=void 0;try{this.work(t)}catch(t){n=!0,i=!!t&&t||new Error(t)}if(n)return this.unsubscribe(),i},n.prototype._unsubscribe=function(){var t=this.id,e=this.scheduler,n=e.actions,i=n.indexOf(this);this.work=null,this.state=null,this.pending=!1,this.scheduler=null,-1!==i&&n.splice(i,1),null!=t&&(this.id=this.recycleAsyncId(e,t,null)),this.delay=null},n}(function(e){function n(t,n){return e.call(this)||this}return t(n,e),n.prototype.schedule=function(t,e){return this},n}(e)),o=function(){function t(e,n){void 0===n&&(n=t.now),this.SchedulerAction=e,this.now=n}return t.prototype.schedule=function(t,e,n){return void 0===e&&(e=0),new this.SchedulerAction(this,t).schedule(n,e)},t.now=function(){return Date.now()},t}(),u=function(e){function n(t,i){void 0===i&&(i=o.now);var r=e.call(this,t,(function(){return n.delegate&&n.delegate!==r?n.delegate.now():i()}))||this;return r.actions=[],r.active=!1,r.scheduled=void 0,r}return t(n,e),n.prototype.schedule=function(t,i,r){return void 0===i&&(i=0),n.delegate&&n.delegate!==this?n.delegate.schedule(t,i,r):e.prototype.schedule.call(this,t,i,r)},n.prototype.flush=function(t){var e=this.actions;if(this.active)e.push(t);else{var n;this.active=!0;do{if(n=t.execute(t.state,t.delay))break}while(t=e.shift());if(this.active=!1,n){for(;t=e.shift();)t.unsubscribe();throw n}}},n}(o),c=new n((function(t){return t.complete()}));function h(t){return t?function(t){return new n((function(e){return t.schedule((function(){return e.complete()}))}))}(t):c}function l(t,e){return new n(e?function(n){return e.schedule(a,0,{error:t,subscriber:n})}:function(e){return e.error(t)})}function a(t){var e=t.error;t.subscriber.error(e)}r||(r={});var d=function(){function t(t,e,n){this.kind=t,this.value=e,this.error=n,this.hasValue="N"===t}return t.prototype.observe=function(t){switch(this.kind){case"N":return t.next&&t.next(this.value);case"E":return t.error&&t.error(this.error);case"C":return t.complete&&t.complete()}},t.prototype.do=function(t,e,n){switch(this.kind){case"N":return t&&t(this.value);case"E":return e&&e(this.error);case"C":return n&&n()}},t.prototype.accept=function(t,e,n){return t&&"function"==typeof t.next?this.observe(t):this.do(t,e,n)},t.prototype.toObservable=function(){switch(this.kind){case"N":return i(this.value);case"E":return l(this.error);case"C":return h()}throw new Error("unexpected notification kind value")},t.createNext=function(e){return void 0!==e?new t("N",e):t.undefinedValueNotification},t.createError=function(e){return new t("E",void 0,e)},t.createComplete=function(){return t.completeNotification},t.completeNotification=new t("C"),t.undefinedValueNotification=new t("N",void 0),t}();export{u as A,c as E,d as N,o as S,s as a,r as b,h as e,l as t};
//# sourceMappingURL=Notification-9e07e457.js.map
