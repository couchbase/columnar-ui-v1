import{g as e,b as t,_ as o}from"../common/tslib.es6-c4a4947b.js";import"../common/mergeMap-64c6f393.js";import"../common/merge-183efbc7.js";import"../common/share-d41e3509.js";import{ANALYZE_FOR_ENTRY_COMPONENTS as r,ElementRef as n,NgModuleRef as s,ViewContainerRef as a,ChangeDetectorRef as i,Renderer2 as p,QueryList as u,TemplateRef as c,ɵCodegenComponentFactoryResolver as d,ComponentFactoryResolver as l,ComponentFactory as m,ComponentRef as f,NgModuleFactory as v,ɵcmf as h,ɵmod as y,ɵmpd as g,ɵregisterModuleFactory as C,Injector as R,ViewEncapsulation as _,ChangeDetectionStrategy as M,SecurityContext as A,LOCALE_ID as w,TRANSLATIONS_FORMAT as E,ɵinlineInterpolate as F,ɵinterpolate as D,ɵEMPTY_ARRAY as T,ɵEMPTY_MAP as P,Renderer as I,ɵvid as b,ɵeld as L,ɵand as S,ɵted as N,ɵdid as O,ɵprd as V,ɵqud as j,ɵpad as x,ɵpod as W,ɵppd as Y,ɵpid as J,ɵnov as k,ɵncd as H,ɵunv as q,ɵcrt as B,ɵccf as X,InjectionToken as $,Compiler as z,ɵConsole as G,MissingTranslationStrategy as Q,Optional as U,Inject as Z,TRANSLATIONS as K,PACKAGE_ROOT_URL as ee,isDevMode as te,createPlatformFactory as oe,COMPILER_OPTIONS as re,CompilerFactory as ne,platformCore as se,Injectable as ae,PLATFORM_ID as ie,Version as pe,ɵglobal as ue,ɵReflectionCapabilities as ce,ɵstringify as de}from"./core.js";import{ɵPLATFORM_BROWSER_ID as le}from"./common.js";import{Identifiers as me,ProviderMeta as fe,CompileReflector as ve,ResourceLoader as he,JitSummaryResolver as ye,SummaryResolver as ge,Lexer as Ce,Parser as Re,HtmlParser as _e,I18NHtmlParser as Me,CompilerConfig as Ae,TemplateParser as we,ElementSchemaRegistry as Ee,JitEvaluator as Fe,DirectiveNormalizer as De,UrlResolver as Te,CompileMetadataResolver as Pe,NgModuleResolver as Ie,DirectiveResolver as be,PipeResolver as Le,StaticSymbolCache as Se,StyleCompiler as Ne,ViewCompiler as Oe,NgModuleCompiler as Ve,DomElementSchemaRegistry as je,JitCompiler as xe,getUrlScheme as We,syntaxError as Ye}from"./compiler.js";import{ɵINTERNAL_BROWSER_PLATFORM_PROVIDERS as Je}from"./platform-browser.js";
/**
 * @license Angular v8.2.14
 * (c) 2010-2019 Google LLC. https://angular.io/
 * License: MIT
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */var ke,He=((ke=new Map).set(me.ANALYZE_FOR_ENTRY_COMPONENTS,r),ke.set(me.ElementRef,n),ke.set(me.NgModuleRef,s),ke.set(me.ViewContainerRef,a),ke.set(me.ChangeDetectorRef,i),ke.set(me.Renderer2,p),ke.set(me.QueryList,u),ke.set(me.TemplateRef,c),ke.set(me.CodegenComponentFactoryResolver,d),ke.set(me.ComponentFactoryResolver,l),ke.set(me.ComponentFactory,m),ke.set(me.ComponentRef,f),ke.set(me.NgModuleFactory,v),ke.set(me.createModuleFactory,h),ke.set(me.moduleDef,y),ke.set(me.moduleProviderDef,g),ke.set(me.RegisterModuleFactoryFn,C),ke.set(me.Injector,R),ke.set(me.ViewEncapsulation,_),ke.set(me.ChangeDetectionStrategy,M),ke.set(me.SecurityContext,A),ke.set(me.LOCALE_ID,w),ke.set(me.TRANSLATIONS_FORMAT,E),ke.set(me.inlineInterpolate,F),ke.set(me.interpolate,D),ke.set(me.EMPTY_ARRAY,T),ke.set(me.EMPTY_MAP,P),ke.set(me.Renderer,I),ke.set(me.viewDef,b),ke.set(me.elementDef,L),ke.set(me.anchorDef,S),ke.set(me.textDef,N),ke.set(me.directiveDef,O),ke.set(me.providerDef,V),ke.set(me.queryDef,j),ke.set(me.pureArrayDef,x),ke.set(me.pureObjectDef,W),ke.set(me.purePipeDef,Y),ke.set(me.pipeDef,J),ke.set(me.nodeValue,k),ke.set(me.ngContentDef,H),ke.set(me.unwrapValue,q),ke.set(me.createRendererType2,B),ke.set(me.createComponentFactory,X),ke),qe=function(){function e(){this.reflectionCapabilities=new ce}return e.prototype.componentModuleUrl=function(e,t){var o=t.moduleId;if("string"==typeof o)return We(o)?o:"package:"+o;if(null!=o)throw Ye('moduleId should be a string in "'+de(e)+"\". See https://goo.gl/wIDDiL for more information.\nIf you're using Webpack you should inline the template and the styles, see https://goo.gl/X2J8zc.");return"./"+de(e)},e.prototype.parameters=function(e){return this.reflectionCapabilities.parameters(e)},e.prototype.tryAnnotations=function(e){return this.annotations(e)},e.prototype.annotations=function(e){return this.reflectionCapabilities.annotations(e)},e.prototype.shallowAnnotations=function(e){throw new Error("Not supported in JIT mode")},e.prototype.propMetadata=function(e){return this.reflectionCapabilities.propMetadata(e)},e.prototype.hasLifecycleHook=function(e,t){return this.reflectionCapabilities.hasLifecycleHook(e,t)},e.prototype.guards=function(e){return this.reflectionCapabilities.guards(e)},e.prototype.resolveExternalReference=function(e){return He.get(e)||e.runtime},e}();
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var Be=new $("ErrorCollector"),Xe={provide:ee,useValue:"/"},$e={get:function(e){throw new Error("No ResourceLoader implementation has been provided. Can't read the url \""+e+'"')}},ze=new $("HtmlParser"),Ge=function(){function e(e,t,o,r,n,s,a,i,p,u,c){this._metadataResolver=t,this._delegate=new xe(t,o,r,n,s,a,i,p,u,c,this.getExtraNgModuleProviders.bind(this)),this.injector=e}return e.prototype.getExtraNgModuleProviders=function(){return[this._metadataResolver.getProviderMetadata(new fe(z,{useValue:this}))]},e.prototype.compileModuleSync=function(e){return this._delegate.compileModuleSync(e)},e.prototype.compileModuleAsync=function(e){return this._delegate.compileModuleAsync(e)},e.prototype.compileModuleAndAllComponentsSync=function(e){var t=this._delegate.compileModuleAndAllComponentsSync(e);return{ngModuleFactory:t.ngModuleFactory,componentFactories:t.componentFactories}},e.prototype.compileModuleAndAllComponentsAsync=function(e){return this._delegate.compileModuleAndAllComponentsAsync(e).then((function(e){return{ngModuleFactory:e.ngModuleFactory,componentFactories:e.componentFactories}}))},e.prototype.loadAotSummaries=function(e){this._delegate.loadAotSummaries(e)},e.prototype.hasAotSummary=function(e){return this._delegate.hasAotSummary(e)},e.prototype.getComponentFactory=function(e){return this._delegate.getComponentFactory(e)},e.prototype.clearCache=function(){this._delegate.clearCache()},e.prototype.clearCacheFor=function(e){this._delegate.clearCacheFor(e)},e.prototype.getModuleId=function(e){var t=this._metadataResolver.getNgModuleMetadata(e);return t&&t.id||void 0},e}(),Qe=[{provide:ve,useValue:new qe},{provide:he,useValue:$e},{provide:ye,deps:[]},{provide:ge,useExisting:ye},{provide:G,deps:[]},{provide:Ce,deps:[]},{provide:Re,deps:[Ce]},{provide:ze,useClass:_e,deps:[]},{provide:Me,useFactory:function(e,t,o,r,n){var s=(t=t||"")?r.missingTranslation:Q.Ignore;return new Me(e,t,o,s,n)},deps:[ze,[new U,new Z(K)],[new U,new Z(E)],[Ae],[G]]},{provide:_e,useExisting:Me},{provide:we,deps:[Ae,ve,Re,Ee,Me,G]},{provide:Fe,useClass:Fe,deps:[]},{provide:De,deps:[he,Te,_e,Ae]},{provide:Pe,deps:[Ae,_e,Ie,be,Le,ge,Ee,De,G,[U,Se],ve,[U,Be]]},Xe,{provide:Ne,deps:[Te]},{provide:Oe,deps:[ve]},{provide:Ve,deps:[ve]},{provide:Ae,useValue:new Ae},{provide:z,useClass:Ge,deps:[R,Pe,we,Ne,Oe,Ve,ge,ve,Fe,Ae,G]},{provide:je,deps:[]},{provide:Ee,useExisting:je},{provide:Te,deps:[ee]},{provide:be,deps:[ve]},{provide:Le,deps:[ve]},{provide:Ie,deps:[ve]}],Ue=function(){function t(t){var o={useJit:!0,defaultEncapsulation:_.Emulated,missingTranslation:Q.Warning};this._defaultOptions=e([o],t)}return t.prototype.createCompiler=function(e){void 0===e&&(e=[]);var t,o={useJit:Ze((t=this._defaultOptions.concat(e)).map((function(e){return e.useJit}))),defaultEncapsulation:Ze(t.map((function(e){return e.defaultEncapsulation}))),providers:Ke(t.map((function(e){return e.providers}))),missingTranslation:Ze(t.map((function(e){return e.missingTranslation}))),preserveWhitespaces:Ze(t.map((function(e){return e.preserveWhitespaces})))};return R.create([Qe,{provide:Ae,useFactory:function(){return new Ae({useJit:o.useJit,jitDevMode:te(),defaultEncapsulation:o.defaultEncapsulation,missingTranslation:o.missingTranslation,preserveWhitespaces:o.preserveWhitespaces})},deps:[]},o.providers]).get(z)},t}();function Ze(e){for(var t=e.length-1;t>=0;t--)if(void 0!==e[t])return e[t]}function Ke(t){var o=[];return t.forEach((function(t){return t&&o.push.apply(o,e(t))})),o}
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */var et=oe(se,"coreDynamic",[{provide:re,useValue:{},multi:!0},{provide:ne,useClass:Ue,deps:[re]}]),tt=function(e){function r(){return null!==e&&e.apply(this,arguments)||this}return t(r,e),r.prototype.get=function(e){var t,o,r=new Promise((function(e,r){t=e,o=r})),n=new XMLHttpRequest;return n.open("GET",e,!0),n.responseType="text",n.onload=function(){var r=n.response||n.responseText,s=1223===n.status?204:n.status;0===s&&(s=r?200:0),200<=s&&s<=300?t(r):o("Failed to load "+e)},n.onerror=function(){o("Failed to load "+e)},n.send(),r},r=o([ae()],r)}(he),ot=[Je,{provide:re,useValue:{providers:[{provide:he,useClass:tt,deps:[]}]},multi:!0},{provide:ie,useValue:le}],rt=function(e){function o(){var t=e.call(this)||this;if(t._cache=ue.$templateCache,null==t._cache)throw new Error("CachedResourceLoader: Template cache was not found in $templateCache.");return t}return t(o,e),o.prototype.get=function(e){return this._cache.hasOwnProperty(e)?Promise.resolve(this._cache[e]):Promise.reject("CachedResourceLoader: Did not find cached template for "+e)},o}(he),nt=new pe("8.2.14"),st=[{provide:he,useClass:rt,deps:[]}],at=oe(et,"browserDynamic",ot);export{Ue as JitCompilerFactory,st as RESOURCE_CACHE_PROVIDER,nt as VERSION,at as platformBrowserDynamic,Ge as ɵCompilerImpl,ot as ɵINTERNAL_BROWSER_DYNAMIC_PLATFORM_PROVIDERS,tt as ɵResourceLoaderImpl,rt as ɵangular_packages_platform_browser_dynamic_platform_browser_dynamic_a,et as ɵplatformCoreDynamic};
//# sourceMappingURL=platform-browser-dynamic.js.map
