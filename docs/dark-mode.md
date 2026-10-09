# Platform dark palette

The dark theme uses charcoal surfaces with restrained indigo accents. The background (#12161c), cards (#1c232d), and sidebar (#0e131a) remain distinct. Main text is off-white (#e4e9f1); secondary text is slate (#a9b5c6). Indigo (#a5b4fc) identifies actions and active navigation; green identifies success/live AI, amber warnings, and rose errors. Text labels accompany status colours.

Shared tokens are defined in `web/app/globals.css`. Component dark variants keep existing light backgrounds and status text from appearing as bright panels or unreadable labels in dark mode. Native inputs follow the active colour scheme. Theme selection is shared across routes and stored locally through next-themes.

Verification: TypeScript passed; research, dashboard and login returned HTTP 200. Calculated contrast for the nine shared foreground/background pairs checked ranged from 6.34:1 to 14.88:1, exceeding 4.5:1 for those specific pairs. This is not a whole-interface accessibility certification: transparency, hover states and other utility colours were not covered by that calculation. Signed-in visual inspection remains pending because the browser tool could not initialize.
