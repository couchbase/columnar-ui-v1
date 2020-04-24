import{_ as e,c as r,g as o}from"../common/tslib.es6-c4a4947b.js";import"../common/mergeMap-bab8a89f.js";import"../common/merge-4c74bf92.js";import"../common/concat-207da212.js";import"../common/ReplaySubject-432677af.js";import"../common/filter-e53d1fcb.js";import"../common/share-9b53a7f4.js";import"../common/switchMap-b9649cdc.js";import{Input as t,Component as n,Inject as i,NgModule as a,Injector as u,ElementRef as c}from"../@angular/core.js";import"../@angular/common.js";import"../@angular/platform-browser.js";import{UpgradeModule as m,downgradeComponent as p,getAngularJSGlobal as s,getAngularLib as f}from"../@angular/upgrade/static.js";import{U as g,S as d,m as l,N as v,f as w}from"../common/interface-c1256a29.js";import{U as y}from"../common/ui-router-rx-32f8195c.js";import{UIView as j,UIROUTER_MODULE_TOKEN as $,applyModuleConfig as b,UIRouterModule as R,UIROUTER_ROOT_MODULE as h,ng2LazyLoadBuilder as N,Ng2ViewConfig as E,makeChildProviders as P,_UIROUTER_SERVICE_PROVIDERS as _}from"./angular.js";import"../common/index-1efb22b9.js";import{N as C}from"../common/viewScroll-4a386da2.js";var T=(s||f)();if(!T)throw new Error("AngularJS not found on window.  https://github.com/ui-router/angular-hybrid/wiki/AngularJS-not-found-on-window");var x=T.module("ui.router.upgrade",["ui.router"]);function F(){return{}}var V=function(){function o(e,r,o){var t=T.element(e.nativeElement).parent().parent();Object.defineProperty(r,"context",{get:function(){var e=t.inheritedData("$uiView");return e&&e.$cfg?e.$cfg.viewDecl.$context:o.root()},enumerable:!0}),Object.defineProperty(r,"fqn",{get:function(){var e=t.inheritedData("$uiView");return e&&e.$uiView?e.$uiView.fqn:null},enumerable:!0})}return o.ctorParameters=function(){return[{type:c},{type:void 0,decorators:[{type:i,args:[j.PARENT_INJECT]}]},{type:d}]},e([t()],o.prototype,"name",void 0),o=e([n({selector:"ui-view-ng-upgrade",template:'\n    <ui-view [name]="name"></ui-view>\n  ',viewProviders:[{provide:j.PARENT_INJECT,useFactory:F}]}),r(1,i(j.PARENT_INJECT))],o)}();function A(e,r){return r.get($,[]).forEach((function(o){return b(e,r,o)})),e}function J(e){return e.get("$uiRouter")}function I(e){return{fqn:null,context:e.root()}}var S={},D=function(){function r(){}var t;return t=r,r.forRoot=function(e){return void 0===e&&(e={}),{ngModule:t,providers:P(e)}},r.forChild=function(e){return void 0===e&&(e={}),{ngModule:R,providers:P(e)}},r=t=e([a({imports:[R,m],declarations:[V],providers:o([{provide:"$uiRouter",useFactory:J,deps:["$injector"]},{provide:g,useFactory:A,deps:["$uiRouter",u]},{provide:h,useValue:S,multi:!0},{provide:j.PARENT_INJECT,useFactory:I,deps:[d]}],_),entryComponents:[V],exports:[V,R]})],r)}();x.directive("uiViewNgUpgrade",p({component:V,inputs:["name"]})),x.run(["$injector",function(e){var r=e.get("$uiRouter");r.plugin(y);var o={get:function(r,o){var t=e.get("$$angularInjector");return e.has(r)?e.get(r):t.get(r,o)}},t=l.fromData(v,o);r.stateRegistry.root().resolvables.push(t)}]),x.config(["$stateRegistryProvider",function(e){e.decorator("lazyLoad",N)}]),x.config(["$stateRegistryProvider",function(e){e.decorator("views",(function(e,r){var o=r(e);return w(o,(function(e,r){"ng1-to-ng2"!==e.$type&&"function"!=typeof e.component||(e.$type="ng1-to-ng2",e.templateProvider=null,e.template="<ui-view-ng-upgrade name='"+e.$uiViewName+"'></ui-view-ng-upgrade>")})),o}))}]),x.run(["$view","$templateFactory",function(e,r){e._pluginapi._viewConfigFactory("ng2",(function(e,r){return new E(e,r)})),e._pluginapi._viewConfigFactory("ng1-to-ng2",(function(e,o){var t=new C(e,Object.assign({},o,{$type:"ng1"}),r);return[new E(e,Object.assign({},o,{$type:"ng2"})),t]}))}]);export{D as UIRouterUpgradeModule,V as UIViewNgUpgrade,I as getParentUIViewInject,J as getUIRouter,F as objectFactory,A as uiRouterUpgradeFactory,x as upgradeModule,S as ɵ0};
//# sourceMappingURL=angular-hybrid.js.map
