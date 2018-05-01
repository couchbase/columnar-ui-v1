var mn = mn || {};
mn.components = mn.components || {};
mn.components.MnTermsAndConditions =
  (function () {
    "use strict";

    mn.helper.extends(MnTermsAndConditions, mn.helper.MnEventableComponent);

    MnTermsAndConditions.annotations = [
      new ng.core.Component({
        templateUrl: "app-new/wizard/mn-terms-and-conditions.html"
      })
    ];

    MnTermsAndConditions.parameters = [
      mn.services.MnWizard,
      mn.services.MnPools,
      mn.services.MnApp,
      mn.services.MnAuth,
      window['@uirouter/angular'].UIRouter
    ];

    return MnTermsAndConditions;

    function MnTermsAndConditions(mnWizardService, mnPoolsService, mnAppService, mnAuthService, uiRouter) {
      mn.helper.MnEventableComponent.call(this);

      this.focusField = true;
      this.onSubmit = new Rx.Subject();
      this.onFinishWithDefaut = new Rx.Subject();

      this.submitted = this.onSubmit.merge(this.onFinishWithDefaut).mapTo(true);
      this.uiRouter = uiRouter;
      this.isEnterprise = mnPoolsService.stream.isEnterprise;
      this.wizardForm = mnWizardService.wizardForm;
      this.initialValues = mnWizardService.initialValues;

      this.termsForm = mnWizardService.wizardForm.termsAndConditions;
      this.termsForm.get("agree").setValue(false);

      this.groupHttp = mnWizardService.stream.groupHttp;
      this.secondGroupHttp = mnWizardService.stream.secondGroupHttp;
      this.servicesHttp = mnWizardService.stream.servicesHttp;

      this.mnAppLoding = mnAppService.stream.loading;

      this.license = mnPoolsService.stream.isEnterprise.switchMap(getLicense);
      this.termsHref = mnPoolsService.stream.isEnterprise.map(getTermsAndCond);

      this.groupHttp
        .loading
        .merge(this.secondGroupHttp.loading)
        .takeUntil(this.mnOnDestroy)
        .subscribe(this.mnAppLoding.next.bind(this.mnAppLoding));

      this.groupHttp
        .success
        .map(getSecondValues.bind(this))
        .takeUntil(this.mnOnDestroy)
        .subscribe(this.secondGroupHttp.post.bind(this.secondGroupHttp));

      this.secondGroupHttp
        .success
        .takeUntil(this.mnOnDestroy)
        .subscribe(function () {
          mnAuthService.stream.loginHttp.post(mnWizardService.getUserCreds());
        });

      mnAuthService.stream.loginHttp
        .success
        .takeUntil(this.mnOnDestroy)
        .subscribe(function () {
          uiRouter.urlRouter.sync();
        });

      this.onSubmit
        .filter(isValid.bind(this))
        .takeUntil(this.mnOnDestroy)
        .subscribe(onSuccess);

      this.onFinishWithDefaut
        .do(this.groupHttp.clearErrors.bind(this.groupHttp))
        .filter(isValid.bind(this))
        .filter(isNotLoading.bind(this))
        .withLatestFrom(mnPoolsService.stream.isEnterprise)
        .map(getValues.bind(this))
        .takeUntil(this.mnOnDestroy)
        .subscribe(this.groupHttp.post.bind(this.groupHttp));

      function onSuccess() {
        uiRouter.stateService.go('app.wizard.newClusterConfig', null, {location: false});
      }

      function isValid() {
        return !this.termsForm.invalid;
      }

      function isNotLoading() {
        return !this.mnAppLoding.getValue();
      }

      function getLicense(isEnterprise) {
        return isEnterprise ? mnWizardService.getEELicense() : mnWizardService.getCELicense();
      }

      function getTermsAndCond(isEnterprise) {
        return isEnterprise ?
          'https://www.couchbase.com/ESLA05242016' :
          'https://www.couchbase.com/community';
      }

      function getSecondValues() {
        return {
          indexesHttp: {
            storageMode: mnWizardService.initialValues.storageMode
          },
          authHttp: [mnWizardService.wizardForm.newCluster.value.user, false]
        };
      }

      function getValues(isEnterprise) {
        return {
          poolsDefaultHttp: [{
            clusterName: this.wizardForm.newCluster.get("clusterName").value
          }, false],
          servicesHttp: {
            services: 'kv,index,fts,n1ql' + (isEnterprise[1] ? ',eventing' : ''),
            setDefaultMemQuotas : true
          },
          diskStorageHttp: this.initialValues.clusterStorage,
          hostnameHttp: this.initialValues.hostname,
          statsHttp: true
        };
      }

    }
  })();
