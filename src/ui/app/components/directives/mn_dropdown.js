import angular from "/ui/web_modules/angular.js";

export default "mnDropdown";

angular
  .module('mnDropdown', [])
  .directive('mnDropdown', mnDropdownDirective)
  .directive('mnDropdownItem', mnDropdownItemDirective)

function mnDropdownItemDirective() {
  var mnDropdownItem ={
    require: '^^mnDropdown',
    restrict: 'E',
    scope: {
      mnItem: '='
    },
    link: link
  };

  return mnDropdownItem;

  function link(scope, element, attrs, mnDropdownCtl) {
    element.on("mousedown", onMousedown);
    element.on("click", onItemClick);
    element.on("mouseup", onMouseup);

    scope.$on("$destroy", function () {
      element.off("mousedown", onMousedown);
      element.off("mouseup", onMouseup);
      element.off("click", onItemClick);
    });

    function onItemClick() {
      mnDropdownCtl.onItemClick(scope.mnItem);
    }

    function onMousedown() {
      element.addClass("mousedowm");
    }

    function onMouseup() {
      element.removeClass("mousedowm");
    }

  }
}
function mnDropdownDirective() {
  var mnDropdown = {
    restrict: 'E',
    scope: {
      model: "=?",
      onClose: "&?",
      onSelect: "&?",
      iconClass: "@?"
    },
    transclude: {
      'select': '?innerSelect',
      'header': '?innerHeader',
      'body': 'innerBody',
      'footer': '?innerFooter'
    },
    templateUrl: "app/components/directives/mn_dropdown.html",
    controller: controller
  };

  return mnDropdown;

  function controller($scope, $transclude) {
    $scope.isSlotFilled = $transclude.isSlotFilled;
    this.onItemClick = onItemClick;

    function onItemClick(item) {
      $scope.model && ($scope.model = item);
      $scope.onSelect && $scope.onSelect({scenarioId: item});
    }
  }
}
