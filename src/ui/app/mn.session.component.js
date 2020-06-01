import {Component, ChangeDetectionStrategy} from '/ui/web_modules/@angular/core.js';
import {pluck, map, takeUntil} from '/ui/web_modules/rxjs/operators.js';
import {MnPermissions} from '/ui/app/ajs.upgraded.providers.js';
import {MnLifeCycleHooksToStream} from './mn.core.js';
import {MnSecurityService} from './mn.security.service.js';
import {MnFormService} from './mn.form.service.js';
import {MnAdminService} from './mn.admin.service.js';

export {MnSessionComponent};

class MnSessionComponent extends MnLifeCycleHooksToStream {
  static get annotations() { return [
    new Component({
      templateUrl: "/ui/app/mn.session.html",
      changeDetection: ChangeDetectionStrategy.OnPush
    })
  ]}

  static get parameters() { return [
    MnSecurityService,
    MnFormService,
    MnPermissions,
    MnAdminService
  ]}

  constructor(mnSecurityService, mnFormService, mnPermissions, mnAdminService) {
    super();

    this.postSession = mnSecurityService.stream.postSession;

    this.form = mnFormService.create(this);

    this.form
      .setFormGroup({uiSessionTimeout: ""})
      .setUnpackPipe(map(v => ({uiSessionTimeout: (Number(v) / 60) || 0})))
      .setSource(mnAdminService.stream.uiSessionTimeout)
      .setPackPipe(map(this.getValue.bind(this)))
      .setPostRequest(this.postSession)
      .successMessage("Settings saved successfully!")
      .clearErrors();

    this.form.group.disable();

    this.isDisabled =
      mnAdminService.stream.uiSessionTimeout
      .pipe(map(v => mnPermissions.export.cluster.admin.security.write));

    this.isDisabled
      .pipe(takeUntil(this.mnOnDestroy))
      .subscribe(this.maybeDisableField.bind(this));
  }

  maybeDisableField(v) {
    this.form.group[v ? "enable": "disable"]();
  }

  getValue() {
    let timeout = this.form.group.get("uiSessionTimeout").value;
    return {uiSessionTimeout: timeout ? (timeout * 60) : ""};
  }
}
