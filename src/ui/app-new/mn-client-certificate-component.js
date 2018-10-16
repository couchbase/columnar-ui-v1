var mn = mn || {};
mn.components = mn.components || {};
mn.components.MnClientCertificate =
  (function (Rx) {
    "use strict";

    mn.core.extend(MnClientCertificate, mn.core.MnEventableComponent);

    MnClientCertificate.annotations = [
      new ng.core.Component({
        templateUrl: "app-new/mn-client-certificate.html",
        changeDetection: ng.core.ChangeDetectionStrategy.OnPush
      })
    ];

    MnClientCertificate.parameters = [
      mn.services.MnForm,
      mn.services.MnSecurity,
      mn.services.MnPermissions,
      mn.services.MnAlerts,
      mn.services.MnAdmin
    ];

    MnClientCertificate.prototype.setInitialValue = setInitialValue;
    MnClientCertificate.prototype.getValue = getValue;
    MnClientCertificate.prototype.addItem = addItem;
    MnClientCertificate.prototype.removeField = removeField;

    return MnClientCertificate;

    function MnClientCertificate(mnFormService, mnSecurityService, mnPermissionsService, mnAlertsService, mnAdminService) {
      mn.core.MnEventableComponent.call(this);

      this.securityWrite = mnPermissionsService.createPermissionStream("admin.security!write");
      this.atLeast50 = mnAdminService.stream.compatVersion.pipe(Rx.operators.pluck("atLeast50"));
      this.atLeast51 = mnAdminService.stream.compatVersion.pipe(Rx.operators.pluck("atLeast51"));

      var getValue = Rx.pipe(Rx.operators.withLatestFrom(this.atLeast50, this.atLeast51),
                             Rx.operators.map(this.getValue.bind(this)));

      this.form = mnFormService.create(this);

      this.form
        .setFormGroup({state: false, prefixes: this.form.builder.array([])})
        .submittable(mnSecurityService.stream.postClientCertAuth, getValue)
        .clearErrors()
        .message("Settings saved successfully!");

      var initData = mnSecurityService.stream.getClientCertAuth.pipe(Rx.operators.first());
      var formValues = Rx.merge(this.form.group.valueChanges, initData);

      this.isErrorString =
        this.form.postRequest.error.pipe(Rx.operators.map(R.is(String)));
      this.isStateDisabled =
        formValues.pipe(Rx.operators.map(R.pipe(R.path(["state"]), R.equals("disable"))));
      this.isLastPrefix =
        formValues.pipe(Rx.operators.map(R.pipe(R.path(["prefixes", "length"]), R.equals(1))));

      this.securityWrite
        .pipe(Rx.operators.takeUntil(this.mnOnDestroy))
        .subscribe(R.pipe(R.not, this.form.disableFields("state")));

      this.maybeDisableControls =
        Rx.combineLatest(this.isStateDisabled, this.securityWrite)
        .pipe(Rx.operators.map(R.pipe(R.equals([false, true]), R.not)));

      this.maybeDisableControls
        .pipe(Rx.operators.takeUntil(this.mnOnDestroy))
        .subscribe(this.form.disableFields("prefixes"));

      initData.subscribe(this.setInitialValue.bind(this));
    }

    function removeField() {
      var last = this.form.group.get('prefixes').length - 1;
      this.form.group.get('prefixes').removeAt(last);
    }

    function addItem(value) {
      this.form.group.get("prefixes").push(this.form.builder.group(value));
    }

    function getValue(value) {
      var state =  this.form.group.get("state");
      var prefixes = this.form.group.get("prefixes");
      if (!value[1] && value[0]) {
        return [{
          state: state.value,
          path: prefixes.value[0].path,
          prefix: prefixes.value[0].prefix,
          delimiter: prefixes.value[0].delimiter,
        }, value[1]];
      } else {
        return [{
          state: state.value,
          prefixes: prefixes.value
        }, value[1]];
      }
    }

    function setInitialValue(value) {
      if (value.prefixes.length) {
        value.prefixes.forEach(this.addItem.bind(this));
      } else {
        this.addItem({delimiter: '', prefix: '', path: 'subject.cn'});
      }
      this.form.group.get("state").patchValue(value.state);
    }

  })(window.rxjs);
