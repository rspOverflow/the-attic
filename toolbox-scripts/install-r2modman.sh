#!/bin/bash

# --- Script Configuration ---
FLATPAK_URL="https://github.com/ebkr/r2modmanPlus/releases/download/v3.2.17/r2modman.flatpak"
FILE_NAME="r2modman.flatpak"

echo "Starting installation process..."

# 1. Download r2modman
echo "Downloading r2modman..."
wget "$FLATPAK_URL" -O "$FILE_NAME"

# 2. Install r2modman
echo "Installing r2modman..."
flatpak install --user -y "$FILE_NAME"

# Remove the installation file to save space
rm "$FILE_NAME"

# 3. Remove winhttp override from Proton
# This looks for the Lethal Company prefix (default Steam location)
# and removes the 'winhttp' override which often causes issues with mod loaders.
echo "Cleaning up Proton library overrides..."
PROTON_PREFIX="$HOME/.local/share/Steam/steamapps/compatdata/1966720/pfx/user.reg"

if [ -f "$PROTON_PREFIX" ]; then
    # Removes the winhttp line from the registry file if it exists
    sed -i '/"winhttp"="native,builtin"/d' "$PROTON_PREFIX"
    echo "Successfully updated Proton registry."
else
    echo "Could not find Lethal Company Proton files. Please run the game once in Steam before running this script."
fi

echo "--------------------------------------------------------"
echo "INSTALLATION COMPLETE"
echo "--------------------------------------------------------"
echo "Please follow these manual steps to finish setup:"
echo ""
echo "1) Open your application menu and launch 'r2modman'."
echo "2) In r2modman, search for 'Lethal Company' and click 'Select game'."
echo "   (Do NOT click 'Set as default')."
echo "3) If r2modman asks you to modify your Steam launch options, please IGNORE/SKIP that request."
echo "4) Once inside the profile, search for and install 'MoreCompany' in the 'Online' tab."
echo "--------------------------------------------------------"
