1. **Add Button HTML**: In `index.html`, locate the HTML where the "Dedupe" button is defined (`btn-dedupe` on line 1034) inside `WheelApp`. Next to it, add a new button "Remove Winners" with class `btn-remove-past-winners` and an appropriate icon (like `users-minus` or `user-minus`).
2. **Select Button in JS**: In the constructor for the `WheelApp`, add `btnRemovePastWinners: wrapper.querySelector(".btn-remove-past-winners")` to `this.dom` (around line 1105).
3. **Add Event Listener**: Add a click listener for `btnRemovePastWinners` in `WheelApp` (around line 1306).
    - It will get the lowercase names from `appState.winners`.
    - It will filter `this.entries` to keep only entries that are not in the winners list.
    - Update `this.rawText`, `this.entries`, and update `entriesInput.value`.
    - Call `this.saveConfig()` and `this.draw()`.
    - Display a toast with the number of removed winners.
4. **Verify Edits**: Use bash to run `grep` and check the added lines in `index.html` to confirm the changes are correct.
5. **Run Frontend Tests**: Run a temporary Playwright script to verify the wheel application visually.
6. **Pre-commit Steps**: Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
7. **Submit**: Submit the change with branch name, commit message, etc.
