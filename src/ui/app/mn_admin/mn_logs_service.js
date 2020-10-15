import angular from "/ui/web_modules/angular.js";
import uiBootstrap from "/ui/web_modules/angular-ui-bootstrap.js";
import ngClipboard from "/ui/libs/ngclipboard.js";

export default "mnLogsService";

angular
  .module('mnLogsService', [uiBootstrap, ngClipboard])
  .service('mnLogsService', mnLogsServiceFactory);

function mnLogsServiceFactory($http, $rootScope, $uibModal) {
  var mnLogsService = {
    getLogs: getLogs,
    showClusterInfoDialog: showClusterInfoDialog
  };

  return mnLogsService;


  function getLogs() {
    return $http.get('/logs');
  }

  function getClusterInfo() {
    return $http.get('/pools/default/terseClusterInfo?all=true');
  }

  function showClusterInfoDialog() {
    return getClusterInfo().then(function (resp) {
      var scope = $rootScope.$new();
      scope.info = JSON.stringify(resp.data, null, 2);
      return $uibModal.open({
        templateUrl: 'app/mn_admin/mn_cluster_info_dialog.html',
        scope: scope
      });
    });
  }
}
