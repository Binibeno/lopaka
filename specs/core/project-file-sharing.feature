Feature: Project file sharing
  As a Lopaka user
  I want to save and load an editable project file
  So that I can move a complete canvas design between browsers or share it with someone else

  Scenario: Saving the current editor state
    Given the editor contains layers on the current screen
    And the editor offers project file controls above the layers list
    When the user saves a project file
    Then the downloaded file includes the project format version
    And the file includes the current platform
    And the file includes the display size and custom display setting
    And the file includes the current screen layers
    And the file includes code generation and platform display settings

  Scenario: Loading a project file
    Given a valid Lopaka project file is selected
    When the user confirms the load warning
    Then the editor restores the project platform
    And the editor restores the display size and custom display setting
    And the editor restores the current screen layers
    And the editor restores code generation and platform display settings
    And the restored project remains available after a page refresh

  Scenario: Warning before replacing the editor contents
    Given the editor contains an unsaved design
    When the user starts loading a project file
    Then the editor warns that loading will overwrite the current editor contents
    And the user can cancel without changing the current design

  Scenario: Unsupported project file version
    Given a Lopaka project file from an unsupported future version
    When the user tries to load the project file
    Then the editor keeps the current design unchanged
    And the editor reports that the project file version is unsupported
