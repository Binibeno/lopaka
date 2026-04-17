Feature: Project screens sidebar
  As a Lopaka user
  I want multiple screens in one project
  So that I can design several canvases with the same project platform and display settings

  Scenario: Screen list placement
    Given the editor has project file controls in the left sidebar
    Then the screen list appears below the project file controls
    And the layers panel appears below the screen list

  Scenario: Creating screens
    Given the project contains one screen named "Screen 1"
    When the user adds a screen
    Then the project contains a new empty screen named "Screen 2"
    And the new screen uses the same platform and display size as the project

  Scenario: Selecting screens
    Given the project contains multiple screens with different layers
    When the user selects another screen
    Then the editor saves the current screen layers
    And the editor loads the selected screen layers
    And the selected screen preview has an orange border

  Scenario: Renaming screens
    Given the project contains a screen named "Screen 1"
    When the user renames the screen to "Home"
    Then the screen list shows the name "Home"

  Scenario: Screen previews
    Given a screen contains visible layers
    When the screen list is shown
    Then each screen item includes a 32 by 32 pixel preview of that screen
