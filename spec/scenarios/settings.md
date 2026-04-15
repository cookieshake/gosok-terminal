# Settings Scenarios

### [SC.SET.1] Settings CRUD

**scenarios**:

#### [Web UI] View all settings

- **Given** The user opens the settings view in the Web UI
- **When** The settings page loads
- **Then** All current settings are displayed with their values

#### [CLI] List all settings

- **Given** Settings exist
- **When** The user runs `gosok setting list`
- **Then** The CLI outputs all settings with their keys and values

#### [Web UI] View a specific setting

- **Given** Setting "font_size" is set to 14
- **When** The user views the font size option in settings
- **Then** The value 14 is displayed

#### [CLI] Get a specific setting

- **Given** Setting "font_size" is set to 14
- **When** The user runs `gosok setting get font_size`
- **Then** The CLI outputs the key "font_size" and value 14

#### [CLI] Get a setting with default fallback

- **Given** Setting "font_size" has no user override but has a default value
- **When** The user runs `gosok setting get font_size`
- **Then** The CLI outputs the default value

#### [Web UI] Change a setting

- **Given** The user is on the settings page
- **When** The user changes the font size to 16 and saves
- **Then** The setting is updated and the change takes effect in the UI (e.g., terminal text size changes)

#### [CLI] Set a setting

- **When** The user runs `gosok setting set font_size 16`
- **Then** The CLI confirms the setting was updated

#### [Web UI] Reset a setting to default

- **Given** The user has overridden the "font_size" setting
- **When** The user clicks "Reset to default" for font size in the settings view
- **Then** The font size reverts to its default value

#### [CLI] Delete a setting (reset to default)

- **Given** Setting "font_size" has a user override
- **When** The user runs `gosok setting delete font_size`
- **Then** The CLI confirms the setting was reset, and subsequent `gosok setting get font_size` returns the default value

**refs**:
- SET.1

---

### [SC.SET.2] Default Settings

**scenarios**:

#### Defaults seeded on first run

- **Given** The user launches gosok for the first time with a fresh database
- **When** The server starts
- **Then** Default settings (including shortcuts) are automatically populated and visible in the settings view

#### Default restored after delete

- **Given** The user has overridden the default "shortcuts" setting
- **When** The user resets the setting to default (via Web UI reset button or `gosok setting delete shortcuts`)
- **Then** The original default value is restored and displayed on subsequent reads

**refs**:
- SET.2
