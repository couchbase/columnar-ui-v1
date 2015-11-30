(function () {
  "use strict";

  angular
    .module("mnViews")
    .controller("mnViewsEditingController", mnViewsEditingController);

  function mnViewsEditingController($scope, $state, $uibModal, mnPoolDefault, mnHelper, mnViewsEditingService, mnViewsListService, mnPromiseHelper) {
    var vm = this;
    var viewsOptions = {
      lineNumbers: true,
      matchBrackets: true,
      tabSize: 2,
      mode: {
        name: "javascript",
        json: true
      },
      theme: 'default',
      readOnly: false
    };
    vm.viewsOptions = viewsOptions;
    vm.isSpatial = $state.params.isSpatial;
    vm.viewId = $state.params.viewId;
    vm.previewRandomDocument = previewRandomDocument;
    vm.awaitingSampleDocument = awaitingSampleDocument;
    vm.awaitingViews = awaitingViews;
    vm.goToDocumentsSection = goToDocumentsSection;
    vm.isEditDocumentDisabled = isEditDocumentDisabled;
    vm.toggleSampleDocument = toggleSampleDocument;
    vm.isViewsEditorControllsDisabled = isViewsEditorControllsDisabled;
    vm.isPreviewRandomDisabled = isPreviewRandomDisabled;
    vm.onSelectViewName = onSelectViewName;
    vm.toggleViews = toggleViews;
    vm.saveAs = saveAs;
    vm.save = save;
    vm.mnPoolDefault = mnPoolDefault.latestValue();
    vm.isFilterOpened = false;

    if (vm.mnPoolDefault.value.isROAdminCreds) {
      return;
    }

    activate();

    function goToDocumentsSection(e) {
      e.stopImmediatePropagation();
      $state.go("app.admin.documents.editing", {
        documentId: vm.state.sampleDocument.meta.id,
        documentsBucket: $state.params.viewsBucket
      });
    }
    function toggleSampleDocument() {
      vm.isSampleDocumentClosed = !vm.isSampleDocumentClosed;
    }
    function toggleViews() {
      vm.isViewsClosed = !vm.isViewsClosed;
    }
    function isEditDocumentDisabled() {
      return awaitingSampleDocument() || !vm.state.sampleDocument || vm.state.isEmptyState;
    }
    function isPreviewRandomDisabled() {
      return awaitingSampleDocument() || vm.state.isEmptyState;
    }
    function isViewsEditorControllsDisabled() {
      return awaitingViews() || vm.state.isEmptyState || !vm.state.isDevelopmentDocument;
    }
    function awaitingSampleDocument() {
      return !vm.state || vm.state.sampleDocumentLoading;
    }
    function awaitingViews() {
      return !vm.state || vm.state.viewsLoading;
    }
    function isViewPathTheSame(current, selected) {
      return current.viewId === selected.viewId && current.isSpatial === selected.isSpatial && current.documentId === selected.documentId;
    }
    function previewRandomDocument(e) {
      e && e.stopImmediatePropagation && e.stopImmediatePropagation();
      mnPromiseHelper(vm.state, mnViewsEditingService.prepareRandomDocument($state.params))
        .showSpinner("sampleDocumentLoading")
        .applyToScope("sampleDocument")
        .cancelOnScopeDestroy($scope);
    }
    function saveAs(e) {
      e.stopImmediatePropagation();
      $uibModal.open({
        controller: 'mnViewsCreateDialogController as viewsCreateDialogCtl',
        templateUrl: 'app/mn_admin/mn_views/create_dialog/mn_views_create_dialog.html',
        scope: $scope,
        resolve: {
          currentDdoc: mnHelper.wrapInFunction(vm.state.currentDocument.doc),
          viewType: mnHelper.wrapInFunction($state.params.isSpatial ? "spatial" : "views")
        }
      }).result.then(function (vm) {
        var selected = {
          documentId: '_design/dev_' + vm.ddoc.name,
          isSpatial: vm.isSpatial,
          viewId: vm.ddoc.view
        };
        if (!isViewPathTheSame($state.params, selected)) {
          $state.go('app.admin.views.editing.result', {
            viewId: selected.viewId,
            documentId: selected.documentId
          });
        }
      });
    }
    function save(e) {
      e.stopImmediatePropagation();
      var url = mnViewsListService.getDdocUrl($state.params.viewsBucket, vm.state.currentDocument.doc.meta.id)
      mnPromiseHelper(vm.state, mnViewsListService.createDdoc(url, vm.state.currentDocument.doc.json))
        .catchErrors("viewsError")
        .showSpinner("viewsLoading")
        .cancelOnScopeDestroy($scope)
        .reloadState();
    }
    function onSelectViewName(selected) {
      $state.go('app.admin.views.editing.result', {
        viewId: selected.viewId,
        isSpatial: selected.isSpatial,
        documentId: selected.documentId
      });
    }

    function activate() {
      $scope.$watch(isViewsEditorControllsDisabled, function (isDisabled) {
        viewsOptions.readOnly = isDisabled ? 'nocursor' : false;
        viewsOptions.matchBrackets = !isDisabled;
        vm.viewsOptions = viewsOptions;
      });
      return mnPromiseHelper(vm, mnViewsEditingService.getViewsEditingState($state.params))
        .applyToScope("state")
        .cancelOnScopeDestroy($scope);
    }
  }
})();
