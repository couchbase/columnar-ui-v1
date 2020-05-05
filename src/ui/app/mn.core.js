import { BehaviorSubject, Subject } from '/ui/web_modules/rxjs.js';
import { distinctUntilChanged, withLatestFrom, takeUntil,
         map, pluck } from '/ui/web_modules/rxjs/operators.js';

export { MnLifeCycleHooksToStream, DetailsHashObserver };

let componentLifecycleHooks = [
  "OnChanges",
  "OnInit",
  "DoCheck",
  "AfterContentInit",
  "AfterContentChecked",
  "AfterViewInit",
  "AfterViewChecked",
  "OnDestroy"
];

class MnLifeCycleHooksToStream {
  constructor() {
    componentLifecycleHooks.forEach((name) => {
      //OnChanges triggers before OnInit, so we should keep current value
      this["mn" + name] = (name === "OnChanges") ? new BehaviorSubject() : new Subject();
    });
  }
}

componentLifecycleHooks.forEach(function (name) {
  if (name === "OnDestroy") {
    MnLifeCycleHooksToStream.prototype["ng" + name] = function (value) {
      this["mn" + name].next();
      this["mn" + name].complete(value);
    }
  } else {
    MnLifeCycleHooksToStream.prototype["ng" + name] = function (value) {
      this["mn" + name].next(value);
    }
  }
});

class DetailsHashObserver {
  constructor(uiRouter, component, paramKey, paramValue) {
    this.uiRouter = uiRouter;
    this.component = component;
    this.paramKey = paramKey;
    this.paramValue = paramValue;

    this.stream = {};
    this.stream.toggleDetails = new Subject();

    this.stream.openedDetailsHash = this.uiRouter.globals.params$
      .pipe(pluck(this.paramKey),
            distinctUntilChanged(),
            map(this.prepareHashValue.bind(this)));

    this.stream.isOpened = this.stream.openedDetailsHash
      .pipe(map(this.isOpened.bind(this)));

    this.stream.newHashValue = this.stream.toggleDetails
      .pipe(withLatestFrom(this.stream.openedDetailsHash),
            map(this.getNewHashValue.bind(this)));

    this.stream.newHashValue
      .pipe(takeUntil(this.component.mnOnDestroy))
      .subscribe(this.setNewHashValue.bind(this));
  }

  setNewHashValue(newHashValue) {
    var stateParams = {};
    stateParams[this.paramKey] = newHashValue;
    this.uiRouter.stateService.go('.', stateParams, {notify: false});
  }

  prepareHashValue(v) {
    return (v || []).map(decodeURIComponent);
  }

  getNewHashValue([toggleValue, values]) {
    values = [...values];
    if (this.isOpened(values)) {
      values.splice(values.indexOf(toggleValue), 1);
    } else {
      values.push(toggleValue);
    }
    return values;
  }

  isOpened(values) {
    return values.indexOf(this.paramValue) > -1;
  }
}
