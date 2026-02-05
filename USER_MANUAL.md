# Airdrop Tracker - User Manual

## Overview
Airdrop Tracker is a web-based application designed to help you organize, manage, and track cryptocurrency airdrop opportunities. It provides powerful filtering, searching, and data management features to keep all your airdrop information in one place.

---

## Table of Contents
1. [Getting Started](#getting-started)
2. [Main Interface](#main-interface)
3. [Adding Airdrops](#adding-airdrops)
4. [Searching & Filtering](#searching--filtering)
5. [Managing Select Options](#managing-select-options)
6. [Data Management](#data-management)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Mobile Usage](#mobile-usage)
9. [Data Storage & Privacy](#data-storage--privacy)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Initial Setup
1. Open the application in your web browser
2. The app loads with no data initially
3. Click **"Add Airdrop"** button to start adding your first airdrop

### First Time Use
- All data is stored locally in your browser (no cloud uploads)
- No login or account required
- Data persists for 1 year from last save

---

## Main Interface

### Header Section
The top section contains all primary controls:

- **Search Bar** – Find airdrops by name or code (live search)
- **Filter Dropdowns** – Quick filters for Task Type, Connect Type, and Status
- **Remove Filters Button** (×) – Clears all active filters instantly
- **Add Airdrop Button** – Opens form to add new airdrop
- **Manage Options Button** (⚙️) – Customize dropdown options
- **Delete All Button** (🗑️) – Deletes all airdrops (with confirmation)
- **Export/Import Buttons** – Backup and restore your data (includes custom select options)
- **Tabs** – Switch between "All" and "New Tasks" views
- **Pagination** – Navigate between pages

### Main Table
Displays all airdrops in a detailed table with columns:
- **Name** – Airdrop project name with star icon for favorites
- **Task Type** – Task badge (Daily, Time based, Quest, Whitelist, Retro, Galxe)
- **Connect Type** – Connect method or platform (EVM, Gmail, Google, SOL, Discord, X)
- **Updated Status** – Current status and date
- **Reward Type** – Reward category (Airdrop, Ambassador, XP, Point, NFT)
- **Raise/Funds** – Fundraising amount and investor count
- **Actions** – Edit and Delete buttons per row

---

## Adding Airdrops

### Opening the Add Form
1. Click **"Add Airdrop"** button in the header
2. A modal form will appear with all input fields

### Form Fields Explanation

| Field | Type | Notes |
|-------|------|-------|
| **Name** | Text (Required) | Airdrop project name (e.g., "Infinex") |
| **Code** | Text (Optional) | Ticker/code (e.g., "INX") |
| **Link** | URL (Optional) | Project website or airdrop page |
| **Task Type** | Dropdown | Task category (Daily, Time based, Quest, Whitelist, Retro, Galxe) |
| **No Active Tasks** | Checkbox | Check if project has no ongoing tasks |
| **New Badge** | Checkbox | Mark as newly added |
| **Connect Type** | Dropdown | How users connect/interact (EVM, Gmail, Google, SOL, Discord, X) |
| **Cost ($)** | Number | How much the task costs in USD |
| **Time (min)** | Number | How long the task takes (minutes) |
| **Status** | Dropdown | Reward Available, Potential, or Confirmed |
| **Status Date** | Text | When the status was updated (e.g., "31 Jan 2026") |
| **Reward Type** | Dropdown | Airdrop, Ambassador, or special reward types (XP, Point, NFT) |
| **Raise Amount** | Text | Fundraising amount (e.g., "72.49M") |
| **Raise Count** | Number | Number of investors |

### Saving an Airdrop
1. Fill in at least the **Name** field (required)
2. Click **"Save Airdrop"** button at bottom
3. If "Name" already exists, you'll see an inline error
4. Success: New airdrop appears in the table

### Editing an Airdrop
1. Click **Edit** (✎️) button next to the airdrop in the table
2. Form opens with current values pre-filled
3. Modify any fields
4. Click **"Save Airdrop"** to save changes
5. The modal title changes to "Edit Airdrop" to indicate edit mode

---

## Searching & Filtering

### Quick Search
- Type in the **Search** box to filter by airdrop name or code
- Results update **instantly** as you type
- Case-insensitive matching

### Quick Filters (Header Dropdowns)
1. **Task Filter** – Show only airdrops with selected task type
2. **Task Type Filter** – Show only specific task categories
3. **Status Filter** – Show by reward status

### Removing All Filters
- Click the **× Remove Filters** button to clear all active filters at once
- All dropdowns reset and table shows all airdrops again

### Advanced Modal Filters (Not Currently Used)
- Click the filter icon to open advanced modal filters
- Select multiple options for complex filtering
- Click "Apply" to apply or "Reset All Filters" to clear

---

## Managing Select Options

### Why Customize Options?
Add, remove, or modify the dropdown options for Task, Task Type, Status, and Reward Type fields to match your specific needs.

### How to Access
1. Click the **"Options"** button (⚙️) in the header
2. **"Manage Select Options"** modal opens

### Step-by-Step Guide

#### 1. Select a Field
- Choose from dropdown: Task, Task Type, Status, or Reward Type

#### 2. View Current Options
- All current options for that field are listed
- Shows both display text and value (in parentheses)

#### 3. Remove an Option
- Click the **🗑️ Delete** button next to any option
- Option is removed from the list immediately

#### 4. Add a New Option
- Enter **Value** (internal identifier, e.g., "bond-staking")
- Enter **Display Text** (what users see, e.g., "Bond Staking")
- Click **"+ Add Option"** button
- New option appears in the list and in the form/filters

#### 5. Save Changes
- Click **"Save Changes"** button at bottom
- Modal closes and all filter dropdowns update automatically
- Changes are saved to local storage (persist after refresh)

### Example: Adding a Custom Task Type
1. Click Options button
2. Select "Task Type" from dropdown
3. Click in "Value" field → type: `defi-governance`
4. Click in "Display Text" field → type: `DeFi Governance`
5. Click "Add Option"
6. Click "Save Changes"
7. New "DeFi Governance" option now appears in all Task Type dropdowns

---

## Data Management

### Exporting Your Data
1. Click **"Export"** button in header
2. Browser automatically downloads a JSON file
3. Filename: `airdrop-data-YYYY-MM-DD.json`
4. Use this to backup your data

### Importing Data
1. Click **"Import"** button in header
2. Select a previously exported JSON file
3. Data is imported and merged into the app
4. Table refreshes with imported airdrops

### Deleting an Airdrop
1. Click **Delete** (🗑️) button next to airdrop in table
2. Confirmation modal appears
3. Click **"Delete"** to confirm deletion
4. Airdrop is removed permanently

### Deleting All Airdrops
1. Click **"Delete All"** button (red button in header)
2. Confirmation modal appears asking to confirm
3. Click **"Delete All"** to permanently delete all airdrops
4. ⚠️ **This cannot be undone** – export first if unsure!

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Esc** | Close any open modal (Add/Edit form, Filters, etc.) |
| **(Coming Soon)** | Additional shortcuts to be added |

---

## Mobile Usage

### Responsive Design
- App automatically adjusts for phones and tablets
- On screens below 600px: Buttons stack vertically
- On screens below 480px: Buttons become icon-only circles to save space

### Mobile Navigation
- Use full-screen modals for easy input on small screens
- Swipe/scroll horizontally on table for narrow columns
- All features work identically to desktop

### Tips for Mobile
- Use landscape orientation for better table visibility
- Export data before major changes
- Use mobile browser's back button carefully (use app's Cancel instead)

---

## Data Storage & Privacy

### Where Is My Data Stored?
- All data stored **locally** in your browser's localStorage
- No data sent to servers
- No cloud sync, no accounts, no tracking

### Data Persistence
- Data automatically saves when you add/edit/delete airdrops
- Data persists even if you close the browser
- **Data expires 1 year** after last save if you don't open the app

### Clearing Data
- Clear browser cache to delete all app data
- Or use **"Delete All"** button in the app
- Export data first if you want to keep a backup

### Switching Browsers/Devices
- Data is **device and browser-specific**
- To move data: Export from old device, Import on new device

---

## Troubleshooting

### "Already Added" Error
**Problem:** Can't save an airdrop with a name that exists  
**Solution:** Either:
- Edit the existing airdrop instead of adding a new one
- Use a different name for the new airdrop
- Names are case-insensitive (e.g., "Infinex" = "infinex")

### Data Disappeared After Refresh
**Problem:** App shows no airdrops after refreshing  
**Possible Causes:**
- Data expired (more than 1 year since last save)
- Browser cache was cleared
- Switched to a different browser/device

**Solution:**
- Check if you have a backup JSON file to import
- Manually re-add the data

### Dropdown Options Didn't Update
**Problem:** New options I added aren't showing in filters  
**Solution:**
- Make sure you clicked **"Save Changes"** in the Options modal
- Try refreshing the page
- Clear browser cache and reload

### Table Doesn't Show New Airdrop
**Problem:** Added an airdrop but it's not visible in table  
**Possible Causes:**
- Filters are active and hiding the new airdrop
- Search box has text filtering it out

**Solution:**
- Click **"Remove Filters"** button
- Clear the search box
- Check if airdrop was actually saved (look for success message)

### Can't Import JSON File
**Problem:** "Invalid JSON file" error when importing  
**Solution:**
- Make sure the file was exported from this app
- Don't edit the JSON file manually
- Ensure file is a valid JSON format
- Try a different exported file

### Lost All My Data (Accidental Delete)
**Problem:** Clicked "Delete All" by mistake  
**Recovery Options:**
- If you have an exported JSON backup, click Import
- Otherwise, data cannot be recovered (stored locally, no cloud backup)
- **Lesson:** Always export data regularly as backup!

---

## Tips & Best Practices

1. **Regular Backups** – Export your data weekly to ensure no loss
2. **Use Favorites** – Click the star (⭐) next to airdrops you're interested in
3. **Custom Options** – Tailor dropdown options to your workflow
4. **Status Updates** – Keep "Updated Status" field current for better tracking
5. **Task Descriptions** – Write detailed task descriptions for future reference
6. **Mobile View** – Test the app on your phone to understand responsive design

---

## Version Info
- **Application:** Airdrop Tracker v1.0
- **Last Updated:** February 6, 2026
- **Browser Compatibility:** Chrome, Firefox, Safari, Edge (Modern versions)

---

## Support & Feedback
This is a standalone web app with no external support system. For issues:
1. Clear browser cache and reload
2. Export data before trying advanced troubleshooting
3. Check Troubleshooting section above

---

## License & Credits
Built with vanilla JavaScript, HTML5, and CSS3.  
Icons from Font Awesome 6.5.1

---

**Happy tracking! 🚀**
